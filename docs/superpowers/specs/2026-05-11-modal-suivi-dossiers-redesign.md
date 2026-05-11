# Redesign — Modal "Suivi des dossiers"

**Date :** 2026-05-11  
**Fichier cible :** `src/components/WorkflowDetailsDialog.tsx`  
**Composant lié :** `src/components/WorkflowTimeline.tsx`

---

## Contexte

Le modal qui s'ouvre au clic sur un dossier dans la page "Suivi des dossiers" contient actuellement **6 onglets** (Workflow, Demande, Financier, Ratios, Scoring, Documents). L'objectif est de le simplifier en **3 onglets** plus intuitifs, de renforcer la lisibilité de la section financière, et d'enrichir la timeline workflow avec les acteurs intervenus.

---

## Structure générale

### Header (sticky, toujours visible)
- **Gauche :** nom du client (bold) · chip statut coloré (En cours = primary, Approuvé = success, Refusé = error) · numéro de dossier (caption) · montant en XOF (caption)
- **Droite :** bouton ✕ rond (`IconButton`, fond `rgba(0,0,0,0.06)`)
- Fond `#fafafa`, bordure basse `rgba(0,0,0,0.07)`

### Barre d'onglets (3 onglets)
| # | Label | Icone MUI |
|---|-------|-----------|
| 0 | Vue d'ensemble | `ViewQuiltOutlined` |
| 1 | Financier | `AccountBalanceOutlined` |
| 2 | Documents | `FolderOpenOutlined` |

Style : indicateur actif = trait `primary.main` en bas, `fontSize: 12px`, `textTransform: none`, `minHeight: 40`.

---

## Onglet 0 — Vue d'ensemble

Deux blocs empilés séparés par un `Divider` avec label texte.

### Bloc A — Demande
Deux `Card` côte à côte (`Grid xs=12 md=6`), empilées sur mobile :

**Card "Infos Client"**  
- Header avec icone `PersonOutline` + titre "Informations Client"
- Lignes label/valeur : Nom du client · Secteur d'activité · Chargé de compte · Agence
- Label : `Typography variant="body2" color="text.secondary"`  
- Valeur : `Typography variant="body2" fontWeight={600}`

**Card "Détails Crédit"**  
- Header avec icone `CreditScoreOutlined` + titre "Détails de la Demande"
- Montant demandé affiché en grand (`variant="h5"`, `color="primary.main"`)
- Lignes : Type de crédit · Durée · Objet · Date de soumission

### Bloc B — Parcours du dossier
Titre "Parcours du dossier" + badge chip indiquant le nombre d'étapes (`X étapes`).

Timeline verticale construite sans `Stepper` MUI (rendu custom) :

```
● [cercle coloré]  NOM DE L'ÉTAPE          [Chip décision]
│   Avatar  Prénom NOM · Rôle
│   📅 12/04/2026  ·  ⏱ 2j 4h
│   💬 "Commentaire..."  (italic, color="text.secondary")
│
│   [Si étape en cours uniquement]
│   → Prochaine étape : [Nom] · Délai estimé : Xj
```

**Couleurs du cercle :**
- Complétée → `success.main` + icone `CheckCircle`
- En cours → `primary.main` + icone `Schedule` (animé si possible)
- À venir → `grey.400` + icone `RadioButtonUnchecked`

**Chip décision :**
- `APPROUVÉ` → `color="success"`
- `REFUSÉ` → `color="error"`
- `EN ATTENTE` → `color="default"`

**Étapes futures :** `opacity: 0.45`

Ligne verticale de connexion : `Box` de 2px de large, `bgcolor="grey.200"`, centré sur le cercle.

---

## Onglet 1 — Financier

### En-tête de l'onglet
Sélecteur d'années en chips cliquables aligné à droite. Permet de filtrer/comparer les années disponibles. Années multiples = colonnes dans les tableaux.

### Bloc 1 — Grandes Masses du Bilan (premier visible)
Tableau compact 2 colonnes côte à côte (`Table` MUI, `size="small"`), dans une `Card` avec `borderRadius: 2` :

| ACTIF | PASSIF |
|-------|--------|
| Actif Immobilisé | Capitaux Propres |
| Actif Circulant | Dettes Financières |
| Trésorerie Actif | Passif Circulant |
| — | Trésorerie Passif |
| **TOTAL ACTIF** | **TOTAL PASSIF** |

