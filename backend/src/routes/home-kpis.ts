/**
 * home-kpis.ts — Route de chargement des KPIs de la page d'accueil.
 *
 * GET /api/home/kpis → renvoie 4 KPIs adaptés au rôle (cf. homeKpiService).
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireCompany } from '../middleware/auth';
import { buildHomeKpisForUser } from '../services/homeKpiService';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

router.get('/kpis', async (req: Request, res: Response) => {
  try {
    const kpis = await buildHomeKpisForUser(
      { id: req.user!.id, role: req.user!.role as string },
      req.companyId!
    );
    res.json({ success: true, kpis });
  } catch (error) {
    console.error('Error fetching home KPIs:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des KPIs' });
  }
});

export default router;
