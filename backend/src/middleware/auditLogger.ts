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
  backup:                   'backup',
  announcements:            'announcement',
  'notification-channels':  'notification_channel',
  'notification-templates': 'notification_template',
  'notification-rules':     'notification_rule',
  notifications:            'notification',
};

const METHOD_ACTION: Record<string, string> = {
  POST:   'CREATE',
  PUT:    'UPDATE',
  PATCH:  'UPDATE',
  DELETE: 'DELETE',
};

// Regex patterns to detect ID-like path segments (UUID or numeric)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUM_RE  = /^\d+$/;

function extractEntityId(segment: string | undefined): string | null {
  if (!segment) return null;
  if (UUID_RE.test(segment) || NUM_RE.test(segment)) return segment;
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

    // Parse URL: /api/<segment>/<id?>/<sub?>
    // e.g., /api/clients/abc-123 → ['api', 'clients', 'abc-123']
    //        /api/backup/restore  → ['api', 'backup', 'restore']
    const urlWithoutQuery = req.originalUrl.split('?')[0];
    const parts = urlWithoutQuery.split('/').filter(Boolean);

    const entitySegment = parts[1] || 'unknown';
    const entityType    = ENTITY_MAP[entitySegment] || entitySegment;
    const entityId      = extractEntityId(parts[2]);

    // Build action string, e.g., CREATE_CLIENT, UPDATE_USER, DELETE_BACKUP
    const action = `${actionPrefix}_${entityType.toUpperCase()}`;

    const logData: any = {
      userId:    user.id,
      action,
      entityType,
      ipAddress: req.ip || (req.socket as any)?.remoteAddress || null,
      userAgent: req.get('User-Agent') || null,
    };
    if (entityId) logData.entityId = entityId;

    prisma.auditLog
      .create({ data: logData })
      .catch((err: Error) => {
        logger.warn(`[auditLogger] Write failed: ${err.message}`);
      });
  });

  next();
}
