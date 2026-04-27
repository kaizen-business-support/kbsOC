# Workflow Step Allowed Actions — Design Spec

**Goal:** Permettre à un administrateur de configurer, pour chaque étape d'une politique de crédit, les actions autorisées (approuver, rejeter, demander des infos, transférer). Ces actions sont vérifiées par le backend avant exécution et masquées dans le frontend si non autorisées.

**Architecture:** Nouveau champ `allowedActions String[]` sur `CreditPolicyStep`. Vérification ajoutée en fin de `canApproveStep()`. Frontend lit les `allowedActions` pour masquer les boutons non autorisés.

**Tech Stack:** Prisma (PostgreSQL), Express/TypeScript backend, React/TypeScript frontend (MUI).

---

## Contexte

### Situation actuelle

- `StepConfigPanel.tsx` expose déjà des checkboxes "Actions autorisées" (Approuver, Refuser, Demander infos, Transférer)
- Ces actions sont stockées dans le champ `description` en JSON — sans effet fonctionnel
- `canApproveStep()` dans `workflowService.ts` vérifie rôle, montant, agence, délégation — mais jamais les actions autorisées de l'étape
- Les boutons dans `WorkflowDetailsDialog.tsx` sont affichés sans tenir compte de la config de l'étape

### Objectif

Brancher la config "Actions autorisées" du workflow builder sur la vérification réelle d'accès, côté backend et frontend.

---

## Modèle de données

### Changement Prisma — `CreditPolicyStep`

```prisma
model CreditPolicyStep {
  // ... champs existants ...
  allowedActions  String[]  @default([]) @map("allowed_actions")
}
```

### Migration SQL

```sql
ALTER TABLE "credit_policy_steps"
  ADD COLUMN "allowed_actions" TEXT[] NOT NULL DEFAULT '{}';
```

### Valeurs valides pour `allowedActions`

| Valeur | Signification |
|--------|---------------|
| `approve` | Approuver le dossier / l'étape |
| `reject` | Rejeter / Refuser |
| `request_info` | Demander des informations complémentaires |
| `transfer` | Transférer à un autre acteur |

**Règle de rétrocompatibilité :** `allowedActions = []` signifie aucune restriction — toutes les actions sont autorisées. Les étapes existantes gardent ce comportement par défaut.

### Interface TypeScript `PolicyStep`

```ts
// src/types/creditPolicyBuilder.ts
interface PolicyStep {
  // ... champs existants ...
  allowedActions: string[]   // nouveau champ
}
```

---

## Backend

### 1. `backend/src/routes/credit-policy.ts`

Trois points d'écriture à mettre à jour pour accepter et persister `allowedActions` :

**`savePolicyWithSteps` (PUT `/:id`)** — dans le mapping des steps :
```ts
allowedActions: step.allowedActions ?? []
```

**`POST /:id/steps`** — dans le body de création :
```ts
allowedActions: allowedActions ?? []
```

**`PUT /:id/steps/:stepId`** — dans la mise à jour :
```ts
...(allowedActions !== undefined && { allowedActions })
```

### 2. `backend/src/services/workflowService.ts`

**Architecture réelle des routes :** Il existe une seule route `POST /:applicationId/approve` qui reçoit `decision: 'APPROVED' | 'REJECTED'`. Les actions `request_info` et `transfer` n'ont pas encore de routes dédiées.

**Mapping `decision` → `action` :**

| Valeur `decision` (route existante) | Valeur `action` (allowedActions) |
|--------------------------------------|----------------------------------|
| `APPROVED` | `approve` |
| `REJECTED` | `reject` |
| `REQUEST_INFO` *(nouvelle valeur)* | `request_info` |
| `TRANSFER` *(nouvelle valeur)* | `transfer` |

**Signature étendue de `canApproveStep` :**

