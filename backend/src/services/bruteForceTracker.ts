/**
 * bruteForceTracker.ts
 *
 * Compteurs Redis pour la détection de brute-force sur le login.
 * Block au niveau utilisateur uniquement (email normalisé). Pas de
 * tracking IP côté Redis (l'IP reste journalisée dans le block_history
 * pour l'audit, cf. triggerBruteForceLockout).
 *
 * Fail-open : si Redis est indisponible, tous les appels renvoient
 * une réponse "non bloqué" et loggent un warn — le système reste up.
 */

import redis from './redis';
import { logger } from '../utils/logger';

export interface BruteForceConfig {
  threshold: number;
  windowSec: number;
  blockDurationSec: number;
}

export function getBruteForceConfig(): BruteForceConfig {
  return {
    threshold:        Number(process.env.BF_THRESHOLD ?? 5),
    windowSec:        Number(process.env.BF_WINDOW_SEC ?? 300),
    blockDurationSec: Number(process.env.BF_BLOCK_DURATION_SEC ?? 900),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function failKey(email: string): string {
  return `bf:fail:user:${normalizeEmail(email)}`;
}

function blockKey(email: string): string {
  return `bf:block:user:${normalizeEmail(email)}`;
}

/**
 * Incrémente le compteur d'échecs. Renvoie `blocked: true` UNIQUEMENT
 * lors de la transition au seuil (premier passage), pour éviter
 * les audits dupliqués sur les tentatives suivantes.
 */
export async function recordFailedAttempt(email: string): Promise<{ blocked: boolean }> {
  if (!email) return { blocked: false };
  const cfg = getBruteForceConfig();
  const fKey = failKey(email);
  const bKey = blockKey(email);
  try {
    const count = await redis.incr(fKey);
    if (count === 1) {
      await redis.expire(fKey, cfg.windowSec);
    }
    if (count < cfg.threshold) return { blocked: false };
    // Au seuil : poser le flag seulement s'il n'existe pas déjà (transition)
    const existed = await redis.exists(bKey);
    if (existed) return { blocked: false };
    await redis.set(bKey, '1', 'EX', cfg.blockDurationSec);
    return { blocked: true };
  } catch (e) {
    logger.warn('[bruteForceTracker] Redis error in recordFailedAttempt, fail-open', { err: String(e) });
    return { blocked: false };
  }
}

export async function recordSuccessfulAttempt(email: string): Promise<void> {
  if (!email) return;
  try {
    await redis.del(failKey(email));
    await redis.del(blockKey(email));
  } catch (e) {
    logger.warn('[bruteForceTracker] Redis error in recordSuccessfulAttempt', { err: String(e) });
  }
}

export async function isBlocked(email: string): Promise<{ blocked: boolean; ttlSec?: number }> {
  if (!email) return { blocked: false };
  const bKey = blockKey(email);
  try {
    const exists = await redis.exists(bKey);
    if (!exists) return { blocked: false };
    const ttl = await redis.ttl(bKey);
    return { blocked: true, ttlSec: ttl > 0 ? ttl : undefined };
  } catch (e) {
    logger.warn('[bruteForceTracker] Redis error in isBlocked, fail-open', { err: String(e) });
    return { blocked: false };
  }
}

export async function purgeBlocksForEmail(email: string): Promise<void> {
  if (!email) return;
  try {
    await redis.del(failKey(email));
    await redis.del(blockKey(email));
  } catch (e) {
    logger.warn('[bruteForceTracker] Redis error in purgeBlocksForEmail', { err: String(e) });
  }
}
