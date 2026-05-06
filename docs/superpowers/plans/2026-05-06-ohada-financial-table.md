# Tableau Financier SYSCOHADA Révisé — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le stepper de saisie manuelle par 3 onglets SYSCOHADA révisé (Compte de Résultat / Flux de Trésorerie / Bilan) avec sections pliables et grandes masses calculées en temps réel.

**Architecture:** Un fichier de données `ohadaStatements.ts` encode les 3 états financiers (codes, libellés, formules). Un composant `OhadaFinancialTable.tsx` consomme ces données pour rendre un tableau MUI par onglet avec lignes saisie/calculées/total. `ManualInputPage.tsx` est simplifié pour rendre directement `OhadaFinancialTable`.

**Tech Stack:** React 18, TypeScript, MUI v5 (Table, Tabs, Collapse, TextField)

**Spec:** `docs/superpowers/specs/2026-05-06-ohada-financial-table-design.md`

---

## Fichiers

| Fichier | Action |
|---|---|
| `src/components/forms/ohadaStatements.ts` | Créer — types + 3 états SYSCOHADA |
| `src/components/forms/OhadaFinancialTable.tsx` | Créer — composant principal |
| `src/pages/ManualInputPage.tsx` | Modifier — remplacer le stepper |

---

## Tâche 1 — Créer `ohadaStatements.ts`

**Fichiers :**
- Créer : `src/components/forms/ohadaStatements.ts`

### Contexte

Ce fichier est la source de vérité pour toute la structure des états financiers SYSCOHADA révisés. Il n'a aucune dépendance React. Il exporte les types et les 3 définitions d'états.

- [ ] **Étape 1.1 : Créer le fichier avec les types et les 3 états**

Créer `src/components/forms/ohadaStatements.ts` avec le contenu suivant :

```ts
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
        { code: 'RO', label: "Variation des autres stocks", type: 'input', indent: 1 },
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
        { code: 'RY', label: "Dotations aux amortissements et dépréciations", type: 'input', indent: 1 },
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
```

- [ ] **Étape 1.2 : Vérifier la compilation TypeScript**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit 2>&1 | head -20
```
Attendu : aucune erreur.

- [ ] **Étape 1.3 : Commit**

```bash
git add src/components/forms/ohadaStatements.ts
git commit -m "feat(ohada): définition SYSCOHADA révisé — compte de résultat, flux de trésorerie, bilan"
```

---

## Tâche 2 — Créer `OhadaFinancialTable.tsx`

**Fichiers :**
- Créer : `src/components/forms/OhadaFinancialTable.tsx`

### Contexte

Ce composant est le tableau financier principal. Il :
- Affiche 3 onglets MUI (Compte de Résultat / Flux de Trésorerie / Bilan)
- Pour chaque onglet, rend un `<Table>` MUI avec les sections et lignes de `ohadaStatements.ts`
- Gère l'état des valeurs saisies et le calcul des grandes masses
- Le Bilan a une gestion spéciale : 3 colonnes (Brut / Amort. / Net)
- Appelle `onComplete(data)` quand l'utilisateur clique "Enregistrer"

- [ ] **Étape 2.1 : Créer le fichier `OhadaFinancialTable.tsx`**

Créer `src/components/forms/OhadaFinancialTable.tsx` :

```tsx
import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography, Collapse, IconButton,
  Button, Tooltip, Paper,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  UnfoldMore as ExpandAllIcon,
  UnfoldLess as CollapseAllIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  incomeStatement, cashflowStatement, balanceSheet,
  OhadaSection, OhadaRow, OhadaStatement,
} from './ohadaStatements';

interface OhadaFinancialTableProps {
  year: number;
  onComplete: (data: {
    incomeStatement: Record<string, number>;
    cashFlow: Record<string, number>;
    balance: { brut: Record<string, number>; amort: Record<string, number> };
  }) => void;
}

// ─── Moteur de calcul ─────────────────────────────────────────────────────────

function computeValues(
  statement: OhadaStatement,
  inputValues: Record<string, number>,
): Record<string, number> {
  const all: Record<string, number> = { ...inputValues };
  for (const section of statement.sections) {
    for (const row of section.rows) {
      if ((row.type === 'calculated' || row.type === 'total') && row.formula && row.signs) {
        all[row.code] = row.formula.reduce((sum, code, i) => {
          const val = all[code] ?? 0;
          return sum + (row.signs![i] === '+' ? val : -val);
        }, 0);
      }
    }
  }
  return all;
}

