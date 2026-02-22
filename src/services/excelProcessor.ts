import * as XLSX from 'xlsx';
import { FinancialData, MultiyearData } from '../types';

export interface ExcelProcessingResult {
  success: boolean;
  data?: MultiyearData;
  error?: string;
  warnings?: string[];
}

export interface ExcelValidationRule {
  field: string;
  required: boolean;
  type: 'number' | 'string' | 'date';
  min?: number;
  max?: number;
  alternatives?: string[];
}

// OHADA template structure - Updated with precise cell references

// BILAN ACTIF section (columns E/F for NET values N/N-1)
const BILAN_ACTIF_MAPPINGS: Record<string, { label: string; cell_n: string; cell_n1: string }> = {
  immobilisations_incorporelles: { 
    label: 'IMMOBILISATIONS INCORPORELLES', 
    cell_n: 'E5', 
    cell_n1: 'F5' 
  },
  frais_developpement: { 
    label: 'Frais de développement et de prospection', 
    cell_n: 'E6', 
    cell_n1: 'F6' 
  },
  brevets_licences: { 
    label: 'Brevets, Licences, logiciels et droit similaire', 
    cell_n: 'E7', 
    cell_n1: 'F7' 
  },
  fonds_commercial: { 
    label: 'Fond commercial et droit au bail', 
    cell_n: 'E8', 
    cell_n1: 'F8' 
  },
  autres_immob_incorporelles: { 
    label: 'Autres immobilisations incorporelles', 
    cell_n: 'E9', 
    cell_n1: 'F9' 
  },
  immobilisations_corporelles: { 
    label: 'IMMOBILISATIONS CORPORELLES', 
    cell_n: 'E10', 
    cell_n1: 'F10' 
  },
  terrains: { 
    label: 'Terrains', 
    cell_n: 'E11', 
    cell_n1: 'F11' 
  },
  batiments: { 
    label: 'Batiments', 
    cell_n: 'E12', 
    cell_n1: 'F12' 
  },
  agencements: { 
    label: 'Agencements, amenagement et Installations', 
    cell_n: 'E13', 
    cell_n1: 'F13' 
  },
  materiel_mobilier: { 
    label: 'Matériel mobilier et actifs biologiques', 
    cell_n: 'E14', 
    cell_n1: 'F14' 
  },
  materiel_transport: { 
    label: 'Matériel de transport', 
    cell_n: 'E15', 
    cell_n1: 'F15' 
  },
  avances_immobilisations: { 
    label: 'Avances et acomptes versées sur immobilisations', 
    cell_n: 'E16', 
    cell_n1: 'F16' 
  },
  immobilisations_financieres: { 
    label: 'IMMOBILISATIONS FINANCIERES', 
    cell_n: 'E18', 
    cell_n1: 'F18' 
  },
  titres_participation: { 
    label: 'Titres de Participation', 
    cell_n: 'E19', 
    cell_n1: 'F19' 
  },
  autres_immob_financieres: { 
    label: 'Autres Immobilisations Financières', 
    cell_n: 'E20', 
    cell_n1: 'F20' 
  },
  total_actif_immobilise: { 
    label: 'TOTAL ACTIF IMMOBILISE', 
    cell_n: 'E21', 
    cell_n1: 'F21' 
  },
  actif_circulant_hao: { 
    label: 'ACTIF CIRCULANT HAO', 
    cell_n: 'E22', 
    cell_n1: 'F22' 
  },
  stocks: { 
    label: 'STOCKS ET ENCOURS', 
    cell_n: 'E23', 
    cell_n1: 'F23' 
  },
  creances_clients: { 
    label: 'CREANCES ET EMPLOIS ASSIMILES', 
    cell_n: 'E24', 
    cell_n1: 'F24' 
  },
  fournisseurs_avances: { 
    label: 'Fournisseurs avances versées', 
    cell_n: 'E25', 
    cell_n1: 'F25' 
  },
  clients: { 
    label: 'Clients', 
    cell_n: 'E26', 
    cell_n1: 'F26' 
  },
  autres_creances: { 
    label: 'Autres créances', 
    cell_n: 'E27', 
    cell_n1: 'F27' 
  },
  total_actif_circulant: { 
    label: 'TOTAL ACTIF CIRCULANT', 
    cell_n: 'E28', 
    cell_n1: 'F28' 
  },
  titres_placement: { 
    label: 'Titres de placement', 
    cell_n: 'E30', 
    cell_n1: 'F30' 
  },
  valeurs_encaisser: { 
    label: 'Valeurs à encaisser', 
    cell_n: 'E31', 
    cell_n1: 'F31' 
  },
  banques_caisses: { 
    label: 'Banques, chèques postaux, caisses et assimilés', 
    cell_n: 'E32', 
    cell_n1: 'F32' 
  },
  tresorerie_actif: { 
    label: 'TOTAL TRESORERIE ACTIF', 
    cell_n: 'E33', 
    cell_n1: 'F33' 
  },
  ecart_conversion_actif: { 
    label: 'Ecart de conversion actif', 
    cell_n: 'E34', 
    cell_n1: 'F34' 
  },
  total_actif: { 
    label: 'TOTAL GENERAL', 
    cell_n: 'E35', 
    cell_n1: 'F35' 
  }
};

