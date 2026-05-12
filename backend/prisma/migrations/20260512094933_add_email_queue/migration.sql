-- CreateEnum
CREATE TYPE "public"."email_queue_status" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "public"."clients" ALTER COLUMN "account_number" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "public"."email_queue" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "status" "public"."email_queue_status" NOT NULL DEFAULT 'PENDING',
    "retries" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "event" TEXT,
    "recipient_name" TEXT,
    "application_id" TEXT,
    "company_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_queue_status_scheduled_at_idx" ON "public"."email_queue"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "email_queue_company_id_idx" ON "public"."email_queue"("company_id");
