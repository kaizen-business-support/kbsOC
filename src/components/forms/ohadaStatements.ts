export type RowType = 'input' | 'calculated' | 'total';

export interface OhadaRow {
  code: string;
  label: string;
  type: RowType;
  formula?: string[];
  signs?: ('+' | '-')[];
  indent: 0 | 1 | 2;
  bold?: boolean;
}

export interface OhadaSection {
  id: string;
  title: string;
  headerColor: string;
  rows: OhadaRow[];
  defaultOpen: boolean;
}

export interface OhadaStatement {
  id: 'income' | 'cashflow' | 'balance';
  title: string;
  sections: OhadaSection[];
}

// ─── COMPTE DE RÉSULTAT ───────────────────────────────────────────────────────

export const incomeStatement: OhadaStatement = {
  id: 'income',
  title: 'Compte de Résultat',
  sections: [
    {
      id: 'exploitation-produits',
      title: "Activités d'Exploitation — Produits",
      headerColor: '#1565c0',
      defaultOpen: true,
      rows: [
        { code: 'RA', label: 'Ventes de marchandises', type: 'input', indent: 1 },
        { code: 'RB', label: 'Achats de marchandises', type: 'input', indent: 1 },
        { code: 'RC', label: 'Variation de stocks de marchandises', type: 'input', indent: 1 },
        { code: 'XA', label: 'Marge brute sur marchandises', type: 'calculated', bold: true, indent: 0, formula: ['RA', 'RB', 'RC'], signs: ['+', '-', '-'] },
        { code: 'RD', label: 'Ventes de produits fabriqués', type: 'input', indent: 1 },
        { code: 'RE', label: 'Travaux, services vendus', type: 'input', indent: 1 },
        { code: 'RF', label: 'Produits accessoires', type: 'input', indent: 1 },
        { code: 'XB', label: "Chiffre d'affaires", type: 'calculated', bold: true, indent: 0, formula: ['RD', 'RE', 'RF'], signs: ['+', '+', '+'] },
        { code: 'RG', label: 'Production stockée ou déstockée (+/-)', type: 'input', indent: 1 },
        { code: 'RH', label: 'Production immobilisée', type: 'input', indent: 1 },
        { code: 'RI', label: "Subventions d'exploitation", type: 'input', indent: 1 },
        { code: 'RJ', label: 'Autres produits', type: 'input', indent: 1 },
        { code: 'RK', label: "Transferts de charges d'exploitation", type: 'input', indent: 1 },
        { code: 'XC', label: "Total Produits d'Exploitation", type: 'calculated', bold: true, indent: 0, formula: ['XA', 'XB', 'RG', 'RH', 'RI', 'RJ', 'RK'], signs: ['+', '+', '+', '+', '+', '+', '+'] },
      ],
    },
    {
      id: 'exploitation-charges',
      title: "Activités d'Exploitation — Charges",
      headerColor: '#b71c1c',
      defaultOpen: true,
      rows: [
        { code: 'RL', label: 'Achats de matières premières et fournitures', type: 'input', indent: 1 },
        { code: 'RM', label: 'Variation de stocks de matières premières', type: 'input', indent: 1 },
        { code: 'RN', label: 'Autres achats', type: 'input', indent: 1 },
        { code: 'RO', label: 'Variation des autres stocks', type: 'input', indent: 1 },
        { code: 'RP', label: 'Transports', type: 'input', indent: 1 },
        { code: 'RQ', label: 'Services extérieurs', type: 'input', indent: 1 },
        { code: 'RR', label: 'Impôts et taxes', type: 'input', indent: 1 },
        { code: 'RS', label: 'Autres charges', type: 'input', indent: 1 },
        { code: 'RT', label: "Transferts de charges d'exploitation (déductibles)", type: 'input', indent: 1 },
        { code: 'XD', label: 'Valeur Ajoutée (VA)', type: 'calculated', bold: true, indent: 0, formula: ['XC', 'RL', 'RM', 'RN', 'RO', 'RP', 'RQ', 'RR', 'RS', 'RT'], signs: ['+', '-', '-', '-', '-', '-', '-', '-', '-', '+'] },
        { code: 'RU', label: 'Charges de personnel', type: 'input', indent: 1 },
        { code: 'RV', label: 'Impôts et taxes sur rémunérations', type: 'input', indent: 1 },
        { code: 'XE', label: "Excédent Brut d'Exploitation (EBE)", type: 'calculated', bold: true, indent: 0, formula: ['XD', 'RU', 'RV'], signs: ['+', '-', '-'] },
        { code: 'RW', label: 'Reprises de provisions et dépréciations', type: 'input', indent: 1 },
        { code: 'RX', label: "Autres produits d'exploitation", type: 'input', indent: 1 },
        { code: 'RY', label: 'Dotations aux amortissements et dépréciations', type: 'input', indent: 1 },
        { code: 'RZ', label: 'Dotations aux provisions', type: 'input', indent: 1 },
        { code: 'S1', label: "Autres charges d'exploitation", type: 'input', indent: 1 },
        { code: 'XF', label: "Résultat d'Exploitation", type: 'calculated', bold: true, indent: 0, formula: ['XE', 'RW', 'RX', 'RY', 'RZ', 'S1'], signs: ['+', '+', '+', '-', '-', '-'] },
      ],
    },
    {
      id: 'financier',
      title: 'Activités Financières',
      headerColor: '#1b5e20',
      defaultOpen: true,
      rows: [
        { code: 'SA', label: 'Revenus financiers et assimilés', type: 'input', indent: 1 },
        { code: 'SB', label: 'Reprises de provisions financières', type: 'input', indent: 1 },
        { code: 'SC', label: 'Transferts de charges financières', type: 'input', indent: 1 },
        { code: 'SD', label: 'Frais financiers et charges assimilées', type: 'input', indent: 1 },
        { code: 'SE', label: 'Dotations aux provisions financières', type: 'input', indent: 1 },
        { code: 'XG', label: 'Résultat Financier', type: 'calculated', bold: true, indent: 0, formula: ['SA', 'SB', 'SC', 'SD', 'SE'], signs: ['+', '+', '+', '-', '-'] },
        { code: 'XH', label: 'Résultat des Activités Ordinaires (RAO)', type: 'calculated', bold: true, indent: 0, formula: ['XF', 'XG'], signs: ['+', '+'] },
      ],
    },
    {
      id: 'hao',
      title: 'Activités HAO (Hors Activités Ordinaires)',
      headerColor: '#4a148c',
      defaultOpen: true,
      rows: [
        { code: 'SF', label: "Produits des cessions d'immobilisations", type: 'input', indent: 1 },
        { code: 'SG', label: 'Autres produits HAO', type: 'input', indent: 1 },
        { code: 'SH', label: "Valeurs comptables des cessions d'immobilisations", type: 'input', indent: 1 },
        { code: 'SI', label: 'Autres charges HAO', type: 'input', indent: 1 },
        { code: 'XI', label: 'Résultat HAO', type: 'calculated', bold: true, indent: 0, formula: ['SF', 'SG', 'SH', 'SI'], signs: ['+', '+', '-', '-'] },
      ],
    },
    {
      id: 'impots',
      title: 'Participation et Impôts',
      headerColor: '#e65100',
      defaultOpen: true,
      rows: [
        { code: 'SJ', label: 'Participation des travailleurs', type: 'input', indent: 1 },
        { code: 'SK', label: 'Impôts sur le résultat', type: 'input', indent: 1 },
        { code: 'XJ', label: 'RÉSULTAT NET', type: 'total', bold: true, indent: 0, formula: ['XH', 'XI', 'SJ', 'SK'], signs: ['+', '+', '-', '-'] },
      ],
    },
  ],
};