// BILAN PASSIF section (columns I/J for NET values N/N-1) 
const BILAN_PASSIF_MAPPINGS: Record<string, { label: string; cell_n: string; cell_n1: string }> = {
  capital_social: { 
    label: 'Capital', 
    cell_n: 'I5', 
    cell_n1: 'J5' 
  },
  actionnaires_capital: { 
    label: 'Actionnaires capital non appelé', 
    cell_n: 'I6', 
    cell_n1: 'J6' 
  },
  primes_capital: { 
    label: 'Primes liées au capital', 
    cell_n: 'I7', 
    cell_n1: 'J7' 
  },
  ecarts_reevaluation: { 
    label: 'Ecarts de Réévaluation', 
    cell_n: 'I8', 
    cell_n1: 'J8' 
  },
  reserves_indisponibles: { 
    label: 'Réserves Indisponibles', 
    cell_n: 'I9', 
    cell_n1: 'J9' 
  },
  reserves_libres: { 
    label: 'Réserves Libres', 
    cell_n: 'I10', 
    cell_n1: 'J10' 
  },
  reserves_reportees: { 
    label: 'Report à nouveau', 
    cell_n: 'I11', 
    cell_n1: 'J11' 
  },
  resultat_exercice: { 
    label: 'Résultat Net de l\'exercice', 
    cell_n: 'I12', 
    cell_n1: 'J12' 
  },
  subventions_investissement: { 
    label: 'Subventions d\'Investissement', 
    cell_n: 'I13', 
    cell_n1: 'J13' 
  },
  provisions_reglementees: { 
    label: 'Provision Réglementées', 
    cell_n: 'I14', 
    cell_n1: 'J14' 
  },
  capitaux_propres: { 
    label: 'TOTAL CAPITAUX PROPRES ET RESSOURCES ASSIMILEES', 
    cell_n: 'I15', 
    cell_n1: 'J15' 
  },
  emprunts_dettes_financieres: { 
    label: 'Emprunts et Dettes Financières', 
    cell_n: 'I17', 
    cell_n1: 'J17' 
  },
  dettes_location: { 
    label: 'Dettes de location acquisition', 
    cell_n: 'I18', 
    cell_n1: 'J18' 
  },
  provisions_financieres: { 
    label: 'Provisions financières pour Risques et Charges', 
    cell_n: 'I19', 
    cell_n1: 'J19' 
  },
  dettes_financieres: { 
    label: 'TOTAL DETTES FINANCIERES ET RESSOURCES ASSIMILEES', 
    cell_n: 'I20', 
    cell_n1: 'J20' 
  },
  ressources_stables: { 
    label: 'TOTAL RESSOURCES STABLES', 
    cell_n: 'I21', 
    cell_n1: 'J21' 
  },
  dettes_circulantes_hao: { 
    label: 'Dettes circulantes HAO', 
    cell_n: 'I22', 
    cell_n1: 'J22' 
  },
  clients_avances_recues: { 
    label: 'Clients Avances Reçues', 
    cell_n: 'I23', 
    cell_n1: 'J23' 
  },
  dettes_fournisseurs: { 
    label: 'Fournisseurs d\'Exploitation', 
    cell_n: 'I24', 
    cell_n1: 'J24' 
  },
  dettes_sociales_fiscales: { 
    label: 'Dettes Sociales et Fiscales', 
    cell_n: 'I25', 
    cell_n1: 'J25' 
  },
  autres_dettes: { 
    label: 'Autres Dettes', 
    cell_n: 'I26', 
    cell_n1: 'J26' 
  },
  provisions_court_terme: { 
    label: 'Provision pour risques à court termes', 
    cell_n: 'I27', 
    cell_n1: 'J27' 
  },
  total_dettes: { 
    label: 'TOTAL PASSIF CIRCULANT', 
    cell_n: 'I28', 
    cell_n1: 'J28' 
  },
  banques_credits_escompte: { 
    label: 'Banques, Crédits d\'escompte et de trésorerie', 
    cell_n: 'I30', 
    cell_n1: 'J30' 
  },
  banques_credits_tresorerie: { 
    label: 'Banques, établissement financiers et crédit de trésorerie', 
    cell_n: 'I31', 
    cell_n1: 'J31' 
  },
  tresorerie_passif: { 
    label: 'TOTAL TRESORERIE PASSIF', 
    cell_n: 'I33', 
    cell_n1: 'J33' 
  },
  ecart_conversion_passif: { 
    label: 'Ecart de conversion passif', 
    cell_n: 'I34', 
    cell_n1: 'J34' 
  },
  total_passif: { 
    label: 'TOTAL GENERAL', 
    cell_n: 'I35', 
    cell_n1: 'J35' 
  }
};

