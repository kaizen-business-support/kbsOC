-- AlterTable
-- IF NOT EXISTS pour rester idempotent : si la colonne existe déjà (cas d'une DB
-- pré-existante baselinée sans cette migration jouée), la commande est un no-op.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMP(3);
