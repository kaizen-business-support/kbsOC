# Tableau Financier SYSCOHADA Révisé — Saisie Manuelle

**Date** : 2026-05-06  
**Statut** : Approuvé

## Contexte

L'onglet "Saisie Manuelle" de la nouvelle demande de crédit affiche actuellement un stepper (Configuration → Bilan → Compte de Résultat → Vérification) avec des formulaires basiques. L'utilisateur a besoin d'un tableau comptable riche suivant la norme SYSCOHADA révisée (2017), avec sections pliables et grandes masses calculées automatiquement.

## Objectif

- Remplacer le stepper de `ManualInputPage` par 3 onglets : **Compte de Résultat** / **Tableau des Flux de Trésorerie** / **Bilan**
- Chaque onglet est un tableau `<Table>` MUI avec sections pliables
- Les grandes masses (XA, XB, XC…) sont calculées en temps réel
- L'interface ressemble à un vrai document SYSCOHADA imprimable

---

## Architecture

### Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `src/components/forms/ohadaStatements.ts` | Définition statique des 3 états SYSCOHADA (codes, libellés, formules, indentation) |
| `src/components/forms/OhadaFinancialTable.tsx` | Composant principal : 3 onglets + tableau par onglet |

### Fichier modifié

| Fichier | Changement |
|---|---|
| `src/pages/ManualInputPage.tsx` | Remplacer le stepper par `<OhadaFinancialTable year={year} onComplete={onComplete} />` |

---

## Structure de données (`ohadaStatements.ts`)

```ts
export type RowType = 'input' | 'calculated' | 'total';

export interface OhadaRow {
  code: string;           // ex: 'RA', 'XA', 'XJ'
  label: string;          // ex: 'Ventes de marchandises'
  type: RowType;
  formula?: string[];     // codes des lignes entrant dans le calcul
  signs?: ('+' | '-')[];  // signe de chaque terme (même index que formula)
  indent: 0 | 1 | 2;     // 0=section, 1=sous-groupe, 2=ligne de détail
  bold?: boolean;
  negate?: boolean;       // true si la ligne est une charge (saisie positive, signe négatif dans le calcul)
}

export interface OhadaSection {
  id: string;
  title: string;
  headerColor: string;    // couleur de fond de l'en-tête (hex)
  rows: OhadaRow[];
  defaultOpen: boolean;
}

export interface OhadaStatement {
  id: 'income' | 'cashflow' | 'balance';
  title: string;
  sections: OhadaSection[];
}
```

---

## Compte de Résultat SYSCOHADA révisé

### Section 1 : Activités d'exploitation — Produits
`headerColor: '#1565c0'` (bleu foncé), `defaultOpen: true`

| Code | Libellé | Type | Formule |
|---|---|---|---|
| RA | Ventes de marchandises | input | — |
| RB | Achats de marchandises | input | — |
| RC | Variation de stocks de marchandises | input | — |
| **XA** | **Marge brute sur marchandises** | calculated | RA - RB - RC |
| RD | Ventes de produits fabriqués | input | — |
| RE | Travaux, services vendus | input | — |
| RF | Produits accessoires | input | — |
| **XB** | **Chiffre d'affaires** | calculated | RD + RE + RF |
| RG | Production stockée ou déstockée (+/-) | input | — |
| RH | Production immobilisée | input | — |
| RI | Subventions d'exploitation | input | — |
| RJ | Autres produits | input | — |
| RK | Transferts de charges d'exploitation | input | — |
| **XC** | **Total Produits d'Exploitation** | calculated | XA + XB + RG + RH + RI + RJ + RK |

### Section 2 : Activités d'exploitation — Charges
`headerColor: '#b71c1c'` (rouge foncé), `defaultOpen: true`

