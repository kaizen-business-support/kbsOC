/**
 * Tests unitaires pour bruteForceTracker avec un mock du client Redis.
 *
 * Le mock simule INCR/SET/EXISTS/DEL/EXPIRE/TTL avec une Map en mémoire +
 * gestion de TTL via setTimeout (ici pas nécessaire pour les assertions).
 */

const ttlMap = new Map<string, number>();
const dataMap = new Map<string, string>();

const fakeRedis = {
  async incr(key: string): Promise<number> {
    const cur = Number(dataMap.get(key) ?? 0);
    const next = cur + 1;
    dataMap.set(key, String(next));
    return next;
  },
  async expire(key: string, sec: number): Promise<number> {
    if (!dataMap.has(key)) return 0;
    ttlMap.set(key, sec);
    return 1;
  },
  async set(key: string, value: string, _flag?: string, sec?: number): Promise<'OK'> {
    dataMap.set(key, value);
    if (typeof sec === 'number') ttlMap.set(key, sec);
    return 'OK';
  },
  async exists(key: string): Promise<number> {
    return dataMap.has(key) ? 1 : 0;
  },
  async ttl(key: string): Promise<number> {
    return ttlMap.get(key) ?? -1;
  },
  async del(key: string): Promise<number> {
    const had = dataMap.delete(key);
    ttlMap.delete(key);
    return had ? 1 : 0;
  },
};

jest.mock('../services/redis', () => ({
  __esModule: true,
  default: fakeRedis,
}));

import {
  recordFailedAttempt, recordSuccessfulAttempt, isBlocked, purgeBlocksForEmail, getBruteForceConfig,
} from '../services/bruteForceTracker';

beforeEach(() => {
  dataMap.clear();
  ttlMap.clear();
  process.env.BF_THRESHOLD = '5';
  process.env.BF_WINDOW_SEC = '300';
  process.env.BF_BLOCK_DURATION_SEC = '900';
});

describe('getBruteForceConfig', () => {
  it('lit les env vars', () => {
    const c = getBruteForceConfig();
    expect(c.threshold).toBe(5);
    expect(c.windowSec).toBe(300);
    expect(c.blockDurationSec).toBe(900);
  });
  it('fallback defaults si env absents', () => {
    delete process.env.BF_THRESHOLD;
    delete process.env.BF_WINDOW_SEC;
    delete process.env.BF_BLOCK_DURATION_SEC;
    const c = getBruteForceConfig();
    expect(c.threshold).toBe(5);
    expect(c.windowSec).toBe(300);
    expect(c.blockDurationSec).toBe(900);
  });
});

describe('recordFailedAttempt', () => {
  it('premier appel → blocked false, counter=1, EXPIRE posé', async () => {
    const r = await recordFailedAttempt('user@test.local');
    expect(r.blocked).toBe(false);
    expect(dataMap.get('bf:fail:user:user@test.local')).toBe('1');
    expect(ttlMap.get('bf:fail:user:user@test.local')).toBe(300);
  });

  it('4 appels → blocked false (sous le seuil)', async () => {
    for (let i = 0; i < 4; i++) {
      const r = await recordFailedAttempt('user@test.local');
      expect(r.blocked).toBe(false);
    }
    expect(dataMap.get('bf:fail:user:user@test.local')).toBe('4');
  });

  it('5ème appel → blocked true, flag posé avec TTL 900', async () => {
    let lastResult = { blocked: false };
    for (let i = 0; i < 5; i++) lastResult = await recordFailedAttempt('user@test.local');
    expect(lastResult.blocked).toBe(true);
    expect(dataMap.get('bf:block:user:user@test.local')).toBe('1');
    expect(ttlMap.get('bf:block:user:user@test.local')).toBe(900);
  });

  it('6ème appel → blocked false (transition déjà passée)', async () => {
    for (let i = 0; i < 5; i++) await recordFailedAttempt('user@test.local');
    const r = await recordFailedAttempt('user@test.local');
    expect(r.blocked).toBe(false);
  });

  it('normalise l\'email (trim + lowercase)', async () => {
    await recordFailedAttempt('  USER@Mail.com  ');
    expect(dataMap.get('bf:fail:user:user@mail.com')).toBe('1');
  });

  it('email vide → no-op', async () => {
    const r = await recordFailedAttempt('');
    expect(r.blocked).toBe(false);
    expect(dataMap.size).toBe(0);
  });
});

describe('recordSuccessfulAttempt', () => {
  it('purge fail counter ET block flag', async () => {
    for (let i = 0; i < 5; i++) await recordFailedAttempt('user@test.local');
    expect(dataMap.has('bf:fail:user:user@test.local')).toBe(true);
    expect(dataMap.has('bf:block:user:user@test.local')).toBe(true);
    await recordSuccessfulAttempt('user@test.local');
    expect(dataMap.has('bf:fail:user:user@test.local')).toBe(false);
    expect(dataMap.has('bf:block:user:user@test.local')).toBe(false);
  });
});

describe('isBlocked', () => {
  it('renvoie false si flag absent', async () => {
    const r = await isBlocked('user@test.local');
    expect(r.blocked).toBe(false);
  });
  it('renvoie true + ttl si flag présent', async () => {
    for (let i = 0; i < 5; i++) await recordFailedAttempt('user@test.local');
    const r = await isBlocked('user@test.local');
    expect(r.blocked).toBe(true);
    expect(r.ttlSec).toBe(900);
  });
});

describe('purgeBlocksForEmail', () => {
  it('supprime les deux clés', async () => {
    for (let i = 0; i < 5; i++) await recordFailedAttempt('user@test.local');
    await purgeBlocksForEmail('user@test.local');
    expect(dataMap.has('bf:fail:user:user@test.local')).toBe(false);
    expect(dataMap.has('bf:block:user:user@test.local')).toBe(false);
  });
});
