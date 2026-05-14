-- CreateEnum
CREATE TYPE "public"."security_rule_type" AS ENUM ('allow', 'deny');

-- CreateEnum
CREATE TYPE "public"."security_applies_to" AS ENUM ('all', 'branch', 'department', 'role', 'user');

-- CreateEnum
CREATE TYPE "public"."security_block_reason" AS ENUM ('ip_blacklisted', 'outside_time_window', 'brute_force', 'manual');

-- CreateEnum
CREATE TYPE "public"."security_block_status" AS ENUM ('blocked', 'unblocked');

-- CreateTable
CREATE TABLE "public"."security_ip_rules" (
    "id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "rule_type" "public"."security_rule_type" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "company_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "security_ip_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."security_time_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "days_of_week" INTEGER NOT NULL,
    "time_start" TEXT NOT NULL,
    "time_end" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "applies_to" "public"."security_applies_to" NOT NULL,
    "target_values" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "denied_message" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "company_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "security_time_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."security_block_history" (
    "id" TEXT NOT NULL,
    "blocked_ip" TEXT NOT NULL,
    "attempted_user_id" TEXT,
    "block_reason" "public"."security_block_reason" NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "request_path" TEXT,
    "user_agent" TEXT,
    "status" "public"."security_block_status" NOT NULL DEFAULT 'blocked',
    "unblocked_by" TEXT,
    "unblocked_at" TIMESTAMP(3),
    "unblock_note" TEXT,
    "company_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_block_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_ip_rules_company_id_is_active_deleted_at_idx" ON "public"."security_ip_rules"("company_id", "is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "security_ip_rules_ip_address_idx" ON "public"."security_ip_rules"("ip_address");

-- CreateIndex
CREATE INDEX "security_time_rules_company_id_is_active_deleted_at_idx" ON "public"."security_time_rules"("company_id", "is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "security_block_history_company_id_status_created_at_idx" ON "public"."security_block_history"("company_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "security_block_history_blocked_ip_created_at_idx" ON "public"."security_block_history"("blocked_ip", "created_at");

-- AddForeignKey
ALTER TABLE "public"."security_ip_rules" ADD CONSTRAINT "security_ip_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."security_ip_rules" ADD CONSTRAINT "security_ip_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."security_time_rules" ADD CONSTRAINT "security_time_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."security_time_rules" ADD CONSTRAINT "security_time_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."security_block_history" ADD CONSTRAINT "security_block_history_attempted_user_id_fkey" FOREIGN KEY ("attempted_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."security_block_history" ADD CONSTRAINT "security_block_history_unblocked_by_fkey" FOREIGN KEY ("unblocked_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."security_block_history" ADD CONSTRAINT "security_block_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