function fmt(val: number | undefined): string {
  if (val === undefined || val === 0) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(val);
}

// ─── Composant TableauOnglet (Compte de Résultat & Flux) ──────────────────────

interface StatementTabProps {
  statement: OhadaStatement;
  values: Record<string, number>;
  computed: Record<string, number>;
  openSections: Record<string, boolean>;
  onChange: (code: string, val: number) => void;
  onToggleSection: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

function StatementTab({
  statement, values, computed, openSections,
  onChange, onToggleSection, onExpandAll, onCollapseAll,
}: StatementTabProps) {
  return (
    <Box>
      {/* Boutons globaux */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, justifyContent: 'flex-end' }}>
        <Button size="small" startIcon={<ExpandAllIcon />} onClick={onExpandAll} variant="outlined" sx={{ fontSize: 11 }}>
          Tout déplier
        </Button>
        <Button size="small" startIcon={<CollapseAllIcon />} onClick={onCollapseAll} variant="outlined" sx={{ fontSize: 11 }}>
          Tout plier
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell sx={{ width: 70, fontWeight: 700, fontSize: 11, color: '#64748b' }}>Code</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, color: '#64748b' }}>Libellé</TableCell>
              <TableCell align="right" sx={{ width: 200, fontWeight: 700, fontSize: 11, color: '#64748b' }}>
                Montant (FCFA)
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {statement.sections.map((section) => (
              <SectionRows
                key={section.id}
                section={section}
                isOpen={openSections[section.id] ?? section.defaultOpen}
                values={values}
                computed={computed}
                onChange={onChange}
                onToggle={() => onToggleSection(section.id)}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Lignes d'une section ─────────────────────────────────────────────────────

interface SectionRowsProps {
  section: OhadaSection;
  isOpen: boolean;
  values: Record<string, number>;
  computed: Record<string, number>;
  onChange: (code: string, val: number) => void;
  onToggle: () => void;
}

function SectionRows({ section, isOpen, values, computed, onChange, onToggle }: SectionRowsProps) {
  return (
    <>
      {/* En-tête de section */}
      <TableRow
        onClick={onToggle}
        sx={{
          bgcolor: section.headerColor,
          cursor: 'pointer',
          '&:hover': { opacity: 0.9 },
        }}
      >
        <TableCell colSpan={2} sx={{ py: 1, px: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" sx={{ color: 'white', p: 0 }}>
              {isOpen ? <CollapseIcon sx={{ fontSize: 18 }} /> : <ExpandIcon sx={{ fontSize: 18 }} />}
            </IconButton>
            <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 12 }}>
              {section.title}
            </Typography>
          </Box>
        </TableCell>
        <TableCell />
      </TableRow>

      {/* Lignes de détail — pliables */}
      {section.rows.map((row) => {
        const isDetailRow = row.type === 'input';
        if (isDetailRow && !isOpen) return null;
        return <DataRow key={row.code} row={row} values={values} computed={computed} onChange={onChange} />;
      })}
    </>
  );
}

// ─── Ligne individuelle ───────────────────────────────────────────────────────

interface DataRowProps {
  row: OhadaRow;
  values: Record<string, number>;
  computed: Record<string, number>;
  onChange: (code: string, val: number) => void;
}

function DataRow({ row, values, computed, onChange }: DataRowProps) {
  const rowBg =
    row.type === 'total' ? '#1565c0' :
    row.type === 'calculated' ? '#fffde7' :
    'white';
  const textColor = row.type === 'total' ? 'white' : '#1e293b';

  return (
    <TableRow sx={{ bgcolor: rowBg, '&:hover': { bgcolor: row.type === 'input' ? '#f8fafc' : rowBg } }}>
      <TableCell sx={{ py: 0.75, px: 1.5, fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
        {row.code}
      </TableCell>
      <TableCell sx={{ py: 0.75, pl: 1.5 + row.indent * 2, pr: 1 }}>
        <Typography sx={{ fontSize: 12, fontWeight: row.bold ? 700 : 400, color: textColor }}>
          {row.label}
        </Typography>
      </TableCell>
      <TableCell align="right" sx={{ py: 0.5, px: 1.5, width: 200 }}>
        {row.type === 'input' ? (
          <TextField
            size="small"
            type="number"
            value={values[row.code] ?? ''}
            onChange={(e) => onChange(row.code, parseFloat(e.target.value) || 0)}
            inputProps={{ style: { textAlign: 'right', fontSize: 12, padding: '4px 8px' } }}
            sx={{ width: 160, '& .MuiOutlinedInput-root': { height: 28 } }}
          />
        ) : (
          <Typography sx={{
            fontSize: 12, fontWeight: 700,
            color: row.type === 'total' ? 'white' : (computed[row.code] ?? 0) < 0 ? '#c62828' : '#1565c0',
          }}>
            {fmt(computed[row.code])}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Onglet Bilan (3 colonnes) ────────────────────────────────────────────────

interface BalanceTabProps {
  brut: Record<string, number>;
  amort: Record<string, number>;
  computed: Record<string, number>;
  openSections: Record<string, boolean>;
  onChangeBrut: (code: string, val: number) => void;
  onChangeAmort: (code: string, val: number) => void;
  onToggleSection: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

function BalanceTab({
  brut, amort, computed, openSections,
  onChangeBrut, onChangeAmort, onToggleSection, onExpandAll, onCollapseAll,
}: BalanceTabProps) {
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, justifyContent: 'flex-end' }}>
        <Button size="small" startIcon={<ExpandAllIcon />} onClick={onExpandAll} variant="outlined" sx={{ fontSize: 11 }}>
          Tout déplier
        </Button>
        <Button size="small" startIcon={<CollapseAllIcon />} onClick={onCollapseAll} variant="outlined" sx={{ fontSize: 11 }}>
          Tout plier
        </Button>
      </Box>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell sx={{ width: 70, fontWeight: 700, fontSize: 11, color: '#64748b' }}>Code</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, color: '#64748b' }}>Libellé</TableCell>
              <TableCell align="right" sx={{ width: 160, fontWeight: 700, fontSize: 11, color: '#64748b' }}>Brut</TableCell>
              <TableCell align="right" sx={{ width: 160, fontWeight: 700, fontSize: 11, color: '#64748b' }}>Amort./Dépréc.</TableCell>
              <TableCell align="right" sx={{ width: 160, fontWeight: 700, fontSize: 11, color: '#64748b' }}>Net</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {balanceSheet.sections.map((section) => {
              const isOpen = openSections[section.id] ?? section.defaultOpen;
              return (
                <React.Fragment key={section.id}>
                  <TableRow onClick={() => onToggleSection(section.id)} sx={{ bgcolor: section.headerColor, cursor: 'pointer', '&:hover': { opacity: 0.9 } }}>
                    <TableCell colSpan={4} sx={{ py: 1, px: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton size="small" sx={{ color: 'white', p: 0 }}>
                          {isOpen ? <CollapseIcon sx={{ fontSize: 18 }} /> : <ExpandIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                        <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 12 }}>{section.title}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  {section.rows.map((row) => {
                    if (row.type === 'input' && !isOpen) return null;
                    const net = (brut[row.code] ?? 0) - (amort[row.code] ?? 0);
                    const computedNet = (row.type === 'calculated' || row.type === 'total') ? (computed[row.code] ?? 0) : net;
                    const rowBg = row.type === 'total' ? '#1565c0' : row.type === 'calculated' ? '#fffde7' : 'white';
                    const textColor = row.type === 'total' ? 'white' : '#1e293b';
                    return (
                      <TableRow key={row.code} sx={{ bgcolor: rowBg }}>
                        <TableCell sx={{ py: 0.75, px: 1.5, fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{row.code}</TableCell>
                        <TableCell sx={{ py: 0.75, pl: 1.5 + row.indent * 2, pr: 1 }}>
                          <Typography sx={{ fontSize: 12, fontWeight: row.bold ? 700 : 400, color: textColor }}>{row.label}</Typography>
                        </TableCell>
                        {row.type === 'input' ? (
                          <>
                            <TableCell align="right" sx={{ py: 0.5, px: 1 }}>
                              <TextField size="small" type="number" value={brut[row.code] ?? ''} onChange={(e) => onChangeBrut(row.code, parseFloat(e.target.value) || 0)} inputProps={{ style: { textAlign: 'right', fontSize: 12, padding: '4px 6px' } }} sx={{ width: 130, '& .MuiOutlinedInput-root': { height: 28 } }} />
                            </TableCell>
                            <TableCell align="right" sx={{ py: 0.5, px: 1 }}>
                              <TextField size="small" type="number" value={amort[row.code] ?? ''} onChange={(e) => onChangeAmort(row.code, parseFloat(e.target.value) || 0)} inputProps={{ style: { textAlign: 'right', fontSize: 12, padding: '4px 6px' } }} sx={{ width: 130, '& .MuiOutlinedInput-root': { height: 28 } }} />
                            </TableCell>
                            <TableCell align="right" sx={{ py: 0.75, px: 1.5 }}>
                              <Typography sx={{ fontSize: 12, fontWeight: 600, color: net < 0 ? '#c62828' : '#1565c0' }}>{fmt(net)}</Typography>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell /><TableCell />
                            <TableCell align="right" sx={{ py: 0.75, px: 1.5 }}>
                              <Typography sx={{ fontSize: 12, fontWeight: 700, color: row.type === 'total' ? 'white' : computedNet < 0 ? '#c62828' : '#1565c0' }}>{fmt(computedNet)}</Typography>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function OhadaFinancialTable({ year, onComplete }: OhadaFinancialTableProps) {
  const [activeTab, setActiveTab] = useState(0);

  // Valeurs saisies
  const [incomeValues, setIncomeValues] = useState<Record<string, number>>({});
  const [cashflowValues, setCashflowValues] = useState<Record<string, number>>({});
  const [balanceBrut, setBalanceBrut] = useState<Record<string, number>>({});
  const [balanceAmort, setBalanceAmort] = useState<Record<string, number>>({});

  // Sections ouvertes (par statement id)
  const [incomeOpen, setIncomeOpen] = useState<Record<string, boolean>>({});
  const [cashflowOpen, setCashflowOpen] = useState<Record<string, boolean>>({});
  const [balanceOpen, setBalanceOpen] = useState<Record<string, boolean>>({});

  // Valeurs calculées
  const incomeComputed = useMemo(() => computeValues(incomeStatement, incomeValues), [incomeValues]);
  const cashflowComputed = useMemo(() => computeValues(cashflowStatement, cashflowValues), [cashflowValues]);

  const balanceNetValues = useMemo(() => {
    const net: Record<string, number> = {};
    balanceSheet.sections.forEach((s) => s.rows.forEach((r) => {
      if (r.type === 'input') net[r.code] = (balanceBrut[r.code] ?? 0) - (balanceAmort[r.code] ?? 0);
    }));
    return net;
  }, [balanceBrut, balanceAmort]);

  const balanceComputed = useMemo(() => computeValues(balanceSheet, balanceNetValues), [balanceNetValues]);

  // Handlers valeurs
  const handleIncomeChange = useCallback((code: string, val: number) =>
    setIncomeValues((p) => ({ ...p, [code]: val })), []);
  const handleCashflowChange = useCallback((code: string, val: number) =>
    setCashflowValues((p) => ({ ...p, [code]: val })), []);
  const handleBalanceBrutChange = useCallback((code: string, val: number) =>
    setBalanceBrut((p) => ({ ...p, [code]: val })), []);
  const handleBalanceAmortChange = useCallback((code: string, val: number) =>
    setBalanceAmort((p) => ({ ...p, [code]: val })), []);

  // Helpers expand/collapse
  const makeExpandAll = (stmt: OhadaStatement, setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) => () =>
    setter(Object.fromEntries(stmt.sections.map((s) => [s.id, true])));
  const makeCollapseAll = (stmt: OhadaStatement, setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) => () =>
    setter(Object.fromEntries(stmt.sections.map((s) => [s.id, false])));
  const makeToggle = (setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) => (id: string) =>
    setter((p) => ({ ...p, [id]: !(p[id] ?? true) }));

  const handleSave = () => {
    onComplete({
      incomeStatement: incomeComputed,
      cashFlow: cashflowComputed,
      balance: { brut: balanceBrut, amort: balanceAmort },
    });
  };

  return (
    <Box>
      {/* Titre avec l'année */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
          États Financiers SYSCOHADA — Exercice {year}
        </Typography>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} size="small">
          Enregistrer
        </Button>
      </Box>

      {/* Onglets */}
      <Box sx={{ borderBottom: '1px solid #e2e8f0', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ '& .MuiTab-root': { fontWeight: 600, fontSize: 13 } }}>
          <Tab label="Compte de Résultat" />
          <Tab label="Flux de Trésorerie" />
          <Tab label="Bilan" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <StatementTab
          statement={incomeStatement}
          values={incomeValues}
          computed={incomeComputed}
          openSections={incomeOpen}
          onChange={handleIncomeChange}
          onToggleSection={makeToggle(setIncomeOpen)}
          onExpandAll={makeExpandAll(incomeStatement, setIncomeOpen)}
          onCollapseAll={makeCollapseAll(incomeStatement, setIncomeOpen)}
        />
      )}
      {activeTab === 1 && (
        <StatementTab
          statement={cashflowStatement}
          values={cashflowValues}
          computed={cashflowComputed}
          openSections={cashflowOpen}
          onChange={handleCashflowChange}
          onToggleSection={makeToggle(setCashflowOpen)}
          onExpandAll={makeExpandAll(cashflowStatement, setCashflowOpen)}
          onCollapseAll={makeCollapseAll(cashflowStatement, setCashflowOpen)}
        />
      )}
      {activeTab === 2 && (
        <BalanceTab
          brut={balanceBrut}
          amort={balanceAmort}
          computed={balanceComputed}
          openSections={balanceOpen}
          onChangeBrut={handleBalanceBrutChange}
          onChangeAmort={handleBalanceAmortChange}
          onToggleSection={makeToggle(setBalanceOpen)}
          onExpandAll={makeExpandAll(balanceSheet, setBalanceOpen)}
          onCollapseAll={makeCollapseAll(balanceSheet, setBalanceOpen)}
        />
      )}
    </Box>
  );
}
```

- [ ] **Étape 2.2 : Vérifier la compilation TypeScript**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit 2>&1 | head -30
```
Attendu : aucune erreur.

- [ ] **Étape 2.3 : Commit**

```bash
git add src/components/forms/OhadaFinancialTable.tsx
git commit -m "feat(ohada): tableau financier SYSCOHADA révisé avec sections pliables et calcul temps réel"
```

---

## Tâche 3 — Modifier `ManualInputPage.tsx`

**Fichiers :**
- Modifier : `src/pages/ManualInputPage.tsx`

### Contexte

`ManualInputPage` est rendu par `FinancialDataInputTabs` dans l'onglet "Saisie Manuelle". Il reçoit `yearContext.year` (l'année) et `yearContext.onComplete` (callback). Il faut remplacer le contenu (stepper + étapes) par `<OhadaFinancialTable>`. Les imports liés au stepper (BalanceSheetForm, IncomeStatementForm, etc.) sont supprimés car ils ne seront plus utilisés.

- [ ] **Étape 3.1 : Remplacer le contenu de ManualInputPage**

Remplacer **tout le contenu** de `src/pages/ManualInputPage.tsx` par :

```tsx
import React from 'react';
import { Box } from '@mui/material';
import { OhadaFinancialTable } from '../components/forms/OhadaFinancialTable';
import { PageType } from '../types';

interface ManualInputPageProps {
  onNavigate: (page: PageType) => void;
  yearContext?: {
    year: number;
    onComplete: (data: any) => void;
  };
}

const ManualInputPage: React.FC<ManualInputPageProps> = ({ onNavigate, yearContext }) => {
  const year = yearContext?.year ?? new Date().getFullYear();

  const handleComplete = (data: any) => {
    if (yearContext?.onComplete) {
      yearContext.onComplete(data);
    } else {
      onNavigate('analysis');
    }
  };

  return (
    <Box>
      <OhadaFinancialTable year={year} onComplete={handleComplete} />
    </Box>
  );
};

export default ManualInputPage;
```

- [ ] **Étape 3.2 : Vérifier la compilation TypeScript**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit 2>&1 | head -30
```
Attendu : aucune erreur.

- [ ] **Étape 3.3 : Commit**

```bash
git add src/pages/ManualInputPage.tsx
git commit -m "feat(manual-input): remplacer le stepper par le tableau financier SYSCOHADA révisé"
```

---

## Vérification manuelle finale

Ouvrir la page "Nouvelle Demande" dans le navigateur et sélectionner l'onglet "Saisie Manuelle" :

1. **3 onglets visibles** : "Compte de Résultat", "Flux de Trésorerie", "Bilan"
2. **Sections pliables** : cliquer sur un en-tête coloré → les lignes de saisie se masquent ; les grandes masses restent visibles
3. **Calcul en temps réel** : saisir une valeur dans "Ventes de marchandises" → XA (Marge brute) se recalcule instantanément
4. **Bilan 3 colonnes** : l'onglet Bilan affiche Brut / Amort. / Net avec Net calculé automatiquement
5. **Bouton Enregistrer** : clique → `onComplete` est appelé et la politique passe à l'étape suivante
6. **Tout plier/déplier** : les boutons en haut de chaque onglet fonctionnent
