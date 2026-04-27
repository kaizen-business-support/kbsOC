-- AlterTable
ALTER TABLE "credit_policy_steps" ADD COLUMN "allowed_actions" TEXT[] NOT NULL DEFAULT '{}';
