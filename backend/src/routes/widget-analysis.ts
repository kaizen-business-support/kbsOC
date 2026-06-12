import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { authenticate, requireCompany } from '../middleware/auth';
import { cacheGet, cacheSet } from '../services/redis';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

const OLLAMA_URL   = process.env.OLLAMA_URL   ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2:1b';
const OLLAMA_TIMEOUT_MS = 20_000;
const CACHE_TTL_S = 7200; // 2 heures

const SYSTEM_PROMPT =
  'Tu es un expert analyste de crédit bancaire (15 ans expérience, institutions financières Afrique de l\'Ouest, FCFA/SYSCOHADA). ' +
  'Règle absolue : réponds en 2 phrases courtes et professionnelles en français. ' +
  'Interprète les données dans le contexte bancaire (approbation, délais, portefeuille, risques). ' +
  'Identifie les points positifs et les signaux d\'alerte. Propose une action si nécessaire. ' +
  'Ne répète pas les données brutes. Commence directement par l\'analyse, sans formule de politesse.';

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt    = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const fmtInt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

function pct(v: number, total: number): string {
  return total ? `${fmt.format((v / total) * 100)}%` : '—';
}
function amtShort(v: number): string {
  if (v >= 1e9) return `${fmt.format(v / 1e9)} Mds FCFA`;
  if (v >= 1e6) return `${fmt.format(v / 1e6)} M FCFA`;
  if (v >= 1e3) return `${fmt.format(v / 1e3)} K FCFA`;
  return `${fmtInt.format(v)} FCFA`;
}

// Données normalisées : bar/line/trend/comparison renvoient { series: [{name, value}] }
// table/gantt/performance_matrix renvoient { rows: [...] }
function getItems(data: any): Array<{ label: string; val: number }> {
  const src = data.series ?? data.rows ?? [];
  return (src as any[]).map((r: any) => ({
    label: r.name ?? r.label ?? r.dimension ?? '',
    val:   Number(r.value ?? r.count ?? 0),
  }));
}

function dataHash(widgetType: string, period: string, data: any): string {
  const payload = JSON.stringify({ widgetType, period, data });
  return crypto.createHash('md5').update(payload).digest('hex').slice(0, 16);
}

// ── Ollama ─────────────────────────────────────────────────────────────────────

async function callOllama(prompt: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), OLLAMA_TIMEOUT_MS);
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL, system: SYSTEM_PROMPT, prompt, stream: false,
        options: { temperature: 0.3, num_predict: 180, top_p: 0.9, repeat_penalty: 1.1 },
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

// ── Templates experts (fallback sans Ollama) ───────────────────────────────────

function expertKpi(data: any, config: any): string {
  const metric = config?.metric ?? 'count';
  // Scalar KPI
  const v = Number(data.value ?? 0);

  if (data.value !== undefined) {
    if (metric === 'approval_rate') {
      if (v >= 75) return `Taux d'approbation de ${fmt.format(v)}% — conforme aux standards UEMOA (≥ 75%). Bonne qualité du portefeuille entrant.`;
      if (v >= 55) return `Taux d'approbation de ${fmt.format(v)}% en deçà de l'objectif (75%). Analyser les motifs de rejet pour cibler les axes d'amélioration.`;
      return `Taux d'approbation critique : ${fmt.format(v)}% — risque opérationnel élevé. Revue immédiate du processus d'instruction recommandée.`;
    }
    if (metric === 'avg_processing_time') {
      const target = Number(config?.targetDays ?? 5);
      if (v <= target) return `Délai moyen de ${fmt.format(v)} j — objectif respecté (≤ ${target} j). Efficacité opérationnelle satisfaisante.`;
      if (v <= target * 2) return `Délai moyen de ${fmt.format(v)} j dépasse la cible (${target} j). Identifier les étapes bloquantes dans le circuit.`;
      return `Délai critique de ${fmt.format(v)} j (${fmt.format(v / target)}× la cible). Audit urgent du circuit d'approbation.`;
    }
    if (metric === 'sum_amount') return `Volume engagé : ${amtShort(v)} sur la période. À rapprocher des plafonds d'engagement et limites sectorielles.`;
    if (metric === 'count')      return `${fmtInt.format(v)} dossier${v > 1 ? 's' : ''} sur la période. Comparer à la capacité des équipes et aux objectifs commerciaux.`;
    return `Valeur : ${fmt.format(v)}. Évaluer par rapport aux objectifs et à l'historique pour qualifier la performance.`;
  }

  // Grouped KPI (série) — series renvoie [{name, value}]
  const items = getItems(data);
  if (!items.length) return '';
  const total = items.reduce((s, r) => s + r.val, 0);
  if (!total) return '';
  const maxI = items.indexOf(items.reduce((m, r) => r.val > m.val ? r : m, items[0]));
  return `${items[maxI].label} domine avec ${pct(items[maxI].val, total)} du total. Répartition sur ${items.length} catégories — analyser la concentration sectorielle.`;
}