// COMPTE DE RESULTAT section (in CR sheet, columns E/F)
const CR_MAPPINGS: Record<string, { label: string; cell_n: string; cell_n1: string }> = {
  ventes_marchandises: { 
    label: 'Ventes de marchandises', 
    cell_n: 'E5', 
    cell_n1: 'F5' 
  },
  achats_marchandises: { 
    label: 'Achats de marchandises', 
    cell_n: 'E6', 
    cell_n1: 'F6' 
  },
  variation_stocks_marchandises: { 
    label: '- Variation de stocks', 
    cell_n: 'E7', 
    cell_n1: 'F7' 
  },
  marge_commerciale: { 
    label: 'MARGE COMMERCIALE', 
    cell_n: 'E8', 
    cell_n1: 'F8' 
  },
  ventes_produits_fabriques: { 
    label: 'Ventes de produits fabriqués', 
    cell_n: 'E9', 
    cell_n1: 'F9' 
  },
  travaux_services: { 
    label: 'Travaux, services vendus', 
    cell_n: 'E10', 
    cell_n1: 'F10' 
  },
  produits_accessoires: { 
    label: 'Produits accessoires', 
    cell_n: 'E11', 
    cell_n1: 'F11' 
  },
  chiffre_affaires: { 
    label: 'CHIFFRE D\'AFFAIRES (A+B+C+D)', 
    cell_n: 'E12', 
    cell_n1: 'F12' 
  },
  production_stockee: { 
    label: 'Production stockée (ou destockage)', 
    cell_n: 'E13', 
    cell_n1: 'F13' 
  },
  production_immobilisee: { 
    label: 'Production immobilisée', 
    cell_n: 'E14', 
    cell_n1: 'F14' 
  },
  subvention_exploitation: { 
    label: 'Subvention d\'exploitation', 
    cell_n: 'E15', 
    cell_n1: 'F15' 
  },
  autres_produits: { 
    label: 'Autres produits', 
    cell_n: 'E16', 
    cell_n1: 'F16' 
  },
  transferts_charges: { 
    label: 'Transferts de charges d\'exploitation', 
    cell_n: 'E17', 
    cell_n1: 'F17' 
  },
  achats_matieres_premieres: { 
    label: 'Achats de matières premières et autres fournitures liées', 
    cell_n: 'E18', 
    cell_n1: 'F18' 
  },
  variation_stocks_mp: { 
    label: '- Variation de stocks de matières premières et fournitures liées', 
    cell_n: 'E19', 
    cell_n1: 'F19' 
  },
  autres_achats: { 
    label: 'Autres achats', 
    cell_n: 'E20', 
    cell_n1: 'F20' 
  },
  variation_autres_stocks: { 
    label: '- Variation de stocks d\'autres approvisionnements', 
    cell_n: 'E21', 
    cell_n1: 'F21' 
  },
  transports: { 
    label: 'Transports', 
    cell_n: 'E22', 
    cell_n1: 'F22' 
  },
  services_exterieurs: { 
    label: 'Services extérieurs', 
    cell_n: 'E23', 
    cell_n1: 'F23' 
  },
  impots_taxes: { 
    label: 'Impôts et taxes', 
    cell_n: 'E24', 
    cell_n1: 'F24' 
  },
  autres_charges: { 
    label: 'Autres charges', 
    cell_n: 'E25', 
    cell_n1: 'F25' 
  },
  valeur_ajoutee: { 
    label: 'VALEUR AJOUTEE (XB+A+RB)+ (somme TE à RJ)', 
    cell_n: 'E26', 
    cell_n1: 'F26' 
  },
  charges_personnel: { 
    label: 'Charges de personnel', 
    cell_n: 'E27', 
    cell_n1: 'F27' 
  },
  excedent_brut_exploitation: { 
    label: 'EXCEDENT BRUT D\'EXPLOITATION ( XC+RK)', 
    cell_n: 'E28', 
    cell_n1: 'F28' 
  },
  reprises_amortissements: { 
    label: 'Reprises d\'amortissements, de provisions et dépréciations', 
    cell_n: 'E29', 
    cell_n1: 'F29' 
  },
  dotations_amortissements: { 
    label: 'Dotations aux amortissements, aux provisions et dépréciations', 
    cell_n: 'E30', 
    cell_n1: 'F30' 
  },
  resultat_exploitation: { 
    label: 'RESULTAT D\'EXPLOITATION ( XD+TJ+RL)', 
    cell_n: 'E31', 
    cell_n1: 'F31' 
  },
  revenus_financiers: { 
    label: 'Revenus financiers et assimilés', 
    cell_n: 'E32', 
    cell_n1: 'F32' 
  },
  reprises_provisions_financieres: { 
    label: 'Reprise de provisions et dépréciations financières', 
    cell_n: 'E33', 
    cell_n1: 'F33' 
  },
  transferts_charges_financieres: { 
    label: 'Transferts de charges financières', 
    cell_n: 'E34', 
    cell_n1: 'F34' 
  },
  frais_financiers: { 
    label: 'Frais financiers et charges assimilées', 
    cell_n: 'E35', 
    cell_n1: 'F35' 
  },
  dotations_provisions_financieres: { 
    label: 'Dotations aux provisions et aux dépréciations financières', 
    cell_n: 'E36', 
    cell_n1: 'F36' 
  },
  resultat_financier: { 
    label: 'RESULTAT FINANCIER ( somme TK à RM)', 
    cell_n: 'E37', 
    cell_n1: 'F37' 
  },
  resultat_courant: { 
    label: 'RESULTAT DES ACTIVITES ORDINAIRES ( XE + XF)', 
    cell_n: 'E38', 
    cell_n1: 'F38' 
  },
  produits_cessions_immobilisations: { 
    label: 'Produits des cessions d\'immobilisations', 
    cell_n: 'E39', 
    cell_n1: 'F39' 
  },
  autres_produits_hao: { 
    label: 'Autres produits HAO', 
    cell_n: 'E40', 
    cell_n1: 'F40' 
  },
  valeurs_comptables_cessions: { 
    label: 'Valeurs comptables des cessions d\'immobilisations', 
    cell_n: 'E41', 
    cell_n1: 'F41' 
  },
  autres_charges_hao: { 
    label: 'Autres charges HAO', 
    cell_n: 'E42', 
    cell_n1: 'F42' 
  },
  resultat_hao: { 
    label: 'RESULTAT HORS ACTIVITES ORDINAIRES ( somme TN à RP)', 
    cell_n: 'E43', 
    cell_n1: 'F43' 
  },
  participation_travailleurs: { 
    label: 'Participation des travailleurs', 
    cell_n: 'E44', 
    cell_n1: 'F44' 
  },
  impots_resultat: { 
    label: 'Impôts sur le résultat', 
    cell_n: 'E45', 
    cell_n1: 'F45' 
  },
  resultat_net: { 
    label: 'RESULTAT NET ( XG + XH +RQ + RS)', 
    cell_n: 'E46', 
    cell_n1: 'F46' 
  }
};

