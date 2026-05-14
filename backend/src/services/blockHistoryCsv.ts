/**
 * blockHistoryCsv.ts
 *
 * Sérialiseur CSV (RFC 4180) pour les entrées security_block_history.
 * Pur, sans dépendance Prisma. Testable.
 */

export interface BlockHistoryRow {
  id: string;
  blockedIp: string;
  attemptedUserId: string | null;
  attemptedUserName: string | null;
  blockReason: string;
  requestPath: string | null;
  userAgent: string | null;
  status: string;
  unblockedById: string | null;
  unblockedByName: string | null;
  unblockedAt: Date | string | null;
  unblockNote: string | null;
  createdAt: Date | string;
}

const HEADER = [
  'id', 'blocked_ip', 'attempted_user_id', 'attempted_user_name',
  'block_reason', 'request_path', 'user_agent', 'status',
  'unblocked_by_id', 'unblocked_by_name', 'unblocked_at', 'unblock_note',
  'created_at',
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToCsv(r: BlockHistoryRow): string {
  return [
    r.id, r.blockedIp, r.attemptedUserId, r.attemptedUserName,
    r.blockReason, r.requestPath, r.userAgent, r.status,
    r.unblockedById, r.unblockedByName, r.unblockedAt, r.unblockNote,
    r.createdAt,
  ].map(csvEscape).join(',');
}

export function blockHistoryToCsv(rows: BlockHistoryRow[]): string {
  const lines = [HEADER.join(',')];
  for (const r of rows) lines.push(rowToCsv(r));
  return lines.join('\n');
}
