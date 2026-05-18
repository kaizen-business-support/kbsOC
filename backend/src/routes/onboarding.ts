import express, { Request, Response } from 'express';
import { prisma } from '../server';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Sub-router mounted under /api/users/me/onboarding by server.ts.
// All endpoints require authentication; the user is identified by req.user.id (set by authenticate middleware).
// No cross-tenant possible: we only ever read/write the current user's own row.
router.use(authenticate);

// GET /api/users/me/onboarding — returns { shouldShow: boolean }
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { onboardingCompletedAt: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    return res.json({
      success: true,
      shouldShow: user.onboardingCompletedAt === null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/users/me/onboarding/complete — set onboardingCompletedAt = now (idempotent)
router.post('/complete', async (req: Request, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { onboardingCompletedAt: new Date() },
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/users/me/onboarding/reset — set onboardingCompletedAt = null
router.post('/reset', async (req: Request, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { onboardingCompletedAt: null },
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;
