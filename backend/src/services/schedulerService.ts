/**
 * schedulerService.ts — Cron-based scheduler.
 *
 * Schedule:
 *  - Partial backup every 6 hours
 *  - Full backup daily at 02:00
 *  - Cleanup of backups older than 30 days every Sunday at 03:00
 *  - Cleanup of audit logs older than 60 days daily at 04:00
 */

import cron from 'node-cron';
import { createBackup, deleteOldBackups } from './backupService';
import { processEmailQueue } from './emailQueueService';
import { logger } from '../utils/logger';
import { prisma } from '../server';

export function startScheduler(): void {
  // Partial backup every 6 hours: 0 */6 * * *
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Scheduled partial backup starting…');
    try {
      const filename = await createBackup('partial', 'scheduler');
      logger.info(`Scheduled partial backup OK: ${filename}`);
    } catch (err) {
      logger.error('Scheduled partial backup FAILED:', err);
    }
  });

  // Full backup every day at 02:00: 0 2 * * *
  cron.schedule('0 2 * * *', async () => {
    logger.info('Scheduled full backup starting…');
    try {
      const filename = await createBackup('full', 'scheduler');
      logger.info(`Scheduled full backup OK: ${filename}`);
    } catch (err) {
      logger.error('Scheduled full backup FAILED:', err);
    }
  });

  // Cleanup backups older than BACKUP_RETENTION_DAYS (default 30) every Sunday at 03:00: 0 3 * * 0
  cron.schedule('0 3 * * 0', () => {
    const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
    logger.info(`Cleaning backups older than ${retentionDays} days…`);
    const deleted = deleteOldBackups(retentionDays);
    logger.info(`Cleanup done: ${deleted} old backup(s) removed`);
  });

  // Cleanup audit logs older than AUDIT_RETENTION_DAYS (default 60) daily at 04:00
  cron.schedule('0 4 * * *', async () => {
    const retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '60', 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    try {
      const result = await prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      logger.info(`Audit log cleanup: ${result.count} entries older than ${retentionDays} days removed`);
    } catch (err) {
      logger.error('Audit log cleanup FAILED:', err);
    }
  });

  // Process email queue every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    try {
      const { sent, failed } = await processEmailQueue();
      if (sent > 0 || failed > 0) {
        logger.info(`Email queue processed: ${sent} sent, ${failed} failed`);
      }
    } catch (err) {
      logger.error('Email queue processing FAILED:', err);
    }
  });

  logger.info('Scheduler started (backup + audit log cleanup + email queue)');
}