// ─── TABLEAU DES FLUX DE TRÉSORERIE ──────────────────────────────────────────

export const cashflowStatement: OhadaStatement = {
  id: 'cashflow',
  title: 'Tableau des Flux de Trésorerie',
  sections: [
    {
      id: 'operationnel',
      title: 'Flux des Activités Opérationnelles',
      headerColor: '#0d47a1',
      defaultOpen: true,
      rows: [
        { code: 'FA', label: "Résultat net de l'exercice", type: 'input', indent: 1 },
        { code: 'FB', label: 'Dotations aux amortissements et dépréciations', type: 'input', indent: 1 },
        { code: 'FC', label: 'Variations des provisions', type: 'input', indent: 1 },
        { code: 'FD', label: "Valeurs comptables des cessions d'immobilisations", type: 'input', indent: 1 },
        { code: 'FE', label: "- Produits des cessions d'immobilisations", type: 'input', indent: 1 },
        { code: 'FF', label: '+ Charges et produits HAO non décaissés/encaissés', type: 'input', indent: 1 },
        { code: 'ZA', label: "Capacité d'Autofinancement Globale (CAFG)", type: 'calculated', bold: true, indent: 0, formula: ['FA', 'FB', 'FC', 'FD', 'FE', 'FF'], signs: ['+', '+', '+', '+', '-', '+'] },
        { code: 'FG', label: '- Variation de stocks (augmentation)', type: 'input', indent: 1 },
        { code: 'FH', label: '- Variation des créances clients (augmentation)', type: 'input', indent: 1 },
        { code: 'FI', label: '+ Variation des dettes fournisseurs (augmentation)', type: 'input', indent: 1 },
        { code: 'ZB', label: 'Variation du BFE', type: 'calculated', bold: true, indent: 0, formula: ['FG', 'FH', 'FI'], signs: ['-', '-', '+'] },
        { code: 'ZC', label: 'Flux de Trésorerie Opérationnel', type: 'calculated', bold: true, indent: 0, formula: ['ZA', 'ZB'], signs: ['+', '+'] },
      ],
    },
    {
      id: 'investissement',
      title: "Flux des Activités d'Investissement",
      headerColor: '#1a237e',
      defaultOpen: true,
      rows: [
        { code: 'FJ', label: "Acquisitions d'immobilisations corporelles et incorporelles", type: 'input', indent: 1 },
        { code: 'FK', label: "Cessions d'immobilisations corporelles et incorporelles", type: 'input', indent: 1 },
        { code: 'FL', label: "Acquisitions d'immobilisations financières", type: 'input', indent: 1 },
        { code: 'FM', label: "Cessions d'immobilisations financières", type: 'input', indent: 1 },
        { code: 'ZD', label: "Flux de Trésorerie d'Investissement", type: 'calculated', bold: true, indent: 0, formula: ['FJ', 'FK', 'FL', 'FM'], signs: ['-', '+', '-', '+'] },
      ],
    },
    {
      id: 'financement-propres',
      title: 'Flux de Financement — Capitaux Propres',
      headerColor: '#004d40',
      defaultOpen: true,
      rows: [
        { code: 'FN', label: '+ Augmentation de capital par apports nouveaux', type: 'input', indent: 1 },
        { code: 'FO', label: "+ Subventions d'investissement reçues", type: 'input', indent: 1 },
        { code: 'FP', label: '- Prélèvements sur le capital', type: 'input', indent: 1 },
        { code: 'FQ', label: '- Dividendes versés', type: 'input', indent: 1 },
        { code: 'ZE', label: 'Flux Capitaux Propres', type: 'calculated', bold: true, indent: 0, formula: ['FN', 'FO', 'FP', 'FQ'], signs: ['+', '+', '-', '-'] },
      ],
    },
    {
      id: 'financement-etrangers',
      title: 'Flux de Financement — Capitaux Étrangers',
      headerColor: '#1b5e20',
      defaultOpen: true,
      rows: [
        { code: 'FR', label: '+ Emprunts', type: 'input', indent: 1 },
        { code: 'FS', label: '+ Autres dettes financières', type: 'input', indent: 1 },
        { code: 'FT', label: "- Remboursements d'emprunts", type: 'input', indent: 1 },
        { code: 'FU', label: '- Remboursements autres dettes financières', type: 'input', indent: 1 },
        { code: 'ZF', label: 'Flux Capitaux Étrangers', type: 'calculated', bold: true, indent: 0, formula: ['FR', 'FS', 'FT', 'FU'], signs: ['+', '+', '-', '-'] },
        { code: 'ZG', label: 'Flux de Trésorerie de Financement', type: 'calculated', bold: true, indent: 0, formula: ['ZE', 'ZF'], signs: ['+', '+'] },
        { code: 'ZH', label: 'VARIATION NETTE DE TRÉSORERIE', type: 'total', bold: true, indent: 0, formula: ['ZC', 'ZD', 'ZG'], signs: ['+', '+', '+'] },
        { code: 'FV', label: 'Trésorerie nette au 1er janvier', type: 'input', indent: 1 },
        { code: 'ZI', label: 'Trésorerie nette au 31 décembre', type: 'total', bold: true, indent: 0, formula: ['ZH', 'FV'], signs: ['+', '+'] },
      ],
    },
  ],
};

