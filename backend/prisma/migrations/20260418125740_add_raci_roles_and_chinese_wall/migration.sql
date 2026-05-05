-- CreateEnum
CREATE TYPE "public"."raci_code" AS ENUM ('r', 'a', 'c', 'i');

-- AlterTable
ALTER TABLE "public"."credit_policy_steps" ADD COLUMN     "phase" TEXT;

-- CreateTable
CREATE TABLE "public"."credit_policy_step_roles" (
    "id" TEXT NOT NULL,
    "policy_step_id" TEXT NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "raci_code" "public"."raci_code" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_policy_step_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenant_chinese_wall_rules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "blocked_role" "public"."user_role" NOT NULL,
    "forbidden_step" TEXT NOT NULL,
    "reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_chinese_wall_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_policy_step_roles_policy_step_id_idx" ON "public"."credit_policy_step_roles"("policy_step_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_policy_step_roles_policy_step_id_role_raci_code_key" ON "public"."credit_policy_step_roles"("policy_step_id", "role", "raci_code");

-- CreateIndex
CREATE INDEX "tenant_chinese_wall_rules_company_id_idx" ON "public"."tenant_chinese_wall_rules"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_chinese_wall_rules_company_id_blocked_role_forbidden_key" ON "public"."tenant_chinese_wall_rules"("company_id", "blocked_role", "forbidden_step");

-- AddForeignKey
ALTER TABLE "public"."credit_policy_step_roles" ADD CONSTRAINT "credit_policy_step_roles_policy_step_id_fkey" FOREIGN KEY ("policy_step_id") REFERENCES "public"."credit_policy_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_chinese_wall_rules" ADD CONSTRAINT "tenant_chinese_wall_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
