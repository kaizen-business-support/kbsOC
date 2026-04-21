# Éditeur Visuel de Workflow de Crédit — Design Spec

**Date :** 2026-04-21
**Projet :** OptimusCredit (kbsOC)
**Statut :** Approuvé

---

## 1. Contexte & Objectif

OptimusCredit dispose déjà d'une `CreditPolicyPage.tsx` avec une interface tableau CRUD pour configurer les politiques de crédit. L'objectif est de la remplacer par un éditeur visuel drag & drop, plus intuitif pour les utilisateurs métier des banques clientes.

**Phase de transition :** Le builder coexiste avec l'interface tableau existante (onglet "Éditeur visuel" + onglet "Liste"). L'interface tableau est retirée une fois le builder validé en production.

**Priorité v1 :** Configuration avancée des règles de transition (guards) > canvas visuel libre.

---

## 2. Architecture Générale

### Layout 3 colonnes

```
┌─────────────────┬────────────────────────────┬──────────────────────┐
│  Palette (240px)│     Liste des étapes        │  Aperçu React Flow   │
│                 │     (source de vérité)       │  (visualisation)     │
│  [+ Dispatch]   │  ┌──────────────────────┐   │                      │
│  [+ Analyse]    │  │ 1. Dispatch   [edit] │   │  ○→□→◇→□→●          │
│  [+ Approbation]│  │ 2. Analyse    [edit] │   │                      │
│  [+ Comité]     │  │ 3. Approbation[edit] │   │                      │
│                 │  │    ▼ Gardes config   │   │                      │
│  Rôles dispo    │  └──────────────────────┘   │                      │
│  ...            │  [Sauvegarder] [Valider]     │                      │
└─────────────────┴────────────────────────────┴──────────────────────┘
```

La liste d'étapes est la **source de vérité**. L'aperçu React Flow est en lecture seule et se synchronise en temps réel.

### Composants frontend

| Composant | Rôle |
|---|---|
| `WorkflowPolicyBuilder.tsx` | Conteneur principal 3 colonnes |
| `StepPalette.tsx` | Palette gauche — types d'étapes (statique) + rôles (enum statique) |
| `StepList.tsx` | Liste drag & drop des étapes |
| `StepConfigPanel.tsx` | Config inline expand/collapse par étape |
| `GuardRulesEditor.tsx` | Rules engine (montant / score / type crédit + AND/OR) |
| `WorkflowPreview.tsx` | Canvas React Flow lecture seule |

**Librairie drag & drop :** React Flow (`@xyflow/react`)

**Intégration :** Nouvel onglet "Éditeur visuel" dans la route `/credit-policy` existante. Aucun changement de routing.

**Rôles dans la palette :** La liste des rôles affichés dans `StepPalette` est issue de la constante statique `ROLES` déjà définie dans `CreditPolicyPage.tsx` (enum `UserRole`). Aucun appel API supplémentaire pour charger les rôles.

---

## 3. Modèle de Données

### Migration Prisma

Ajout d'un seul champ sur le modèle existant `CreditPolicyStep`. Les champs `conditionMinAmount` / `conditionMaxAmount` existants sont conservés pour rétrocompatibilité avec les données migrées, mais **le champ `guards` est la source de vérité pour les règles de transition dans le nouveau builder**. En cas de coexistence, `guards` prend la priorité.

```prisma
model CreditPolicyStep {
  // ... tous les champs existants inchangés ...
  guards Json? @map("guards") // règles de transition conditionnelles (v2 builder)
}
```

> **Note :** Ce champ n'est pas encore dans `schema.prisma` — il doit être ajouté manuellement avant d'exécuter la migration.

**Commandes de migration :**
```bash
# 1. Ajouter le champ dans schema.prisma, puis :
npx prisma migrate dev --name add_guards_to_credit_policy_step
# 2. Régénérer le client :
npx prisma generate
```

SQL généré par Prisma :
```sql
ALTER TABLE "credit_policy_steps" ADD COLUMN "guards" JSONB;
```

### Structure JSON des gardes

```json
{
  "operator": "AND",
  "conditions": [
    {
      "field": "amount",
      "operator": "BETWEEN",
      "value": { "min": 0, "max": 50000000 }
    },
    {
      "field": "riskScore",
      "operator": "GTE",
      "value": 60
    },
    {
      "field": "creditTypeId",
      "operator": "IN",
      "value": ["ctype_001", "ctype_002"]
    }
  ]
}
```

### Champs de conditions supportés en v1

| field | Source | Type | Opérateurs |
|---|---|---|---|
| `amount` | `CreditApplication.amount` | Decimal | `BETWEEN`, `LT`, `GT`, `GTE`, `LTE` |
| `riskScore` | `CreditApplication.score.numeric` (Int, extrait du Json) | Int (0–100) | `GTE`, `LTE`, `BETWEEN` |
| `creditTypeId` | `CreditApplication.creditTypeId` (singular — le type du dossier) | String | `IN`, `NOT_IN` (valeur = tableau de strings) |

**Clarifications importantes :**
- `riskScore` est extrait du champ `CreditApplication.score` (Json?) via le chemin `score?.numeric`. Si `score` est null ou ne contient pas `numeric`, la condition `riskScore` est évaluée comme non-satisfaite.
- `creditTypeId` dans les gardes évalue `CreditApplication.creditTypeId` (la FK vers le type de crédit du dossier, valeur unique). Le champ `guards.conditions[].value` pour l'opérateur `IN` est un tableau de strings (IDs de CreditType).

