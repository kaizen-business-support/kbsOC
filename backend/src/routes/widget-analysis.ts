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
  const v = Number(data.value ?? (rows.length === 1 ? (rows[0]?.value ?? rows[0]?.count ?? 0) : 0));

  if (metric === 'approval_rate') {
    if (v >= 75) return `Le taux d'approbation de ${fmt.format(v)}% reflète une politique de crédit saine et une sélection rigoureuse des dossiers, conforme aux standards UEMOA (objectif ≥ 75%). Cette performance témoigne d'une bonne qualité de la production commerciale.`;
    if (v >= 55) return `Le taux d'approbation de ${fmt.format(v)}% reste en deçà de l'objectif institutionnel de 75%. Cette situation peut traduire soit une qualité insuffisante des dossiers soumis, soit des critères d'analyse trop restrictifs. Une analyse des motifs de rejet est recommandée pour identifier les axes d'amélioration.`;
    return `Le taux d'approbation critique de ${fmt.format(v)}% signale une dégradation sévère de la qualité du portefeuille entrant. Ce niveau expose l'institution à un risque opérationnel élevé. Une revue immédiate du processus d'instruction et un renforcement de l'accompagnement des chargés d'affaires sont urgents.`;
  }

  if (metric === 'avg_processing_time') {
    const target = Number(config?.targetDays ?? 5);
    if (v <= target) return `Le délai moyen de traitement de ${fmt.format(v)} jours respecte l'objectif de qualité de service (≤ ${target}j), signe d'une bonne efficacité opérationnelle. Ce niveau renforce la compétitivité de l'institution et la satisfaction de la clientèle professionnelle.`;
    if (v <= target * 2) return `Le délai moyen de ${fmt.format(v)} jours dépasse la cible de ${target} jours. Ce glissement peut affecter la satisfaction client et la compétitivité face aux autres établissements. Identifier les étapes consommatrices de temps dans le circuit d'instruction pour cibler les optimisations.`;
    return `Un délai moyen de ${fmt.format(v)} jours — soit ${fmt.format(v / target)}× la cible de ${target} jours — traduit un dysfonctionnement opérationnel significatif. Risques : perte de clients, saturation des équipes d'analyse, dégradation de la notation institutionnelle. Un audit du circuit d'approbation est nécessaire.`;
  }

  if (metric === 'sum_amount') {
    return `Le volume total engagé s'établit à ${amtShort(v)} sur la période, reflétant l'intensité de l'activité de crédit. Ce chiffre est à mettre en perspective avec les plafonds d'engagements autorisés et les limites sectorielles pour évaluer le niveau de risque portefeuille.`;
  }

  if (metric === 'count') {
    return `${fmtInt.format(v)} dossier${v > 1 ? 's' : ''} traité${v > 1 ? 's' : ''} sur la période. Ce volume est à analyser par rapport à la capacité de traitement des équipes et aux objectifs commerciaux pour évaluer la tension opérationnelle et la performance de la production.`;
  }

  return `Indicateur : ${fmt.format(v)}. Évaluer cette valeur au regard des objectifs fixés et de l'historique de l'institution pour déterminer si elle traduit une progression ou une dégradation de la performance.`;
}

function expertBar(data: any, config: any): string {
  const rows = data.rows ?? [];
  if (!rows.length) return '';
  const nums = rows.map((r: any) => Number(r.value ?? r.count ?? 0));
  const total = nums.reduce((a: number, b: number) => a + b, 0);
  if (!total) return '';
  const maxI = nums.indexOf(Math.max(...nums));
  const minI = nums.indexOf(Math.min(...nums));
  const metric = config?.metric ?? 'count';
  const isAmount = metric === 'sum_amount';

  return `${rows[maxI].label} concentre la plus grande part de l'activité avec ${pct(nums[maxI], total)} du total (${isAmount ? amtShort(nums[maxI]) : fmtInt.format(nums[maxI])}). L'écart entre le segment le plus fort (${rows[maxI].label}) et le plus faible (${rows[minI].label} : ${pct(nums[minI], total)}) mérite une analyse pour identifier les facteurs de performance et rééquilibrer si nécessaire.`;
}

function expertLine(data: any): string {
  const rows = data.rows ?? [];
  if (rows.length < 2) return '';
  const nums = rows.map((r: any) => Number(r.value ?? r.count ?? 0));
  const first = nums[0];
  const last = nums[nums.length - 1];
  const delta = first ? ((last - first) / first) * 100 : 0;
  const dir = delta >= 0 ? 'progression' : 'recul';
  const icon = delta >= 0 ? '+' : '';
  const maxI = nums.indexOf(Math.max(...nums));
  const recent2 = nums.slice(-2);
  const recentTrend = recent2[1] > recent2[0] ? 'accélération récente positive' : 'légère inflexion récente';

  return `La tendance affiche une ${dir} de ${icon}${fmt.format(Math.abs(delta))}% sur la période, passant de ${fmtInt.format(first)} à ${fmtInt.format(last)}. Le pic enregistré en « ${rows[maxI].label} » (${fmtInt.format(nums[maxI])}) constitue une référence de performance à capitaliser. ${rows.length >= 3 ? `On note une ${recentTrend} qu'il convient de surveiller attentivement.` : ''}`;
}

