-- ============================================================
-- Migration : Politique de Crédit
-- Ajoute CreditPolicy, CreditPolicyStep et enrichit
-- WorkflowStep + CreditApplication avec le tracking du temps.
-- ============================================================

-- 1. Nouveau type enum PolicyStepType
DO $$ BEGIN
  CREATE TYPE "policy_step_type" AS ENUM ('dispatch', 'analysis', 'approval', 'committee');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Nouveaux événements de notification (extend enum)
ALTER TYPE "notif_event" ADD VALUE IF NOT EXISTS 'STEP_OVERDUE';
ALTER TYPE "notif_event" ADD VALUE IF NOT EXISTS 'STEP_PENDING_REMINDER';

-- 3. Table credit_policies
CREATE TABLE IF NOT EXISTS "credit_policies" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "code"        TEXT NOT NULL,
  "description" TEXT,
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "version"     INTEGER NOT NULL DEFAULT 1,
  "valid_from"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valid_to"    TIMESTAMP(3),
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "credit_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "credit_policies_code_key" ON "credit_policies"("code");

-- 4. Table credit_policy_steps
CREATE TABLE IF NOT EXISTS "credit_policy_steps" (
  "id"                     TEXT NOT NULL,
  "policy_id"              TEXT NOT NULL,
  "step_name"              TEXT NOT NULL,
  "step_label"             TEXT NOT NULL,
  "order"                  INTEGER NOT NULL,
  "step_type"              "policy_step_type" NOT NULL,
  "assigned_role"          "user_role" NOT NULL,
  "condition_min_amount"   DECIMAL(15,2),
  "condition_max_amount"   DECIMAL(15,2),
  "approval_min_amount"    DECIMAL(15,2),
  "approval_max_amount"    DECIMAL(15,2),
  "expected_duration_hours" INTEGER NOT NULL DEFAULT 24,
  "max_duration_hours"     INTEGER NOT NULL DEFAULT 72,
  "is_required"            BOOLEAN NOT NULL DEFAULT true,
  "is_active"              BOOLEAN NOT NULL DEFAULT true,
  "description"            TEXT,
  "credit_type_ids"        TEXT[] NOT NULL DEFAULT '{}',

  CONSTRAINT "credit_policy_steps_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_policy_steps_policy_id_fkey"
    FOREIGN KEY ("policy_id")
    REFERENCES "credit_policies"("id")
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "credit_policy_steps_policy_id_order_key"
  ON "credit_policy_steps"("policy_id", "order");

-- 5. Enrichissement de credit_applications
ALTER TABLE "credit_applications"
  ADD COLUMN IF NOT EXISTS "policy_id"               TEXT,
  ADD COLUMN IF NOT EXISTS "total_duration_minutes"  INTEGER;

ALTER TABLE "credit_applications"
  ADD CONSTRAINT "credit_applications_policy_id_fkey"
    FOREIGN KEY ("policy_id")
    REFERENCES "credit_policies"("id")
    ON DELETE SET NULL
    NOT VALID;

-- 6. Enrichissement de workflow_steps (tracking du temps + lien politique)
ALTER TABLE "workflow_steps"
  ADD COLUMN IF NOT EXISTS "policy_step_id"    TEXT,
  ADD COLUMN IF NOT EXISTS "started_at"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "duration_minutes"  INTEGER,
  ADD COLUMN IF NOT EXISTS "is_overdue"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "overdue_at"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notified_at"       TIMESTAMP(3);

ALTER TABLE "workflow_steps"
  ADD CONSTRAINT "workflow_steps_policy_step_id_fkey"
    FOREIGN KEY ("policy_step_id")
    REFERENCES "credit_policy_steps"("id")
    ON DELETE SET NULL
    NOT VALID;

-- Index utiles
CREATE INDEX IF NOT EXISTS "credit_policies_is_active_idx"      ON "credit_policies"("is_active");
CREATE INDEX IF NOT EXISTS "credit_policy_steps_policy_id_idx"  ON "credit_policy_steps"("policy_id");
CREATE INDEX IF NOT EXISTS "workflow_steps_policy_step_id_idx"  ON "workflow_steps"("policy_step_id");
CREATE INDEX IF NOT EXISTS "workflow_steps_is_overdue_idx"      ON "workflow_steps"("is_overdue");
CREATE INDEX IF NOT EXISTS "credit_applications_policy_id_idx"  ON "credit_applications"("policy_id");
