import { Router, Request, Response } from 'express';
import { authenticate, requireCompany } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2:1b';
const OLLAMA_TIMEOUT_MS = 20_000;

const SYSTEM_PROMPT =
  'Tu es un expert analyste de crédit bancaire (15 ans expérience, institutions financières Afrique de l\'Ouest, FCFA/SYSCOHADA). ' +
  'Règle absolue : réponds en 2 à 3 phrases courtes et professionnelles en français. ' +
  'Interprète les données dans le contexte bancaire (taux d\'approbation, délais, portefeuille, risques). ' +
  'Identifie les points positifs et les signaux d\'alerte. Propose une action concrète si nécessaire. ' +
  'Ne répète jamais les données brutes. Commence directement par l\'analyse, sans formule de politesse.';

// ── Ollama integration ─────────────────────────────────────────────────────────

async function callOllama(prompt: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), OLLAMA_TIMEOUT_MS);

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        system: SYSTEM_PROMPT,
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 220, top_p: 0.9, repeat_penalty: 1.1 },
      }),
    });

    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { response?: string };
    return json.response?.trim() || null;
  } catch {
    return null;
  }
}

// ── Expert fallback templates ──────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const fmtInt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
function pct(v: number, total: number): string { return total ? `${fmt.format((v / total) * 100)}%` : '—'; }
function amtShort(v: number): string {
  if (v >= 1e9) return `${fmt.format(v / 1e9)} Mds FCFA`;
  if (v >= 1e6) return `${fmt.format(v / 1e6)} M FCFA`;
  if (v >= 1e3) return `${fmt.format(v / 1e3)} K FCFA`;
  return `${fmtInt.format(v)} FCFA`;
}

function expertKpi(data: any, config: any): string {
  const metric = config?.metric ?? 'count';
  const rows = data.rows ?? [];
  const v = Number(data.value ?? (rows.length === 1 ? (rows[0]?.value ?? rows[0]?.count ?? 0) : null) ?? 0);

  if (metric === 'approval_rate') {
    if (v >= 75) return `Taux d'approbation de ${fmt.format(v)}% — conforme aux standards UEMOA (≥ 75%). Bonne qualité du portefeuille entrant.`;
    if (v >= 55) return `Taux d'approbation de ${fmt.format(v)}% en deçà de l'objectif (75%). Analyser les motifs de rejet pour identifier les axes d'amélioration.`;
    return `Taux d'approbation critique : ${fmt.format(v)}%. Risque opérationnel élevé — revue immédiate du processus d'instruction recommandée.`;
  }
  if (metric === 'avg_processing_time') {
    const target = Number(config?.targetDays ?? 5);
    if (v <= target) return `Délai moyen de ${fmt.format(v)} j — objectif respecté (≤ ${target} j). Efficacité opérationnelle satisfaisante.`;
    if (v <= target * 2) return `Délai moyen de ${fmt.format(v)} j dépasse la cible (${target} j). Identifier les étapes bloquantes dans le circuit d'instruction.`;
    return `Délai critique : ${fmt.format(v)} j soit ${fmt.format(v / target)}× la cible. Audit du circuit d'approbation urgent pour éviter la perte de clients.`;
  }
  if (metric === 'sum_amount') {
    return `Volume engagé : ${amtShort(v)} sur la période. À rapprocher des plafonds d'engagement et limites sectorielles pour évaluer l'exposition au risque.`;
  }
  if (metric === 'count') {
    return `${fmtInt.format(v)} dossier${v > 1 ? 's' : ''} sur la période. Comparer à la capacité des équipes et aux objectifs commerciaux pour mesurer la tension opérationnelle.`;
  }
  return rows.length > 1
    ? `Répartition sur ${rows.length} catégories. Analyser la concentration et les écarts par rapport aux objectifs pour prioriser les actions.`
    : `Valeur : ${fmt.format(v)}. Évaluer par rapport aux objectifs et à l'historique pour qualifier la performance.`;
}

function expertBar(data: any, config: any): string {
  const rows = data.rows ?? [];
  if (!rows.length) return '';
  const nums = rows.map((r: any) => Number(r.value ?? r.count ?? 0));
  const total = nums.reduce((a: number, b: number) => a + b, 0);
  if (!total) return '';
  const maxI = nums.indexOf(Math.max(...nums));
  const minI = nums.indexOf(Math.min(...nums));
  const isAmount = (config?.metric ?? '') === 'sum_amount';
  const maxVal = isAmount ? amtShort(nums[maxI]) : fmtInt.format(nums[maxI]);
  return `${rows[maxI].label} domine avec ${pct(nums[maxI], total)} du total (${maxVal}). Écart avec le segment le plus faible (${rows[minI].label} : ${pct(nums[minI], total)}) — identifier les leviers de rééquilibrage.`;
}