- Header colonne : fond `primary.main` léger (`alpha 0.08`), texte bold
- Ligne TOTAL : fond `primary.light` (alpha 0.15), `fontWeight: 700`
- Icones : `Inventory2Outlined` (Actif), `AccountBalanceOutlined` (Passif)
- Si multi-années : colonnes par année (année en header)

### Bloc 2 — Compte de Résultat
Tableau compact dans `Card` :

| Indicateur | 2022 | 2023 | 2024 |
|------------|------|------|------|
| Chiffre d'Affaires | | | ↑ |
| Valeur Ajoutée | | | ↑ |
| EBE | | | ↓ |
| Résultat Exploitation | | | ↑ |
| Résultat Net | | | ↑ |

Flèche tendance : `TrendingUp` vert / `TrendingDown` rouge comparée à l'année précédente.

### Bloc 3 — Ratios clés
4 `Card` mini côte à côte (`Grid xs=6 md=3`) :

| Card | Icone | Valeur | Norme | Badge |
|------|-------|--------|-------|-------|
| Liquidité Générale | `WaterDrop` | 1.82 | ≥ 1.5 | ✅ OK |
| Marge Nette | `TrendingUp` | 12.4% | ≥ 10% | ✅ OK |
| Dette/Capitaux | `Balance` | 0.63 | ≤ 1.0 | ✅ OK |
| Rotation Actif | `Autorenew` | 0.91x | — | — |

Style card : bordure gauche colorée (2px) selon statut — `success.main` / `warning.main` / `error.main`. Fond blanc. Valeur en `variant="h6"` bold.

### Bloc 4 — Scoring (compact)
`Box` avec :
- Score affiché en grand (`variant="h3"`, `fontWeight: 800`) centré
- `LinearProgress` colorée (`success` ≥80, `info` ≥65, `warning` ≥50, `error` <50), `height: 10px`, `borderRadius: 5`
- Badge risque (`Chip`) : Risque Faible / Modéré / Élevé / Critique

---

## Onglet 2 — Documents

### Zone d'upload
Rectangle en pointillés (`border: 2px dashed grey.300`), `borderRadius: 2`, fond `grey.50` :
- Icone `CloudUploadOutlined` centré (couleur `grey.400`)
- Texte "Glissez vos fichiers ici ou cliquez pour parcourir"
- Au clic → déclenche `fileInputRef.current.click()`
- Pendant upload : `CircularProgress` + message "Téléversement en cours..."

### Liste des documents
Chaque document = `Box` (ligne) avec hover `bgcolor="grey.50"`, `borderRadius: 1`, `py: 1`, `px: 1.5` :

```
[Icone type fichier]  nom_fichier.pdf    [Chip catégorie]   12/04/2026
                      Taille · Par Prénom NOM              [👁] [⬇]
```

**Icones par type :**
- PDF → `PictureAsPdf` couleur `#f44336`
- Image → `Image` couleur `#9c27b0`
- Excel/CSV → `TableChart` couleur `#4caf50`
- Autre → `InsertDriveFile` couleur `#1976d2`

**Actions :**
- `Visibility` → ouvre prévisualisation dans Dialog secondaire
- `Download` → télécharge le fichier

**État vide :** illustration `FolderOpen` + `Typography` "Aucun document attaché à ce dossier."

### Prévisualisation
`Dialog` secondaire (maxWidth `md`) avec fond sombre pour PDF/images, bouton fermer en haut à droite. Pas de navigation hors du modal parent.

---

## Contraintes techniques

- Conserver toute la logique métier existante (appels API, gestion OTP, `canApprove`, `handleApproval`)
- Les actions d'approbation (boutons Approuver/Refuser + `OtpVerificationDialog`) restent dans le `DialogActions` en bas, visibles si `canApprove()` est vrai
- Les données financières continuent d'utiliser `flattenOhadaData` / `resolveYearData`
- Le composant `WorkflowTimeline.tsx` est supprimé ; le rendu de la timeline est intégré directement dans `WorkflowDetailsDialog.tsx` pour éviter le passage de props redondant
- Maintenir la compatibilité avec les 3 formats de données financières (OHADA, multiyear_data, legacy plat)

---

## Fichiers à modifier

| Fichier | Nature de la modification |
|---------|--------------------------|
| `src/components/WorkflowDetailsDialog.tsx` | Refonte complète du JSX (3 onglets, nouveaux blocs) |
| `src/components/WorkflowTimeline.tsx` | Refactorisation ou intégration inline |
