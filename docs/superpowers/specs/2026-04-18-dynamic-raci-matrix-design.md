# Matrice RACI Dynamique par Tenant — Design

## Goal

Rendre la matrice RACI configurable par tenant : chaque tenant peut modifier les rôles R/A/C/I par étape de workflow, gérer son mur chinois, et voir quels utilisateurs sont affectés à chaque rôle. Toute modification impacte directement les workflows (RACI = CreditPolicy active).

## Architecture

La matrice RACI est une vue/édition de la `CreditPolicy` active du tenant. Le **R** (Responsible) est `CreditPolicyStep.assignedRole` (source de vérité pour le moteur de workflow). Les rôles **A/C/I** sont stockés dans une nouvelle table `CreditPolicyStepRole`. Le mur chinois est stocké dans `TenantChineseWallRule` (remplace le code hardcodé dans `workflowService.ts`).

## Tech Stack

- Backend : Node.js + Express + Prisma + PostgreSQL
- Frontend : React + TypeScript + MUI
- Auth : JWT avec `companyId` extrait par middleware `requireCompany`

---

## Section 1 — Modèle de données

### Nouvelle table : `CreditPolicyStepRole`

```prisma
model CreditPolicyStepRole {
  id           String           @id @default(cuid())
  policyStepId String           @map("policy_step_id")
  policyStep   CreditPolicyStep @relation(fields: [policyStepId], references: [id], onDelete: Cascade)
  role         UserRole
  raciCode     RaciCode         @map("raci_code")
  createdAt    DateTime         @default(now()) @map("created_at")

  @@unique([policyStepId, role, raciCode])
  @@index([policyStepId])
  @@map("credit_policy_step_roles")
}

enum RaciCode {
  A  @map("a")
  C  @map("c")
  I  @map("i")
  @@map("raci_code")
}
```

- Stocke uniquement A, C, I. Le R est toujours `CreditPolicyStep.assignedRole`.
- `onDelete: Cascade` : si l'étape est supprimée, les rôles A/C/I sont supprimés aussi.
- Contrainte `@@unique([policyStepId, role, raciCode])` : pas de doublon rôle+code par étape.

### Nouvelle table : `TenantChineseWallRule`

```prisma
model TenantChineseWallRule {
  id            String   @id @default(cuid())
  companyId     String   @map("company_id")
  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  blockedRole   UserRole @map("blocked_role")
  forbiddenStep String   @map("forbidden_step")
  reason        String?
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")

  @@unique([companyId, blockedRole, forbiddenStep])
  @@index([companyId])
  @@map("tenant_chinese_wall_rules")
}
```

- Remplace le dict `CHINESE_WALL_RULES` hardcodé dans `workflowService.ts`.
- `isActive` permet de désactiver une règle sans la supprimer.
- `forbiddenStep` est le slug de l'étape (ex: `contre_analyse`).

### Ajouts sur modèles existants

```prisma
// Sur CreditPolicyStep :
stepRoles  CreditPolicyStepRole[]

// Sur Company :
chineseWallRules TenantChineseWallRule[]
```

### Nouvelle migration

`prisma/migrations/YYYYMMDD_add_raci_roles_and_chinese_wall` — non destructive, aucune colonne existante modifiée.

---

## Section 2 — API Backend

### Nouveau router : `backend/src/routes/raci-matrix.ts`

Monté sur `/api/raci-matrix`, protégé par `authenticate` + `requireCompany`.

#### `GET /api/raci-matrix`

Retourne la politique active du tenant avec :
- Toutes les étapes ordonnées (`order ASC`)
- Pour chaque étape : `assignedRole` (R) + entrées A/C/I depuis `CreditPolicyStepRole`
- Pour chaque rôle impliqué dans l'étape : liste des utilisateurs (`CompanyMembership` filtrés par role + companyId)
- Règles mur chinois du tenant (`TenantChineseWallRule` où `isActive = true`)

