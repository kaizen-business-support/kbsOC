-- Create the database schema manually
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE "user_role" AS ENUM ('account_manager', 'credit_analyst', 'branch_manager', 'credit_committee', 'management', 'admin');
CREATE TYPE "application_status" AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'disbursed');
CREATE TYPE "repayment_schedule" AS ENUM ('monthly', 'quarterly', 'semiannual', 'annual');
CREATE TYPE "financial_period" AS ENUM ('annual', 'semester', 'quarterly');
CREATE TYPE "document_category" AS ENUM ('financial', 'legal', 'identity', 'collateral', 'other');
CREATE TYPE "document_status" AS ENUM ('processing', 'verified', 'error', 'pending');
CREATE TYPE "step_status" AS ENUM ('pending', 'in_review', 'approved', 'rejected', 'completed');

-- Create users table
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "name" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'account_manager',
    "department" TEXT,
    "job_title" TEXT,
    "permissions" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "azure_id" TEXT,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Create clients table
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "rccm" TEXT,
    "ninea" TEXT,
    "cofi" TEXT,
    "legal_form" TEXT,
    "sector" TEXT,
    "established_year" INTEGER,
    "headquarters" TEXT,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- Create credit_applications table
CREATE TABLE "credit_applications" (
    "id" TEXT NOT NULL,
    "application_number" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "purpose" TEXT NOT NULL,
    "duration_months" INTEGER,
    "proposed_rate" DECIMAL(5,2),
    "collateral_type" TEXT,
    "collateral_value" DECIMAL(15,2),
    "repayment_schedule" "repayment_schedule",
    "status" "application_status" NOT NULL DEFAULT 'draft',
    "score" JSONB,
    "analysis_results" JSONB,
    "submitted_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_applications_pkey" PRIMARY KEY ("id")
);

-- Create financial_data table
CREATE TABLE "financial_data" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "period" "financial_period" NOT NULL DEFAULT 'annual',
    "account_name" TEXT NOT NULL,
    "account_value" DECIMAL(15,2) NOT NULL,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_data_pkey" PRIMARY KEY ("id")
);

-- Create documents table
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "category" "document_category" NOT NULL DEFAULT 'other',
    "ocr_text" TEXT,
    "extracted_data" JSONB,
    "status" "document_status" NOT NULL DEFAULT 'pending',
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- Create workflow_steps table
CREATE TABLE "workflow_steps" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "step_name" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "assignee_id" TEXT,
    "status" "step_status" NOT NULL DEFAULT 'pending',
    "deadline" TIMESTAMP(3),
    "comments" TEXT,
    "decision" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- Create audit_logs table
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "application_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Create unique indexes
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_azure_id_key" ON "users"("azure_id");
CREATE UNIQUE INDEX "clients_rccm_key" ON "clients"("rccm");
CREATE UNIQUE INDEX "clients_ninea_key" ON "clients"("ninea");
CREATE UNIQUE INDEX "credit_applications_application_number_key" ON "credit_applications"("application_number");
CREATE UNIQUE INDEX "financial_data_client_id_year_period_account_name_key" ON "financial_data"("client_id", "year", "period", "account_name");

-- Add foreign key constraints
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_data" ADD CONSTRAINT "financial_data_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;