// TABLEAU DE FLUX DE TRESORERIE section (in TFT sheet, columns E/F)
const TFT_MAPPINGS: Record<string, { label: string; cell_n: string; cell_n1: string }> = {
  tresorerie_debut_periode: { 
    label: 'Trésorerie nette au 1er Janvier (Trésorerie actif N-1 - Trésorerie passif N-1)', 
    cell_n: 'E3', 
    cell_n1: 'F3' 
  },
  flux_tresorerie_activites_operationnelles_header: { 
    label: 'Flux de trésorerie provenant des activités opérationnelles', 
    cell_n: 'E4', 
    cell_n1: 'F4' 
  },
  capacite_autofinancement: { 
    label: 'Capacité d\'autofinancement Global (CAFG)', 
    cell_n: 'E5', 
    cell_n1: 'F5' 
  },
  variation_actif_circulant_hao: { 
    label: '- Actif circulant HAO', 
    cell_n: 'E6', 
    cell_n1: 'F6' 
  },
  variation_stocks: { 
    label: '- Variation des stocks', 
    cell_n: 'E7', 
    cell_n1: 'F7' 
  },
  variation_creances: { 
    label: '- Variation des créances et emplois assimilés', 
    cell_n: 'E8', 
    cell_n1: 'F8' 
  },
  variation_passif_circulant: { 
    label: '- Variation du passif circulant', 
    cell_n: 'E9', 
    cell_n1: 'F9' 
  },
  variation_bfg: { 
    label: 'Variation du BFG liés aux opérations opérationnelles (FB+FC+FD+FE)', 
    cell_n: 'E10', 
    cell_n1: 'F10' 
  },
  flux_tresorerie_activites_operationnelles: { 
    label: 'Flux de trésorerie provenant des activités opérationnelles (Somme FA à FE)', 
    cell_n: 'E11', 
    cell_n1: 'F11' 
  },
  flux_investissements_header: { 
    label: 'Flux de trésorerie provenant des activités d\'investissements', 
    cell_n: 'E12', 
    cell_n1: 'F12' 
  },
  decaissements_immob_incorp: { 
    label: '- Décaissements liés aux acquisition d\'immobilisation incorporelles', 
    cell_n: 'E13', 
    cell_n1: 'F13' 
  },
  decaissements_immob_corp: { 
    label: '- Décaissements liés aux acquisition d\'immobilisation corporelles', 
    cell_n: 'E14', 
    cell_n1: 'F14' 
  },
  decaissements_immob_fin: { 
    label: '- Décaissements liés aux acquisition d\'immobilisation financières', 
    cell_n: 'E15', 
    cell_n1: 'F15' 
  },
  encaissements_cessions_ic: { 
    label: '+ Encaissements liés aux cessions d\'immobilisation incorporelles et corporelles', 
    cell_n: 'E16', 
    cell_n1: 'F16' 
  },
  encaissements_cessions_fin: { 
    label: '+ Encaissements liés aux cessions d\'immobilisation financière', 
    cell_n: 'E17', 
    cell_n1: 'F17' 
  },
  flux_tresorerie_activites_investissement: { 
    label: 'Flux de trésorerie provenant des opérations d\'investissement (somme FF à FJ)', 
    cell_n: 'E18', 
    cell_n1: 'F18' 
  },
  flux_capitaux_propres_header: { 
    label: 'Flux de trésorerie provenant du financement par les capitaux propres', 
    cell_n: 'E19', 
    cell_n1: 'F19' 
  },
  augmentation_capital: { 
    label: '+ Augmentation de capital par apports nouveaux', 
    cell_n: 'E20', 
    cell_n1: 'F20' 
  },
  subventions_investissement: { 
    label: '+ Subventions d\'investissement reçues', 
    cell_n: 'E21', 
    cell_n1: 'F21' 
  },
  prelevements_capital: { 
    label: '- Prélèvements sur le capital', 
    cell_n: 'E22', 
    cell_n1: 'F22' 
  },
  distributions: { 
    label: '- Distribution versées', 
    cell_n: 'E23', 
    cell_n1: 'F23' 
  },
  flux_capitaux_propres_total: { 
    label: 'Flux de trésorerie provenant des capitaux propres (somme FK à FN)', 
    cell_n: 'E24', 
    cell_n1: 'F24' 
  },
  flux_capitaux_etrangers_header: { 
    label: 'Trésorerie provenant du financement par les capitaux étrangers', 
    cell_n: 'E25', 
    cell_n1: 'F25' 
  },
  emprunts: { 
    label: '+ Emprunts', 
    cell_n: 'E26', 
    cell_n1: 'F26' 
  },
  autres_dettes_financieres: { 
    label: '+ Autres dettes financières', 
    cell_n: 'E27', 
    cell_n1: 'F27' 
  },
  remboursements: { 
    label: '- Remboursements des emprunts et autres dettes financières', 
    cell_n: 'E28', 
    cell_n1: 'F28' 
  },
  flux_capitaux_etrangers_total: { 
    label: 'Flux de trésorerie provenant des capitaux étrangers (somme FO à FQ)', 
    cell_n: 'E29', 
    cell_n1: 'F29' 
  },
  flux_tresorerie_activites_financement: { 
    label: 'Flux de trésorerie provenant des activités de financement ( D+E)', 
    cell_n: 'E30', 
    cell_n1: 'F30' 
  },
  variation_tresorerie: { 
    label: 'VARIATION DE LA TRESORERIE NETTE DE LA PERIODE ( B+C+F)', 
    cell_n: 'E31', 
    cell_n1: 'F31' 
  },
  tresorerie_fin_periode: { 
    label: 'Trésorerie nette au 31 Décembre (G +A)', 
    cell_n: 'E32', 
    cell_n1: 'F32' 
  },
  controle_tresorerie: { 
    label: 'Contrôle : Trésorerie actif N -Trésorerie passif N', 
    cell_n: 'E33', 
    cell_n1: 'F33' 
  }
};

// Validation rules for financial data
const VALIDATION_RULES: ExcelValidationRule[] = [
  { field: 'total_actif', required: true, type: 'number', min: 0 },
  { field: 'capitaux_propres', required: true, type: 'number' },
  { field: 'chiffre_affaires', required: true, type: 'number', min: 0 },
  { field: 'resultat_net', required: true, type: 'number' },
  { field: 'exercice', required: true, type: 'number', min: 2000, max: 2030 },
];

export class ExcelProcessor {
  private static getCellValue(worksheet: XLSX.WorkSheet, cellAddress: string): any {
    const cell = worksheet[cellAddress];
    if (!cell) {
      console.log(`ExcelProcessor - Cell ${cellAddress} is empty or doesn't exist`);
      return null;
    }
    
    // Get the raw value or the formatted value
    let value = cell.v;
    if (value === undefined || value === null || value === '') {
      console.log(`ExcelProcessor - Cell ${cellAddress} has no value`);
      return null;
    }
    
    console.log(`ExcelProcessor - Cell ${cellAddress} raw value:`, value, typeof value);
    return value;
  }

