import { Router, Request, Response } from 'express';
import { authenticate, requireCompany } from '../middleware/auth';
import { getWidgetData, getPivotData, Period, PivotDimension } from '../services/widgetDataService';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

const VALID_PERIODS: Period[] = ['this_month', 'this_quarter', 'this_year', 'last_6_months', 'last_12_months'];
const VALID_GROUP_BY = ['status', 'month', 'branch', 'manager', 'sector', 'credit_type'];
const VALID_PIVOT_DIMS: PivotDimension[] = ['branch', 'manager', 'month', 'sector', 'credit_type', 'status'];

router.get('/pivot', async (req: Request, res: Response) => {
  const { rowDimension, colDimension, metric, period } = req.query;
  if (!rowDimension || !colDimension || !metric || !period)
    return res.status(400).json({ success: false, error: 'rowDimension, colDimension, metric et period sont requis' }) as any;
  if (!VALID_PIVOT_DIMS.includes(rowDimension as PivotDimension))
    return res.status(400).json({ success: false, error: `rowDimension invalide` }) as any;
  if (!VALID_PIVOT_DIMS.includes(colDimension as PivotDimension))
    return res.status(400).json({ success: false, error: `colDimension invalide` }) as any;
  if (!['count', 'sum_amount'].includes(metric as string))
    return res.status(400).json({ success: false, error: `metric invalide (count ou sum_amount)` }) as any;
  if (!VALID_PERIODS.includes(period as Period))
    return res.status(400).json({ success: false, error: `period invalide` }) as any;
  try {
    const data = await getPivotData(
      { rowDimension: rowDimension as PivotDimension, colDimension: colDimension as PivotDimension, metric: metric as 'count' | 'sum_amount', period: period as Period },
      req.companyId!
    );
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  const { source, metric, groupBy, period, limit } = req.query;
  const filter = req.query.filter as Record<string, string> | undefined;

  if (!source) return res.status(400).json({ success: false, error: 'Le paramètre source est requis' }) as any;
  if (!metric) return res.status(400).json({ success: false, error: 'Le paramètre metric est requis' }) as any;
  if (!period) return res.status(400).json({ success: false, error: 'Le paramètre period est requis' }) as any;
  if (!VALID_PERIODS.includes(period as Period))
    return res.status(400).json({ success: false, error: `period invalide. Valeurs acceptées: ${VALID_PERIODS.join(', ')}` }) as any;
  if (groupBy && !VALID_GROUP_BY.includes(groupBy as string))
    return res.status(400).json({ success: false, error: `groupBy invalide` }) as any;

  try {
    const data = await getWidgetData(
      {
        source: source as any,
        metric: metric as string,
        groupBy: groupBy as any,
        period: period as Period,
        filter: filter as any,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      },
      req.companyId!
    );
    res.json({ success: true, data });
  } catch (e: any) {
    const isValidationError = e.message?.includes('invalide') || e.message?.includes('Metric') || e.message?.includes('Source');
    res.status(isValidationError ? 400 : 500).json({ success: false, error: e.message });
  }
});

export default router;
