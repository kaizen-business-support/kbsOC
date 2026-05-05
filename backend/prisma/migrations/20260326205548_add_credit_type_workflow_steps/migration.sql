-- CreateTable
CREATE TABLE "public"."credit_type_workflow_steps" (
    "id" TEXT NOT NULL,
    "credit_type_id" TEXT NOT NULL,
    "step_name" TEXT NOT NULL,
    "step_label" TEXT NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "order" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "duration_days" INTEGER NOT NULL DEFAULT 3,
    "description" TEXT,

    CONSTRAINT "credit_type_workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_type_workflow_steps_credit_type_id_order_key" ON "public"."credit_type_workflow_steps"("credit_type_id", "order");

-- AddForeignKey
ALTER TABLE "public"."credit_type_workflow_steps" ADD CONSTRAINT "credit_type_workflow_steps_credit_type_id_fkey" FOREIGN KEY ("credit_type_id") REFERENCES "public"."credit_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
