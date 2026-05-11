-- AlterTable
ALTER TABLE "clients" ADD COLUMN "account_number" VARCHAR(30);

-- CreateIndex
CREATE UNIQUE INDEX "clients_account_number_key" ON "clients"("account_number");
