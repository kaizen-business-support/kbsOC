# Import en Bulk des Utilisateurs — Design

**Date :** 2026-04-20  
**Statut :** Approuvé  
**Auteur :** devofs2

---

## Objectif

Permettre à l'administrateur de créer des utilisateurs en lot via un fichier Excel (`.xlsx`). Un modèle pré-rempli est téléchargeable, les lignes sont validées côté frontend avant import, et une barre de progression affiche l'avancement ligne par ligne.

---

## Architecture

### Approche retenue : Séquentiel frontend (Option A)

- Le frontend lit le fichier Excel via la lib `xlsx`
- Il appelle `POST /api/users` une fois par ligne valide
- La progress bar avance après chaque appel API
- **Aucun changement backend requis**

### Composant unique réutilisable

```
src/components/BulkUserImportDialog.tsx
```

Props :
```typescript
interface BulkUserImportDialogProps {
  open: boolean;
  /**
   * Appelé lorsque l'utilisateur ferme le dialog AVANT d'atteindre l'étape 5
   * (ex : annuler à l'étape 1, 2 ou 3, ou fermer la dialog avant import).
   * N'est PAS appelé si l'utilisateur quitte depuis l'étape 5.
   */
  onClose: () => void;
  /**
   * Appelé lorsque l'utilisateur quitte l'étape 5 (Rapport), que l'import
   * soit terminé normalement ou annulé en cours de route.
   * `created` = nombre d'utilisateurs créés avec succès avant la fin/annulation.
   * `errors` = liste des lignes échouées (validation ou API).
   */
  onComplete: (created: number, errors: BulkImportError[]) => void;
  /**
   * Uniquement requis dans le contexte SUPER_ADMIN (PlatformAdminPage).
   * En contexte ADMIN tenant, le companyId est injecté automatiquement
   * via le JWT côté backend (middleware requireCompany).
   * En contexte SUPER_ADMIN, le companyId doit être passé explicitement
   * via cette prop (ex : l'ID de la company sélectionnée dans PlatformAdminPage).
   */
  companyId?: string;
}
```

### Type BulkImportError

```typescript
interface BulkImportError {
  row: number;       // numéro de ligne dans le fichier (1-based, sans compter l'en-tête)
  email: string;     // email de la ligne concernée (ou chaîne vide si absent)
  message: string;   // description de l'erreur (validation ou API)
}
```

Le dialog est auto-suffisant. Toute la logique (lecture Excel, validation, import séquentiel) est encapsulée dedans.

---

## Flux en 5 étapes (stepper)

```
Étape 1 — Modèle      : Télécharger le fichier modèle .xlsx
Étape 2 — Upload      : Glisser/déposer ou sélectionner le fichier rempli
Étape 3 — Aperçu      : Tableau des lignes lues (valides ✓ / invalides ✗)
Étape 4 — Import      : Progress bar séquentielle + liste en temps réel
Étape 5 — Rapport     : Résumé final + téléchargement rapport d'erreurs
```

---

## Modèle Excel

### Colonnes (dans l'ordre)

| # | Colonne | Obligatoire | Notes |
|---|---------|-------------|-------|
| A | `Nom complet` | Oui | Texte libre |
| B | `Email` | Oui | Format email valide, unique |
| C | `Rôle` | Oui | Liste déroulante (validation Excel) |
| D | `Département` | Non | Texte libre |
| E | `Agence` | Non | Texte libre |
| F | `Poste` | Non | Texte libre |

### Rôles valides (liste déroulante dans le Excel)

```
CHARGE_AFFAIRES, ANALYSTE_RISQUES, RESPONSABLE_RISQUES,
RESPONSABLE_ENGAGEMENTS, COMITE_CREDIT, DIRECTION_GENERALE,
DIRECTION_JURIDIQUE, BACK_OFFICE, ADMIN
```

### Génération du modèle

Le fichier `.xlsx` est généré dynamiquement côté frontend via `xlsx` :
- Ligne 1 : en-têtes en gras avec fond teal (`#0F766E`)
- Ligne 2 : exemple pré-rempli (grisé)
- Validation de données sur colonne C (liste déroulante des rôles)
- Feuille nommée `"Utilisateurs"`, largeur des colonnes ajustée

---

## Validation frontend (étape Aperçu)

### Validation du format du fichier (étape Upload)

Avant de passer à l'aperçu, les vérifications suivantes bloquent la progression si elles échouent :