  private static extractDataFromOhadaTemplate(workbook: XLSX.WorkBook, yearConfig?: { primaryYear: number; startYear: number; endYear: number }): { data: MultiyearData; warnings: string[] } {
    const warnings: string[] = [];
    const multiyearData: MultiyearData = {};
    
    // Determine reference year (use primaryYear if provided, otherwise current year)
    const referenceYear = yearConfig?.primaryYear || new Date().getFullYear();
    
    console.log('ExcelProcessor - Starting OHADA template extraction with yearConfig:', yearConfig);
    console.log('ExcelProcessor - Reference year:', referenceYear);
    console.log('ExcelProcessor - Available sheets:', workbook.SheetNames);
    
    // Debug: Check exact sheet names and case sensitivity
    workbook.SheetNames.forEach(sheetName => {
      console.log(`ExcelProcessor - Found sheet: "${sheetName}" (length: ${sheetName.length})`);
    });
    
    // Process each sheet with precise cell mappings
    const sheetsToProcess = [
      { name: 'Bilan', mappings: { ...BILAN_ACTIF_MAPPINGS, ...BILAN_PASSIF_MAPPINGS } },
      { name: 'CR', mappings: CR_MAPPINGS },
      { name: 'TFT', mappings: TFT_MAPPINGS }
    ];
    
    console.log('ExcelProcessor - Looking for sheets:', sheetsToProcess.map(s => s.name));
    
    sheetsToProcess.forEach(({ name, mappings }) => {
      const worksheet = workbook.Sheets[name];
      if (!worksheet) {
        warnings.push(`Feuille "${name}" non trouvée dans le fichier Excel`);
        console.log(`ExcelProcessor - Sheet ${name} not found`);
        return;
      }
      
      console.log(`ExcelProcessor - Processing sheet: ${name} with ${Object.keys(mappings).length} field mappings`);
      
      // Special debugging for TFT sheet
      if (name === 'TFT') {
        console.log('ExcelProcessor - TFT Sheet Processing - Field mappings:', Object.keys(mappings));
        console.log('ExcelProcessor - TFT Sheet - Sample cells check:');
        console.log('  E3 (tresorerie_debut_periode):', this.getCellValue(worksheet, 'E3'));
        console.log('  E11 (flux_operationnels):', this.getCellValue(worksheet, 'E11'));
        console.log('  E31 (variation_tresorerie):', this.getCellValue(worksheet, 'E31'));
      }
      
      // Process each field in this sheet using precise cell mappings
      Object.entries(mappings).forEach(([fieldKey, fieldConfig]) => {
        // Extract for year N
        const valueN = this.getCellValue(worksheet, fieldConfig.cell_n);
        if (valueN !== null) {
          const actualYearN = this.getYearFromKey('N', referenceYear);
          
          // Check if year is in target range
          if (!yearConfig || (actualYearN >= yearConfig.startYear && actualYearN <= yearConfig.endYear)) {
            if (!multiyearData['N']) {
              multiyearData['N'] = {
                year: actualYearN,
                data: {}
              };
              console.log(`ExcelProcessor - Created new year data structure for N (year ${actualYearN})`);
            }
            
            const numericValueN = this.parseNumericValue(valueN);
            multiyearData['N'].data[fieldKey] = numericValueN;
            
            // Debug: Log each field extraction with raw value
            console.log(`ExcelProcessor - ${fieldKey} for N: Raw="${valueN}", Parsed=${numericValueN} from ${name}!${fieldConfig.cell_n}`);
            
            // Special attention to TFT fields
            if (name === 'TFT') {
              console.log(`ExcelProcessor - TFT FIELD DETAIL: ${fieldKey} - Raw cell value: "${valueN}", Type: ${typeof valueN}, Parsed: ${numericValueN}`);
            }
          }
        }
        
        // Extract for year N-1
        const valueN1 = this.getCellValue(worksheet, fieldConfig.cell_n1);
        if (valueN1 !== null) {
          const actualYearN1 = this.getYearFromKey('N-1', referenceYear);
          
          // Check if year is in target range
          if (!yearConfig || (actualYearN1 >= yearConfig.startYear && actualYearN1 <= yearConfig.endYear)) {
            if (!multiyearData['N-1']) {
              multiyearData['N-1'] = {
                year: actualYearN1,
                data: {}
              };
              console.log(`ExcelProcessor - Created new year data structure for N-1 (year ${actualYearN1})`);
            }
            
            const numericValueN1 = this.parseNumericValue(valueN1);
            multiyearData['N-1'].data[fieldKey] = numericValueN1;
            
            // Debug: Log each field extraction with raw value
            console.log(`ExcelProcessor - ${fieldKey} for N-1: Raw="${valueN1}", Parsed=${numericValueN1} from ${name}!${fieldConfig.cell_n1}`);
            
            // Special attention to TFT fields
            if (name === 'TFT') {
              console.log(`ExcelProcessor - TFT FIELD DETAIL: ${fieldKey} - Raw cell value: "${valueN1}", Type: ${typeof valueN1}, Parsed: ${numericValueN1}`);
            }
          }
        }
      });
    });

    // Calculate derived fields
    this.calculateDerivedFields(multiyearData);

    // Log summary of extracted data and add template validation
    let hasRealData = false;
    Object.entries(multiyearData).forEach(([yearKey, yearData]) => {
      const nonZeroFields = Object.entries(yearData.data).filter(([, value]) => value !== 0);
      console.log(`ExcelProcessor - Year ${yearKey} (${yearData.year}): ${nonZeroFields.length} non-zero fields out of ${Object.keys(yearData.data).length} total fields`);
      
      // Check if this appears to be real data vs. template
      const significantFields = ['chiffre_affaires', 'total_actif', 'capitaux_propres', 'resultat_net'];
      const hasSignificantData = significantFields.some(field => {
        const value = (yearData.data as any)[field];
        return value && Math.abs(Number(value)) > 0;
      });
      
      if (hasSignificantData) {
        hasRealData = true;
      }
    });
    
    // Warn if all data appears to be zeros (template)
    if (!hasRealData) {
      warnings.push("⚠️ ATTENTION: Les données extraites semblent être un modèle vide. Assurez-vous de remplir le template avec vos données financières réelles avant de l'importer.");
      console.warn('ExcelProcessor - WARNING: Template appears to contain only zero/empty values. Users should fill in real financial data.');
    }
    
    // Continue with detailed field logging
    Object.entries(multiyearData).forEach(([yearKey, yearData]) => {
      const nonZeroFields = Object.entries(yearData.data).filter(([, value]) => value !== 0);
      
      // Specifically check TFT and CR fields
      const tftFields = ['tresorerie_debut_periode', 'flux_tresorerie_activites_operationnelles', 'flux_tresorerie_activites_investissement', 'flux_tresorerie_activites_financement', 'variation_tresorerie', 'tresorerie_fin_periode'];
      const crFields = ['chiffre_affaires', 'resultat_exploitation', 'total_produits_exploitation', 'total_charges_exploitation'];
      
      console.log(`ExcelProcessor - TFT fields for ${yearKey}:`, 
        tftFields.map(field => `${field}: ${(yearData.data as any)[field] || 0}`).join(', '));
      console.log(`ExcelProcessor - CR fields for ${yearKey}:`, 
        crFields.map(field => `${field}: ${(yearData.data as any)[field] || 0}`).join(', '));
      
      if (nonZeroFields.length > 0) {
        console.log(`ExcelProcessor - Non-zero fields for ${yearKey}:`, nonZeroFields.map(([key, value]) => `${key}: ${value}`));
      }
    });

    // Validate that we have data for the expected years
    if (yearConfig && yearConfig.startYear === yearConfig.endYear) {
      // Single year upload - find which year key corresponds to the target year
      const targetYear = yearConfig.startYear;
      const yearDiff = referenceYear - targetYear;
      const expectedYearKey = yearDiff === 0 ? 'N' : yearDiff === 1 ? 'N-1' : `N-${yearDiff}`;
      
      if (!multiyearData[expectedYearKey] || Object.keys(multiyearData[expectedYearKey].data).length === 0) {
        warnings.push(`Aucune donnée trouvée pour l'année ${targetYear} (${expectedYearKey})`);
      }
    } else {
      // Multi-year upload - validate expected years (only N and N-1 available in OHADA template)
      ['N-1', 'N'].forEach(yearKey => {
        if (!multiyearData[yearKey] || Object.keys(multiyearData[yearKey].data).length === 0) {
          warnings.push(`Aucune donnée trouvée pour l'année ${yearKey}`);
        }
      });
    }

    console.log('ExcelProcessor - Final multiyearData from OHADA extraction:', JSON.stringify(multiyearData, null, 2));
    return { data: multiyearData, warnings };
  }