```ts
type StepAction = 'approve' | 'reject' | 'request_info' | 'transfer'

async function canApproveStep(
  userId: string,
  applicationId: string,
  stepName: string,
  action: StepAction = 'approve'   // défaut 'approve' pour rétrocompatibilité
): Promise<{ allowed: boolean; reason?: string }>
```

**Vérification ajoutée en dernière position** (après rôle, montant, agence) :

```ts
// Vérification des actions autorisées sur l'étape de politique
if (currentStep.policyStepId) {
  const policyStep = await prisma.creditPolicyStep.findUnique({
    where: { id: currentStep.policyStepId },
    select: { allowedActions: true }
  })
  if (policyStep && policyStep.allowedActions.length > 0) {
    if (!policyStep.allowedActions.includes(action)) {
      return {
        allowed: false,
        reason: `L'action "${action}" n'est pas configurée pour cette étape`
      }
    }
  }
}
```

### 3. `backend/src/routes/workflows.ts`

La route existante `POST /:applicationId/approve` étend les valeurs de `decision` acceptées et mappe vers l'action correspondante avant d'appeler `canApproveStep` :

```ts
// Valeurs decision acceptées (extension des valeurs existantes)
type Decision = 'APPROVED' | 'REJECTED' | 'REQUEST_INFO' | 'TRANSFER'

// Mapping decision → action pour canApproveStep
const DECISION_TO_ACTION: Record<Decision, StepAction> = {
  APPROVED:     'approve',
  REJECTED:     'reject',
  REQUEST_INFO: 'request_info',
  TRANSFER:     'transfer',
}

// Appel modifié
const action = DECISION_TO_ACTION[decision as Decision] ?? 'approve'
const authCheck = await canApproveStep(userId, applicationId, currentStep.stepName, action)
```

Les comportements APPROVED et REJECTED existants sont conservés à l'identique. REQUEST_INFO et TRANSFER sont de nouvelles décisions dont la logique métier (changement de statut du step) est à implémenter dans la même route.

---

## Frontend

### 1. `src/components/workflow-builder/StepConfigPanel.tsx`

**État actuel du fichier :**
- Les actions sont lues depuis `step.description` via `getActions(desc)` (JSON.parse)
- La clé pour "Demander des infos" est `'request'` (pas `'request_info'`)
- Les actions sont écrites dans `description` via `onChange({ description: setActions(next) })`

**Changements à apporter :**

1. Renommer la clé `'request'` → `'request_info'` dans le tableau `ACTIONS` :
```ts
// Avant
const ACTIONS = [
  { key: 'approve',  label: 'Approuver' },
  { key: 'reject',   label: 'Refuser' },
  { key: 'request',  label: 'Demander des informations' },   // ← à renommer
  { key: 'transfer', label: 'Transférer' },
]

// Après
const ACTIONS = [
  { key: 'approve',      label: 'Approuver' },
  { key: 'reject',       label: 'Refuser' },
  { key: 'request_info', label: 'Demander des informations' },
  { key: 'transfer',     label: 'Transférer' },
]
```

2. Supprimer `getActions` / `setActions` et lire/écrire dans `allowedActions` :
```ts
// Avant
const actions = getActions(step.description)
const toggleAction = (key: string) => {
  const next = actions.includes(key) ? actions.filter(a => a !== key) : [...actions, key]
  onChange({ description: setActions(next) })
}

// Après
const actions = step.allowedActions ?? []
const toggleAction = (key: string) => {
  const next = actions.includes(key) ? actions.filter(a => a !== key) : [...actions, key]
  onChange({ allowedActions: next })
}
```

3. Les checkboxes cochées par défaut quand `allowedActions = []` (comportement initial inchangé) :
```ts
checked={actions.length === 0 ? true : actions.includes(key)}
```

### 2. `src/components/WorkflowDetailsDialog.tsx`

Le dialog lit les `allowedActions` de l'étape courante (via `currentStep.allowedActions` retourné par l'API) et masque les boutons non autorisés.

