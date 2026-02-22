import Redis from 'ioredis';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.warn('Redis connection error (non-fatal):', err.message));

// ─── Token blacklist (logout) ────────────────────────────────────────────────

/**
 * Add a JWT ID (jti) to the blacklist until it expires.
 * @param jti   The JWT "jti" claim value
 * @param ttlSeconds Remaining lifetime of the token in seconds
 */
export async function blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
  if (ttlSeconds <= 0) return;
  try {
    await redis.set(`bl:${jti}`, '1', 'EX', ttlSeconds);
  } catch (err) {
    logger.warn('Redis blacklist write failed (non-fatal):', err);
  }
}

/**
 * Check whether a JWT ID is blacklisted (i.e. the token was revoked).
 */
export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  try {
    const val = await redis.get(`bl:${jti}`);
    return val === '1';
  } catch (err) {
    logger.warn('Redis blacklist read failed (non-fatal) — allowing token:', err);
    return false; // fail open: don't block login if Redis is down
  }
}

// ─── Generic cache helpers ───────────────────────────────────────────────────

export async function cacheGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, value, 'EX', ttlSeconds);
  } catch (err) {
    logger.warn('Redis cache write failed (non-fatal):', err);
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    logger.warn('Redis cache delete failed (non-fatal):', err);
  }
}

export default redis;
