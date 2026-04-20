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
  onClose: () => void;
  onComplete: (created: number, errors: BulkImportError[]) => void;
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

Règles appliquées sur chaque ligne avant import :

| Règle | Résultat si violation |
|-------|-----------------------|
| `Nom complet` vide | Erreur : "Nom obligatoire" |
| `Email` vide | Erreur : "Email obligatoire" |
| `Email` format invalide | Erreur : "Format email invalide" |
| `Rôle` absent ou non reconnu | Erreur : "Rôle invalide" |
| Email dupliqué dans le fichier | Erreur : "Email en doublon (ligne X)" |

Les lignes invalides sont affichées en rouge dans l'aperçu. L'admin peut :
- **Importer uniquement les lignes valides** (bouton principal)
- **Annuler** et corriger le fichier

---

## Import séquentiel (étape 4)

```
Pour chaque ligne valide (index i de N) :
  1. Appel POST /api/users avec { name, email, role, department, branch, jobTitle }
  2. Si succès → ligne marquée ✓, compteur ++
  3. Si erreur API → ligne marquée ✗, erreur enregistrée (continue)
  4. Progress bar = i / N * 100
  5. Délai minimal 50ms entre appels (éviter flooding)
```

**Gestion des erreurs mid-import :** Option B choisie — continuer malgré les erreurs, lister à la fin.

**Annulation :** Un bouton "Annuler" permet d'arrêter après la ligne en cours. Les utilisateurs déjà créés le restent.

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

### Téléchargement du rapport d'erreurs

Bouton "Télécharger les erreurs (.xlsx)" — génère un Excel avec les lignes échouées, prêtes à être corrigées et ré-importées.

---

## Points d'intégration

### 1. UserManagementPage (ADMIN tenant)

- Bouton `Import Excel` ajouté à côté du bouton `Ajouter un utilisateur`
- Le `companyId` est transmis implicitement via le JWT (middleware `requireCompany`)

### 2. PlatformAdminPage (SUPER_ADMIN)

- Bouton `Import Excel` ajouté dans le panneau de chaque company
- Même composant `BulkUserImportDialog`, même comportement

---

## Dépendances

| Package | Usage | Action |
|---------|-------|--------|
| `xlsx` | Lecture et génération de fichiers Excel | `npm install xlsx` si absent |

---

## Contraintes et limites

- **Limite recommandée :** 500 lignes par fichier (au-delà, risque de timeout navigateur)
- **Ligne 1 obligatoirement l'en-tête** — la première ligne du fichier est ignorée (en-têtes)
- **Encodage :** UTF-8 attendu pour les caractères accentués
- **Pas de rollback :** Les créations réussies avant une annulation ne sont pas annulées

---

## Fichiers modifiés / créés

| Fichier | Action |
|---------|--------|
| `src/components/BulkUserImportDialog.tsx` | Créer |
| `src/pages/UserManagementPage.tsx` | Modifier — ajouter bouton + intégrer dialog |
| `src/pages/PlatformAdminPage.tsx` | Modifier — ajouter bouton + intégrer dialog |
| `package.json` | Modifier — ajouter dépendance `xlsx` si absente |
