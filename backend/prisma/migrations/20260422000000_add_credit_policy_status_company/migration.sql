-- Migration : colonnes manquantes sur credit_policies et credit_policy_steps
-- Ajoute status, company_id, phase, guards + contraintes associées

-- 1. Enum policy_status (si absent)
DO $$ BEGIN
  CREATE TYPE "policy_status" AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Colonnes manquantes sur credit_policies
ALTER TABLE "credit_policies"
  ADD COLUMN IF NOT EXISTS "status"     "policy_status" NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "company_id" TEXT;

-- 3. Contrainte FK vers companies (si la table existe)
DO $$ BEGIN
  ALTER TABLE "credit_policies"
    ADD CONSTRAINT "credit_policies_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id")
      ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Supprimer l'ancienne contrainte unique sur code seul (si elle existe)
DROP INDEX IF EXISTS "credit_policies_code_key";

-- 5. Nouvelle contrainte unique (company_id, code)
CREATE UNIQUE INDEX IF NOT EXISTS "credit_policies_company_id_code_key"
  ON "credit_policies"("company_id", "code");

-- 6. Index sur company_id
CREATE INDEX IF NOT EXISTS "credit_policies_company_id_idx"
  ON "credit_policies"("company_id");

-- 7. Colonnes manquantes sur credit_policy_steps
ALTER TABLE "credit_policy_steps"
  ADD COLUMN IF NOT EXISTS "phase"  TEXT,
  ADD COLUMN IF NOT EXISTS "guards" JSONB;
