# Workflow Step Allowed Actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre les actions autorisées (approuver, rejeter, demander infos, transférer) configurables par étape dans le workflow builder et les faire vérifier réellement par le backend avant exécution.

**Architecture:** Nouveau champ `allowedActions String[]` sur `CreditPolicyStep`. Le backend vérifie ce champ dans `canApproveStep()`. Le frontend `WorkflowDetailsDialog` masque les boutons non autorisés. Le `StepConfigPanel` écrit directement dans `allowedActions` au lieu de `description`.

**Tech Stack:** Prisma + PostgreSQL (migration manuelle), Express/TypeScript backend, React/TypeScript + MUI frontend.

---

## Fichiers modifiés

| Fichier | Rôle |
|---------|------|
| `backend/prisma/schema.prisma` | Ajouter `allowedActions String[]` sur `CreditPolicyStep` |
| `backend/prisma/migrations/20260427000000_add_allowed_actions/migration.sql` | Migration SQL |
| `backend/src/routes/credit-policy.ts` | Persister `allowedActions` dans 3 endroits (POST policy, PUT policy, POST step) |
| `backend/src/services/workflowService.ts` | Étendre `canApproveStep` avec paramètre `action` + vérification |
| `backend/src/routes/workflows.ts` | Mapper `decision` → `action`, inclure `allowedActions` dans GET |
| `src/types/creditPolicyBuilder.ts` | Ajouter `allowedActions: string[]` à `PolicyStep` |
| `src/types/index.ts` | Ajouter `allowedActions?: string[]` à `WorkflowStep` |
| `src/components/workflow-builder/StepConfigPanel.tsx` | Câbler checkboxes sur `allowedActions` |
| `src/components/WorkflowDetailsDialog.tsx` | Helper `isActionAllowed` + masquage boutons |

---

## Task 1 : Migration Prisma — champ `allowedActions`

**Files:**
- Modify: `backend/prisma/schema.prisma:419` (après `description String?`)
- Create: `backend/prisma/migrations/20260427000000_add_allowed_actions/migration.sql`

- [ ] **Step 1 : Ajouter le champ dans schema.prisma**

Dans `backend/prisma/schema.prisma`, après la ligne `description   String?` (ligne 419), ajouter :

```prisma
  allowedActions  String[]  @default([]) @map("allowed_actions")
```

Le modèle `CreditPolicyStep` doit ressembler à :
```prisma
  description   String?
  allowedActions  String[]  @default([]) @map("allowed_actions")
  creditTypeIds String[]  @default([]) @map("credit_type_ids")
```

- [ ] **Step 2 : Créer le dossier et fichier de migration**

```bash
mkdir -p backend/prisma/migrations/20260427000000_add_allowed_actions
```

Créer `backend/prisma/migrations/20260427000000_add_allowed_actions/migration.sql` :

```sql
-- AlterTable
ALTER TABLE "credit_policy_steps" ADD COLUMN "allowed_actions" TEXT[] NOT NULL DEFAULT '{}';
```

- [ ] **Step 3 : Appliquer la migration et régénérer le client**

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

Résultat attendu : `Applied 1 migration` puis `Generated Prisma Client`.

- [ ] **Step 4 : Vérifier en TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260427000000_add_allowed_actions/
git commit -m "feat(db): ajouter allowedActions sur CreditPolicyStep"
```

---

## Task 2 : Types TypeScript

**Files:**
- Modify: `src/types/creditPolicyBuilder.ts:18-36`
- Modify: `src/types/index.ts:203-215`

- [ ] **Step 1 : Ajouter `allowedActions` à `PolicyStep`**

Dans `src/types/creditPolicyBuilder.ts`, l'interface `PolicyStep` (ligne 18) :

```ts
// Avant (ligne 34-35)
  guards: GuardsJson | null;
  _error?: string; // validation error, frontend only

// Après
  guards: GuardsJson | null;
  allowedActions: string[];  // actions autorisées sur cette étape
  _error?: string; // validation error, frontend only
```

- [ ] **Step 2 : Ajouter `allowedActions` à `WorkflowStep`**

Dans `src/types/index.ts`, l'interface `WorkflowStep` (ligne 203) :

```ts
// Avant (ligne 213-215)
  decision?: 'approved' | 'rejected' | 'on_hold' | 'pending';
  comments?: string;
}

// Après
  decision?: 'approved' | 'rejected' | 'on_hold' | 'pending';
  comments?: string;
  allowedActions?: string[];  // actions configurées sur l'étape de politique
}
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : aucune erreur (quelques warnings sur `allowedActions` non initialisé sont normaux à ce stade).

- [ ] **Step 4 : Commit**

```bash
git add src/types/creditPolicyBuilder.ts src/types/index.ts
git commit -m "feat(types): ajouter allowedActions à PolicyStep et WorkflowStep"
```

