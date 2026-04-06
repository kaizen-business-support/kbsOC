/**
 * Correspondance slug → libellé français pour les noms d'étapes workflow.
 * Source unique — importer depuis ici dans workflowService et credit-policy routes.
 */
export const STEP_NAME_FR: Record<string, string> = {
  application_created:       'Création du dossier',
  credit_analysis:           'Analyse crédit',
  credit_analyst_review:     "Analyse par l'Analyste Crédit",
  analyst_supervisor_review: 'Validation Superviseur Analyste',
  branch_manager_review:     "Validation Directeur d'Agence",
  credit_committee_review:   'Passage en Comité de Crédit',
  management_review:         'Validation Direction Générale',
  dispatch:                  'Dispatch',
  account_manager_dispatch:  'Dispatch Chargé de Compte',
  approval:                  'Approbation',
  final_decision:            'Décision finale',
  documentation:             'Documentation',
};