**Helper :**
```ts
const isActionAllowed = (action: string): boolean => {
  if (!currentStep?.allowedActions || currentStep.allowedActions.length === 0) return true
  return currentStep.allowedActions.includes(action)
}
```

**Application sur les boutons :** Les boutons Approuver / Rejeter sont déjà présents dans `WorkflowDetailsDialog.tsx` (ligne ~2464 et ~2478) — ils appellent `handleApproval('REJECTED')` et `handleApproval('APPROVED')`. Leur affichage se base actuellement sur la logique `canApprove()` locale. On ajoute le check `isActionAllowed` **en plus** de ce check existant (le plus restrictif des deux s'applique) :

```tsx
{canApprove() && isActionAllowed('approve') && (
  <Button onClick={() => setOtpDialog({ open: true, pendingDecision: 'APPROVED' })}>
    Approuver
  </Button>
)}
{canApprove() && isActionAllowed('reject') && (
  <Button onClick={() => setOtpDialog({ open: true, pendingDecision: 'REJECTED' })}>
    Rejeter
  </Button>
)}
```

### 3. `src/services/api.ts`

S'assurer que les réponses des routes workflow retournent `allowedActions` sur les étapes. Vérifier que `getWorkflowSteps` (ou équivalent) inclut ce champ dans la sélection Prisma.

---

## Flux de bout en bout

```
1. Admin ouvre WorkflowPolicyBuilder
   → Sélectionne une étape "Comité de crédit"
   → Coche uniquement "Approuver" et "Rejeter"
   → Sauvegarde → allowedActions: ['approve', 'reject'] persisté en DB

2. Agent ouvre WorkflowDetailsDialog sur un dossier
   → Étape courante = "Comité de crédit"
   → Frontend lit allowedActions: ['approve', 'reject']
   → Boutons "Approuver" ✓ et "Rejeter" ✓ visibles
   → Boutons "Demander infos" ✗ et "Transférer" ✗ masqués

3. Agent clique "Approuver"
   → POST /api/workflows/:id/approve  { decision: 'APPROVED' }
   → Mapping APPROVED → action 'approve'
   → canApproveStep(..., 'approve')
   → Vérifie rôle ✓, montant ✓, agence ✓
   → Vérifie allowedActions: ['approve', 'reject'].includes('approve') ✓
   → Action autorisée → workflow avance

4. Appel avec décision non configurée (bypass frontend ou mauvaise config)
   → POST /api/workflows/:id/approve  { decision: 'REQUEST_INFO' }
   → Mapping REQUEST_INFO → action 'request_info'
   → canApproveStep(..., 'request_info')
   → allowedActions: ['approve', 'reject'].includes('request_info') ✗
   → 403 { error: "L'action request_info n'est pas configurée pour cette étape" }
```

---

## Rétrocompatibilité

- Toutes les étapes existantes ont `allowedActions = []` → aucune restriction → comportement identique à aujourd'hui
- `canApproveStep` a `action = 'approve'` en paramètre par défaut → aucun appelant existant à modifier au-delà de la route `/approve`
- La route `/approve` valide uniquement `decision` in `['APPROVED','REJECTED','REQUEST_INFO','TRANSFER']` — les nouvelles valeurs ne changent pas la logique des deux premières
- Le champ `description` dans `CreditPolicyStep` n'est pas supprimé — les données JSON qu'il contenait sont abandonnées (le nouveau champ `allowedActions` est la source de vérité)
- La clé `'request'` (ancienne) devient `'request_info'` — les étapes existantes avec `description` contenant `'request'` ne sont pas migrées (elles auront `allowedActions = []` = aucune restriction)
- `npx prisma generate` doit être exécuté après la migration pour régénérer le client Prisma

---

## Hors scope

- Permissions système (`role_permissions.permissions` JSON) — non impactées
- Limites de montant (`ApprovalLimit`) — non modifiées
- Délégations — non modifiées
- Audit log des actions bloquées — non inclus dans cette version