---

## Task 3 : Backend — persister `allowedActions` dans credit-policy.ts

**Files:**
- Modify: `backend/src/routes/credit-policy.ts:78-93` (POST policy avec steps)
- Modify: `backend/src/routes/credit-policy.ts:286-305` (PUT policy avec steps)
- Modify: `backend/src/routes/credit-policy.ts:364-415` (POST step individuel)

- [ ] **Step 1 : POST policy — mapping de création avec steps (ligne 78-93)**

Ajouter `allowedActions` dans le `create` du mapping des steps :

```ts
// Avant (ligne 91-93)
                isRequired: s.isRequired ?? true,
                description: s.description ?? null,
                creditTypeIds: s.creditTypeIds ?? [],

// Après
                isRequired: s.isRequired ?? true,
                description: s.description ?? null,
                creditTypeIds: s.creditTypeIds ?? [],
                allowedActions: s.allowedActions ?? [],
```

- [ ] **Step 2 : PUT policy — remplacement complet des étapes (ligne 286-305)**

Ajouter `allowedActions` dans le `createMany` data mapping :

```ts
// Avant (ligne 301-304)
            isRequired: s.isRequired ?? true,
            isActive: s.isActive ?? true,
            description: s.description ?? null,
            creditTypeIds: s.creditTypeIds ?? [],

// Après
            isRequired: s.isRequired ?? true,
            isActive: s.isActive ?? true,
            description: s.description ?? null,
            creditTypeIds: s.creditTypeIds ?? [],
            allowedActions: s.allowedActions ?? [],
```

- [ ] **Step 3 : POST step individuel — destructuration + create (ligne 364-415)**

Ajouter `allowedActions` dans la destructuration du body et dans le `prisma.creditPolicyStep.create` :

```ts
// Avant (ligne 364-369) — destructuration
    const {
      stepName, stepLabel, order, stepType, assignedRole,
      conditionMinAmount, conditionMaxAmount,
      approvalMinAmount, approvalMaxAmount,
      expectedDurationHours, maxDurationHours,
      isRequired, description, creditTypeIds,
    } = req.body;

// Après
    const {
      stepName, stepLabel, order, stepType, assignedRole,
      conditionMinAmount, conditionMaxAmount,
      approvalMinAmount, approvalMaxAmount,
      expectedDurationHours, maxDurationHours,
      isRequired, description, creditTypeIds, allowedActions,
    } = req.body;
```

```ts
// Avant (ligne 413-414) — dans prisma.creditPolicyStep.create data
        description: description ?? null,
        creditTypeIds: creditTypeIds ?? [],

// Après
        description: description ?? null,
        creditTypeIds: creditTypeIds ?? [],
        allowedActions: allowedActions ?? [],
```

- [ ] **Step 4 : Vérifier TypeScript backend**

```bash
cd backend && npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/routes/credit-policy.ts
git commit -m "feat(api): persister allowedActions dans les routes credit-policy"
```

---

## Task 4 : Backend — étendre `canApproveStep` dans workflowService.ts

**Files:**
- Modify: `backend/src/services/workflowService.ts:535-654`

- [ ] **Step 1 : Ajouter le type `StepAction` et étendre la signature**

En haut de `workflowService.ts` (chercher les autres types/constantes en début de fichier ou juste avant la fonction), ajouter :

```ts
export type StepAction = 'approve' | 'reject' | 'request_info' | 'transfer';
```

Modifier la signature de `canApproveStep` (ligne 535-543) :

```ts
// Avant
export async function canApproveStep(
  userId: string,
  applicationId: string,
  stepName: string
): Promise<{

// Après
export async function canApproveStep(
  userId: string,
  applicationId: string,
  stepName: string,
  action: StepAction = 'approve'
): Promise<{
```

- [ ] **Step 2 : Ajouter la vérification `allowedActions` en fin de fonction**

Juste avant le `return { allowed: true, delegationContext }` final (ligne 653), ajouter :

```ts
  // ── 4. Vérification des actions autorisées sur l'étape de politique ──────────
  if (step.policyStepId) {
    const policyStepForActions = await prisma.creditPolicyStep.findUnique({
      where: { id: step.policyStepId },
      select: { allowedActions: true },
    });
    if (policyStepForActions && policyStepForActions.allowedActions.length > 0) {
      if (!policyStepForActions.allowedActions.includes(action)) {
        return {
          allowed: false,
          reason: `L'action "${action}" n'est pas autorisée sur cette étape`,
        };
      }
    }
  }

  return { allowed: true, delegationContext };
```

Note : la variable `policyStep` existe déjà dans la fonction (lignes 626-631) — utiliser un nom différent (`policyStepForActions`) pour éviter la collision.

