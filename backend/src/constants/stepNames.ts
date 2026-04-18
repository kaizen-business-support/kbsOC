/**
 * Correspondance slug → libellé français pour les noms d'étapes workflow.
 * Source unique — importer depuis ici dans workflowService et credit-policy routes.
 */
export const STEP_NAME_FR: Record<string, string> = {
  // Étapes RACI BCI
  application_created:           'Création du dossier',
  charge_affaires_dispatch:      'Dépôt dossier — Chargé d\'Affaires',
  verification_completude:       'Vérification complétude — Engagements',
  contre_analyse:                'Contre-analyse — Direction Risques',
  calcul_ratios_prudentiels:     'Calcul ratios prudentiels — Risques',
  notation_interne:              'Notation interne — Risques',
  avis_risques:                  'Avis de la Direction Risques',
  validation_comite:             'Validation Comité de Crédit',
  decision_direction:            'Décision Direction Générale',
  mise_en_place_sib:             'Mise en place SIB',
  saisie_garanties:              'Saisie des garanties — Back Office',
  formalisation_garanties:       'Formalisation des garanties — Direction Juridique',
  tirage_fonds:                  'Tirage des fonds',
  back_office_setup:             'Configuration Back Office',
  // Étapes legacy (compatibilité ascendante)
  account_manager_review:        'Revue Chargé d\'Affaires',
  credit_analysis:               'Analyse de crédit',
  supervisor_review:             'Revue superviseur',
  branch_manager_approval:       'Approbation Directeur d\'Agence',
  credit_committee_review:       'Comité de Crédit',
  management_approval:           'Approbation Direction',
  compliance_check:              'Vérification conformité',
  final_approval:                'Approbation finale',
  disbursement:                  'Décaissement',
};

export const STEP_ROLES: Record<string, string[]> = {
  charge_affaires_dispatch:      ['CHARGE_AFFAIRES'],
  verification_completude:       ['RESPONSABLE_ENGAGEMENTS'],
  contre_analyse:                ['ANALYSTE_RISQUES', 'RESPONSABLE_RISQUES'],
  calcul_ratios_prudentiels:     ['ANALYSTE_RISQUES', 'RESPONSABLE_RISQUES'],
  notation_interne:              ['ANALYSTE_RISQUES', 'RESPONSABLE_RISQUES'],
  avis_risques:                  ['RESPONSABLE_RISQUES'],
  validation_comite:             ['COMITE_CREDIT'],
  decision_direction:            ['DIRECTION_GENERALE'],
  mise_en_place_sib:             ['RESPONSABLE_ENGAGEMENTS', 'BACK_OFFICE'],
  saisie_garanties:              ['BACK_OFFICE', 'RESPONSABLE_ENGAGEMENTS'],
  formalisation_garanties:       ['DIRECTION_JURIDIQUE'],
  tirage_fonds:                  ['RESPONSABLE_ENGAGEMENTS', 'BACK_OFFICE'],
  back_office_setup:             ['BACK_OFFICE'],
};
