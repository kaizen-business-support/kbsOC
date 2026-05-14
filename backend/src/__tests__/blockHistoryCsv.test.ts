import { blockHistoryToCsv, BlockHistoryRow } from '../services/blockHistoryCsv';

const baseRow: BlockHistoryRow = {
  id: 'cuid-1',
  blockedIp: '198.51.100.42',
  attemptedUserId: 'u-1',
  attemptedUserName: 'Alice',
  blockReason: 'IP_BLACKLISTED',
  requestPath: '/api/clients',
  userAgent: 'curl/8.0',
  status: 'BLOCKED',
  unblockedById: null,
  unblockedByName: null,
  unblockedAt: null,
  unblockNote: null,
  createdAt: new Date('2026-05-14T10:00:00Z'),
};

describe('blockHistoryToCsv', () => {
  it('renvoie seulement le header pour un tableau vide', () => {
    const csv = blockHistoryToCsv([]);
    expect(csv).toBe(
      'id,blocked_ip,attempted_user_id,attempted_user_name,block_reason,request_path,user_agent,status,unblocked_by_id,unblocked_by_name,unblocked_at,unblock_note,created_at'
    );
  });

  it('sérialise une ligne simple', () => {
    const csv = blockHistoryToCsv([baseRow]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('cuid-1,198.51.100.42,u-1,Alice,IP_BLACKLISTED,/api/clients,curl/8.0,BLOCKED');
    expect(lines[1]).toContain('2026-05-14T10:00:00.000Z');
  });

  it('rend les nullables comme champ vide', () => {
    const csv = blockHistoryToCsv([{ ...baseRow, attemptedUserId: null, attemptedUserName: null, userAgent: null }]);
    const line = csv.split('\n')[1];
    expect(line).toContain(',,'); // au moins deux nullables consécutifs
  });

  it('échappe les virgules', () => {
    const csv = blockHistoryToCsv([{ ...baseRow, unblockNote: 'note, avec virgule' }]);
    expect(csv).toContain('"note, avec virgule"');
  });

  it('échappe les guillemets doubles', () => {
    const csv = blockHistoryToCsv([{ ...baseRow, unblockNote: 'dit "ok"' }]);
    expect(csv).toContain('"dit ""ok"""');
  });

  it('échappe les retours ligne', () => {
    const csv = blockHistoryToCsv([{ ...baseRow, unblockNote: 'ligne1\nligne2' }]);
    expect(csv).toContain('"ligne1\nligne2"');
  });

  it('user-agent avec virgule et quote → échappé', () => {
    const csv = blockHistoryToCsv([{ ...baseRow, userAgent: 'Mozilla/5.0 (Mac, "v2")' }]);
    expect(csv).toContain('"Mozilla/5.0 (Mac, ""v2"")"');
  });
});
