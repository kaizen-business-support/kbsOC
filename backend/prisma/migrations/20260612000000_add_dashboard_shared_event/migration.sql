-- Add DASHBOARD_SHARED value to notif_event enum
ALTER TYPE "notif_event" ADD VALUE IF NOT EXISTS 'DASHBOARD_SHARED';
