/**
 * bruteForceGate.ts
 *
 * Middleware à monter UNIQUEMENT sur POST /api/auth/login.
 * Lit req.body.email et bloque (429) si le compteur Redis indique
 * que ce compte est verrouillé. Fail-open si Redis indisponible
 * (le tracker gère le warn).
 */

import { Request, Response, NextFunction } from 'express';
import { isBlocked } from '../services/bruteForceTracker';

export async function bruteForceGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const email = (req.body?.email as string | undefined) ?? '';
  if (!email) return next();

  const { blocked } = await isBlocked(email);
  if (!blocked) return next();

  res.status(429).json({
    success: false,
    error: 'rate_limited',
    message: 'Trop de tentatives. Compte temporairement verrouillé.',
  });
}
