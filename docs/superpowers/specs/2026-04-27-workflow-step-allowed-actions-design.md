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

Les 4 routes d'action passent leur type à `canApproveStep` :

| Route | Action passée |
|-------|---------------|
| `POST /:applicationId/approve` | `'approve'` |
| `POST /:applicationId/reject` | `'reject'` |
| `POST /:applicationId/request-info` | `'request_info'` |
| `POST /:applicationId/transfer` | `'transfer'` |

Exemple :
```ts
// Avant
const authCheck = await canApproveStep(userId, applicationId, currentStep.stepName)

// Après
const authCheck = await canApproveStep(userId, applicationId, currentStep.stepName, 'approve')
```

---

## Frontend

### 1. `src/components/workflow-builder/StepConfigPanel.tsx`

Les checkboxes "Actions autorisées" existantes passent de lire/écrire dans `description` (JSON) à lire/écrire directement dans `step.allowedActions`.

**Mapping checkboxes → valeurs :**

| Checkbox | Valeur `allowedActions` |
|----------|------------------------|
| Approuver | `approve` |
| Refuser | `reject` |
| Demander des informations | `request_info` |
| Transférer | `transfer` |

**Lecture (initialisation) :**
```ts
const isChecked = (action: string) => step.allowedActions?.includes(action) ?? true
// Si allowedActions vide → toutes cochées par défaut (UX intuitive)
```

**Écriture (on change) :**
```ts
const toggleAction = (action: string, checked: boolean) => {
  const current = step.allowedActions ?? []
  const next = checked
    ? [...current, action]
    : current.filter(a => a !== action)
  onChange({ ...step, allowedActions: next })
}
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

**Application sur les boutons :**
```tsx
{isActionAllowed('approve') && <Button onClick={handleApprove}>Approuver</Button>}
{isActionAllowed('reject') && <Button onClick={handleReject}>Rejeter</Button>}
{isActionAllowed('request_info') && <Button onClick={handleRequestInfo}>Demander infos</Button>}
{isActionAllowed('transfer') && <Button onClick={handleTransfer}>Transférer</Button>}
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
   → POST /api/workflows/:id/approve
   → canApproveStep(..., 'approve')
   → Vérifie rôle ✓, montant ✓, agence ✓
   → Vérifie allowedActions: ['approve', 'reject'].includes('approve') ✓
   → Action autorisée → workflow avance

4. Appel direct à l'API (bypass frontend)
   → POST /api/workflows/:id/request-info
   → canApproveStep(..., 'request_info')
   → allowedActions: ['approve', 'reject'].includes('request_info') ✗
   → 403 { error: "L'action request_info n'est pas configurée pour cette étape" }
```

---

## Rétrocompatibilité

- Toutes les étapes existantes ont `allowedActions = []` → aucune restriction → comportement identique à aujourd'hui
- `canApproveStep` a `action = 'approve'` en paramètre par défaut → aucun appelant existant à modifier au-delà des 4 routes workflows
- Le champ `description` conserve son contenu actuel (non supprimé), la migration n'est qu'un ajout

---

## Hors scope

- Permissions système (`role_permissions.permissions` JSON) — non impactées
- Limites de montant (`ApprovalLimit`) — non modifiées
- Délégations — non modifiées
- Audit log des actions bloquées — non inclus dans cette version