| Code | Libellé | Type | Formule |
|---|---|---|---|
| RL | Achats de matières premières et fournitures | input | — |
| RM | Variation de stocks de matières premières | input | — |
| RN | Autres achats | input | — |
| RO | Variation des autres stocks | input | — |
| RP | Transports | input | — |
| RQ | Services extérieurs | input | — |
| RR | Impôts et taxes | input | — |
| RS | Autres charges | input | — |
| RT | Transferts de charges d'exploitation (déductibles) | input | — |
| **XD** | **Valeur Ajoutée (VA)** | calculated | XC - RL - RM - RN - RO - RP - RQ - RR - RS + RT |
| RU | Charges de personnel | input | — |
| RV | Impôts et taxes sur rémunérations | input | — |
| **XE** | **Excédent Brut d'Exploitation (EBE)** | calculated | XD - RU - RV |
| RW | Reprises de provisions et dépréciations | input | — |
| RX | Autres produits d'exploitation | input | — |
| RY | Dotations aux amortissements et dépréciations | input | — |
| RZ | Dotations aux provisions | input | — |
| S1 | Autres charges d'exploitation | input | — |
| **XF** | **Résultat d'Exploitation** | calculated | XE + RW + RX - RY - RZ - S1 |

### Section 3 : Activités financières
`headerColor: '#1b5e20'` (vert foncé), `defaultOpen: true`

| Code | Libellé | Type | Formule |
|---|---|---|---|
| SA | Revenus financiers et assimilés | input | — |
| SB | Reprises de provisions financières | input | — |
| SC | Transferts de charges financières | input | — |
| SD | Frais financiers et charges assimilées | input | — |
| SE | Dotations aux provisions financières | input | — |
| **XG** | **Résultat Financier** | calculated | SA + SB + SC - SD - SE |
| **XH** | **Résultat des Activités Ordinaires (RAO)** | calculated | XF + XG |

### Section 4 : Activités HAO
`headerColor: '#4a148c'` (violet foncé), `defaultOpen: true`

| Code | Libellé | Type | Formule |
|---|---|---|---|
| SF | Produits des cessions d'immobilisations | input | — |
| SG | Autres produits HAO | input | — |
| SH | Valeurs comptables des cessions d'immobilisations | input | — |
| SI | Autres charges HAO | input | — |
| **XI** | **Résultat HAO** | calculated | SF + SG - SH - SI |

### Section 5 : Participation et Impôts
`headerColor: '#e65100'` (orange foncé), `defaultOpen: true`

| Code | Libellé | Type | Formule |
|---|---|---|---|
| SJ | Participation des travailleurs | input | — |
| SK | Impôts sur le résultat | input | — |
| **XJ** | **RÉSULTAT NET** | total | XH + XI - SJ - SK |

---

## Tableau des Flux de Trésorerie SYSCOHADA révisé

### Section 1 : Flux des Activités Opérationnelles
`headerColor: '#0d47a1'`, `defaultOpen: true`

| Code | Libellé | Type | Formule |
|---|---|---|---|
| FA | Résultat net de l'exercice | input | — |
| FB | Dotations aux amortissements et dépréciations | input | — |
| FC | Variations des provisions | input | — |
| FD | Valeurs comptables des cessions d'immobilisations | input | — |
| FE | - Produits des cessions d'immobilisations | input | — |
| FF | + Charges et produits HAO non décaissés/encaissés | input | — |
| **ZA** | **Capacité d'Autofinancement Globale (CAFG)** | calculated | FA + FB + FC + FD - FE + FF |
| FG | - Variation de stocks (augmentation) | input | — |
| FH | - Variation des créances clients (augmentation) | input | — |
| FI | + Variation des dettes fournisseurs (augmentation) | input | — |
| **ZB** | **Variation du BFE** | calculated | -FG - FH + FI |
| **ZC** | **Flux de Trésorerie Opérationnel** | calculated | ZA + ZB |

### Section 2 : Flux des Activités d'Investissement
`headerColor: '#1a237e'`, `defaultOpen: true`

