/**
 * auditLogger.ts — Global middleware that records mutating operations to AuditLog.
 *
 * Runs after authenticate() middleware (so req.user is available).
 * Uses res.on('finish') pattern to write logs asynchronously without
 * blocking the response (fire-and-forget with individual error handling).
 *
 * Only successful (2xx) POST / PUT / PATCH / DELETE requests are logged.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import { logger } from '../utils/logger';

// Maps URL path segments to readable entity type names
const ENTITY_MAP: Record<string, string> = {
  clients:                  'client',
  applications:             'application',
  workflows:                'workflow',
  'workflow-config':        'workflow_config',
  users:                    'user',
  roles:                    'role',
  departments:              'department',
  branches:                 'branch',
  'approval-limits':        'approval_limit',
  'credit-types':           'credit_type',
  'credit-policies':        'credit_policy',
  dispatching:              'application',
  backup:                   'backup',
  announcements:            'announcement',
  'notification-channels':  'notification_channel',
  'notification-templates': 'notification_template',
  'notification-rules':     'notification_rule',
  notifications:            'notification',
  documents:                'document',
  otp:                      'session',
  '2fa':                    'two_factor',
  'bank-holidays':          'bank_holiday',
};

const METHOD_ACTION: Record<string, string> = {
  POST:   'CREATE',
  PUT:    'UPDATE',
  PATCH:  'UPDATE',
  DELETE: 'DELETE',
};

// Verb → action prefix for special sub-path routes
const VERB_ACTION: Record<string, string> = {
  approve:                  'APPROVE',
  reject:                   'REJECT',
  'start-step':             'START_STEP',
  assign:                   'ASSIGN',
  reassign:                 'REASSIGN',
  restore:                  'RESTORE',
  setup:                    'SETUP',
  disable:                  'DISABLE',
  verify:                   'VERIFY',
  'verify-setup':           'VERIFY_SETUP',
  'change-password':        'CHANGE_PASSWORD',
  'change-password-forced': 'CHANGE_PASSWORD',
  'reset-password':         'RESET_PASSWORD',
  'forgot-password':        'REQUEST_PASSWORD_RESET',
  'regenerate-backup-codes':'REGENERATE_BACKUP_CODES',
  activate:                 'ACTIVATE',
  deactivate:               'DEACTIVATE',
  archive:                  'ARCHIVE',
};

// Regex patterns to detect ID-like path segments (UUID, CUID, or numeric)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUID_RE = /^c[a-z0-9]{20,}$/i;
const NUM_RE  = /^\d+$/;

function isIdSegment(s: string | undefined): boolean {
  if (!s) return false;
  return UUID_RE.test(s) || CUID_RE.test(s) || NUM_RE.test(s);
}

/**
 * Extracts relevant body fields for the audit trail depending on the action.
 * Returns null if there is nothing worth capturing.
 */
function buildNewValues(subVerb: string | undefined, entitySegment: string, body: any): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;

  // Workflow decision (approve/reject)
  if (subVerb === 'approve') {
    const vals: Record<string, unknown> = {};
    if (body.decision)  vals.decision = body.decision;
    if (body.comments)  vals.comments = body.comments;
    return Object.keys(vals).length ? vals : null;
  }

  // Dispatching: capture who was assigned
  if (entitySegment === 'dispatching') {
    const vals: Record<string, unknown> = {};
    if (body.analystId)     vals.analystId     = body.analystId;
    if (body.applicationId) vals.applicationId = body.applicationId;
    if (body.isReassign)    vals.isReassign    = body.isReassign;
    if (body.comment)       vals.comment       = body.comment;
    return Object.keys(vals).length ? vals : null;
  }

  // 2FA changes
  if (entitySegment === '2fa') {
    if (body.userId) return { userId: body.userId };
    return null;
  }

  return null;
}

export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  // Only instrument mutating HTTP methods
  const actionPrefix = METHOD_ACTION[req.method];
  if (!actionPrefix) {
    next();
    return;
  }

  res.on('finish', () => {
    // Only log successful responses
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    const user = (req as any).user;
    if (!user?.id) return;

    // Parse URL: /api/<segment>/<id-or-verb?>/<verb-or-id?>/<...>
    const urlWithoutQuery = req.originalUrl.split('?')[0];
    const parts = urlWithoutQuery.split('/').filter(Boolean);
    // e.g. /api/workflows/abc/approve  → ['api', 'workflows', 'abc', 'approve']
    //      /api/dispatching/assign      → ['api', 'dispatching', 'assign']
    //      /api/auth/2fa/setup          → ['api', 'auth', '2fa', 'setup']

    let entitySegment = parts[1] || 'unknown';

    // /api/auth/2fa/* → treat as two_factor entity
    if (entitySegment === 'auth' && parts[2] === '2fa') {
      entitySegment = '2fa';
    }

    const entityType = ENTITY_MAP[entitySegment] ?? entitySegment.replace(/-/g, '_');

    const part2 = parts[2]; // first segment after entity
    const part3 = parts[3]; // second segment after entity

    // Entity ID: first UUID/CUID/number found in path, or fall back to body
    const idAt2 = isIdSegment(part2) ? part2 : null;
    const idAt3 = isIdSegment(part3) ? part3 : null;
    const entityId =
      idAt2 ??
      idAt3 ??
      (req.body?.applicationId as string | undefined) ??
      null;

    // Sub-verb: the first non-ID path segment after the entity name
    const subVerbRaw = idAt2 ? part3 : part2;
    const subVerb = subVerbRaw && !isIdSegment(subVerbRaw) ? subVerbRaw : undefined;

    // Build action string
    let action: string;
    if (subVerb) {
      const verbPrefix = VERB_ACTION[subVerb] ?? subVerb.toUpperCase().replace(/-/g, '_');
      action = `${verbPrefix}_${entityType.toUpperCase()}`;
    } else {
      action = `${actionPrefix}_${entityType.toUpperCase()}`;
    }

    // Workflow decisions: the 'approve' endpoint handles both APPROVED and REJECTED
    // → use the actual decision from the body as the action verb
    if (subVerb === 'approve' && req.body?.decision === 'REJECTED') {
      action = `REJECT_${entityType.toUpperCase()}`;
    }

    // Capture relevant body fields as newValues for richer audit trail
    const newValues = buildNewValues(subVerb, entitySegment, req.body);

    const logData: any = {
      userId:    user.id,
      action,
      entityType,
      ipAddress: req.ip || (req.socket as any)?.remoteAddress || null,
      userAgent: req.get('User-Agent') || null,
    };
    if (entityId)  logData.entityId  = entityId;
    if (newValues) logData.newValues = newValues;

    prisma.auditLog
      .create({ data: logData })
      .catch((err: Error) => {
        logger.warn(`[auditLogger] Write failed: ${err.message}`);
      });
  });

  next();
}
