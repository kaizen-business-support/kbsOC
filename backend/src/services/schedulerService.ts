/**
 * schedulerService.ts — Cron-based backup scheduler.
 *
 * Schedule:
 *  - Partial backup every 6 hours
 *  - Full backup daily at 02:00
 *  - Cleanup of backups older than 30 days every Sunday at 03:00
 */

import cron from 'node-cron';
import { createBackup, deleteOldBackups } from './backupService';
import { logger } from '../utils/logger';

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

  logger.info('Backup scheduler started');
}
