-- Migration : convertir role_permissions.role de l'enum user_role vers TEXT
-- Permet la création libre de rôles personnalisés

-- 1. Ajouter une colonne texte temporaire
ALTER TABLE "role_permissions" ADD COLUMN "role_text" TEXT;

-- 2. Recopier en remappant les valeurs DB (alias @map) vers les noms Prisma
UPDATE "role_permissions" SET "role_text" = CASE "role"::text
  WHEN 'account_manager'    THEN 'CHARGE_AFFAIRES'
  WHEN 'credit_analyst'     THEN 'ANALYSTE_RISQUES'
  WHEN 'analyst_supervisor' THEN 'RESPONSABLE_RISQUES'
  WHEN 'branch_manager'     THEN 'RESPONSABLE_ENGAGEMENTS'
  WHEN 'credit_committee'   THEN 'COMITE_CREDIT'
  WHEN 'management'         THEN 'DIRECTION_GENERALE'
  WHEN 'admin'              THEN 'ADMIN'
  WHEN 'super_admin'        THEN 'SUPER_ADMIN'
  WHEN 'back_office'        THEN 'BACK_OFFICE'
  WHEN 'direction_juridique' THEN 'DIRECTION_JURIDIQUE'
  ELSE "role"::text
END;

-- 3. Supprimer l'ancienne colonne enum et renommer la colonne texte
ALTER TABLE "role_permissions" DROP COLUMN "role";
ALTER TABLE "role_permissions" RENAME COLUMN "role_text" TO "role";
ALTER TABLE "role_permissions" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_key" UNIQUE ("role");