function expertLine(data: any): string {
  const rows = data.rows ?? [];
  if (rows.length < 2) return '';
  const nums = rows.map((r: any) => Number(r.value ?? r.count ?? 0));
  const first = nums[0], last = nums[nums.length - 1];
  const delta = first ? ((last - first) / first) * 100 : 0;
  const dir = delta >= 0 ? `progression de +${fmt.format(delta)}%` : `recul de ${fmt.format(Math.abs(delta))}%`;
  const maxI = nums.indexOf(Math.max(...nums));
  return `Tendance en ${dir} sur la période (${fmtInt.format(first)} → ${fmtInt.format(last)}). Pic à « ${rows[maxI].label} » (${fmtInt.format(nums[maxI])}) — référence à capitaliser.`;
}

function expertGauge(data: any, config: any): string {
  const v = Number(data.value ?? 0);
  const warn = config?.threshold?.warning ?? 70;
  const crit = config?.threshold?.critical ?? 50;
  if (v < crit) return `Zone critique : ${fmt.format(v)}% (seuil ${crit}%). Intervention corrective immédiate requise pour éviter une dégradation structurelle.`;
  if (v < warn) return `Zone d'alerte : ${fmt.format(v)}% (objectif ${warn}%). Mesures préventives à engager pour retrouver le niveau cible.`;
  return `Performance satisfaisante : ${fmt.format(v)}% (≥ ${warn}%). Maintenir la dynamique et surveiller les tendances pour anticiper toute inflexion.`;
}

function expertGantt(data: any): string {
  const rows = (data.rows ?? []) as any[];
  if (!rows.length) return '';
  const counts: Record<string, number> = {};
  let totalAmt = 0;
  for (const r of rows) { counts[r.status] = (counts[r.status] ?? 0) + 1; totalAmt += Number(r.amount) || 0; }
  const inProg = (counts['UNDER_REVIEW'] ?? 0) + (counts['SUBMITTED'] ?? 0);
  const approved = counts['APPROVED'] ?? 0;
  const total = rows.length;
  const rate = total ? fmt.format((approved / total) * 100) : '—';
  return `Pipeline : ${total} dossiers dont ${inProg} en instruction. Taux de transformation ${rate}%${totalAmt ? ` — volume ${amtShort(totalAmt)}` : ''}.`;
}

function expertMatrix(data: any, config: any): string {
  const rows = (data.rows ?? []) as any[];
  if (!rows.length) return '';
  const target = Number(config?.targetDays ?? 5);
  const scores = rows.map((r: any) => Number(r.score ?? 0));
  const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
  const maxI = scores.indexOf(Math.max(...scores));
  const overdue = rows.filter((r: any) => Number(r.avgDelay ?? 0) > target).length;
  return `Score moyen : ${fmt.format(avg)}/100 — meilleur : ${rows[maxI]?.name} (${fmt.format(scores[maxI])}/100). ${overdue > 0 ? `${overdue} agent${overdue > 1 ? 's dépassent' : ' dépasse'} la cible de ${target} j — accompagnement ciblé requis.` : `Tous respectent le délai cible de ${target} j.`}`;
}

function expertPivot(data: any): string {
  const rows = data.pivotRows ?? [];
  const cols = data.pivotCols ?? [];
  const matrix = data.pivotMatrix ?? {};
  if (!rows.length || !cols.length) return '';
  let maxVal = -Infinity; let maxRow = ''; let maxCol = ''; let total = 0;
  for (const r of rows) for (const c of cols) { const v = Number(matrix[r]?.[c] ?? 0); if (v > maxVal) { maxVal = v; maxRow = r; maxCol = c; } total += v; }
  return `Tableau ${rows.length}×${cols.length} — concentration max : ${maxRow}/${maxCol} (${fmtInt.format(maxVal)}, ${total ? fmt.format((maxVal / total) * 100) : '—'}% du total). Surveiller cette concentration dans la politique de diversification.`;
}