function expertSeries(data: any, config: any, mode: 'bar' | 'line'): string {
  const items = getItems(data);
  if (!items.length) return '';
  const vals  = items.map(r => r.val);
  const total = vals.reduce((a, b) => a + b, 0);
  if (!total) return '';
  const maxI = vals.indexOf(Math.max(...vals));
  const minI = vals.indexOf(Math.min(...vals));
  const isAmount = (config?.metric ?? '') === 'sum_amount';

  if (mode === 'line') {
    const first = vals[0], last = vals[vals.length - 1];
    const delta = first ? ((last - first) / first) * 100 : 0;
    const dir = delta >= 0 ? `+${fmt.format(delta)}%` : `${fmt.format(delta)}%`;
    return `Tendance ${dir} sur la période (${fmtInt.format(first)} → ${fmtInt.format(last)}). Pic à « ${items[maxI].label} » (${fmtInt.format(vals[maxI])}) — référence à capitaliser.`;
  }

  const maxVal = isAmount ? amtShort(vals[maxI]) : fmtInt.format(vals[maxI]);
  return `${items[maxI].label} domine avec ${pct(vals[maxI], total)} du total (${maxVal}). Écart avec le plus faible (${items[minI].label} : ${pct(vals[minI], total)}) — analyser les leviers de rééquilibrage.`;
}

function expertGauge(data: any, config: any): string {
  const v    = Number(data.value ?? 0);
  const warn = config?.threshold?.warning  ?? 70;
  const crit = config?.threshold?.critical ?? 50;
  if (v < crit) return `Zone critique : ${fmt.format(v)}% (seuil ${crit}%). Intervention corrective immédiate requise.`;
  if (v < warn) return `Zone d'alerte : ${fmt.format(v)}% (objectif ${warn}%). Mesures préventives à engager pour retrouver le niveau cible.`;
  return `Performance satisfaisante : ${fmt.format(v)}% (≥ ${warn}%). Maintenir la dynamique et surveiller les tendances mensuelles.`;
}

function expertGantt(data: any): string {
  const rows = (data.rows ?? []) as any[];
  if (!rows.length) return '';
  const counts: Record<string, number> = {};
  let totalAmt = 0;
  for (const r of rows) { counts[r.status] = (counts[r.status] ?? 0) + 1; totalAmt += Number(r.amount) || 0; }
  const inProg   = (counts['UNDER_REVIEW'] ?? 0) + (counts['SUBMITTED'] ?? 0);
  const approved = counts['APPROVED'] ?? 0;
  const rate     = rows.length ? fmt.format((approved / rows.length) * 100) : '—';
  return `Pipeline : ${rows.length} dossier${rows.length > 1 ? 's' : ''} dont ${inProg} en instruction, taux transformation ${rate}%.${totalAmt ? ` Volume : ${amtShort(totalAmt)}.` : ''}`;
}

function expertMatrix(data: any, config: any): string {
  const rows = (data.rows ?? []) as any[];
  if (!rows.length) return '';
  const target = Number(config?.targetDays ?? 5);
  const scores = rows.map((r: any) => Number(r.score ?? 0));
  const avg    = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
  const maxI   = scores.indexOf(Math.max(...scores));
  const overdue = rows.filter((r: any) => Number(r.avgDays ?? 0) > target).length;
  const topName = rows[maxI]?.dimension ?? rows[maxI]?.name ?? '—';
  return `Score moyen : ${fmt.format(avg)}/100 — meilleur : ${topName} (${fmt.format(scores[maxI])}/100). ${overdue > 0 ? `${overdue} agent${overdue > 1 ? 's dépassent' : ' dépasse'} la cible de ${target} j — accompagnement requis.` : `Tous respectent le délai cible de ${target} j.`}`;
}

function expertPivot(data: any): string {
  const rows   = data.pivotRows ?? [];
  const cols   = data.pivotCols ?? [];
  const matrix = data.pivotMatrix ?? {};
  if (!rows.length || !cols.length) return '';
  let maxVal = -Infinity, maxRow = '', maxCol = '', total = 0;
  for (const r of rows) for (const c of cols) {
    const v = Number(matrix[r]?.[c] ?? 0);
    if (v > maxVal) { maxVal = v; maxRow = r; maxCol = c; }
    total += v;
  }
  return `Tableau ${rows.length}×${cols.length} — concentration max : ${maxRow}/${maxCol} (${fmtInt.format(maxVal)}, ${pct(maxVal, total)} du total). Surveiller cette concentration dans la politique de diversification.`;
}