- [ ] **Step 3 : Vérifier TypeScript**

```bash
cd backend && npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add backend/src/services/workflowService.ts
git commit -m "feat(workflow): canApproveStep vérifie allowedActions de l'étape de politique"
```

---

## Task 5 : Backend — mettre à jour la route `/approve` dans workflows.ts

**Files:**
- Modify: `backend/src/routes/workflows.ts:249-317`
- Modify: `backend/src/routes/workflows.ts:118-134` (GET response steps)

- [ ] **Step 1 : Importer `StepAction` depuis workflowService**

En haut de `backend/src/routes/workflows.ts`, l'import de `canApproveStep` (chercher la ligne existante) :

```ts
// Avant
import { canApproveStep, ... } from '../services/workflowService';

// Après — ajouter StepAction
import { canApproveStep, StepAction, ... } from '../services/workflowService';
```

- [ ] **Step 2 : Étendre la validation `decision` et mapper vers `action` (ligne 261-311)**

```ts
// Avant (ligne 261-266)
    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      return res.status(400).json({
        success: false,
        error: 'decision must be APPROVED or REJECTED'
      });
    }

// Après
    const VALID_DECISIONS = ['APPROVED', 'REJECTED', 'REQUEST_INFO', 'TRANSFER'];
    if (!VALID_DECISIONS.includes(decision)) {
      return res.status(400).json({
        success: false,
        error: `decision must be one of: ${VALID_DECISIONS.join(', ')}`
      });
    }

    const DECISION_TO_ACTION: Record<string, StepAction> = {
      APPROVED:     'approve',
      REJECTED:     'reject',
      REQUEST_INFO: 'request_info',
      TRANSFER:     'transfer',
    };
    const stepAction = DECISION_TO_ACTION[decision] ?? 'approve';
```

- [ ] **Step 3 : Passer `stepAction` à `canApproveStep` (ligne 311)**

```ts
// Avant
    const authCheck = await canApproveStep(userId, applicationId, currentStep.stepName);

// Après
    const authCheck = await canApproveStep(userId, applicationId, currentStep.stepName, stepAction);
```

- [ ] **Step 4 : Inclure `allowedActions` dans la réponse GET (mapping steps, ligne 118-134)**

Le mapping actuel ne joint pas `policyStepId`. Modifier pour inclure `allowedActions` :

D'abord dans la requête `include` des `workflowSteps` (ligne 62-68), ajouter l'include de la policy step :

```ts
// Avant
        workflowSteps: {
          orderBy: { createdAt: 'asc' },
          include: { assignee: true }
        },

// Après
        workflowSteps: {
          orderBy: { createdAt: 'asc' },
          include: {
            assignee: true,
            policyStep: { select: { allowedActions: true } },
          }
        },
```

Puis dans le mapping `steps` (ligne 118-134), ajouter `allowedActions` :

```ts
// Avant (ligne 133)
        comments: step.comments || undefined

// Après
        comments: step.comments || undefined,
        allowedActions: (step as any).policyStep?.allowedActions ?? [],
```

- [ ] **Step 5 : Vérifier TypeScript**

```bash
cd backend && npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 6 : Commit**

```bash
git add backend/src/routes/workflows.ts
git commit -m "feat(workflow): route /approve mappe decision→action, GET retourne allowedActions"
```

---

## Task 6 : Frontend — StepConfigPanel.tsx

**Files:**
- Modify: `src/components/workflow-builder/StepConfigPanel.tsx:23-47`

- [ ] **Step 1 : Renommer la clé `request` → `request_info` dans `ACTIONS`**

```ts
// Avant (ligne 23-28)
const ACTIONS = [
  { key: 'approve',   label: 'Approuver' },
  { key: 'reject',    label: 'Refuser' },
  { key: 'request',   label: 'Demander des informations' },
  { key: 'transfer',  label: 'Transférer' },
];

// Après
const ACTIONS = [
  { key: 'approve',      label: 'Approuver' },
  { key: 'reject',       label: 'Refuser' },
  { key: 'request_info', label: 'Demander des informations' },
  { key: 'transfer',     label: 'Transférer' },
];
```

- [ ] **Step 2 : Supprimer `getActions`/`setActions` et câbler sur `allowedActions`**

```ts
// Supprimer ces lignes (30-35)
function getActions(desc: string | null): string[] {
  try { return JSON.parse(desc ?? '[]'); } catch { return ['approve', 'reject', 'request']; }
}
function setActions(actions: string[]): string {
  return JSON.stringify(actions);
}
```

```ts
// Avant (ligne 42-47)
  const actions = getActions(step.description);

  const toggleAction = (key: string) => {
    const next = actions.includes(key) ? actions.filter((a) => a !== key) : [...actions, key];
    onChange({ description: setActions(next) });
  };

