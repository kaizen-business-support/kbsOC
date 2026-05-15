/**
 * roleAliases.ts
 *
 * Côté DB, le rôle d'une étape de workflow (workflow_steps.role / String libre)
 * peut être stocké soit sous sa forme "legacy" UPPER_CASE (CHARGE_AFFAIRES, …),
 * soit sous sa forme @map snake_case (account_manager, …) selon l'environnement
 * et l'historique des seeds/politiques. À l'inverse, users.role passe par
 * l'enum UserRole : Prisma le retourne toujours en UPPER_CASE côté TS.
 *
 * Pour que les comparaisons step.role ↔ user.role et les filtres Prisma
 * `where: { role: ... }` restent corrects quel que soit l'encodage stocké,
 * on accepte les deux formes en requête.
 */
const ROLE_ALIASES: Record<string, readonly string[]> = {
  CHARGE_AFFAIRES:         ['CHARGE_AFFAIRES',         'account_manager'],
  ANALYSTE_RISQUES:        ['ANALYSTE_RISQUES',        'credit_analyst'],
  RESPONSABLE_RISQUES:     ['RESPONSABLE_RISQUES',     'analyst_supervisor'],
  RESPONSABLE_ENGAGEMENTS: ['RESPONSABLE_ENGAGEMENTS', 'branch_manager'],
  COMITE_CREDIT:           ['COMITE_CREDIT',           'credit_committee'],
  DIRECTION_GENERALE:      ['DIRECTION_GENERALE',      'management'],
  ADMIN:                   ['ADMIN',                   'admin'],
  SUPER_ADMIN:             ['SUPER_ADMIN',             'super_admin'],
  BACK_OFFICE:             ['BACK_OFFICE',             'back_office'],
  DIRECTION_JURIDIQUE:     ['DIRECTION_JURIDIQUE',     'direction_juridique'],
  ASSISTANT_COMMERCIAL:    ['ASSISTANT_COMMERCIAL',    'assistant_commercial'],
  DIR_AG:                  ['DIR_AG',                  'dir_ag'],
};

const REVERSE_INDEX: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_ALIASES).flatMap(([canonical, all]) =>
    all.map(v => [v, canonical])
  )
);

/** Retourne toutes les formes connues d'un rôle (legacy UPPER_CASE + @map snake_case). */
export function rolesMatching(role: string): string[] {
  const canonical = REVERSE_INDEX[role] ?? role;
  return [...(ROLE_ALIASES[canonical] ?? [role])];
}

/** Convertit n'importe quel encodage vers la forme canonique TS (UPPER_CASE). */
export function canonicalRole(role: string): string {
  return REVERSE_INDEX[role] ?? role;
}