function expertFallback(widgetType: string, data: any, config: any): string {
  try {
    switch (widgetType) {
      case 'kpi_card':           return expertKpi(data, config);
      case 'bar_chart':
      case 'comparison_chart':   return expertBar(data, config);
      case 'line_chart':
      case 'trend_chart':        return expertLine(data);
      case 'gauge':              return expertGauge(data, config);
      case 'gantt_chart':        return expertGantt(data);
      case 'performance_matrix': return expertMatrix(data, config);
      case 'pivot_table':        return expertPivot(data);
      case 'table': {
        const n = (data.rows ?? []).length;
        return `${n} entrée${n > 1 ? 's' : ''} affichée${n > 1 ? 's' : ''}. Comparer aux benchmarks sectoriels pour identifier les écarts et prioriser les actions.`;
      }
      default: return '';
    }
  } catch { return ''; }
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildOllamaPrompt(widgetType: string, title: string, data: any, config: any, period: string): string {
  const periodLabel: Record<string, string> = {
    this_month: 'ce mois', this_quarter: 'ce trimestre', this_year: 'cette année',
    last_6_months: '6 derniers mois', last_12_months: '12 derniers mois',
  };
  const per = periodLabel[period] ?? period;

  let dataStr = '';
  try {
    const rows = data.rows ?? [];
    const nums = rows.map((r: any) => Number(r.value ?? r.count ?? 0));
    const total = nums.reduce((a: number, b: number) => a + b, 0);

    switch (widgetType) {
      case 'kpi_card':
        dataStr = `Indicateur: ${config?.metric ?? 'count'}\nValeur: ${fmt.format(Number(data.value ?? nums[0] ?? 0))}`;
        if (config?.targetDays) dataStr += `\nCible: ≤ ${config.targetDays} jours`;
        break;
      case 'bar_chart': case 'comparison_chart':
        dataStr = `Répartition:\n` + rows.slice(0, 8).map((r: any) =>
          `  ${r.label}: ${fmtInt.format(Number(r.value ?? r.count ?? 0))} (${pct(Number(r.value ?? r.count ?? 0), total)})`).join('\n');
        break;
      case 'line_chart': case 'trend_chart':
        dataStr = rows.length <= 13
          ? `Série: ` + rows.map((r: any) => `${r.label}=${fmtInt.format(Number(r.value ?? r.count ?? 0))}`).join(', ')
          : `${rows.length} points: premier=${fmtInt.format(nums[0])}, dernier=${fmtInt.format(nums[nums.length-1])}, max=${fmtInt.format(Math.max(...nums))}`;
        break;
      case 'gauge':
        dataStr = `Valeur: ${fmt.format(Number(data.value ?? 0))}%\nSeuil alerte: ${config?.threshold?.warning ?? 70}%, seuil critique: ${config?.threshold?.critical ?? 50}%`;
        break;
      case 'gantt_chart':
        const cnts: Record<string, number> = {};
        let amt = 0;
        for (const r of rows) { cnts[r.status] = (cnts[r.status] ?? 0) + 1; amt += Number(r.amount) || 0; }
        dataStr = Object.entries(cnts).map(([s, n]) => `${s}: ${n}`).join(', ');
        if (amt) dataStr += `\nMontant total: ${amtShort(amt)}`;
        break;
      case 'performance_matrix':
        dataStr = rows.slice(0, 6).map((r: any) =>
          `${r.name}: score=${Number(r.score ?? 0).toFixed(0)}/100, délai=${Number(r.avgDelay ?? 0).toFixed(1)}j`).join('\n');
        break;
      case 'pivot_table':
        dataStr = `Tableau ${(data.pivotRows ?? []).length}×${(data.pivotCols ?? []).length}`;
        break;
      default:
        dataStr = JSON.stringify(data).slice(0, 400);
    }
  } catch { dataStr = JSON.stringify(data).slice(0, 400); }

  return `Widget "${title}" (${widgetType}, ${per}):\n${dataStr}`;
}

// ── Route ──────────────────────────────────────────────────────────────────────

router.post('/analyze', async (req: Request, res: Response) => {
  const { widgetType, title, data, config, period } = req.body;
  if (!widgetType || !data) {
    return res.status(400).json({ success: false, error: 'widgetType et data sont requis' }) as any;
  }

  // Try Ollama first (local, free)
  const ollamaPrompt = buildOllamaPrompt(widgetType, title ?? widgetType, data, config ?? {}, period ?? 'this_month');
  const aiAnalysis = await callOllama(ollamaPrompt);

  if (aiAnalysis) {
    return res.json({ success: true, data: { analysis: aiAnalysis, source: 'ollama' } });
  }

  // Fallback: expert template engine
  const fallback = expertFallback(widgetType, data, config ?? {});
  if (fallback) {
    return res.json({ success: true, data: { analysis: fallback, source: 'template' } });
  }

  return res.status(422).json({ success: false, error: 'Aucune analyse disponible pour ce type de widget' }) as any;
});

export default router;
