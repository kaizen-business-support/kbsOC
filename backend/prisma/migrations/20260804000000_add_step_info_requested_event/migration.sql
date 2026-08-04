-- Add STEP_INFO_REQUESTED value to notif_event enum
-- La route POST /workflows/:applicationId/approve (decision=REQUEST_INFO) déclenchait
-- déjà cet événement, mais la valeur manquait à l'enum : Prisma levait une
-- PrismaClientValidationError avalée par le try/catch de triggerNotification,
-- et aucune notification n'était jamais émise pour une demande d'informations.
ALTER TYPE "notif_event" ADD VALUE IF NOT EXISTS 'STEP_INFO_REQUESTED';