function expertFallback(widgetType: string, data: any, config: any): string {
  try {
    switch (widgetType) {
      case 'kpi_card':           return expertKpi(data, config);
      case 'bar_chart':
      case 'comparison_chart':   return expertSeries(data, config, 'bar');
      case 'line_chart':
      case 'trend_chart':        return expertSeries(data, config, 'line');
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

// ── Prompt Ollama ──────────────────────────────────────────────────────────────

function buildOllamaPrompt(widgetType: string, title: string, data: any, config: any, period: string): string {
  const PER: Record<string, string> = {
    this_month: 'ce mois', this_quarter: 'ce trimestre', this_year: 'cette année',
    last_6_months: '6 derniers mois', last_12_months: '12 derniers mois',
  };
  const per = PER[period] ?? period;

  let dataStr = '';
  try {
    const items = getItems(data);
    const vals  = items.map(r => r.val);
    const total = vals.reduce((a, b) => a + b, 0);

    switch (widgetType) {
      case 'kpi_card':
        if (data.value !== undefined) {
          dataStr = `Indicateur: ${config?.metric ?? 'count'}, Valeur: ${fmt.format(Number(data.value))}`;
          if (config?.targetDays) dataStr += `, Cible: ≤${config.targetDays}j`;
        } else {
          dataStr = items.slice(0, 6).map(r => `${r.label}=${fmtInt.format(r.val)}`).join(', ');
        }
        break;
      case 'bar_chart': case 'comparison_chart':
        dataStr = items.slice(0, 8).map(r => `${r.label}:${fmtInt.format(r.val)}(${pct(r.val, total)})`).join(', ');
        break;
      case 'line_chart': case 'trend_chart':
        dataStr = items.length <= 12
          ? items.map(r => `${r.label}=${fmtInt.format(r.val)}`).join(', ')
          : `${items.length} pts: début=${fmtInt.format(vals[0])}, fin=${fmtInt.format(vals[vals.length-1])}, max=${fmtInt.format(Math.max(...vals))}`;
        break;
      case 'gauge':
        dataStr = `${fmt.format(Number(data.value ?? 0))}% (alerte:${config?.threshold?.warning ?? 70}%, critique:${config?.threshold?.critical ?? 50}%)`;
        break;
      case 'gantt_chart': {
        const rows = (data.rows ?? []) as any[];
        const cnt: Record<string, number> = {};
        let amt = 0;
        for (const r of rows) { cnt[r.status] = (cnt[r.status] ?? 0) + 1; amt += Number(r.amount) || 0; }
        dataStr = Object.entries(cnt).map(([s, n]) => `${s}:${n}`).join(', ');
        if (amt) dataStr += `, volume:${amtShort(amt)}`;
        break;
      }
      case 'performance_matrix':
        dataStr = (data.rows ?? []).slice(0, 5).map((r: any) =>
          `${r.dimension ?? r.name}:score=${Number(r.score ?? 0).toFixed(0)}/100,délai=${Number(r.avgDays ?? 0).toFixed(1)}j`).join('; ');
        break;
      case 'pivot_table':
        dataStr = `${(data.pivotRows ?? []).length}×${(data.pivotCols ?? []).length} tableau croisé`;
        break;
      default:
        dataStr = JSON.stringify(data).slice(0, 300);
    }
  } catch { dataStr = ''; }

  return `Widget "${title}" (${widgetType}, ${per}): ${dataStr}`;
}

// ── Route ──────────────────────────────────────────────────────────────────────

router.post('/analyze', async (req: Request, res: Response) => {
  const { widgetType, title, data, config, period } = req.body;
  if (!widgetType || !data) {
    return res.status(400).json({ success: false, error: 'widgetType et data requis' }) as any;
  }

  // 1. Redis cache
  const key = `wa:${dataHash(widgetType, period ?? 'this_month', data)}`;
  const cached = await cacheGet(key);
  if (cached) {
    return res.json({ success: true, data: { analysis: cached, source: 'cache' } });
  }

  let analysis = '';

  // 2. Ollama (local AI)
  const ollamaPrompt = buildOllamaPrompt(widgetType, title ?? widgetType, data, config ?? {}, period ?? 'this_month');
  const aiText = await callOllama(ollamaPrompt);
  if (aiText) analysis = aiText;

  // 3. Expert template fallback
  if (!analysis) analysis = expertFallback(widgetType, data, config ?? {});

  if (!analysis) {
    return res.status(422).json({ success: false, error: 'Aucune analyse disponible pour ce type de widget' }) as any;
  }

  // 4. Cache in Redis (non-blocking)
  cacheSet(key, analysis, CACHE_TTL_S).catch(() => {});

  return res.json({ success: true, data: { analysis, source: aiText ? 'ollama' : 'template' } });
});

export default router;