  private static calculateDerivedFields(multiyearData: MultiyearData): void {
    // The new mappings should already contain the correct field names
    // This method now focuses on calculating any missing derived fields
    Object.entries(multiyearData).forEach(([yearKey, yearData]) => {
      const data = yearData.data as any; // Type assertion to allow dynamic property assignment
      
      console.log(`ExcelProcessor - calculateDerivedFields for ${yearKey} before calculation:`, {
        chiffre_affaires: data.chiffre_affaires,
        resultat_exploitation: data.resultat_exploitation,
        production_stockee: data.production_stockee,
        production_immobilisee: data.production_immobilisee,
        subvention_exploitation: data.subvention_exploitation,
        autres_produits: data.autres_produits,
        transferts_charges: data.transferts_charges
      });
      
      // Calculate total produits exploitation from available components
      // Total produits d'exploitation = Chiffre d'affaires + Production stockée + Production immobilisée + Subventions + Autres produits + Transferts de charges
      let totalProduitsExploitation = 0;
      
      // Add marge commerciale (if exists)
      if (data.marge_commerciale) totalProduitsExploitation += Number(data.marge_commerciale);
      
      // Add chiffre d'affaires
      if (data.chiffre_affaires) totalProduitsExploitation += Number(data.chiffre_affaires);
      
      // Add other product components if available
      if (data.production_stockee) totalProduitsExploitation += Number(data.production_stockee);
      if (data.production_immobilisee) totalProduitsExploitation += Number(data.production_immobilisee);
      if (data.subvention_exploitation) totalProduitsExploitation += Number(data.subvention_exploitation);
      if (data.autres_produits) totalProduitsExploitation += Number(data.autres_produits);
      if (data.transferts_charges) totalProduitsExploitation += Number(data.transferts_charges);
      
      // Set total produits exploitation
      if (totalProduitsExploitation > 0) {
        data.total_produits_exploitation = totalProduitsExploitation;
        console.log(`ExcelProcessor - Calculated total_produits_exploitation for ${yearKey}: ${totalProduitsExploitation}`);
      } else if (data.chiffre_affaires) {
        // Fallback to chiffre d'affaires if no other components
        data.total_produits_exploitation = Number(data.chiffre_affaires);
        console.log(`ExcelProcessor - Using chiffre_affaires as total_produits_exploitation for ${yearKey}: ${data.chiffre_affaires}`);
      } else {
        console.log(`ExcelProcessor - WARNING: No data to calculate total_produits_exploitation for ${yearKey}`);
      }
      
      // Calculate total charges exploitation as: Total produits d'exploitation - Résultat d'exploitation
      if (data.total_produits_exploitation && data.resultat_exploitation !== undefined) {
        const calculatedCharges = Number(data.total_produits_exploitation) - Number(data.resultat_exploitation);
        data.total_charges_exploitation = calculatedCharges;
        console.log(`ExcelProcessor - Calculated total_charges_exploitation for ${yearKey}: ${calculatedCharges} (produits: ${data.total_produits_exploitation}, resultat: ${data.resultat_exploitation})`);
      } else {
        console.log(`ExcelProcessor - WARNING: Cannot calculate total_charges_exploitation for ${yearKey} - missing data:`, {
          total_produits_exploitation: data.total_produits_exploitation,
          resultat_exploitation: data.resultat_exploitation
        });
      }
      
      // TFT fields are now directly mapped with correct names - no additional mapping needed
      console.log(`ExcelProcessor - TFT fields already correctly mapped for ${yearKey}:`, {
        tresorerie_debut_periode: data.tresorerie_debut_periode,
        flux_tresorerie_activites_operationnelles: data.flux_tresorerie_activites_operationnelles,
        flux_tresorerie_activites_investissement: data.flux_tresorerie_activites_investissement,
        flux_tresorerie_activites_financement: data.flux_tresorerie_activites_financement,
        variation_tresorerie: data.variation_tresorerie,
        tresorerie_fin_periode: data.tresorerie_fin_periode
      });
      // variation_tresorerie is already correctly mapped
      
      // Ensure we have a working capital calculation
      if (data.total_actif_circulant && data.total_dettes) {
        data.working_capital = Number(data.total_actif_circulant) - Number(data.total_dettes);
      }
      
      // Calculate BFR (Besoin en Fonds de Roulement) if missing
      if (!data.bfr && data.total_actif_circulant && data.tresorerie_actif && data.total_dettes && data.tresorerie_passif) {
        data.bfr = (Number(data.total_actif_circulant) - Number(data.tresorerie_actif)) - (Number(data.total_dettes) - Number(data.tresorerie_passif));
      }
      
      // Ensure compatibilité avec resultat_exercice -> resultat_net
      if (data.resultat_exercice && !data.resultat_net) {
        data.resultat_net = data.resultat_exercice;
      }
      
      console.log(`ExcelProcessor - Derived fields calculated for ${yearKey}:`, {
        total_produits_exploitation: data.total_produits_exploitation,
        total_charges_exploitation: data.total_charges_exploitation,
        working_capital: data.working_capital,
        bfr: data.bfr,
        resultat_net: data.resultat_net,
        // TFT mappings - directly extracted
        tresorerie_debut_periode: data.tresorerie_debut_periode,
        flux_tresorerie_activites_operationnelles: data.flux_tresorerie_activites_operationnelles,
        flux_tresorerie_activites_investissement: data.flux_tresorerie_activites_investissement,
        flux_tresorerie_activites_financement: data.flux_tresorerie_activites_financement,
        variation_tresorerie: data.variation_tresorerie,
        tresorerie_fin_periode: data.tresorerie_fin_periode
      });
    });
  }

