/**
 * backupService.ts — PostgreSQL backup/restore service.
 *
 * Uses child_process.spawn (NOT exec) with explicit args to avoid shell injection.
 * Works on Linux (Ubuntu) and Windows (development).
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { createGzip } from 'zlib';
import { prisma } from '../server';
import { logger } from '../utils/logger';
import { sendEmail } from './notificationService';

// ─── Configuration ────────────────────────────────────────────────────────────

const isLinux = process.platform === 'linux';

const BACKUP_DIR = isLinux
  ? process.env.BACKUP_DIR || '/var/backups/credit_app'
  : process.env.BACKUP_DIR || path.resolve('./backups');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';
const DB_NAME = process.env.DB_NAME || 'optimus_credit';
const DB_USER = process.env.DB_USER || 'optimus';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

/**
 * Spawns pg_dump or psql either directly (when installed) or via `docker exec`
 * when DOCKER_PG_CONTAINER is set.
 * Env vars are read lazily (at call time) so dotenv.config() has already run.
 */
function spawnPg(pgCmd: string, pgArgs: string[]): ReturnType<typeof spawn> {
  const container = process.env.DOCKER_PG_CONTAINER || '';
  if (container) {
    const password = process.env.CONTAINER_PG_PASSWORD || '';
    return spawn('docker', [
      'exec', '-i',
      '-e', `PGPASSWORD=${password}`,
      container,
      pgCmd,
      ...pgArgs,
    ]);
  }
  return spawn(pgCmd, pgArgs, { env: { ...process.env, PGPASSWORD: DB_PASSWORD } });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info(`Backup directory created: ${BACKUP_DIR}`);
  }
}

function buildFilename(type: 'full' | 'partial'): string {
  const now = new Date();
  const date = now.toISOString().replace('T', '_').replace(/:/g, '-').split('.')[0];
  return `backup_${date}_${type}.sql.gz`;
}

