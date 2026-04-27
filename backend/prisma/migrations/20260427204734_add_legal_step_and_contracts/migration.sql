-- CreateEnum
CREATE TYPE "public"."contract_file_format" AS ENUM ('docx', 'pdf');

-- CreateEnum
CREATE TYPE "public"."contract_status" AS ENUM ('draft', 'pending_signature', 'signed', 'archived', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."signature_mode" AS ENUM ('manual', 'external');

-- CreateEnum
CREATE TYPE "public"."signatory_party" AS ENUM ('bank', 'client');

-- CreateEnum
CREATE TYPE "public"."signatory_status" AS ENUM ('pending', 'signed', 'declined');

-- AlterEnum
ALTER TYPE "public"."document_category" ADD VALUE 'contract';

-- AlterEnum
ALTER TYPE "public"."policy_step_type" ADD VALUE 'legal';

-- AlterTable
ALTER TABLE "public"."companies" ADD COLUMN     "legal_representative" TEXT,
ADD COLUMN     "signature_provider_config" JSONB;

-- CreateTable
CREATE TABLE "public"."contract_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "description" TEXT,
    "file_format" "public"."contract_file_format" NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "original_name" TEXT NOT NULL,
    "credit_type_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "custom_fields" JSONB NOT NULL DEFAULT '[]',
    "detected_variables" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."generated_contracts" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "document_id" TEXT,
    "status" "public"."contract_status" NOT NULL DEFAULT 'draft',
    "custom_values" JSONB NOT NULL DEFAULT '{}',
    "signature_mode" "public"."signature_mode",
    "external_provider_ref" TEXT,
    "signed_file_path" TEXT,
    "signed_file_hash" TEXT,
    "generated_by" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "generated_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contract_signatories" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "party" "public"."signatory_party" NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT,
    "status" "public"."signatory_status" NOT NULL DEFAULT 'pending',
    "signed_at" TIMESTAMP(3),
    "external_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_signatories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."webhook_event_log" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_event_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_templates_company_id_idx" ON "public"."contract_templates"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_templates_company_id_name_key" ON "public"."contract_templates"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "generated_contracts_document_id_key" ON "public"."generated_contracts"("document_id");

-- CreateIndex
CREATE INDEX "generated_contracts_application_id_idx" ON "public"."generated_contracts"("application_id");

-- CreateIndex
CREATE INDEX "generated_contracts_template_id_idx" ON "public"."generated_contracts"("template_id");

-- CreateIndex
CREATE INDEX "contract_signatories_contract_id_idx" ON "public"."contract_signatories"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_event_log_provider_event_id_key" ON "public"."webhook_event_log"("provider", "event_id");

-- AddForeignKey
ALTER TABLE "public"."contract_templates" ADD CONSTRAINT "contract_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."generated_contracts" ADD CONSTRAINT "generated_contracts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."generated_contracts" ADD CONSTRAINT "generated_contracts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."generated_contracts" ADD CONSTRAINT "generated_contracts_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."generated_contracts" ADD CONSTRAINT "generated_contracts_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contract_signatories" ADD CONSTRAINT "contract_signatories_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."generated_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