  private static getYearFromKey(yearKey: string, referenceYear?: number): number {
    const currentYear = referenceYear || new Date().getFullYear();
    switch (yearKey) {
      case 'N': return currentYear;
      case 'N-1': return currentYear - 1;
      case 'N-2': return currentYear - 2;
      default:
        const match = yearKey.match(/N-(\d+)/);
        return match ? currentYear - parseInt(match[1]) : currentYear;
    }
  }

  private static validateData(data: FinancialData, year: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const rule of VALIDATION_RULES) {
      const value = data[rule.field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`Champ requis manquant: ${rule.field} pour l'exercice ${year}`);
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        if (rule.type === 'number') {
          const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : Number(value);
          
          if (isNaN(numValue)) {
            errors.push(`Valeur non numérique pour ${rule.field}: ${value}`);
          } else {
            if (rule.min !== undefined && numValue < rule.min) {
              errors.push(`Valeur trop faible pour ${rule.field}: ${numValue} (min: ${rule.min})`);
            }
            if (rule.max !== undefined && numValue > rule.max) {
              errors.push(`Valeur trop élevée pour ${rule.field}: ${numValue} (max: ${rule.max})`);
            }
          }
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  private static parseNumericValue(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    
    if (typeof value === 'number') return value;
    
    if (typeof value === 'string') {
      // Remove currency symbols, spaces, and convert French decimal separator
      const cleaned = value
        .replace(/[€$£¥₹₽]/g, '') // Remove currency symbols
        .replace(/\s/g, '') // Remove spaces
        .replace(/,/g, '.') // Convert comma to dot for decimal
        .replace(/[^\d.-]/g, ''); // Keep only digits, dots, and minus
      
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    return 0;
  }

  private static processWorksheet(workbook: XLSX.WorkBook, yearConfig?: { primaryYear: number; startYear: number; endYear: number }): { data: MultiyearData; warnings: string[] } {
    // Check if this is an OHADA/BCEAO template (multi-sheet format)
    const expectedSheets = ['Bilan', 'CR', 'TFT'];
    const hasOhadaSheets = expectedSheets.some(sheetName => workbook.SheetNames.includes(sheetName));
    
    if (hasOhadaSheets) {
      console.log('ExcelProcessor - Detected OHADA/BCEAO template format');
      try {
        const ohadaResult = this.extractDataFromOhadaTemplate(workbook, yearConfig);
        if (Object.keys(ohadaResult.data).length > 0) {
          return ohadaResult;
        }
      } catch (error) {
        console.warn('OHADA template extraction failed, falling back to generic processing:', error);
      }
    }

    // Fallback to generic processing for non-OHADA templates
    console.log('ExcelProcessor - Using generic processing for non-OHADA template');
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      raw: false,
      defval: ''
    });

    if (jsonData.length < 2) {
      throw new Error('Le fichier Excel doit contenir au moins une ligne d\'en-têtes et une ligne de données');
    }

    const warnings: string[] = [];
    const multiyearData: MultiyearData = {};

    // Find data in various formats
    for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
      const row = jsonData[rowIndex] as any[];
      if (!row || row.length === 0) continue;

      // Look for year indicators
      const firstCell = row[0]?.toString()?.trim();
      if (firstCell && /20\d{2}/.test(firstCell)) {
        const year = parseInt(firstCell.match(/20\d{2}/)?.[0] || '');
        if (year && year >= 2000 && year <= 2030) {
          const currentYear = new Date().getFullYear();
          const yearDiff = currentYear - year;
          let yearKey: string;

          if (yearDiff === 0) yearKey = 'N';
          else if (yearDiff === 1) yearKey = 'N-1';
          else if (yearDiff === 2) yearKey = 'N-2';
          else yearKey = `N-${yearDiff}`;

          // Extract financial data from this row
          const financialData: FinancialData = {};
          
          // Map common indices to fields (assuming standard layout)
          const commonMappings = [
            { index: 1, field: 'total_actif' },
            { index: 2, field: 'capitaux_propres' },
            { index: 3, field: 'chiffre_affaires' },
            { index: 4, field: 'resultat_net' }
          ];

          commonMappings.forEach(mapping => {
            if (row[mapping.index] !== undefined && row[mapping.index] !== '') {
              financialData[mapping.field] = this.parseNumericValue(row[mapping.index]);
            }
          });

          if (Object.keys(financialData).length > 0) {
            multiyearData[yearKey] = {
              year,
              data: financialData
            };
          }
        }
      }
    }

    if (Object.keys(multiyearData).length === 0) {
      warnings.push('Aucune donnée financière valide trouvée. Assurez-vous d\'utiliser le modèle OHADA/BCEAO fourni.');
    }

    return { data: multiyearData, warnings };
  }

