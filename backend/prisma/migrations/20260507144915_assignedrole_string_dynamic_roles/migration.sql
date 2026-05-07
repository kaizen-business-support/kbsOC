-- Conversion de assigned_role : user_role enum → TEXT
-- Permet d'utiliser des rôles personnalisés sans toucher au schéma Prisma.
--
-- PostgreSQL peut caster un enum vers TEXT directement (USING enum_col::TEXT).
-- Le cast donne la valeur @map() stockée (ex. 'account_manager'), pas la clé
-- TypeScript ('CHARGE_AFFAIRES'). On fait ensuite un UPDATE pour aligner les
-- valeurs existantes sur les clés enum que le code utilise côté application.

-- Étape 1 : changer le type de colonne (enum → text)
ALTER TABLE "public"."credit_policy_steps"
  ALTER COLUMN "assigned_role" TYPE TEXT USING "assigned_role"::TEXT;

-- Étape 2 : convertir les anciennes valeurs @map() vers les clés enum
UPDATE "public"."credit_policy_steps"
SET "assigned_role" = CASE "assigned_role"
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
  ELSE "assigned_role"  -- conserver toute valeur déjà sous forme de clé
END;