```json
{
  "policy": { "id": "...", "name": "Politique Générale BCI 2024", "version": 1 },
  "steps": [
    {
      "id": "step-id",
      "stepName": "application_created",
      "stepLabel": "Création du dossier",
      "phase": "Montage dossier",
      "order": 1,
      "stepType": "DISPATCH",
      "assignedRole": "CHARGE_AFFAIRES",       // = CreditPolicyStep.assignedRole (R)
      "roles": [
        { "role": "RESPONSABLE_ENGAGEMENTS", "raciCode": "I" }
      ],
      "users": {
        "CHARGE_AFFAIRES": [{ "id": "u1", "name": "Amadou Diallo", "email": "ca1@bci.sn" }],
        "RESPONSABLE_ENGAGEMENTS": [{ "id": "u2", "name": "Fatou Sow", "email": "resp.eng@bci.sn" }]
      }
    }
  ],
  "chineseWallRules": [
    { "id": "r1", "blockedRole": "ANALYSTE_RISQUES", "forbiddenStep": "mise_en_place_sib", "reason": "Mur chinois BCEAO", "isActive": true }
  ]
}
```

Si aucune politique active n'existe, retourne `{ policy: null, steps: [], chineseWallRules: [] }`.

#### `PUT /api/raci-matrix/steps/:stepId`

Modifie les propriétés d'une étape : `stepLabel`, `phase`, `assignedRole` (R), `expectedDurationHours`, `maxDurationHours`, `conditionMinAmount`, `conditionMaxAmount`.

#### `PUT /api/raci-matrix/steps/:stepId/roles`

Remplace entièrement les rôles A/C/I d'une étape.
- Body : `[{ role: "ANALYSTE_RISQUES", raciCode: "C" }]`
- Implémentation : `deleteMany` sur `policyStepId` puis `createMany`.

#### `POST /api/raci-matrix/steps`

Crée une nouvelle étape dans la politique active.
- Body : `{ stepName, stepLabel, phase, assignedRole, order, stepType, expectedDurationHours, maxDurationHours }`
- Si aucune politique active : retourne 409 avec message explicite.

#### `DELETE /api/raci-matrix/steps/:stepId`

Soft delete : `isActive = false` sur `CreditPolicyStep`.

#### `PUT /api/raci-matrix/chinese-wall`

Remplace toutes les règles mur chinois du tenant (full replace).
- Body : `[{ blockedRole, forbiddenStep, reason }]`
- Implémentation : `deleteMany({ where: { companyId } })` puis `createMany`.

### Modification de `workflowService.ts`

`canApproveStep(userId, applicationId, stepName)` récupère `companyId` depuis `application.companyId`. La requête qui charge l'application doit inclure `companyId` dans son `select` :

```ts
const application = await prisma.creditApplication.findUnique({
  where: { id: applicationId },
  select: {
    companyId: true,  // ← ajout nécessaire
    amount: true,
    // ... autres champs existants
  },
});
```

Puis le dict hardcodé `CHINESE_WALL_RULES` est remplacé par :

```ts
// Avant (hardcodé) :
const chineseWallRule = CHINESE_WALL_RULES[user.role as string];

// Après (DB) :
const rules = await prisma.tenantChineseWallRule.findMany({
  where: { companyId: application.companyId, blockedRole: user.role as UserRole, isActive: true },
  select: { forbiddenStep: true, reason: true },
});
const blocked = rules.find(r => r.forbiddenStep === stepName);
if (blocked) return { allowed: false, reason: blocked.reason ?? 'Mur chinois' };
```

### Modification de `stepNames.ts`

Supprimer `STEP_ROLES` (remplacé par la DB). Conserver `STEP_NAME_FR` comme fallback d'affichage uniquement.

---

## Section 3 — Frontend

### `src/pages/RACIMatrixPage.tsx` — réécriture complète

**3 onglets MUI :**

#### Onglet 1 — Matrice RACI

Tableau MUI avec :
- **Colonnes** : Étape | Description | [un par rôle présent dans la politique]
- **En-tête de colonne rôle** : nom du rôle + avatars des utilisateurs ayant ce rôle (Tooltip avec nom/email)
- **Cellules** : badge coloré R/A/C/I ou `–`. En mode édition : clic → menu popover (R / A / C / I / Effacer).
  - Contrainte R : déplacer le R d'une cellule met à jour `assignedRole` de l'étape, pas juste les roles A/C/I.
  - Couleurs : R=bleu `#1D4ED8`, A=ambre `#B45309`, C=violet `#6D28D9`, I=gris `#6B7280`
- **Mode édition** : bouton "Modifier" en haut à droite. En mode lecture, tableau non interactif.
- **Bouton Enregistrer** : actif dès qu'une modification est détectée. Envoie les diffs (`PUT /steps/:id` pour changement R, `PUT /steps/:id/roles` pour A/C/I).
- **Filtre par phase** : `ToggleButtonGroup` existant, conservé.