// Après
  const actions = step.allowedActions ?? [];

  const toggleAction = (key: string) => {
    const next = actions.includes(key) ? actions.filter((a) => a !== key) : [...actions, key];
    onChange({ allowedActions: next });
  };
```

- [ ] **Step 3 : Mettre à jour la prop `checked` dans les checkboxes (ligne 173)**

```tsx
// Avant
                    checked={actions.includes(key)}

// Après — toutes cochées si allowedActions vide (= pas de restriction)
                    checked={actions.length === 0 ? true : actions.includes(key)}
```

- [ ] **Step 4 : Vérifier TypeScript frontend**

```bash
npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add src/components/workflow-builder/StepConfigPanel.tsx
git commit -m "feat(workflow-builder): câbler checkboxes actions sur allowedActions (was description JSON)"
```

---

## Task 7 : Frontend — WorkflowDetailsDialog.tsx

**Files:**
- Modify: `src/components/WorkflowDetailsDialog.tsx:240-298` (après `canApprove`)
- Modify: `src/components/WorkflowDetailsDialog.tsx:2459-2487` (boutons Rejeter/Approuver)

- [ ] **Step 1 : Ajouter le helper `isActionAllowed`**

Après la fonction `canApprove()` (ligne 298, après le `}`), ajouter :

```ts
  const isActionAllowed = (action: string): boolean => {
    const currentStep = workflow.steps?.find(step => !step.completedAt);
    if (!currentStep?.allowedActions || currentStep.allowedActions.length === 0) return true;
    return currentStep.allowedActions.includes(action);
  };
```

- [ ] **Step 2 : Gater le bouton "Rejeter" (ligne 2459-2472)**

```tsx
// Avant
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={submitting ? <CircularProgress size={13} /> : <RejectIcon sx={{ fontSize: 14 }} />}
              onClick={() => setOtpDialog({ open: true, pendingDecision: 'REJECTED' })}

// Après — wrapper conditionnel
            {isActionAllowed('reject') && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={submitting ? <CircularProgress size={13} /> : <RejectIcon sx={{ fontSize: 14 }} />}
              onClick={() => setOtpDialog({ open: true, pendingDecision: 'REJECTED' })}
              disabled={submitting}
              sx={{
                borderRadius: '10px', px: 2, fontSize: '13px', fontWeight: 600,
                textTransform: 'none', whiteSpace: 'nowrap',
              }}
            >
              Rejeter
            </Button>
            )}
```

- [ ] **Step 3 : Gater le bouton "Approuver" (ligne 2473-2487)**

```tsx
// Avant
            <Button
              variant="contained"
              color="success"
              ...
              onClick={() => setOtpDialog({ open: true, pendingDecision: 'APPROVED' })}

// Après — wrapper conditionnel
            {isActionAllowed('approve') && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={submitting ? <CircularProgress size={13} /> : <ApproveIcon sx={{ fontSize: 14 }} />}
              onClick={() => setOtpDialog({ open: true, pendingDecision: 'APPROVED' })}
              disabled={submitting}
              sx={{
                borderRadius: '10px', px: 2, fontSize: '13px', fontWeight: 600,
                textTransform: 'none', whiteSpace: 'nowrap',
                boxShadow: 'none', '&:hover': { boxShadow: 'none' },
              }}
            >
              Approuver
            </Button>
            )}
```

- [ ] **Step 4 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add src/components/WorkflowDetailsDialog.tsx
git commit -m "feat(dialog): masquer boutons selon allowedActions de l'étape courante"
```

---

## Task 8 : Test de bout en bout + push

- [ ] **Step 1 : Build backend**

```bash
cd backend && npm run build
```

Résultat attendu : aucune erreur de compilation.

- [ ] **Step 2 : Vérifier TypeScript frontend**

```bash
cd .. && npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 3 : Test manuel**

1. Aller dans **Workflow Builder** → Politique de crédit → sélectionner une étape de type APPROVAL
2. Dans le panneau de configuration, décocher "Rejeter" → garder seulement "Approuver"
3. Cliquer "Enregistrer"
4. Ouvrir un dossier en cours à cette étape dans **Suivi des workflows**
5. Vérifier que le bouton "Rejeter" est masqué, "Approuver" est visible
6. Tenter via Postman : `POST /api/workflows/:id/approve { decision: 'REJECTED' }` → doit retourner 403

- [ ] **Step 4 : Instructions de déploiement serveur**

```bash
sudo git pull
cd backend
sudo npx prisma migrate deploy    # applique la migration allowedActions
sudo npx prisma generate          # régénère le client Prisma
sudo npm run build
sudo systemctl restart optimuscredit-backend.service
```

- [ ] **Step 5 : Push final**

```bash
git push
```
