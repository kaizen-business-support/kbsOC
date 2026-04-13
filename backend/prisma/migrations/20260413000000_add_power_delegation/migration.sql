-- Ajouter is_on_leave sur les utilisateurs
ALTER TABLE "users" ADD COLUMN "is_on_leave" BOOLEAN NOT NULL DEFAULT false;

-- Créer la table power_delegations
CREATE TABLE "power_delegations" (
  "id"             TEXT NOT NULL,
  "delegator_id"   TEXT NOT NULL,
  "delegate_id"    TEXT NOT NULL,
  "start_date"     TIMESTAMP(3) NOT NULL,
  "end_date"       TIMESTAMP(3) NOT NULL,
  "reason"         TEXT,
  "permissions"    JSONB NOT NULL,
  "is_active"      BOOLEAN NOT NULL DEFAULT true,
  "created_by_id"  TEXT NOT NULL,
  "revoked_at"     TIMESTAMP(3),
  "revoked_by_id"  TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "power_delegations_pkey" PRIMARY KEY ("id")
);

-- Index
CREATE INDEX "power_delegations_delegator_id_idx"  ON "power_delegations"("delegator_id");
CREATE INDEX "power_delegations_delegate_id_idx"   ON "power_delegations"("delegate_id");
CREATE INDEX "power_delegations_active_dates_idx"  ON "power_delegations"("is_active", "start_date", "end_date");

-- Foreign keys
ALTER TABLE "power_delegations"
  ADD CONSTRAINT "power_delegations_delegator_id_fkey"
    FOREIGN KEY ("delegator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "power_delegations_delegate_id_fkey"
    FOREIGN KEY ("delegate_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "power_delegations_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "power_delegations_revoked_by_id_fkey"
    FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
