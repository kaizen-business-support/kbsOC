-- WorkflowStep.role : user_role enum → TEXT
-- La table est vide en migration, conversion des valeurs @map() par précaution.

ALTER TABLE "public"."workflow_steps"
  ALTER COLUMN "role" TYPE TEXT USING "role"::TEXT;

UPDATE "public"."workflow_steps"
SET "role" = CASE "role"
  WHEN 'account_manager'    THEN 'CHARGE_AFFAIRES'
  WHEN 'credit_analyst'     THEN 'ANALYSTE_RISQUES'
  WHEN 'analyst_supervisor' THEN 'RESPONSABLE_RISQUES'
  WHEN 'branch_manager'     THEN 'RESPONSABLE_ENGAGEMENTS'
  WHEN 'credit_committee'   THEN 'COMITE_CREDIT'
  WHEN 'management'         THEN 'DIRECTION_GENERALE'
  WHEN 'admin'              THEN 'ADMIN'
  WHEN 'super_admin'        THEN 'SUPER_ADMIN'
  WHEN 'back_office'        THEN 'BACK_OFFICE'
  WHEN 'direction_juridique'  THEN 'DIRECTION_JURIDIQUE'
  WHEN 'assistant_commercial' THEN 'ASSISTANT_COMMERCIAL'
  WHEN 'dir_ag'               THEN 'DIR_AG'
  ELSE "role"
END;