function expertGauge(data: any, config: any): string {
  const v = Number(data.value ?? 0);
  const warn = config?.threshold?.warning ?? 70;
  const crit = config?.threshold?.critical ?? 50;
  if (v < crit) return `L'indicateur à ${fmt.format(v)}% se situe en zone critique (seuil : ${crit}%). Ce niveau signale un risque majeur sur la performance de l'institution. Une intervention corrective immédiate est indispensable pour éviter une dégradation structurelle.`;
  if (v < warn) return `Avec ${fmt.format(v)}%, l'indicateur se trouve en zone d'alerte (objectif : ${warn}%). Bien que la situation ne soit pas critique, elle appelle une vigilance accrue et des mesures préventives pour retrouver le niveau cible.`;
  return `L'indicateur à ${fmt.format(v)}% se positionne en zone de performance satisfaisante (objectif ≥ ${warn}%). Ce résultat reflète une gestion maîtrisée. Maintenir cette dynamique en surveillant les tendances mensuelles pour anticiper toute inflexion.`;
}

function expertGantt(data: any): string {
  const rows = (data.rows ?? []) as any[];
  if (!rows.length) return '';
  const counts: Record<string, number> = {};
  let totalAmt = 0;
  for (const r of rows) { counts[r.status] = (counts[r.status] ?? 0) + 1; totalAmt += Number(r.amount) || 0; }
  const inProg = (counts['UNDER_REVIEW'] ?? 0) + (counts['SUBMITTED'] ?? 0);
  const approved = counts['APPROVED'] ?? 0;
  const rejected = counts['REJECTED'] ?? 0;
  const total = rows.length;
  const approvalR = total ? fmt.format((approved / total) * 100) : '—';
  return `Le pipeline recense ${fmtInt.format(total)} dossier${total > 1 ? 's' : ''} dont ${inProg} en cours d'instruction. Avec ${approved} approbation${approved > 1 ? 's' : ''} (${approvalR}%) et ${rejected} rejet${rejected > 1 ? 's' : ''}, le taux de transformation est à surveiller par rapport aux objectifs. ${totalAmt ? `Le volume total du portefeuille atteint ${amtShort(totalAmt)}, ce qui donne une mesure de l'exposition au risque de crédit en cours.` : ''}`;
}

function expertMatrix(data: any, config: any): string {
  const rows = (data.rows ?? []) as any[];
  if (!rows.length) return '';
  const target = Number(config?.targetDays ?? 5);
  const scores = rows.map((r: any) => Number(r.score ?? 0));
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxI = scores.indexOf(Math.max(...scores));
  const overdue = rows.filter((r: any) => Number(r.avgDelay ?? 0) > target);
  const topPeformer = rows[maxI];
  return `La performance moyenne des agents s'établit à ${fmt.format(avgScore)}/100. ${topPeformer?.name} se distingue avec ${fmt.format(scores[maxI])}/100, représentant un modèle de bonnes pratiques à partager. ${overdue.length > 0 ? `${overdue.length} agent${overdue.length > 1 ? 's dépassent' : ' dépasse'} le délai cible de ${target} jours, ce qui requiert un accompagnement ciblé et un suivi managérial renforcé.` : `Tous les agents respectent le délai cible de ${target} jours, signe d'une organisation opérationnelle efficace.`}`;
}

function expertPivot(data: any): string {
  const rows = data.pivotRows ?? [];
  const cols = data.pivotCols ?? [];
  const matrix = data.pivotMatrix ?? {};
  if (!rows.length || !cols.length) return '';
  let maxVal = -Infinity; let maxRow = ''; let maxCol = '';
  let total = 0;
  for (const r of rows) for (const c of cols) { const v = Number(matrix[r]?.[c] ?? 0); if (v > maxVal) { maxVal = v; maxRow = r; maxCol = c; } total += v; }
  return `L'analyse croisée ${rows.length}×${cols.length} révèle que la combinaison ${maxRow}/${maxCol} enregistre le volume le plus élevé (${fmtInt.format(maxVal)}, soit ${total ? fmt.format((maxVal / total) * 100) : '—'}% du total). Cette concentration sectorielle mérite une attention particulière dans la gestion du risque de portefeuille et la politique de diversification.`;
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
        return `Le tableau présente ${n} entrée${n > 1 ? 's' : ''} sur la période sélectionnée. Analyser les valeurs par rapport aux benchmarks sectoriels et aux objectifs de l'institution pour identifier les écarts et définir les priorités d'action.`;
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