**Opérateurs logiques :** `AND` / `OR` au niveau racine uniquement (pas d'imbrication en v1).

---

## 4. UX Flow

### Flux principal

1. L'utilisateur ouvre l'onglet "Éditeur visuel" — la politique active est chargée
2. Il glisse un type d'étape depuis la palette vers la liste
3. Il clique sur une étape → panneau de config s'expand inline
4. Il configure : nom, rôle, SLA, gardes
5. L'aperçu React Flow se met à jour en temps réel
6. Il clique **Valider** → validation automatique (client + serveur)
7. Il clique **Sauvegarder** → API + incrément de version automatique

### Panneau de configuration inline

```
┌─────────────────────────────────────────────────────┐
│ ▼ 2. Analyse Crédit                    [ANALYSE] ✕  │
├─────────────────────────────────────────────────────┤
│ Nom de l'étape : [Analyse Crédit          ]         │
│ Rôle assigné   : [Analyste Risques      ▾]         │
│ SLA attendu    : [24] h   SLA max : [72] h          │
│ Types de crédit: [Tous ▾] ou sélection multiple     │
├─────────────────────────────────────────────────────┤
│ GARDES (conditions d'activation)                    │
│ Opérateur : ● AND  ○ OR                             │
│                                                     │
│ + Montant entre [0] et [50 000 000] XOF             │
│ + Score risque ≥ [60]                               │
│ + Types crédit dans [Court terme, Moyen terme]      │
│                                                     │
│ [+ Ajouter une condition]                           │
└─────────────────────────────────────────────────────┘
```

### Validation automatique (avant sauvegarde)

Règles côté client ET côté serveur :
- Au moins 1 étape `DISPATCH` et 1 étape `APPROVAL` ou `COMMITTEE`
- Aucune étape sans rôle assigné
- Pas de doublons d'ordre
- Chaque garde a des valeurs complètes (pas de condition vide)

Les erreurs s'affichent **inline** sur le bloc concerné (bordure rouge + message), pas en toast global.

---

## 5. Backend API

### Endpoints existants étendus

| Méthode | Route | Changement |
|---|---|---|
| `GET` | `/api/credit-policies/:id` | Inclure `guards` dans la réponse des steps |
| `PUT` | `/api/credit-policies/:id` | Auto-incrément `version` + persistance `guards` + contrôle optimiste de version |

### Nouvel endpoint de validation

```
POST /api/credit-policies/:id/validate
→ 200 { valid: true }
→ 422 { valid: false, errors: [{ stepId: string, message: string }] }
```

### Auto-versioning

À chaque `PUT`, le handler exécute :
```ts
version: { increment: 1 }
```

Les gardes ne s'appliquent qu'aux nouvelles applications créées après activation de la politique modifiée. Les dossiers en cours ne sont pas impactés.

### Contrôle de concurrence (optimistic locking)

Le `PUT` accepte un champ `expectedVersion: number` dans le body. Le handler vérifie que la version en base correspond avant d'écrire. Si elle ne correspond pas (deux admins sauvegardant simultanément) :

```
→ 409 { error: "CONFLICT", message: "La politique a été modifiée par quelqu'un d'autre. Veuillez recharger avant de sauvegarder." }
```

Le frontend affiche ce message et propose un bouton "Recharger".

### Guard Engine

Nouveau service `backend/src/services/guardEngine.ts` :

```ts
type GuardContext = {
  amount: number;        // CreditApplication.amount
  riskScore: number;     // extrait de CreditApplication.score?.numeric (défaut: 0)
  creditTypeId: string;  // CreditApplication.creditTypeId
};

function evaluateGuards(guards: GuardsJson | null, ctx: GuardContext): boolean
```

Fonction pure, testable indépendamment, appelée par le moteur de workflow lors des transitions entre étapes.

---

## 6. Permissions & Accès

Le builder utilise le système RBAC existant (`RolePermission.permissions` — tableau Json de strings).

- Si l'utilisateur possède la permission `MANAGE_CREDIT_POLICY` dans son `RolePermission` → accès édition complet
- Sinon → builder en lecture seule (boutons Sauvegarder/Valider masqués, drag & drop désactivé)

**Initialisation :** La permission `MANAGE_CREDIT_POLICY` doit être ajoutée dans le seed / script de migration des rôles pour `ADMIN` et `SUPER_ADMIN`. Sans cette initialisation, le builder sera en lecture seule pour tous les utilisateurs au premier déploiement. Ajouter au script de seed existant :

```ts
// Dans seed ou migration script
for (const role of ['ADMIN', 'SUPER_ADMIN'] as const) {
  await prisma.rolePermission.update({
    where: { role },
    data: { permissions: { push: 'MANAGE_CREDIT_POLICY' } },
  });
}
```

---

## 7. Hors Scope v1

- Duplication de politique comme template
- Imbrication de conditions AND/OR (nested guards)
- Canvas libre avec positionnement manuel des nœuds
- Versioning manuel avec diff visuel entre versions
- Export PDF du workflow

---

## 8. Dépendances

- `@xyflow/react` (React Flow v12) — à ajouter dans `package.json` frontend
- Prisma migration — 1 champ `guards JSONB` sur `credit_policy_steps` + `prisma generate`
- Seed update — ajouter `MANAGE_CREDIT_POLICY` aux rôles `ADMIN` et `SUPER_ADMIN`
- Aucune autre dépendance externe
