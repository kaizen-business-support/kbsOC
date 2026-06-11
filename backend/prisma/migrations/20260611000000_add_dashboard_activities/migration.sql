CREATE TABLE IF NOT EXISTS "dashboard_activities" (
    "id"           TEXT        NOT NULL,
    "dashboard_id" TEXT        NOT NULL,
    "user_id"      TEXT        NOT NULL,
    "user_name"    TEXT        NOT NULL,
    "action"       TEXT        NOT NULL,
    "widget_id"    TEXT,
    "widget_title" TEXT,
    "details"      JSONB       NOT NULL DEFAULT '{}',
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dashboard_activities_dashboard_id_created_at_idx"
    ON "dashboard_activities"("dashboard_id", "created_at" DESC);

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dashboard_activities_dashboard_id_fkey'
    ) THEN
        ALTER TABLE "dashboard_activities"
            ADD CONSTRAINT "dashboard_activities_dashboard_id_fkey"
            FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
