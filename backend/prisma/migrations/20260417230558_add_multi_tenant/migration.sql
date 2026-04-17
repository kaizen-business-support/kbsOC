-- CreateEnum
CREATE TYPE "public"."policy_step_type" AS ENUM ('dispatch', 'analysis', 'approval', 'committee');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "public"."notif_event" ADD VALUE 'STEP_OVERDUE';
ALTER TYPE "public"."notif_event" ADD VALUE 'STEP_PENDING_REMINDER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "public"."user_role" ADD VALUE 'super_admin';
ALTER TYPE "public"."user_role" ADD VALUE 'back_office';
ALTER TYPE "public"."user_role" ADD VALUE 'direction_juridique';

-- DropIndex
DROP INDEX "public"."clients_ninea_key";

-- DropIndex
DROP INDEX "public"."clients_rccm_key";

-- AlterTable
ALTER TABLE "public"."announcements" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "public"."approval_limits" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "public"."clients" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "public"."credit_applications" ADD COLUMN     "company_id" TEXT,
ADD COLUMN     "policy_id" TEXT,
ADD COLUMN     "total_duration_minutes" INTEGER;

-- AlterTable
ALTER TABLE "public"."credit_types" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "public"."notifications" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "public"."power_delegations" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "public"."workflow_steps" ADD COLUMN     "duration_minutes" INTEGER,
ADD COLUMN     "is_overdue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notified_at" TIMESTAMP(3),
ADD COLUMN     "overdue_at" TIMESTAMP(3),
ADD COLUMN     "policy_step_id" TEXT,
ADD COLUMN     "started_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."company_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credit_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMP(3),
    "company_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credit_policy_steps" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "step_name" TEXT NOT NULL,
    "step_label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "step_type" "public"."policy_step_type" NOT NULL,
    "assigned_role" "public"."user_role" NOT NULL,
    "condition_min_amount" DECIMAL(15,2),
    "condition_max_amount" DECIMAL(15,2),
    "approval_min_amount" DECIMAL(15,2),
    "approval_max_amount" DECIMAL(15,2),
    "expected_duration_hours" INTEGER NOT NULL DEFAULT 24,
    "max_duration_hours" INTEGER NOT NULL DEFAULT 72,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "credit_type_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "credit_policy_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "public"."companies"("code");

-- CreateIndex
CREATE INDEX "company_memberships_company_id_idx" ON "public"."company_memberships"("company_id");

-- CreateIndex
CREATE INDEX "company_memberships_user_id_idx" ON "public"."company_memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_memberships_user_id_company_id_key" ON "public"."company_memberships"("user_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_policies_code_key" ON "public"."credit_policies"("code");

-- CreateIndex
CREATE INDEX "credit_policies_company_id_idx" ON "public"."credit_policies"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_policy_steps_policy_id_order_key" ON "public"."credit_policy_steps"("policy_id", "order");

-- CreateIndex
CREATE INDEX "announcements_company_id_idx" ON "public"."announcements"("company_id");

-- CreateIndex
CREATE INDEX "approval_limits_company_id_idx" ON "public"."approval_limits"("company_id");

-- CreateIndex
CREATE INDEX "clients_company_id_idx" ON "public"."clients"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_company_id_rccm_key" ON "public"."clients"("company_id", "rccm");

-- CreateIndex
CREATE UNIQUE INDEX "clients_company_id_ninea_key" ON "public"."clients"("company_id", "ninea");

-- CreateIndex
CREATE INDEX "credit_applications_company_id_idx" ON "public"."credit_applications"("company_id");

-- CreateIndex
CREATE INDEX "credit_types_company_id_idx" ON "public"."credit_types"("company_id");

-- CreateIndex
CREATE INDEX "notifications_company_id_idx" ON "public"."notifications"("company_id");

-- CreateIndex
CREATE INDEX "power_delegations_company_id_idx" ON "public"."power_delegations"("company_id");

-- AddForeignKey
ALTER TABLE "public"."company_memberships" ADD CONSTRAINT "company_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."company_memberships" ADD CONSTRAINT "company_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."announcements" ADD CONSTRAINT "announcements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clients" ADD CONSTRAINT "clients_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_applications" ADD CONSTRAINT "credit_applications_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."credit_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_applications" ADD CONSTRAINT "credit_applications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_steps" ADD CONSTRAINT "workflow_steps_policy_step_id_fkey" FOREIGN KEY ("policy_step_id") REFERENCES "public"."credit_policy_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."approval_limits" ADD CONSTRAINT "approval_limits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_types" ADD CONSTRAINT "credit_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_policies" ADD CONSTRAINT "credit_policies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_policy_steps" ADD CONSTRAINT "credit_policy_steps_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."credit_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."power_delegations" ADD CONSTRAINT "power_delegations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."power_delegations_active_dates_idx" RENAME TO "power_delegations_is_active_start_date_end_date_idx";
