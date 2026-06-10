-- CreateTable
CREATE TABLE IF NOT EXISTS "dashboards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "company_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "layout" JSONB NOT NULL DEFAULT '[]',
    "template_source_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "dashboard_widgets" (
    "id" TEXT NOT NULL,
    "dashboard_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "dashboard_shares" (
    "id" TEXT NOT NULL,
    "dashboard_id" TEXT NOT NULL,
    "shareType" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "dashboard_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "company_id" TEXT,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "layout" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "dashboard_template_widgets" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dashboard_template_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "dashboards_company_id_idx" ON "dashboards"("company_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "dashboards_owner_id_idx" ON "dashboards"("owner_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "dashboard_widgets_dashboard_id_idx" ON "dashboard_widgets"("dashboard_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_shares_dashboard_id_shareType_target_id_key"
    ON "dashboard_shares"("dashboard_id", "shareType", "target_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "dashboard_shares_dashboard_id_idx" ON "dashboard_shares"("dashboard_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "dashboard_templates_company_id_idx" ON "dashboard_templates"("company_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "dashboard_template_widgets_template_id_idx" ON "dashboard_template_widgets"("template_id");

-- AddForeignKey (idempotent via DO block)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dashboards_company_id_fkey'
    ) THEN
        ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_company_id_fkey"
            FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dashboards_owner_id_fkey'
    ) THEN
        ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_owner_id_fkey"
            FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dashboard_widgets_dashboard_id_fkey'
    ) THEN
        ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_dashboard_id_fkey"
            FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dashboard_shares_dashboard_id_fkey'
    ) THEN
        ALTER TABLE "dashboard_shares" ADD CONSTRAINT "dashboard_shares_dashboard_id_fkey"
            FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dashboard_templates_company_id_fkey'
    ) THEN
        ALTER TABLE "dashboard_templates" ADD CONSTRAINT "dashboard_templates_company_id_fkey"
            FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dashboard_template_widgets_template_id_fkey'
    ) THEN
        ALTER TABLE "dashboard_template_widgets" ADD CONSTRAINT "dashboard_template_widgets_template_id_fkey"
            FOREIGN KEY ("template_id") REFERENCES "dashboard_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
