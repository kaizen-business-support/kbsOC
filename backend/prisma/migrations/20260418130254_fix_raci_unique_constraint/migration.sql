-- Drop old unique constraint on credit_policy_step_roles
DROP INDEX IF EXISTS "public"."credit_policy_step_roles_policy_step_id_role_raci_code_key";

-- Drop redundant index on credit_policy_step_roles
DROP INDEX IF EXISTS "public"."credit_policy_step_roles_policy_step_id_idx";

-- Create new unique constraint on (policy_step_id, role) only
CREATE UNIQUE INDEX "credit_policy_step_roles_policy_step_id_role_key" ON "public"."credit_policy_step_roles"("policy_step_id", "role");

-- Drop redundant index on tenant_chinese_wall_rules
DROP INDEX IF EXISTS "public"."tenant_chinese_wall_rules_company_id_idx";
