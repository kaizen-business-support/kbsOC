-- DropIndex
DROP INDEX "public"."approval_limits_role_key";

-- DropIndex
DROP INDEX "public"."credit_policies_code_key";

-- DropIndex
DROP INDEX "public"."credit_types_code_key";

-- DropIndex
DROP INDEX "public"."credit_types_name_key";

-- AlterTable
ALTER TABLE "public"."branches" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "public"."departments" ADD COLUMN     "company_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "approval_limits_company_id_role_key" ON "public"."approval_limits"("company_id", "role");

-- CreateIndex
CREATE INDEX "branches_company_id_idx" ON "public"."branches"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_policies_company_id_code_key" ON "public"."credit_policies"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "credit_types_company_id_name_key" ON "public"."credit_types"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "credit_types_company_id_code_key" ON "public"."credit_types"("company_id", "code");

-- CreateIndex
CREATE INDEX "departments_company_id_idx" ON "public"."departments"("company_id");

-- AddForeignKey
ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branches" ADD CONSTRAINT "branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