| Code | Libellé | Type | Formule |
|---|---|---|---|
| FJ | Acquisitions d'immobilisations corporelles et incorporelles | input | — |
| FK | Cessions d'immobilisations corporelles et incorporelles | input | — |
| FL | Acquisitions d'immobilisations financières | input | — |
| FM | Cessions d'immobilisations financières | input | — |
| **ZD** | **Flux de Trésorerie d'Investissement** | calculated | -FJ + FK - FL + FM |

### Section 3 : Flux des Activités de Financement — Capitaux propres
`headerColor: '#004d40'`, `defaultOpen: true`

| Code | Libellé | Type | Formule |
|---|---|---|---|
| FN | + Augmentation de capital par apports nouveaux | input | — |
| FO | + Subventions d'investissement reçues | input | — |
| FP | - Prélèvements sur le capital | input | — |
| FQ | - Dividendes versés | input | — |
| **ZE** | **Flux Capitaux Propres** | calculated | FN + FO - FP - FQ |

### Section 4 : Flux des Activités de Financement — Capitaux étrangers
`headerColor: '#1b5e20'`, `defaultOpen: true`

| Code | Libellé | Type | Formule |
|---|---|---|---|
| FR | + Emprunts | input | — |
| FS | + Autres dettes financières | input | — |
| FT | - Remboursements d'emprunts | input | — |
| FU | - Remboursements d'autres dettes financières | input | — |
| **ZF** | **Flux Capitaux Étrangers** | calculated | FR + FS - FT - FU |
| **ZG** | **Flux de Trésorerie de Financement** | calculated | ZE + ZF |
| **ZH** | **VARIATION NETTE DE TRÉSORERIE** | total | ZC + ZD + ZG |
| FV | Trésorerie nette au 1er janvier | input | — |
| **ZI** | **Trésorerie nette au 31 décembre** | total | ZH + FV |

---

## Bilan SYSCOHADA révisé

### Section 1 : Actif Immobilisé
`headerColor: '#1565c0'`, `defaultOpen: true`

Colonnes : **Brut** | **Amort./Dépréc.** | **Net** (calculé = Brut - Amort.)

| Code | Libellé | Type |
|---|---|---|
| AB | Charges immobilisées | input (brut + amort) |
| AC | Frais d'établissement et de développement | input |
| AD | Brevets, licences, logiciels | input |
| AE | Fonds commercial et droit au bail | input |
| AF | Autres immobilisations incorporelles | input |
| AG | Terrains | input |
| AH | Bâtiments | input |
| AI | Aménagements, agencements, installations | input |
| AJ | Matériel, mobilier et actifs biologiques | input |
| AK | Matériel de transport | input |
| AL | Avances et acomptes versés sur immobilisations | input |
| AM | Titres de participation | input |
| AN | Autres immobilisations financières | input |
| **AO** | **Total Actif Immobilisé** | calculated (somme nettes) |

### Section 2 : Actif Circulant
`headerColor: '#00838f'`, `defaultOpen: true`

| Code | Libellé | Type |
|---|---|---|
| AP | Actif circulant HAO | input |
| AQ | Marchandises | input |
| AR | Matières premières et fournitures | input |
| AS | En-cours de fabrication | input |
| AT | Produits fabriqués | input |
| AU | Avances et acomptes versés sur commandes | input |
| AV | Fournisseurs, avances versées | input |
| AW | Clients | input |
| AX | Autres créances | input |
| **AZ** | **Total Actif Circulant** | calculated |

### Section 3 : Trésorerie Actif
`headerColor: '#558b2f'`, `defaultOpen: true`

| Code | Libellé | Type |
|---|---|---|
| BA | Titres de placement | input |
| BB | Valeurs à encaisser | input |
| BC | Banques, chèques postaux, caisse | input |
| **BT** | **Total Trésorerie Actif** | calculated |
| **BZ** | **TOTAL ACTIF** | total | AO + AZ + BT |

### Section 4 : Capitaux Propres
`headerColor: '#1565c0'`, `defaultOpen: true`

