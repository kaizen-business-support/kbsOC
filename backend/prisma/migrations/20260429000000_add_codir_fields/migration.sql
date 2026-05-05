-- Migration: ajouter les champs d'escalade et de relance sur workflow_steps

ALTER TABLE "workflow_steps" ADD COLUMN "is_escalated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workflow_steps" ADD COLUMN "escalated_at" TIMESTAMP(3);
ALTER TABLE "workflow_steps" ADD COLUMN "escalated_by_id" TEXT;
ALTER TABLE "workflow_steps" ADD COLUMN "last_relanced_at" TIMESTAMP(3);
