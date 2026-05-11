-- CreateEnum
CREATE TYPE "repayment_status" AS ENUM ('pending', 'paid', 'late', 'partial');

-- CreateTable
CREATE TABLE "repayment_entries" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "company_id" TEXT,
    "period_number" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "expected_amount" DECIMAL(15,2) NOT NULL,
    "expected_principal" DECIMAL(15,2) NOT NULL,
    "expected_interest" DECIMAL(15,2) NOT NULL,
    "status" "repayment_status" NOT NULL DEFAULT 'pending',
    "paid_amount" DECIMAL(15,2),
    "paid_at" TIMESTAMP(3),
    "verified_by_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repayment_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repayment_entries_application_id_period_number_key" ON "repayment_entries"("application_id", "period_number");
CREATE INDEX "repayment_entries_application_id_idx" ON "repayment_entries"("application_id");
CREATE INDEX "repayment_entries_company_id_idx" ON "repayment_entries"("company_id");

-- AddForeignKey
ALTER TABLE "repayment_entries" ADD CONSTRAINT "repayment_entries_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repayment_entries" ADD CONSTRAINT "repayment_entries_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