| Code | Libellé | Type |
|---|---|---|
| CA | Capital | input |
| CB | Apporteurs, capital non appelé (-) | input |
| CC | Primes liées au capital social | input |
| CD | Écarts de réévaluation | input |
| CE | Réserves indisponibles | input |
| CF | Réserves libres | input |
| CG | Report à nouveau (+/-) | input |
| CH | Résultat net de l'exercice | input |
| CI | Autres capitaux propres | input |
| **CP** | **Total Capitaux Propres** | calculated |

### Section 5 : Dettes Financières
`headerColor: '#4527a0'`, `defaultOpen: true`

| Code | Libellé | Type |
|---|---|---|
| DA | Emprunts | input |
| DB | Dettes de crédit-bail | input |
| DC | Dettes financières diverses | input |
| DD | Provisions financières pour risques et charges | input |
| **DF** | **Total Dettes Financières** | calculated |
| **DG** | **Total Ressources Stables** | calculated | CP + DF |

### Section 6 : Passif Circulant
`headerColor: '#b71c1c'`, `defaultOpen: true`

| Code | Libellé | Type |
|---|---|---|
| DH | Dettes circulantes HAO | input |
| DI | Clients, avances reçues | input |
| DJ | Fournisseurs d'exploitation | input |
| DK | Dettes fiscales | input |
| DL | Dettes sociales | input |
| DM | Autres dettes | input |
| DN | Risques provisionnés | input |
| **DP** | **Total Passif Circulant** | calculated |

### Section 7 : Trésorerie Passif
`headerColor: '#e65100'`, `defaultOpen: true`

| Code | Libellé | Type |
|---|---|---|
| DQ | Banques, crédits d'escompte | input |
| DR | Banques, crédits de trésorerie | input |
| **DT** | **Total Trésorerie Passif** | calculated |
| **DZ** | **TOTAL PASSIF** | total | DG + DP + DT |

---

## Design visuel du tableau (`OhadaFinancialTable.tsx`)

### Types de lignes

| Type | Style |
|---|---|
| En-tête de section | `bgcolor: headerColor`, texte blanc, chevron cliquable, `fontWeight: 700` |
| Ligne `input` | Fond blanc, code en `#94a3b8`, `TextField` numérique à droite |
| Ligne `calculated` | `bgcolor: '#fffde7'`, libellé en gras, valeur en lecture seule |
| Ligne `total` | `bgcolor: '#1565c0'`, texte blanc, `fontWeight: 700` |

### Colonnes

- **Code** : 70px, fixe
- **Libellé** : flex, indentation via `paddingLeft: indent * 16px`
- **Montant** : 200px, alignement droite, `TextField` pour `input`, texte formaté pour `calculated`/`total`

### Comportement

- Bouton "Tout plier / Tout déplier" en haut de chaque onglet
- Sections fermées : les lignes `input` sont masquées, les lignes `calculated` et `total` restent visibles
- Calcul en temps réel : `useMemo` sur toutes les valeurs calculées
- Formatage des nombres : séparateur de milliers, 0 décimales (FCFA)

### Bilan — colonnes spéciales

Le Bilan a 3 colonnes de montant : **Brut** | **Amort./Dépréc.** | **Net** (= Brut − Amort., calculé automatiquement)

---

## Intégration dans ManualInputPage

Le stepper existant (4 étapes) est remplacé par :

```tsx
<OhadaFinancialTable
  year={yearContext.year}
  onComplete={(data) => yearContext.onComplete(data)}
/>
```

Le composant expose via `onComplete` un objet structuré :
```ts
{
  incomeStatement: Record<string, number>,   // code → valeur saisie
  cashFlow: Record<string, number>,
  balance: { brut: Record<string, number>, amort: Record<string, number> },
}
```

---

## Hors scope

- Validation inter-états (ex: Résultat Net du Compte de Résultat = Résultat Net du Bilan)
- Export PDF/Excel du tableau rempli
- Saisie multi-exercices dans le même tableau (chaque année a sa propre instance)
