-- AlterTable
ALTER TABLE "public"."approval_limits" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."credit_type_workflow_steps" ADD COLUMN     "condition_max_amount" DECIMAL(15,2),
ADD COLUMN     "condition_min_amount" DECIMAL(15,2);