| Règle | Résultat si violation |
|-------|-----------------------|
| Extension du fichier différente de `.xlsx` | Erreur : "Format invalide — seuls les fichiers .xlsx sont acceptés" |
| En-têtes de colonnes ne correspondent pas exactement aux colonnes attendues (A=`Nom complet`, B=`Email`, C=`Rôle`, D=`Département`, E=`Agence`, F=`Poste`) | Erreur : "Structure du fichier invalide — utilisez le modèle fourni" |
| Fichier vide (aucune ligne de données après l'en-tête) | Erreur : "Le fichier ne contient aucune donnée" |

Ces erreurs sont affichées dans l'étape Upload. L'utilisateur doit corriger le fichier ou télécharger à nouveau le modèle.

### Limite de lignes (étape Aperçu)

- Si le fichier contient **plus de 500 lignes de données**, un avertissement est affiché en haut de l'aperçu :  
  > ⚠️ "Votre fichier contient N lignes. La limite maximale est de 500 lignes. Le bouton d'import est désactivé. Divisez votre fichier en plusieurs lots."
- Le bouton **"Importer les lignes valides"** est **désactivé** tant que le fichier dépasse 500 lignes.
- L'utilisateur doit fractionner son fichier avant de pouvoir procéder.

### Règles de validation par ligne

| Règle | Résultat si violation |
|-------|-----------------------|
| `Nom complet` vide | Erreur : "Nom obligatoire" |
| `Email` vide | Erreur : "Email obligatoire" |
| `Email` format invalide | Erreur : "Format email invalide" |
| `Rôle` absent ou non reconnu | Erreur : "Rôle invalide" |
| Email dupliqué dans le fichier | Erreur : "Email en doublon (ligne X)" |

Les lignes invalides sont affichées en rouge dans l'aperçu. L'admin peut :
- **Importer uniquement les lignes valides** (bouton principal — désactivé si toutes les lignes sont invalides)
- **Annuler** et corriger le fichier

### Cas limite : toutes les lignes sont invalides

Si toutes les lignes échouent à la validation, le bouton "Importer les lignes valides" est **désactivé** et un message s'affiche :  
> ✗ "Aucune ligne valide à importer. Corrigez le fichier et rechargez-le."

---

## Import séquentiel (étape 4)

```
Pour chaque ligne valide (index i de N) :
  1. Appel POST /api/users avec { name, email, role, department, branch, jobTitle, companyId? }
     — companyId est inclus uniquement si la prop companyId est fournie (contexte SUPER_ADMIN)
  2. Si succès → ligne marquée ✓, compteur ++
  3. Si erreur API → ligne marquée ✗, erreur enregistrée (continue)
  4. Progress bar = (i + 1) / N * 100   // i est 0-based ; +1 pour atteindre 100% à la dernière ligne
  5. Délai minimal 150ms entre appels (throttling pour protéger le serveur)
```

**Gestion des erreurs mid-import :** Option B choisie — continuer malgré les erreurs, lister à la fin.

**Annulation :** Un bouton "Annuler" permet d'arrêter après la ligne en cours. Les utilisateurs déjà créés le restent. Après annulation, l'import s'arrête et le stepper avance automatiquement à l'étape 5 (Rapport), affichant le résumé des créations effectuées avant l'annulation.

---

## Rapport final (étape 5)

### Affichage

```
✓ 42 utilisateurs créés avec succès
✗ 3 erreurs

Erreurs :
  Ligne 5  — jean.dupont@bci.com     — Email déjà utilisé
  Ligne 12 — marie.martin@bci.com    — Rôle non configuré
  Ligne 28 — pierre.durand@bci.com   — Erreur serveur
```

En cas d'annulation, un bandeau indique : "Import annulé — N utilisateurs créés avant l'annulation."

### Téléchargement du rapport d'erreurs

Bouton "Télécharger les erreurs (.xlsx)" — génère un Excel avec les lignes échouées, prêtes à être corrigées et ré-importées. Ce bouton n'est affiché que s'il y a au moins une erreur.

---

## Points d'intégration

### 1. UserManagementPage (ADMIN tenant)

- Bouton `Import Excel` ajouté à côté du bouton `Ajouter un utilisateur`
- Le `companyId` est transmis implicitement via le JWT (middleware `requireCompany`) — la prop `companyId` n'est **pas** passée au dialog

### 2. PlatformAdminPage (SUPER_ADMIN)

- Bouton `Import Excel` ajouté dans le panneau de chaque company
- Même composant `BulkUserImportDialog`, avec la prop `companyId={company.id}` passée explicitement
- Sans cette prop, le backend rejette la requête (pas de companyId dans le JWT SUPER_ADMIN)

---

## Dépendances

| Package | Usage | Action |
|---------|-------|--------|
| `xlsx` | Lecture et génération de fichiers Excel | `npm install xlsx` si absent |

---

## Contraintes et limites

- **Limite stricte :** 500 lignes par fichier — au-delà, le bouton d'import est désactivé avec un message explicatif
- **Ligne 1 obligatoirement l'en-tête** — la première ligne du fichier est ignorée (en-têtes) ; toute divergence bloque l'import
- **Formats acceptés :** `.xlsx` uniquement — les formats `.xls`, `.csv` et autres sont rejetés à l'upload
- **Encodage :** UTF-8 attendu pour les caractères accentués
- **Pas de rollback :** Les créations réussies avant une annulation ne sont pas annulées
- **Délai inter-appels :** 150ms minimum entre chaque requête POST pour éviter de saturer le serveur

---

## Fichiers modifiés / créés

| Fichier | Action |
|---------|--------|
| `src/components/BulkUserImportDialog.tsx` | Créer |
| `src/pages/UserManagementPage.tsx` | Modifier — ajouter bouton + intégrer dialog |
| `src/pages/PlatformAdminPage.tsx` | Modifier — ajouter bouton + intégrer dialog avec `companyId` |
| `package.json` | Modifier — ajouter dépendance `xlsx` si absente |