async function sendNotificationEmail(subject: string, body: string): Promise<void> {
  // Fetch active recipients from DB
  let recipients: Array<{ email: string; name?: string | null }> = [];
  try {
    recipients = await (prisma as any).backupNotifyEmail.findMany({ where: { isActive: true } });
  } catch {
    // table may not exist yet — ignore
  }

  // Fallback to env vars if no DB recipients
  if (recipients.length === 0) {
    const fallback = process.env.BACKUP_NOTIFY_EMAIL || process.env.SMTP_USER;
    if (!fallback) return;
    recipients = [{ email: fallback }];
  }

  // Send to all active recipients in parallel
  await Promise.all(
    recipients.map(r =>
      sendEmail(r.email, subject, `<pre style="font-family:monospace">${body}</pre>`).catch((err: Error) =>
        logger.warn(`Backup notification to ${r.email} failed: ${err.message}`)
      )
    )
  );
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Create a database backup using pg_dump.
 * Returns the filename of the created backup.
 */
export async function createBackup(
  type: 'full' | 'partial' = 'full',
  createdBy?: string
): Promise<string> {
  ensureBackupDir();
  const filename = buildFilename(type);
  const filePath = path.join(BACKUP_DIR, filename);

  logger.info(`Starting ${type} backup → ${filename}`);

  const pgUser = process.env.DOCKER_PG_CONTAINER ? (process.env.CONTAINER_PG_USER || 'postgres') : DB_USER;
  const pgPort = process.env.DOCKER_PG_CONTAINER ? '5432' : DB_PORT;

  const pgDumpArgs = [
    '-h', DB_HOST,
    '-p', pgPort,
    '-U', pgUser,
    '-d', DB_NAME,
    '--no-password',
    '--format=plain',
  ];

  // For partial backup, skip large binary columns (just structure + critical data)
  if (type === 'partial') {
    pgDumpArgs.push('--exclude-table-data=documents');
  }

  return new Promise((resolve, reject) => {
    const pg = spawnPg('pg_dump', pgDumpArgs);
    const out = fs.createWriteStream(filePath);
    const gzip = createGzip();

    pg.stdout.pipe(gzip).pipe(out);

    let stderr = '';
    pg.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    pg.on('error', (err) => {
      reject(new Error(`pg_dump spawn failed: ${err.message}`));
    });

    pg.on('close', async (code) => {
      if (code !== 0) {
        // Clean up partial file
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        const errMsg = `pg_dump exited with code ${code}: ${stderr}`;
        logger.error(errMsg);

        await (prisma as any).backupLog.create({
          data: { filename, type, size: 0, status: 'failed', error: errMsg, createdBy }
        }).catch(() => {});

        sendNotificationEmail(
          `[OptimusCredit] Backup FAILED — ${filename}`,
          `Backup failed at ${new Date().toISOString()}\n\n${errMsg}`
        ).catch(() => {});
        reject(new Error(errMsg));
        return;
      }

      const size = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;

      await (prisma as any).backupLog.create({
        data: { filename, type, size, status: 'success', createdBy }
      }).catch(() => {});

      sendNotificationEmail(
        `[OptimusCredit] Backup OK — ${filename}`,
        `Backup completed at ${new Date().toISOString()}\nFile: ${filePath}\nSize: ${(size / 1024 / 1024).toFixed(2)} MB`
      ).catch(() => {});

      logger.info(`Backup completed: ${filename} (${(size / 1024).toFixed(0)} KB)`);
      resolve(filename);
    });
  });
}

/**
 * List available backup files.
 */
export function listBackups(): Array<{ filename: string; size: number; createdAt: Date; type: string }> {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup_') && f.endsWith('.sql.gz'))
    .sort()
    .reverse(); // Newest first

  return files.map(filename => {
    const filePath = path.join(BACKUP_DIR, filename);
    const stat = fs.statSync(filePath);
    const type = filename.includes('_full') ? 'full' : 'partial';
    return { filename, size: stat.size, createdAt: stat.mtime, type };
  });
}

/**
 * Restore from a backup file using psql.
 * DANGEROUS: This overwrites the current database.
 */
export async function restoreBackup(filename: string): Promise<void> {
  // Validate filename — only alphanumerics, dashes, underscores, and dots
  if (!/^[a-zA-Z0-9_\-.]+\.sql\.gz$/.test(filename)) {
    throw new Error('Invalid backup filename');
  }

  const filePath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found: ${filename}`);
  }

  // Ensure path is within BACKUP_DIR
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(BACKUP_DIR))) {
    throw new Error('Invalid backup path');
  }

  logger.warn(`Starting database restore from: ${filename}`);

  const pgUser = process.env.DOCKER_PG_CONTAINER ? (process.env.CONTAINER_PG_USER || 'postgres') : DB_USER;
  const pgPort = process.env.DOCKER_PG_CONTAINER ? '5432' : DB_PORT;

  return new Promise((resolve, reject) => {
    const psql = spawnPg('psql', [
      '-h', DB_HOST,
      '-p', pgPort,
      '-U', pgUser,
      '-d', DB_NAME,
      '--no-password',
    ]);

    const input = fs.createReadStream(filePath);
    const gunzip = require('zlib').createGunzip();

    input.pipe(gunzip).pipe(psql.stdin);

    let stderr = '';
    psql.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    psql.on('error', reject);
    psql.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`psql restore failed (code ${code}): ${stderr}`));
      } else {
        logger.info(`Restore completed from: ${filename}`);
        sendNotificationEmail(
          `[OptimusCredit] Database RESTORED — ${filename}`,
          `Restore completed at ${new Date().toISOString()}\nSource: ${filename}`
        ).catch(() => {});
        resolve();
      }
    });
  });
}

/**
 * Delete a backup file by name.
 */
export function deleteBackupFile(filename: string): void {
  if (!/^[a-zA-Z0-9_\-.]+\.sql\.gz$/.test(filename)) {
    throw new Error('Invalid backup filename');
  }
  const filePath = path.join(BACKUP_DIR, filename);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(BACKUP_DIR))) {
    throw new Error('Invalid backup path');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filename}`);
  }
  fs.unlinkSync(filePath);
  logger.info(`Backup deleted: ${filename}`);
}

/**
 * Delete backup files older than retentionDays.
 */
export function deleteOldBackups(retentionDays = 30): number {
  ensureBackupDir();
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let deleted = 0;

  fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup_') && f.endsWith('.sql.gz'))
    .forEach(filename => {
      const filePath = path.join(BACKUP_DIR, filename);
      const stat = fs.statSync(filePath);
      if (stat.mtime.getTime() < cutoff) {
        fs.unlinkSync(filePath);
        deleted++;
        logger.info(`Old backup deleted: ${filename}`);
      }
    });

  return deleted;
}

export { BACKUP_DIR };
