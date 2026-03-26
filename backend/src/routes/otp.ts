import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// ─── Stockage en mémoire (test) ───────────────────────────────────────────────
// En production, remplacer par Redis ou une table DB.
interface OtpEntry {
  code: string;
  purpose: string;
  expiresAt: Date;
  used: boolean;
}

const otpStore = new Map<string, OtpEntry>();

// Nettoyage automatique des OTP expirés toutes les 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [key, entry] of otpStore.entries()) {
    if (entry.expiresAt < now || entry.used) otpStore.delete(key);
  }
}, 5 * 60 * 1000);

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── POST /api/otp/generate ───────────────────────────────────────────────────
router.post('/generate', authenticate, (req: Request, res: Response) => {
  try {
    const { purpose } = req.body as { purpose?: string };

    if (!purpose) {
      return res.status(400).json({ success: false, error: 'Le champ purpose est requis' });
    }

    const userId = req.user!.id;
    const storeKey = `${userId}:${purpose}`;

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    otpStore.set(storeKey, { code, purpose, expiresAt, used: false });

    console.log(`[OTP] Generated for user=${userId} purpose=${purpose} code=${code}`);

    // En production : envoyer par SMS/email et NE PAS retourner le code
    return res.json({
      success: true,
      // ⚠️ MODE TEST — supprimer en production
      _testCode: code,
      expiresIn: 600,
      message: 'OTP généré avec succès',
    });
  } catch (err) {
    console.error('OTP generate error:', err);
    return res.status(500).json({ success: false, error: 'Erreur interne' });
  }
});

// ─── POST /api/otp/verify ─────────────────────────────────────────────────────
router.post('/verify', authenticate, (req: Request, res: Response) => {
  try {
    const { code, purpose } = req.body as { code?: string; purpose?: string };

    if (!code || !purpose) {
      return res.status(400).json({ success: false, error: 'Code et purpose requis' });
    }

    const userId = req.user!.id;
    const storeKey = `${userId}:${purpose}`;
    const entry = otpStore.get(storeKey);

    if (!entry) {
      return res.status(400).json({ success: false, error: 'Aucun OTP en attente pour cette action' });
    }

    if (entry.used) {
      return res.status(400).json({ success: false, error: 'Cet OTP a déjà été utilisé' });
    }

    if (new Date() > entry.expiresAt) {
      otpStore.delete(storeKey);
      return res.status(400).json({ success: false, error: 'OTP expiré, veuillez en générer un nouveau' });
    }

    if (entry.code !== String(code).trim()) {
      return res.status(400).json({ success: false, error: 'Code OTP incorrect' });
    }

    // Marquer comme utilisé (single-use)
    entry.used = true;
    otpStore.set(storeKey, entry);

    return res.json({ success: true, message: 'OTP vérifié avec succès' });
  } catch (err) {
    console.error('OTP verify error:', err);
    return res.status(500).json({ success: false, error: 'Erreur interne' });
  }
});

export default router;
