-- CreateEnum
CREATE TYPE "public"."user_role" AS ENUM ('account_manager', 'credit_analyst', 'branch_manager', 'credit_committee', 'management', 'admin');

-- CreateEnum
CREATE TYPE "public"."application_status" AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'disbursed');

-- CreateEnum
CREATE TYPE "public"."repayment_schedule" AS ENUM ('monthly', 'quarterly', 'semiannual', 'annual');

-- CreateEnum
CREATE TYPE "public"."financial_period" AS ENUM ('annual', 'semester', 'quarterly');

-- CreateEnum
CREATE TYPE "public"."document_category" AS ENUM ('financial', 'legal', 'identity', 'collateral', 'other');

-- CreateEnum
CREATE TYPE "public"."document_status" AS ENUM ('processing', 'verified', 'error', 'pending');

-- CreateEnum
CREATE TYPE "public"."step_status" AS ENUM ('pending', 'in_review', 'approved', 'rejected', 'completed');

-- CreateEnum
CREATE TYPE "public"."announcement_priority" AS ENUM ('info', 'warning', 'urgent');

-- CreateEnum
CREATE TYPE "public"."step_type" AS ENUM ('fixed', 'approval');

-- CreateEnum
CREATE TYPE "public"."channel_type" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "public"."notif_event" AS ENUM ('APPLICATION_SUBMITTED', 'STEP_ASSIGNED', 'STEP_APPROVED', 'STEP_REJECTED', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED');

-- CreateEnum
CREATE TYPE "public"."notif_type" AS ENUM ('INFO', 'ACTION_REQUIRED', 'SUCCESS', 'WARNING');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "name" TEXT NOT NULL,
    "role" "public"."user_role" NOT NULL DEFAULT 'account_manager',
    "department" TEXT,
    "job_title" TEXT,
    "phone" TEXT,
    "permissions" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "azure_id" TEXT,
    "last_login" TIMESTAMP(3),
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "backup_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "two_factor_required" BOOLEAN NOT NULL DEFAULT false,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "password_expires_at" TIMESTAMP(3),
    "password_reset_token" TEXT,
    "password_reset_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "public"."announcement_priority" NOT NULL DEFAULT 'info',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."clients" (
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credit_applications" (
    "id" TEXT NOT NULL,
    "application_number" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "purpose" TEXT NOT NULL,
    "duration_months" INTEGER,
    "credit_type_id" TEXT,
    "proposed_rate" DECIMAL(5,2),
    "collateral_type" TEXT,
    "collateral_value" DECIMAL(15,2),
    "repayment_schedule" "public"."repayment_schedule",
    "status" "public"."application_status" NOT NULL DEFAULT 'draft',
    "score" JSONB,
    "analysis_results" JSONB,
    "submitted_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."financial_data" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "period" "public"."financial_period" NOT NULL DEFAULT 'annual',
    "account_name" TEXT NOT NULL,
    "account_value" DECIMAL(15,2) NOT NULL,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documents" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "category" "public"."document_category" NOT NULL DEFAULT 'other',
    "ocr_text" TEXT,
    "extracted_data" JSONB,
    "status" "public"."document_status" NOT NULL DEFAULT 'pending',
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_steps" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "step_name" TEXT NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "assignee_id" TEXT,
    "status" "public"."step_status" NOT NULL DEFAULT 'pending',
    "deadline" TIMESTAMP(3),
    "comments" TEXT,
    "decision" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
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

-- CreateTable
CREATE TABLE "public"."workflow_step_configs" (
    "id" TEXT NOT NULL,
    "step_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "expected_duration" INTEGER NOT NULL,
    "max_duration" INTEGER,
    "description" TEXT,
    "step_type" "public"."step_type" NOT NULL DEFAULT 'fixed',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_step_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."approval_limits" (
    "id" TEXT NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "display_name" TEXT NOT NULL,
    "min_amount" DECIMAL(15,2) NOT NULL,
    "max_amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "review_duration" INTEGER NOT NULL,
    "max_review_duration" INTEGER,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credit_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "default_rate" DECIMAL(5,2) NOT NULL,
    "min_rate" DECIMAL(5,2),
    "max_rate" DECIMAL(5,2),
    "min_duration" INTEGER,
    "max_duration" INTEGER,
    "requires_collateral" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'Sénégal',
    "manager" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "id" TEXT NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "two_factor_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."backup_logs" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."backup_notify_emails" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_notify_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_channels" (
    "id" TEXT NOT NULL,
    "type" "public"."channel_type" NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "event" "public"."notif_event" NOT NULL,
    "channel_id" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_rules" (
    "id" TEXT NOT NULL,
    "event" "public"."notif_event" NOT NULL,
    "template_id" TEXT NOT NULL,
    "recipientRoles" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "public"."notif_type" NOT NULL DEFAULT 'INFO',
    "related_type" TEXT,
    "related_id" TEXT,
    "action_url" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_azure_id_key" ON "public"."users"("azure_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_rccm_key" ON "public"."clients"("rccm");

-- CreateIndex
CREATE UNIQUE INDEX "clients_ninea_key" ON "public"."clients"("ninea");

-- CreateIndex
CREATE UNIQUE INDEX "credit_applications_application_number_key" ON "public"."credit_applications"("application_number");

-- CreateIndex
CREATE INDEX "credit_applications_status_idx" ON "public"."credit_applications"("status");

-- CreateIndex
CREATE INDEX "credit_applications_client_id_idx" ON "public"."credit_applications"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_data_client_id_year_period_account_name_key" ON "public"."financial_data"("client_id", "year", "period", "account_name");

-- CreateIndex
CREATE INDEX "workflow_steps_application_id_idx" ON "public"."workflow_steps"("application_id");

-- CreateIndex
CREATE INDEX "workflow_steps_status_idx" ON "public"."workflow_steps"("status");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "public"."audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "public"."audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_step_configs_step_name_key" ON "public"."workflow_step_configs"("step_name");

-- CreateIndex
CREATE UNIQUE INDEX "approval_limits_role_key" ON "public"."approval_limits"("role");

-- CreateIndex
CREATE UNIQUE INDEX "credit_types_name_key" ON "public"."credit_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "credit_types_code_key" ON "public"."credit_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "public"."departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "public"."departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "branches_name_key" ON "public"."branches"("name");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "public"."branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_key" ON "public"."role_permissions"("role");

-- CreateIndex
CREATE UNIQUE INDEX "backup_notify_emails_email_key" ON "public"."backup_notify_emails"("email");

-- CreateIndex
CREATE UNIQUE INDEX "notification_channels_type_key" ON "public"."notification_channels"("type");

-- CreateIndex
CREATE UNIQUE INDEX "notification_rules_event_template_id_key" ON "public"."notification_rules"("event", "template_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "public"."notifications"("user_id", "is_read");

-- AddForeignKey
ALTER TABLE "public"."announcements" ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clients" ADD CONSTRAINT "clients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_applications" ADD CONSTRAINT "credit_applications_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_applications" ADD CONSTRAINT "credit_applications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_applications" ADD CONSTRAINT "credit_applications_credit_type_id_fkey" FOREIGN KEY ("credit_type_id") REFERENCES "public"."credit_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."financial_data" ADD CONSTRAINT "financial_data_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_steps" ADD CONSTRAINT "workflow_steps_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_steps" ADD CONSTRAINT "workflow_steps_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."credit_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_templates" ADD CONSTRAINT "notification_templates_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_rules" ADD CONSTRAINT "notification_rules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
