/**
 * security-time-status.ts
 *
 * GET /api/security/time-status
 *   Renvoie le statut horaire courant de l'utilisateur authentifié.
 *   Cette route NE doit PAS être bloquée par timeRulesGate (sinon
 *   le frontend ne pourrait pas la poller depuis l'état "verrouillé").
 *
 * Aucune permission spécifique requise — tout utilisateur authentifié
 * peut consulter son propre statut.
 */

import { Router, Request, Response } from 'express';
import { getCurrentTimeStatus } from '../services/securityTimeStatusService';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'unauthenticated' });
    }
    const status = await getCurrentTimeStatus(
      {
        id: req.user.id,
        role: req.user.role,
        branch: req.user.branch ?? null,
        department: req.user.department ?? null,
      },
      req.companyId ?? null
    );
    res.json({
      success: true,
      data: {
        locked: status.locked,
        message: status.message,
        nextOpen: status.nextOpen ? status.nextOpen.toISOString() : null,
        allowReadOnly: status.allowReadOnly,
      },
    });
  } catch (e) {
    console.error('[security-time-status]', e);
    res.status(500).json({ success: false, error: 'internal' });
  }
});

export default router;
