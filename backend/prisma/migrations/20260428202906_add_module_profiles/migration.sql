-- CreateEnum
CREATE TYPE "public"."data_scope" AS ENUM ('branch_only', 'multi_branch', 'all_branches');

-- CreateTable
CREATE TABLE "public"."module_profiles" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "label" TEXT NOT NULL,
    "modules" JSONB NOT NULL,
    "default_scope" "public"."data_scope" NOT NULL DEFAULT 'branch_only',
    "allowed_branches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_module_overrides" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "modules" JSONB,
    "data_scope" "public"."data_scope",
    "allowed_branches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_module_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scope_delegates" (
    "id" TEXT NOT NULL,
    "delegator_id" TEXT NOT NULL,
    "delegate_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "scope" "public"."data_scope" NOT NULL,
    "allowed_branches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowed_actions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scope_delegates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "module_profiles_company_id_idx" ON "public"."module_profiles"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_profiles_company_id_role_key" ON "public"."module_profiles"("company_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "user_module_overrides_user_id_company_id_key" ON "public"."user_module_overrides"("user_id", "company_id");

-- CreateIndex
CREATE INDEX "scope_delegates_delegate_id_is_active_idx" ON "public"."scope_delegates"("delegate_id", "is_active");

-- CreateIndex
CREATE INDEX "scope_delegates_company_id_idx" ON "public"."scope_delegates"("company_id");

-- AddForeignKey
ALTER TABLE "public"."module_profiles" ADD CONSTRAINT "module_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."module_profiles" ADD CONSTRAINT "module_profiles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_module_overrides" ADD CONSTRAINT "user_module_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_module_overrides" ADD CONSTRAINT "user_module_overrides_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_module_overrides" ADD CONSTRAINT "user_module_overrides_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scope_delegates" ADD CONSTRAINT "scope_delegates_delegator_id_fkey" FOREIGN KEY ("delegator_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scope_delegates" ADD CONSTRAINT "scope_delegates_delegate_id_fkey" FOREIGN KEY ("delegate_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scope_delegates" ADD CONSTRAINT "scope_delegates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scope_delegates" ADD CONSTRAINT "scope_delegates_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