  static async processExcelFile(file: File, yearConfig?: { primaryYear: number; startYear: number; endYear: number }): Promise<ExcelProcessingResult> {
    try {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
      ];

      if (!validTypes.includes(file.type)) {
        return {
          success: false,
          error: 'Type de fichier non supporté. Utilisez un fichier Excel (.xlsx ou .xls)',
        };
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        return {
          success: false,
          error: 'Le fichier est trop volumineux. Taille maximum: 10 MB',
        };
      }

      // Read file
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      if (!workbook.SheetNames.length) {
        return {
          success: false,
          error: 'Le fichier Excel ne contient aucune feuille de calcul',
        };
      }

      let multiyearData: MultiyearData = {};
      let allWarnings: string[] = [];

      // Process the workbook (handles both single-sheet and multi-sheet formats)
      try {
        const { data, warnings } = this.processWorksheet(workbook, yearConfig);
        multiyearData = data;
        allWarnings.push(...warnings);
      } catch (error: any) {
        allWarnings.push(`Erreur lors du traitement du fichier: ${error.message}`);
      }

      if (Object.keys(multiyearData).length === 0) {
        return {
          success: false,
          error: 'Aucune donnée financière valide trouvée dans le fichier Excel',
          warnings: allWarnings,
        };
      }

      return {
        success: true,
        data: multiyearData,
        warnings: allWarnings.length > 0 ? allWarnings : undefined,
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Erreur lors du traitement du fichier: ${error.message}`,
      };
    }
  }

  // Helper method to create a template Excel file based on the provided structure
  static createTemplate(): Blob {
    const workbook = XLSX.utils.book_new();
    
    // Create the template structure as described by the user
    const templateData: any[][] = [];
    
    // Header rows
    for (let i = 0; i < 15; i++) {
      templateData.push(new Array(10).fill(''));
    }
    
    // Add section headers and labels
    templateData[14] = ['', '', '', 'N-2', 'N-1', 'N', '', '', '', ''];
    
    // BILAN ACTIF
    templateData[15] = ['BILAN ACTIF', '', '', '', '', '', '', '', '', ''];
    templateData[16] = ['Immobilisations incorporelles', '', '', '500000', '600000', '700000', '', '', '', ''];
    templateData[17] = ['Immobilisations corporelles', '', '', '5000000', '5500000', '6000000', '', '', '', ''];
    templateData[18] = ['Immobilisations financières', '', '', '200000', '250000', '300000', '', '', '', ''];
    templateData[19] = ['Total Actif Immobilisé', '', '', '5700000', '6350000', '7000000', '', '', '', ''];
    templateData[20] = ['', '', '', '', '', '', '', '', '', ''];
    templateData[21] = ['Stocks', '', '', '800000', '900000', '1000000', '', '', '', ''];
    templateData[22] = ['Créances clients', '', '', '1200000', '1400000', '1600000', '', '', '', ''];
    templateData[23] = ['Autres créances', '', '', '300000', '350000', '400000', '', '', '', ''];
    templateData[24] = ['Total Actif Circulant', '', '', '2300000', '2650000', '3000000', '', '', '', ''];
    templateData[25] = ['', '', '', '', '', '', '', '', '', ''];
    templateData[26] = ['Trésorerie Actif', '', '', '500000', '600000', '700000', '', '', '', ''];
    templateData[27] = ['Total Actif', '', '', '8500000', '9600000', '10700000', '', '', '', ''];
    
    // BILAN PASSIF
    templateData[29] = ['BILAN PASSIF', '', '', '', '', '', '', '', '', ''];
    templateData[30] = ['Capital social', '', '', '2000000', '2000000', '2500000', '', '', '', ''];
    templateData[31] = ['Réserves et résultats reportés', '', '', '1500000', '2000000', '2500000', '', '', '', ''];
    templateData[32] = ['Résultat de l\'exercice', '', '', '800000', '900000', '1000000', '', '', '', ''];
    templateData[33] = ['Total Capitaux Propres', '', '', '4300000', '4900000', '6000000', '', '', '', ''];
    templateData[34] = ['', '', '', '', '', '', '', '', '', ''];
    templateData[35] = ['Dettes financières', '', '', '2000000', '2200000', '2000000', '', '', '', ''];
    templateData[36] = ['Dettes fournisseurs', '', '', '1500000', '1700000', '1900000', '', '', '', ''];
    templateData[37] = ['Autres dettes', '', '', '700000', '800000', '800000', '', '', '', ''];
    templateData[38] = ['Total Dettes', '', '', '4200000', '4700000', '4700000', '', '', '', ''];
    templateData[39] = ['', '', '', '', '', '', '', '', '', ''];
    templateData[40] = ['Trésorerie Passif', '', '', '0', '0', '0', '', '', '', ''];
    templateData[41] = ['Total Passif', '', '', '8500000', '9600000', '10700000', '', '', '', ''];
    
    // Fill remaining rows for complete template
    while (templateData.length < 80) {
      templateData.push(new Array(10).fill(''));
    }

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template EF');

    // Generate buffer
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }
}

export default ExcelProcessor;