#### Onglet 2 — Mur Chinois

Tableau croisé : lignes = rôles pouvant être bloqués, colonnes = étapes.
- Chaque cellule = `Switch` MUI (activé = interdit)
- Champ texte `reason` au survol (Tooltip éditable en mode édition)
- Bouton Enregistrer → `PUT /api/raci-matrix/chinese-wall`

#### Onglet 3 — Étapes

Liste ordonnée avec :
- Drag & drop pour réordonner (met à jour `order` via `PUT /steps/:id`)
- Bouton **+ Ajouter** → Dialog : stepName (slug), stepLabel, phase, assignedRole, stepType, SLA heures
- Icône **Supprimer** par ligne → confirmation → `DELETE /steps/:id`

### Nouveau service frontend : `src/services/raciMatrixApi.ts`

```ts
export const raciMatrixApi = {
  getMatrix: () => ApiService.get('/raci-matrix'),
  updateStep: (stepId: string, data: Partial<RaciStep>) => ApiService.put(`/raci-matrix/steps/${stepId}`, data),
  updateStepRoles: (stepId: string, roles: RaciRole[]) => ApiService.put(`/raci-matrix/steps/${stepId}/roles`, roles),
  createStep: (data: NewRaciStep) => ApiService.post('/raci-matrix/steps', data),
  deleteStep: (stepId: string) => ApiService.delete(`/raci-matrix/steps/${stepId}`),
  updateChineseWall: (rules: ChineseWallRule[]) => ApiService.put('/raci-matrix/chinese-wall', rules),
};
```

---

## Section 4 — Migration & Seed

### Migration Prisma

Fichier : `prisma/migrations/TIMESTAMP_add_raci_roles_and_chinese_wall/migration.sql`
- `CREATE TABLE credit_policy_step_roles`
- `CREATE TABLE tenant_chinese_wall_rules`
- `CREATE TYPE raci_code AS ENUM ('a', 'c', 'i')`

### Seed BCI (`seed-bci.js` — step 6)

1. **Mur chinois** : 9 règles pour BCI (ANALYSTE_RISQUES × 6 étapes + RESPONSABLE_RISQUES × 6 étapes + RESPONSABLE_ENGAGEMENTS × 4 étapes — avec déduplication pour ANALYSTE/RESPONSABLE_RISQUES qui partagent les mêmes interdictions).

2. **Étapes manquantes** : ajouter `application_created` (order=0, CA, DISPATCH) et `back_office_setup` (order=13, BO, DISPATCH) dans la politique active BCI.

3. **Rôles A/C/I** : insérer les entrées `CreditPolicyStepRole` correspondant à la matrice RACI de référence (14 étapes, tous les A/C/I documentés).

---

## Fichiers modifiés

| Fichier | Action |
|---------|--------|
| `backend/prisma/schema.prisma` | +2 models, +1 enum, +2 relations |
| `backend/prisma/migrations/...` | nouvelle migration non-destructive |
| `backend/prisma/seed-bci.js` | step 6 : wall rules + A/C/I + étapes manquantes |
| `backend/src/routes/raci-matrix.ts` | nouveau (6 routes) |
| `backend/src/server.ts` | mount `/api/raci-matrix` |
| `backend/src/services/workflowService.ts` | `canApproveStep` lit mur chinois depuis DB |
| `backend/src/constants/stepNames.ts` | supprimer `STEP_ROLES` |
| `src/pages/RACIMatrixPage.tsx` | réécriture complète (3 onglets, éditable) |
| `src/services/raciMatrixApi.ts` | nouveau service API frontend |

---

## Contraintes et règles métier

- **Un seul R par étape** : le frontend empêche d'avoir deux R sur la même ligne.
- **Mur chinois enforced** : `canApproveStep` vérifie les règles DB avant d'autoriser un traitement.
- **Isolation tenant** : `requireCompany` middleware sur toutes les routes, `companyId` injecté sur chaque requête.
- **Pas de RACI sans politique active** : si aucune `CreditPolicy` active, l'UI affiche un message d'invite à créer une politique.
- **Modifications immédiates** : pas de "draft" — les changements de la matrice impactent les nouveaux dossiers dès la sauvegarde. Les dossiers en cours conservent leurs étapes existantes (les `WorkflowStep` déjà créés ne sont pas modifiés rétroactivement).