// ─── BILAN ────────────────────────────────────────────────────────────────────

export const balanceSheet: OhadaStatement = {
  id: 'balance',
  title: 'Bilan',
  sections: [
    {
      id: 'actif-immobilise',
      title: 'Actif Immobilisé',
      headerColor: '#1565c0',
      defaultOpen: true,
      rows: [
        { code: 'AB', label: 'Charges immobilisées', type: 'input', indent: 1 },
        { code: 'AC', label: "Frais d'établissement et de développement", type: 'input', indent: 1 },
        { code: 'AD', label: 'Brevets, licences, logiciels', type: 'input', indent: 1 },
        { code: 'AE', label: 'Fonds commercial et droit au bail', type: 'input', indent: 1 },
        { code: 'AF', label: 'Autres immobilisations incorporelles', type: 'input', indent: 1 },
        { code: 'AG', label: 'Terrains', type: 'input', indent: 1 },
        { code: 'AH', label: 'Bâtiments', type: 'input', indent: 1 },
        { code: 'AI', label: 'Aménagements, agencements, installations', type: 'input', indent: 1 },
        { code: 'AJ', label: 'Matériel, mobilier et actifs biologiques', type: 'input', indent: 1 },
        { code: 'AK', label: 'Matériel de transport', type: 'input', indent: 1 },
        { code: 'AL', label: 'Avances et acomptes versés sur immobilisations', type: 'input', indent: 1 },
        { code: 'AM', label: 'Titres de participation', type: 'input', indent: 1 },
        { code: 'AN', label: 'Autres immobilisations financières', type: 'input', indent: 1 },
        { code: 'AO', label: 'Total Actif Immobilisé', type: 'calculated', bold: true, indent: 0, formula: ['AB','AC','AD','AE','AF','AG','AH','AI','AJ','AK','AL','AM','AN'], signs: ['+','+','+','+','+','+','+','+','+','+','+','+','+'] },
      ],
    },
    {
      id: 'actif-circulant',
      title: 'Actif Circulant',
      headerColor: '#00838f',
      defaultOpen: true,
      rows: [
        { code: 'AP', label: 'Actif circulant HAO', type: 'input', indent: 1 },
        { code: 'AQ', label: 'Marchandises', type: 'input', indent: 1 },
        { code: 'AR', label: 'Matières premières et fournitures', type: 'input', indent: 1 },
        { code: 'AS', label: 'En-cours de fabrication', type: 'input', indent: 1 },
        { code: 'AT', label: 'Produits fabriqués', type: 'input', indent: 1 },
        { code: 'AU', label: 'Avances et acomptes versés sur commandes', type: 'input', indent: 1 },
        { code: 'AV', label: 'Fournisseurs, avances versées', type: 'input', indent: 1 },
        { code: 'AW', label: 'Clients', type: 'input', indent: 1 },
        { code: 'AX', label: 'Autres créances', type: 'input', indent: 1 },
        { code: 'AZ', label: 'Total Actif Circulant', type: 'calculated', bold: true, indent: 0, formula: ['AP','AQ','AR','AS','AT','AU','AV','AW','AX'], signs: ['+','+','+','+','+','+','+','+','+'] },
      ],
    },
    {
      id: 'tresorerie-actif',
      title: 'Trésorerie Actif',
      headerColor: '#558b2f',
      defaultOpen: true,
      rows: [
        { code: 'BA', label: 'Titres de placement', type: 'input', indent: 1 },
        { code: 'BB', label: 'Valeurs à encaisser', type: 'input', indent: 1 },
        { code: 'BC', label: 'Banques, chèques postaux, caisse', type: 'input', indent: 1 },
        { code: 'BT', label: 'Total Trésorerie Actif', type: 'calculated', bold: true, indent: 0, formula: ['BA','BB','BC'], signs: ['+','+','+'] },
        { code: 'BZ', label: 'TOTAL ACTIF', type: 'total', bold: true, indent: 0, formula: ['AO','AZ','BT'], signs: ['+','+','+'] },
      ],
    },
    {
      id: 'capitaux-propres',
      title: 'Capitaux Propres',
      headerColor: '#1565c0',
      defaultOpen: true,
      rows: [
        { code: 'CA', label: 'Capital', type: 'input', indent: 1 },
        { code: 'CB', label: 'Apporteurs, capital non appelé (-)', type: 'input', indent: 1 },
        { code: 'CC', label: 'Primes liées au capital social', type: 'input', indent: 1 },
        { code: 'CD', label: 'Écarts de réévaluation', type: 'input', indent: 1 },
        { code: 'CE', label: 'Réserves indisponibles', type: 'input', indent: 1 },
        { code: 'CF', label: 'Réserves libres', type: 'input', indent: 1 },
        { code: 'CG', label: 'Report à nouveau (+/-)', type: 'input', indent: 1 },
        { code: 'CH', label: "Résultat net de l'exercice", type: 'input', indent: 1 },
        { code: 'CI', label: 'Autres capitaux propres', type: 'input', indent: 1 },
        { code: 'CP', label: 'Total Capitaux Propres', type: 'calculated', bold: true, indent: 0, formula: ['CA','CB','CC','CD','CE','CF','CG','CH','CI'], signs: ['+','-','+','+','+','+','+','+','+'] },
      ],
    },
    {
      id: 'dettes-financieres',
      title: 'Dettes Financières',
      headerColor: '#4527a0',
      defaultOpen: true,
      rows: [
        { code: 'DA', label: 'Emprunts', type: 'input', indent: 1 },
        { code: 'DB', label: 'Dettes de crédit-bail', type: 'input', indent: 1 },
        { code: 'DC', label: 'Dettes financières diverses', type: 'input', indent: 1 },
        { code: 'DD', label: 'Provisions financières pour risques et charges', type: 'input', indent: 1 },
        { code: 'DF', label: 'Total Dettes Financières', type: 'calculated', bold: true, indent: 0, formula: ['DA','DB','DC','DD'], signs: ['+','+','+','+'] },
        { code: 'DG', label: 'Total Ressources Stables', type: 'calculated', bold: true, indent: 0, formula: ['CP','DF'], signs: ['+','+'] },
      ],
    },
    {
      id: 'passif-circulant',
      title: 'Passif Circulant',
      headerColor: '#b71c1c',
      defaultOpen: true,
      rows: [
        { code: 'DH', label: 'Dettes circulantes HAO', type: 'input', indent: 1 },
        { code: 'DI', label: 'Clients, avances reçues', type: 'input', indent: 1 },
        { code: 'DJ', label: "Fournisseurs d'exploitation", type: 'input', indent: 1 },
        { code: 'DK', label: 'Dettes fiscales', type: 'input', indent: 1 },
        { code: 'DL', label: 'Dettes sociales', type: 'input', indent: 1 },
        { code: 'DM', label: 'Autres dettes', type: 'input', indent: 1 },
        { code: 'DN', label: 'Risques provisionnés', type: 'input', indent: 1 },
        { code: 'DP', label: 'Total Passif Circulant', type: 'calculated', bold: true, indent: 0, formula: ['DH','DI','DJ','DK','DL','DM','DN'], signs: ['+','+','+','+','+','+','+'] },
      ],
    },
    {
      id: 'tresorerie-passif',
      title: 'Trésorerie Passif',
      headerColor: '#e65100',
      defaultOpen: true,
      rows: [
        { code: 'DQ', label: "Banques, crédits d'escompte", type: 'input', indent: 1 },
        { code: 'DR', label: 'Banques, crédits de trésorerie', type: 'input', indent: 1 },
        { code: 'DT', label: 'Total Trésorerie Passif', type: 'calculated', bold: true, indent: 0, formula: ['DQ','DR'], signs: ['+','+'] },
        { code: 'DZ', label: 'TOTAL PASSIF', type: 'total', bold: true, indent: 0, formula: ['DG','DP','DT'], signs: ['+','+','+'] },
      ],
    },
  ],
};

export const ALL_STATEMENTS: OhadaStatement[] = [incomeStatement, cashflowStatement, balanceSheet];
