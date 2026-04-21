# Workflow Credit Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un éditeur visuel drag & drop pour configurer la politique de crédit de chaque banque, avec règles de transition conditionnelles (guards), cycle de vie DRAFT/ACTIVE/ARCHIVED, et isolation multi-tenant stricte.

**Architecture:** Config-first — une liste d'étapes ordonnées est la source de vérité, React Flow sert uniquement d'aperçu visuel synchronisé. Le builder coexiste avec l'interface tableau existante via un nouvel onglet dans `CreditPolicyPage.tsx`.

**Tech Stack:** React + TypeScript + MUI + @xyflow/react — Backend: Node/Express + Prisma/PostgreSQL

---

## Carte des fichiers

### Fichiers créés

| Fichier | Rôle |
|---|---|
| `backend/src/services/guardEngine.ts` | Fonction pure d'évaluation des guards |
| `src/types/creditPolicyBuilder.ts` | Types TypeScript partagés guards/étapes |
| `src/components/workflow-builder/GuardRulesEditor.tsx` | UI rules engine (AND/OR + conditions) |
| `src/components/workflow-builder/StepConfigPanel.tsx` | Panneau de config inline d'une étape |
| `src/components/workflow-builder/StepPalette.tsx` | Palette gauche — types d'étapes + rôles |
| `src/components/workflow-builder/StepList.tsx` | Liste drag & drop des étapes |
| `src/components/workflow-builder/WorkflowPreview.tsx` | Canvas React Flow lecture seule |
| `src/components/workflow-builder/WorkflowPolicyBuilder.tsx` | Conteneur principal 3 colonnes |

### Fichiers modifiés

| Fichier | Ce qui change |
|---|---|
| `backend/prisma/schema.prisma` | + champ `guards` sur `CreditPolicyStep` + enum `PolicyStatus` + champ `status` sur `CreditPolicy` |
| `backend/src/routes/credit-policy.ts` | + `guards` dans GET/PUT, optimistic locking, endpoints validate/activate/archive |
| `backend/prisma/seed-roles.js` | + `MANAGE_CREDIT_POLICY` dans permissions ADMIN |
| `src/services/api.ts` | + méthodes `validatePolicy`, `activatePolicy`, `archivePolicy` dans `creditPolicyApi` |
| `src/pages/CreditPolicyPage.tsx` | + onglet "Éditeur visuel" → `WorkflowPolicyBuilder` |

---

## Tâche 1 : Migrations Prisma

**Fichiers :**
- Modifier : `backend/prisma/schema.prisma`

- [ ] **Step 1 : Ajouter `PolicyStatus` enum et champ `status` dans schema.prisma**

Dans `backend/prisma/schema.prisma`, ajouter l'enum avant les autres enums existants et modifier `CreditPolicy` :

```prisma
// Ajouter cet enum (avant l'enum ApplicationStatus par exemple)
enum PolicyStatus {
  DRAFT    @map("draft")
  ACTIVE   @map("active")
  ARCHIVED @map("archived")

  @@map("policy_status")
}

// Dans model CreditPolicy, ajouter après le champ `version` :
  status      PolicyStatus       @default(DRAFT)
```

- [ ] **Step 2 : Ajouter `guards` dans `CreditPolicyStep`**

Dans le model `CreditPolicyStep`, ajouter après le champ `phase` :

```prisma
  guards      Json?              @map("guards")
```

- [ ] **Step 3 : Exécuter les migrations**

```bash
cd backend
npx prisma migrate dev --name add_policy_status_and_guards
npx prisma generate
```

Expected output : `✔  Generated Prisma Client` sans erreur.

- [ ] **Step 4 : Vérifier le schéma généré**

```bash
npx prisma db pull --print 2>/dev/null | grep -E "guards|policy_status"
```

Expected : voir les colonnes `guards` et `status` apparaître.

- [ ] **Step 5 : Commit**

```bash
cd ..
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(db): add PolicyStatus enum + guards field to credit policy"
```

---

## Tâche 2 : Guard Engine (backend)

**Fichiers :**
- Créer : `backend/src/services/guardEngine.ts`

- [ ] **Step 1 : Créer le fichier guardEngine.ts**

```typescript
// backend/src/services/guardEngine.ts

export type GuardOperator = 'AND' | 'OR';
export type ConditionOperator = 'BETWEEN' | 'LT' | 'GT' | 'GTE' | 'LTE' | 'IN' | 'NOT_IN';
export type ConditionField = 'amount' | 'riskScore' | 'creditTypeId';

export interface GuardCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: number | { min: number; max: number } | string[];
}

export interface GuardsJson {
  operator: GuardOperator;
  conditions: GuardCondition[];
}

export interface GuardContext {
  amount: number;
  riskScore: number;     // extrait de CreditApplication.score?.numeric — défaut 0
  creditTypeId: string;
}

function evaluateCondition(condition: GuardCondition, ctx: GuardContext): boolean {
  const raw = ctx[condition.field];
  const val = typeof raw === 'number' ? raw : 0;
  const strVal = String(raw ?? '');

  switch (condition.operator) {
    case 'GTE':
      return val >= (condition.value as number);
    case 'LTE':
      return val <= (condition.value as number);
    case 'GT':
      return val > (condition.value as number);
    case 'LT':
      return val < (condition.value as number);
    case 'BETWEEN': {
      const { min, max } = condition.value as { min: number; max: number };
      return val >= min && val <= max;
    }
    case 'IN':
      return (condition.value as string[]).includes(strVal);
    case 'NOT_IN':
      return !(condition.value as string[]).includes(strVal);
    default:
      return false;
  }
}

export function evaluateGuards(guards: GuardsJson | null, ctx: GuardContext): boolean {
  if (!guards || !guards.conditions || guards.conditions.length === 0) return true;

  const results = guards.conditions.map((c) => evaluateCondition(c, ctx));
  return guards.operator === 'AND'
    ? results.every(Boolean)
    : results.some(Boolean);
}
```

- [ ] **Step 2 : Tester manuellement avec ts-node**

Le fichier est TypeScript — utiliser ts-node (déjà présent dans le projet backend) :

```bash
cd backend
npx ts-node -e "
import { evaluateGuards } from './src/services/guardEngine';
const guards = { operator: 'AND' as const, conditions: [{ field: 'amount' as const, operator: 'BETWEEN' as const, value: { min: 0, max: 50000000 } }, { field: 'riskScore' as const, operator: 'GTE' as const, value: 60 }] };
console.log(evaluateGuards(guards, { amount: 25000000, riskScore: 75, creditTypeId: 'x' })); // true
console.log(evaluateGuards(guards, { amount: 25000000, riskScore: 50, creditTypeId: 'x' })); // false
console.log(evaluateGuards(null, { amount: 0, riskScore: 0, creditTypeId: '' })); // true
"
```

Si ts-node n'est pas disponible : `npx tsx -e "..."` (même syntaxe).

Expected output :
```
true
false
true
```

- [ ] **Step 3 : Commit**

```bash
git add backend/src/services/guardEngine.ts
git commit -m "feat(backend): add pure guard engine service"
```

---

## Tâche 3 : Extension des routes backend existantes

**Fichiers :**
- Modifier : `backend/src/routes/credit-policy.ts`

- [ ] **Step 1 : Ajouter `guards` dans la réponse GET /api/credit-policies/:id**

Dans le handler `GET /:id`, s'assurer que les steps incluent `guards`. Le handler existant retourne déjà les steps via `include`. Vérifier et ajouter si manquant :

```typescript
// Dans le select/include des steps, s'assurer que guards est retourné
// Prisma retourne tous les champs par défaut — vérifier juste que guards
// n'est pas exclu par un `select` partiel existant.
// Si select partiel, ajouter : guards: true
```

Localiser le handler GET /:id (chercher `router.get('/:id'`) et vérifier qu'aucun `select` n'exclut `guards`.

- [ ] **Step 2 : Ajouter optimistic locking + guards dans PUT /:id**

Localiser `router.put('/:id'` et modifier le handler pour :
1. Extraire `expectedVersion` du body
2. Vérifier que `version` en base === `expectedVersion` avant update
3. Ajouter `guards` dans les données de mise à jour des steps

```typescript
// Dans router.put('/:id', ...)
const { name, code, description, validFrom, validTo, steps, expectedVersion } = req.body;

// Optimistic locking
if (expectedVersion !== undefined) {
  const current = await prisma.creditPolicy.findUnique({
    where: { id: req.params.id },
    select: { version: true, companyId: true },
  });
  if (!current) return res.status(404).json({ success: false, error: 'Politique non trouvée' });
  if (current.companyId !== req.companyId) return res.status(403).json({ success: false, error: 'Accès interdit' });
  if (current.version !== expectedVersion) {
    return res.status(409).json({
      success: false,
      error: 'CONFLICT',
      message: 'La politique a été modifiée par quelqu\'un d\'autre. Veuillez recharger avant de sauvegarder.',
    });
  }
}
```

Dans la mise à jour des steps, ajouter `guards: s.guards ?? null` aux données créées/mises à jour.

- [ ] **Step 3 : Ajouter `status` dans le GET /api/credit-policies (liste)**

Dans le handler `GET /`, le champ `status` est retourné automatiquement par Prisma. Vérifier que le filtre `companyId` est bien présent (il l'est déjà).

- [ ] **Step 4 : Commit**

```bash
git add backend/src/routes/credit-policy.ts
git commit -m "feat(backend): add guards persistence + optimistic locking to credit policy routes"
```

---

## Tâche 4 : Nouveaux endpoints validate / activate / archive

**Fichiers :**
- Modifier : `backend/src/routes/credit-policy.ts`

- [ ] **Step 1 : Ajouter endpoint POST /:id/validate**

Ajouter après les routes existantes, avant `export default router` :

```typescript
// ─── POST /api/credit-policies/:id/validate ──────────────────────────────────

router.post('/:id/validate', async (req: Request, res: Response) => {
  try {
    const policy = await prisma.creditPolicy.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    if (!policy) return res.status(404).json({ success: false, error: 'Politique non trouvée' });
    if (policy.companyId !== req.companyId) return res.status(403).json({ success: false, error: 'Accès interdit' });

    const errors: { stepId: string | null; message: string }[] = [];

    const hasDispatch = policy.steps.some((s) => s.stepType === 'DISPATCH');
    const hasApproval = policy.steps.some((s) => s.stepType === 'APPROVAL' || s.stepType === 'COMMITTEE');

    if (!hasDispatch) errors.push({ stepId: null, message: 'Au moins une étape DISPATCH est requise' });
    if (!hasApproval) errors.push({ stepId: null, message: 'Au moins une étape APPROVAL ou COMMITTEE est requise' });

    for (const step of policy.steps) {
      if (!step.assignedRole) {
        errors.push({ stepId: step.id, message: `L'étape "${step.stepLabel}" n'a pas de rôle assigné` });
      }
    }

    if (errors.length > 0) {
      return res.status(422).json({ success: false, valid: false, errors });
    }

    res.json({ success: true, valid: true });
  } catch (error) {
    console.error('[credit-policy] POST /:id/validate', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la validation' });
  }
});
```

- [ ] **Step 2 : Extraire la logique de validation dans une fonction helper**

Avant les routes, ajouter cette fonction helper qui centralise toutes les règles de validation (partagée entre `/validate` et `/activate`) :

```typescript
// Helper : retourne les erreurs de validation d'une politique
function getPolicyValidationErrors(steps: { stepType: string; assignedRole: string | null; stepLabel: string; id: string }[]) {
  const errors: { stepId: string | null; message: string }[] = [];
  const hasDispatch = steps.some((s) => s.stepType === 'DISPATCH');
  const hasApproval = steps.some((s) => s.stepType === 'APPROVAL' || s.stepType === 'COMMITTEE');
  if (!hasDispatch) errors.push({ stepId: null, message: 'Au moins une étape DISPATCH est requise' });
  if (!hasApproval) errors.push({ stepId: null, message: 'Au moins une étape APPROVAL ou COMMITTEE est requise' });
  for (const step of steps) {
    if (!step.assignedRole) errors.push({ stepId: step.id, message: `L'étape "${step.stepLabel}" n'a pas de rôle assigné` });
  }
  return errors;
}
```

Puis mettre à jour le handler `/validate` pour utiliser ce helper :

```typescript
// Dans POST /:id/validate, remplacer la logique inline par :
const errors = getPolicyValidationErrors(policy.steps);
if (errors.length > 0) return res.status(422).json({ success: false, valid: false, errors });
res.json({ success: true, valid: true });
```

- [ ] **Step 3 : Ajouter endpoint POST /:id/activate**

```typescript
// ─── POST /api/credit-policies/:id/activate ──────────────────────────────────

router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const policy = await prisma.creditPolicy.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    if (!policy) return res.status(404).json({ success: false, error: 'Politique non trouvée' });
    if (policy.companyId !== req.companyId) return res.status(403).json({ success: false, error: 'Accès interdit' });
    if (policy.status === 'ARCHIVED') {
      return res.status(422).json({ success: false, error: 'Une politique archivée ne peut pas être activée' });
    }

    // Valider (règles complètes) avant d'activer
    const validationErrors = getPolicyValidationErrors(policy.steps);
    if (validationErrors.length > 0) {
      return res.status(422).json({ success: false, error: 'VALIDATION_REQUIRED', message: 'La politique doit être validée avant activation', errors: validationErrors });
    }

    // Archiver l'ancienne politique active de la même banque
    const oldActive = await prisma.creditPolicy.findFirst({
      where: { companyId: req.companyId, status: 'ACTIVE', id: { not: req.params.id } },
    });

    await prisma.$transaction(async (tx) => {
      if (oldActive) {
        await tx.creditPolicy.update({
          where: { id: oldActive.id },
          data: { status: 'ARCHIVED', isActive: false },
        });
      }
      await tx.creditPolicy.update({
        where: { id: req.params.id },
        data: { status: 'ACTIVE', isActive: true },
      });
    });

    res.json({ success: true, activated: true, archivedPolicyId: oldActive?.id ?? null });
  } catch (error) {
    console.error('[credit-policy] POST /:id/activate', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'activation' });
  }
});
```

- [ ] **Step 3 : Ajouter endpoint POST /:id/archive**

```typescript
// ─── POST /api/credit-policies/:id/archive ───────────────────────────────────

router.post('/:id/archive', async (req: Request, res: Response) => {
  try {
    const policy = await prisma.creditPolicy.findUnique({
      where: { id: req.params.id },
      select: { id: true, companyId: true, status: true },
    });

    if (!policy) return res.status(404).json({ success: false, error: 'Politique non trouvée' });
    if (policy.companyId !== req.companyId) return res.status(403).json({ success: false, error: 'Accès interdit' });

    await prisma.creditPolicy.update({
      where: { id: req.params.id },
      data: { status: 'ARCHIVED', isActive: false },
    });

    res.json({ success: true, archived: true });
  } catch (error) {
    console.error('[credit-policy] POST /:id/archive', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'archivage' });
  }
});
```

- [ ] **Step 4 : Tester les endpoints avec curl (serveur doit tourner)**

```bash
# Vérifier la validation (remplacer POLICY_ID et TOKEN)
curl -s -X POST http://localhost:3001/api/credit-policies/POLICY_ID/validate \
  -H "Authorization: Bearer TOKEN" | jq .
```

Expected : `{ "success": true, "valid": true }` si politique valide.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/routes/credit-policy.ts
git commit -m "feat(backend): add validate/activate/archive endpoints for credit policy lifecycle"
```

---

## Tâche 5 : Seed permission MANAGE_CREDIT_POLICY

**Fichiers :**
- Modifier : `backend/prisma/seed-roles.js`

- [ ] **Step 1 : Ajouter la permission dans le tableau ADMIN**

Dans `backend/prisma/seed-roles.js`, trouver le role `ADMIN` (ligne ~96) et ajouter `'manage_credit_policy'` à son tableau `permissions` :

```javascript
// Dans le tableau permissions de ADMIN, ajouter :
'manage_credit_policy',
```

Note : utiliser `manage_credit_policy` (snake_case, cohérent avec les autres permissions du fichier).

- [ ] **Step 2 : Ajouter SUPER_ADMIN si absent du seed**

Vérifier si `SUPER_ADMIN` est dans le tableau `roles`. Si absent, l'ajouter :

```javascript
{
  role: 'SUPER_ADMIN',
  label: 'Super Administrateur',
  description: 'Accès plateforme complet, toutes les compagnies',
  permissions: [
    'manage_credit_policy',
    // ... mêmes permissions que ADMIN
  ]
},
```

Si déjà présent, ajouter juste `'manage_credit_policy'` à ses permissions.

- [ ] **Step 3 : Exécuter le seed**

```bash
cd backend
node prisma/seed-roles.js
```

Expected : `Administrateur Système (N permissions) → X utilisateur(s) mis à jour`

- [ ] **Step 4 : Commit**

```bash
git add backend/prisma/seed-roles.js
git commit -m "feat(seed): add manage_credit_policy permission to ADMIN and SUPER_ADMIN"
```

---

## Tâche 6 : Types TypeScript + installation @xyflow/react

**Fichiers :**
- Créer : `src/types/creditPolicyBuilder.ts`

- [ ] **Step 1 : Installer @xyflow/react**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npm install @xyflow/react
```

Expected : package ajouté dans `package.json`, pas d'erreur peer deps.

- [ ] **Step 2 : Créer le fichier de types**

```typescript
// src/types/creditPolicyBuilder.ts

export type PolicyStepType = 'DISPATCH' | 'ANALYSIS' | 'APPROVAL' | 'COMMITTEE';
export type PolicyStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type GuardOperator = 'AND' | 'OR';
export type ConditionOperator = 'BETWEEN' | 'LT' | 'GT' | 'GTE' | 'LTE' | 'IN' | 'NOT_IN';
export type ConditionField = 'amount' | 'riskScore' | 'creditTypeId';

export interface GuardCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: number | { min: number; max: number } | string[];
}

export interface GuardsJson {
  operator: GuardOperator;
  conditions: GuardCondition[];
}

export interface PolicyStep {
  id: string;
  policyId: string;
  stepName: string;
  stepLabel: string;
  order: number;
  stepType: PolicyStepType;
  assignedRole: string;
  conditionMinAmount: number | null;
  conditionMaxAmount: number | null;
  expectedDurationHours: number;
  maxDurationHours: number;
  isRequired: boolean;
  isActive: boolean;
  description: string | null;
  creditTypeIds: string[];
  guards: GuardsJson | null;
  // validation error (frontend only, not persisted)
  _error?: string;
}

export interface CreditPolicyFull {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  status: PolicyStatus;
  version: number;
  validFrom: string;
  validTo: string | null;
  companyId: string | null;
  steps: PolicyStep[];
  _count?: { steps: number; applications: number };
}

export interface CreditType {
  id: string;
  name: string;
  code: string;
}

export const STEP_TYPE_CONFIG: Record<PolicyStepType, { label: string; color: string; bgColor: string }> = {
  DISPATCH:  { label: 'Dispatch',     color: '#1565c0', bgColor: '#e3f2fd' },
  ANALYSIS:  { label: 'Analyse',      color: '#e65100', bgColor: '#fff3e0' },
  APPROVAL:  { label: 'Approbation',  color: '#2e7d32', bgColor: '#e8f5e9' },
  COMMITTEE: { label: 'Comité',       color: '#6a1b9a', bgColor: '#f3e5f5' },
};

export const ROLES = [
  { value: 'CHARGE_AFFAIRES',         label: "Chargé d'Affaires" },
  { value: 'ANALYSTE_RISQUES',        label: 'Analyste Risques' },
  { value: 'RESPONSABLE_RISQUES',     label: 'Responsable Risques' },
  { value: 'RESPONSABLE_ENGAGEMENTS', label: 'Responsable Engagements' },
  { value: 'COMITE_CREDIT',           label: 'Comité de Crédit' },
  { value: 'DIRECTION_GENERALE',      label: 'Direction Générale' },
  { value: 'DIRECTION_JURIDIQUE',     label: 'Direction Juridique' },
  { value: 'BACK_OFFICE',             label: 'Back Office' },
];
```

- [ ] **Step 3 : Commit**

```bash
git add src/types/creditPolicyBuilder.ts package.json package-lock.json
git commit -m "feat(frontend): add @xyflow/react + credit policy builder types"
```

---

## Tâche 7 : Méthodes API frontend

**Fichiers :**
- Modifier : `src/services/api.ts`

- [ ] **Step 1 : Ajouter les méthodes dans `creditPolicyApi`**

Dans `src/services/api.ts`, localiser `export const creditPolicyApi = {` (ligne ~1511) et ajouter après les méthodes existantes (avant la fermeture `}`):

```typescript
  async validatePolicy(id: string): Promise<any> {
    try {
      const res = await api.post(`/credit-policies/${id}/validate`);
      return { success: true, data: res.data };
    } catch (e: any) {
      const body = e.response?.data;
      return { success: false, valid: false, errors: body?.errors || [], error: body?.error };
    }
  },

  async activatePolicy(id: string): Promise<any> {
    try {
      const res = await api.post(`/credit-policies/${id}/activate`);
      return { success: true, data: res.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.message || 'Erreur lors de l\'activation' };
    }
  },

  async archivePolicy(id: string): Promise<any> {
    try {
      const res = await api.post(`/credit-policies/${id}/archive`);
      return { success: true, data: res.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur lors de l\'archivage' };
    }
  },

  async savePolicyWithSteps(id: string, data: { steps: any[]; expectedVersion: number }): Promise<any> {
    try {
      const res = await api.put(`/credit-policies/${id}`, data);
      return { success: true, data: res.data.data };
    } catch (e: any) {
      const body = e.response?.data;
      if (e.response?.status === 409) {
        return { success: false, conflict: true, error: body?.message || 'Conflit de version' };
      }
      return { success: false, error: body?.error || 'Erreur sauvegarde' };
    }
  },
```

- [ ] **Step 2 : Commit**

```bash
git add src/services/api.ts
git commit -m "feat(frontend): add validate/activate/archive/save API methods"
```

---

## Tâche 8 : GuardRulesEditor component

**Fichiers :**
- Créer : `src/components/workflow-builder/GuardRulesEditor.tsx`

- [ ] **Step 1 : Créer le dossier**

```bash
mkdir -p src/components/workflow-builder
```

- [ ] **Step 2 : Créer GuardRulesEditor.tsx**

```typescript
// src/components/workflow-builder/GuardRulesEditor.tsx
import React from 'react';
import {
  Box, Typography, Select, MenuItem, TextField, IconButton,
  Button, ToggleButtonGroup, ToggleButton, Chip,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import {
  GuardsJson, GuardCondition, ConditionField, ConditionOperator, GuardOperator, CreditType,
} from '../../types/creditPolicyBuilder';

interface Props {
  value: GuardsJson | null;
  onChange: (guards: GuardsJson | null) => void;
  creditTypes: CreditType[];
  readOnly?: boolean;
}

const FIELD_OPTIONS: { value: ConditionField; label: string }[] = [
  { value: 'amount',       label: 'Montant du dossier (XOF)' },
  { value: 'riskScore',    label: 'Score de risque (0–100)' },
  { value: 'creditTypeId', label: 'Type de crédit' },
];

const NUMERIC_OPS: { value: ConditionOperator; label: string }[] = [
  { value: 'BETWEEN', label: 'Entre' },
  { value: 'GTE',     label: '≥' },
  { value: 'LTE',     label: '≤' },
  { value: 'GT',      label: '>' },
  { value: 'LT',      label: '<' },
];

const LIST_OPS: { value: ConditionOperator; label: string }[] = [
  { value: 'IN',     label: 'Dans la liste' },
  { value: 'NOT_IN', label: 'Pas dans la liste' },
];

function emptyCondition(): GuardCondition {
  return { field: 'amount', operator: 'GTE', value: 0 };
}

function emptyGuards(): GuardsJson {
  return { operator: 'AND', conditions: [] };
}

export function GuardRulesEditor({ value, onChange, creditTypes, readOnly = false }: Props) {
  const guards = value ?? emptyGuards();

  const setOperator = (op: GuardOperator) => onChange({ ...guards, operator: op });

  const addCondition = () => onChange({ ...guards, conditions: [...guards.conditions, emptyCondition()] });

  const removeCondition = (i: number) => {
    const updated = guards.conditions.filter((_, idx) => idx !== i);
    onChange(updated.length === 0 ? null : { ...guards, conditions: updated });
  };

  const updateCondition = (i: number, patch: Partial<GuardCondition>) => {
    const conditions = guards.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c);
    onChange({ ...guards, conditions });
  };

  const renderValueInput = (cond: GuardCondition, i: number) => {
    if (cond.field === 'creditTypeId') {
      const selected = Array.isArray(cond.value) ? cond.value as string[] : [];
      return (
        <Select
          multiple size="small" value={selected} disabled={readOnly}
          onChange={(e) => updateCondition(i, { value: e.target.value as string[] })}
          renderValue={(vals) => (vals as string[]).map((v) => creditTypes.find((ct) => ct.id === v)?.name ?? v).join(', ')}
          sx={{ minWidth: 180 }}
        >
          {creditTypes.map((ct) => (
            <MenuItem key={ct.id} value={ct.id}>{ct.name}</MenuItem>
          ))}
        </Select>
      );
    }

    if (cond.operator === 'BETWEEN') {
      const val = (cond.value as { min: number; max: number }) ?? { min: 0, max: 0 };
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField size="small" type="number" label="Min" value={val.min} disabled={readOnly}
            onChange={(e) => updateCondition(i, { value: { ...val, min: Number(e.target.value) } })}
            sx={{ width: 110 }} />
          <Typography variant="body2">et</Typography>
          <TextField size="small" type="number" label="Max" value={val.max} disabled={readOnly}
            onChange={(e) => updateCondition(i, { value: { ...val, max: Number(e.target.value) } })}
            sx={{ width: 110 }} />
        </Box>
      );
    }

    return (
      <TextField size="small" type="number" label="Valeur" value={cond.value as number} disabled={readOnly}
        onChange={(e) => updateCondition(i, { value: Number(e.target.value) })}
        sx={{ width: 110 }} />
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
          Conditions d'activation
        </Typography>
        {guards.conditions.length > 1 && (
          <ToggleButtonGroup size="small" value={guards.operator} exclusive
            onChange={(_, v) => v && setOperator(v)}>
            <ToggleButton value="AND" disabled={readOnly}>ET</ToggleButton>
            <ToggleButton value="OR"  disabled={readOnly}>OU</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>

      {guards.conditions.map((cond, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          {i > 0 && (
            <Chip label={guards.operator} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
          )}
          <Select size="small" value={cond.field} disabled={readOnly}
            onChange={(e) => updateCondition(i, { field: e.target.value as ConditionField, operator: 'GTE', value: 0 })}>
            {FIELD_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </Select>

          <Select size="small" value={cond.operator} disabled={readOnly}
            onChange={(e) => updateCondition(i, { operator: e.target.value as ConditionOperator, value: 0 })}>
            {(cond.field === 'creditTypeId' ? LIST_OPS : NUMERIC_OPS).map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>

          {renderValueInput(cond, i)}

          {!readOnly && (
            <IconButton size="small" color="error" onClick={() => removeCondition(i)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      ))}

      {!readOnly && (
        <Button size="small" startIcon={<AddIcon />} onClick={addCondition} sx={{ mt: 0.5 }}>
          Ajouter une condition
        </Button>
      )}
    </Box>
  );
}
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/workflow-builder/GuardRulesEditor.tsx
git commit -m "feat(frontend): add GuardRulesEditor component"
```

---

## Tâche 9 : StepConfigPanel component

**Fichiers :**
- Créer : `src/components/workflow-builder/StepConfigPanel.tsx`

- [ ] **Step 1 : Créer StepConfigPanel.tsx**

```typescript
// src/components/workflow-builder/StepConfigPanel.tsx
import React from 'react';
import {
  Box, TextField, Select, MenuItem, InputLabel, FormControl,
  Typography, Divider, Chip, Collapse, IconButton, Tooltip,
} from '@mui/material';
import { ExpandMore, ExpandLess, Delete as DeleteIcon } from '@mui/icons-material';
import { PolicyStep, ROLES, STEP_TYPE_CONFIG, CreditType } from '../../types/creditPolicyBuilder';
import { GuardRulesEditor } from './GuardRulesEditor';

interface Props {
  step: PolicyStep;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<PolicyStep>) => void;
  onDelete: () => void;
  creditTypes: CreditType[];
  readOnly?: boolean;
}

export function StepConfigPanel({ step, expanded, onToggle, onChange, onDelete, creditTypes, readOnly = false }: Props) {
  const cfg = STEP_TYPE_CONFIG[step.stepType];
  const hasError = !!step._error;

  return (
    <Box
      sx={{
        border: `2px solid ${hasError ? '#f44336' : cfg.color}`,
        borderRadius: 2,
        mb: 1,
        bgcolor: 'background.paper',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, p: 1.5,
          bgcolor: cfg.bgColor, borderRadius: '6px 6px 0 0', cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        <Typography variant="body2" sx={{ fontWeight: 700, color: cfg.color, minWidth: 20 }}>
          {step.order}.
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
          {step.stepLabel || '(sans nom)'}
        </Typography>
        <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.color, color: '#fff', fontWeight: 700, fontSize: 11 }} />
        {!readOnly && (
          <Tooltip title="Supprimer l'étape">
            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
      </Box>

      {hasError && (
        <Typography variant="caption" color="error" sx={{ px: 2, py: 0.5, display: 'block', bgcolor: '#ffebee' }}>
          {step._error}
        </Typography>
      )}

      {/* Body */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Nom de l'étape" size="small" fullWidth disabled={readOnly}
            value={step.stepLabel}
            onChange={(e) => onChange({ stepLabel: e.target.value, stepName: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
          />

          <FormControl size="small" fullWidth>
            <InputLabel>Rôle assigné</InputLabel>
            <Select value={step.assignedRole} label="Rôle assigné" disabled={readOnly}
              onChange={(e) => onChange({ assignedRole: e.target.value })}>
              {ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="SLA attendu (h)" size="small" type="number" disabled={readOnly}
              value={step.expectedDurationHours}
              onChange={(e) => onChange({ expectedDurationHours: Number(e.target.value) })}
              sx={{ flex: 1 }} />
            <TextField label="SLA max (h)" size="small" type="number" disabled={readOnly}
              value={step.maxDurationHours}
              onChange={(e) => onChange({ maxDurationHours: Number(e.target.value) })}
              sx={{ flex: 1 }} />
          </Box>

          <Divider />

          <GuardRulesEditor
            value={step.guards}
            onChange={(guards) => onChange({ guards })}
            creditTypes={creditTypes}
            readOnly={readOnly}
          />
        </Box>
      </Collapse>
    </Box>
  );
}
```

- [ ] **Step 2 : Commit**

```bash
git add src/components/workflow-builder/StepConfigPanel.tsx
git commit -m "feat(frontend): add StepConfigPanel component"
```

---

## Tâche 10 : StepPalette + StepList

**Fichiers :**
- Créer : `src/components/workflow-builder/StepPalette.tsx`
- Créer : `src/components/workflow-builder/StepList.tsx`

- [ ] **Step 1 : Créer StepPalette.tsx**

```typescript
// src/components/workflow-builder/StepPalette.tsx
import React from 'react';
import { Box, Typography, Paper, Divider } from '@mui/material';
import { PolicyStepType, STEP_TYPE_CONFIG, ROLES } from '../../types/creditPolicyBuilder';

interface Props {
  onAddStep: (type: PolicyStepType) => void;
  readOnly?: boolean;
}

const STEP_TYPES: PolicyStepType[] = ['DISPATCH', 'ANALYSIS', 'APPROVAL', 'COMMITTEE'];

export function StepPalette({ onAddStep, readOnly = false }: Props) {
  return (
    <Box sx={{ width: 220, flexShrink: 0, p: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', display: 'block', mb: 1 }}>
        Types d'étapes
      </Typography>

      {STEP_TYPES.map((type) => {
        const cfg = STEP_TYPE_CONFIG[type];
        return (
          <Paper
            key={type}
            elevation={0}
            onClick={() => !readOnly && onAddStep(type)}
            sx={{
              border: `2px dashed ${cfg.color}`,
              bgcolor: cfg.bgColor,
              borderRadius: 2,
              p: 1,
              mb: 1,
              cursor: readOnly ? 'not-allowed' : 'pointer',
              opacity: readOnly ? 0.5 : 1,
              transition: 'all 0.15s',
              '&:hover': readOnly ? {} : { boxShadow: 2, transform: 'translateY(-1px)' },
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700, color: cfg.color }}>
              + {cfg.label}
            </Typography>
          </Paper>
        );
      })}

      <Divider sx={{ my: 2 }} />

      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', display: 'block', mb: 1 }}>
        Rôles disponibles
      </Typography>

      {ROLES.map((r) => (
        <Typography key={r.value} variant="caption" display="block" color="text.secondary" sx={{ mb: 0.5, pl: 0.5 }}>
          • {r.label}
        </Typography>
      ))}
    </Box>
  );
}
```

- [ ] **Step 2 : Créer StepList.tsx**

```typescript
// src/components/workflow-builder/StepList.tsx
import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { PolicyStep, CreditType } from '../../types/creditPolicyBuilder';
import { StepConfigPanel } from './StepConfigPanel';

interface Props {
  steps: PolicyStep[];
  onStepsChange: (steps: PolicyStep[]) => void;
  creditTypes: CreditType[];
  readOnly?: boolean;
}

export function StepList({ steps, onStepsChange, creditTypes, readOnly = false }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id);

  const updateStep = (id: string, patch: Partial<PolicyStep>) => {
    onStepsChange(steps.map((s) => s.id === id ? { ...s, ...patch } : s));
  };

  const deleteStep = (id: string) => {
    const filtered = steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 }));
    onStepsChange(filtered);
    if (expandedId === id) setExpandedId(null);
  };

  const handleDragStart = (idx: number) => setDraggingIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setOverIdx(idx); };

  const handleDrop = (toIdx: number) => {
    if (draggingIdx === null || draggingIdx === toIdx) { setDraggingIdx(null); setOverIdx(null); return; }
    const reordered = [...steps];
    const [moved] = reordered.splice(draggingIdx, 1);
    reordered.splice(toIdx, 0, moved);
    onStepsChange(reordered.map((s, i) => ({ ...s, order: i + 1 })));
    setDraggingIdx(null);
    setOverIdx(null);
  };

  if (steps.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4, border: '2px dashed #ccc', borderRadius: 2, color: 'text.disabled' }}>
        <Typography variant="body2">Ajoutez des étapes depuis la palette à gauche</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflowY: 'auto' }}>
      {steps.map((step, idx) => (
        <Box
          key={step.id}
          draggable={!readOnly}
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={() => handleDrop(idx)}
          onDragEnd={() => { setDraggingIdx(null); setOverIdx(null); }}
          sx={{
            opacity: draggingIdx === idx ? 0.4 : 1,
            outline: overIdx === idx && draggingIdx !== idx ? '2px dashed #1976d2' : 'none',
            borderRadius: 2,
            transition: 'opacity 0.15s',
          }}
        >
          <StepConfigPanel
            step={step}
            expanded={expandedId === step.id}
            onToggle={() => toggleExpand(step.id)}
            onChange={(patch) => updateStep(step.id, patch)}
            onDelete={() => deleteStep(step.id)}
            creditTypes={creditTypes}
            readOnly={readOnly}
          />
        </Box>
      ))}
    </Box>
  );
}
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/workflow-builder/StepPalette.tsx src/components/workflow-builder/StepList.tsx
git commit -m "feat(frontend): add StepPalette and StepList components"
```

---

## Tâche 11 : WorkflowPreview (React Flow)

**Fichiers :**
- Créer : `src/components/workflow-builder/WorkflowPreview.tsx`

- [ ] **Step 1 : Créer WorkflowPreview.tsx**

```typescript
// src/components/workflow-builder/WorkflowPreview.tsx
import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { ReactFlow, Background, Controls, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PolicyStep, STEP_TYPE_CONFIG } from '../../types/creditPolicyBuilder';

interface Props {
  steps: PolicyStep[];
}

export function WorkflowPreview({ steps }: Props) {
  const { nodes, edges } = useMemo(() => {
    const sorted = [...steps].sort((a, b) => a.order - b.order);

    const nodes: Node[] = sorted.map((step, i) => ({
      id: step.id,
      position: { x: 160, y: i * 120 },
      data: {
        label: (
          <Box sx={{ textAlign: 'center', p: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: STEP_TYPE_CONFIG[step.stepType].color, display: 'block' }}>
              {STEP_TYPE_CONFIG[step.stepType].label}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              {step.stepLabel || '(sans nom)'}
            </Typography>
          </Box>
        ),
      },
      style: {
        background: STEP_TYPE_CONFIG[step.stepType].bgColor,
        border: `2px solid ${STEP_TYPE_CONFIG[step.stepType].color}`,
        borderRadius: 8,
        width: 180,
        fontSize: 12,
      },
    }));

    const edges: Edge[] = sorted.slice(0, -1).map((step, i) => ({
      id: `e-${step.id}-${sorted[i + 1].id}`,
      source: step.id,
      target: sorted[i + 1].id,
      animated: false,
      style: { stroke: '#90a4ae', strokeWidth: 2 },
    }));

    return { nodes, edges };
  }, [steps]);

  if (steps.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
        <Typography variant="body2">Ajoutez des étapes pour voir l'aperçu</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, height: '100%', minHeight: 400 }}>
      <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}>
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </Box>
  );
}
```

- [ ] **Step 2 : Commit**

```bash
git add src/components/workflow-builder/WorkflowPreview.tsx
git commit -m "feat(frontend): add WorkflowPreview with React Flow"
```

---

## Tâche 12 : WorkflowPolicyBuilder — Conteneur principal

**Fichiers :**
- Créer : `src/components/workflow-builder/WorkflowPolicyBuilder.tsx`

- [ ] **Step 1 : Créer WorkflowPolicyBuilder.tsx**

```typescript
// src/components/workflow-builder/WorkflowPolicyBuilder.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Select, MenuItem, Button, Chip, Alert,
  CircularProgress, Divider, Tooltip, FormControl, InputLabel,
} from '@mui/material';
import {
  Save as SaveIcon, CheckCircle as ValidateIcon,
  PlayArrow as ActivateIcon, Archive as ArchiveIcon, Add as AddIcon,
} from '@mui/icons-material';
import { useUser } from '../../contexts/UserContext';
import { creditPolicyApi } from '../../services/api';
import {
  CreditPolicyFull, PolicyStep, PolicyStepType, CreditType, STEP_TYPE_CONFIG,
} from '../../types/creditPolicyBuilder';
import { StepPalette } from './StepPalette';
import { StepList } from './StepList';
import { WorkflowPreview } from './WorkflowPreview';

function generateTempId() {
  return `new_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function createStep(type: PolicyStepType, order: number): PolicyStep {
  const cfg = STEP_TYPE_CONFIG[type];
  return {
    id: generateTempId(),
    policyId: '',
    stepName: type.toLowerCase(),
    stepLabel: cfg.label,
    order,
    stepType: type,
    assignedRole: 'CHARGE_AFFAIRES',
    conditionMinAmount: null,
    conditionMaxAmount: null,
    expectedDurationHours: 24,
    maxDurationHours: 72,
    isRequired: true,
    isActive: true,
    description: null,
    creditTypeIds: [],
    guards: null,
  };
}

function validateStepsClient(steps: PolicyStep[]): PolicyStep[] {
  return steps.map((s) => {
    if (!s.assignedRole) return { ...s, _error: 'Rôle obligatoire' };
    if (!s.stepLabel.trim()) return { ...s, _error: 'Nom obligatoire' };
    return { ...s, _error: undefined };
  });
}

export function WorkflowPolicyBuilder() {
  const { hasPermission } = useUser();
  const canEdit = hasPermission('manage_credit_policy');

  const [policies, setPolicies] = useState<CreditPolicyFull[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [steps, setSteps] = useState<PolicyStep[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [creditTypes, setCreditTypes] = useState<CreditType[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId) ?? null;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [polRes, ctRes] = await Promise.all([
      creditPolicyApi.getPolicies(),
      creditPolicyApi.getCreditTypes(),
    ]);
    if (polRes.success && polRes.data) {
      setPolicies(polRes.data);
      const active = polRes.data.find((p: CreditPolicyFull) => p.status === 'ACTIVE') ?? polRes.data[0];
      if (active) {
        setSelectedPolicyId(active.id);
        setSteps(active.steps ?? []);
        setCurrentVersion(active.version);
      }
    }
    if (ctRes.success && ctRes.data) setCreditTypes(ctRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelectPolicy = (id: string) => {
    const pol = policies.find((p) => p.id === id);
    if (!pol) return;
    setSelectedPolicyId(id);
    setSteps(pol.steps ?? []);
    setCurrentVersion(pol.version);
    setMessage(null);
  };

  const handleAddStep = (type: PolicyStepType) => {
    if (!canEdit || selectedPolicy?.status !== 'DRAFT') return;
    setSteps((prev) => [...prev, createStep(type, prev.length + 1)]);
  };

  const handleSave = async () => {
    if (!selectedPolicyId || !canEdit) return;
    const validated = validateStepsClient(steps);
    setSteps(validated);
    const hasErrors = validated.some((s) => s._error);
    if (hasErrors) { setMessage({ text: 'Corrigez les erreurs avant de sauvegarder', type: 'error' }); return; }

    setSaving(true);
    const res = await creditPolicyApi.savePolicyWithSteps(selectedPolicyId, {
      steps: validated.map((s) => ({ ...s, _error: undefined })),
      expectedVersion: currentVersion,
    });
    setSaving(false);

    if (res.success) {
      setCurrentVersion(res.data?.version ?? currentVersion + 1);
      setMessage({ text: 'Politique sauvegardée (v' + (res.data?.version ?? currentVersion + 1) + ')', type: 'success' });
    } else if (res.conflict) {
      setMessage({ text: res.error, type: 'warning' });
    } else {
      setMessage({ text: res.error, type: 'error' });
    }
  };

  const handleValidate = async () => {
    if (!selectedPolicyId) return;
    const res = await creditPolicyApi.validatePolicy(selectedPolicyId);
    if (res.data?.valid) {
      setMessage({ text: 'Workflow valide — vous pouvez activer la politique', type: 'success' });
    } else {
      const errMsgs = (res.errors ?? []).map((e: any) => e.message).join(' | ');
      setMessage({ text: errMsgs || res.error, type: 'error' });
    }
  };

  const handleActivate = async () => {
    if (!selectedPolicyId) return;
    const res = await creditPolicyApi.activatePolicy(selectedPolicyId);
    if (res.success) {
      setMessage({ text: 'Politique activée avec succès', type: 'success' });
      await loadData();
    } else {
      setMessage({ text: res.error, type: 'error' });
    }
  };

  const handleArchive = async () => {
    if (!selectedPolicyId) return;
    const res = await creditPolicyApi.archivePolicy(selectedPolicyId);
    if (res.success) {
      setMessage({ text: 'Politique archivée', type: 'info' });
      await loadData();
    } else {
      setMessage({ text: res.error, type: 'error' });
    }
  };

  const handleNewPolicy = async () => {
    const name = `Politique ${new Date().getFullYear()}-DRAFT`;
    const code = `POL-${Date.now()}`;
    const res = await creditPolicyApi.createPolicy({ name, code, description: '' });
    if (res.success && res.data) {
      await loadData();
      setSelectedPolicyId(res.data.id);
      setSteps([]);
      setCurrentVersion(1);
    }
  };

  const isDraft = selectedPolicy?.status === 'DRAFT';
  const isActive = selectedPolicy?.status === 'ACTIVE';

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1 }}>
      {/* Header — sélecteur de politique */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 280 }}>
          <InputLabel>Politique de crédit</InputLabel>
          <Select value={selectedPolicyId} label="Politique de crédit" onChange={(e) => handleSelectPolicy(e.target.value)}>
            {policies.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} — v{p.version}
                <Chip size="small" label={p.status} sx={{ ml: 1, fontSize: 10,
                  bgcolor: p.status === 'ACTIVE' ? '#e8f5e9' : p.status === 'DRAFT' ? '#fff3e0' : '#f5f5f5',
                  color: p.status === 'ACTIVE' ? '#2e7d32' : p.status === 'DRAFT' ? '#e65100' : '#757575',
                }} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {canEdit && (
          <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={handleNewPolicy}>
            Nouvelle politique
          </Button>
        )}

        <Box sx={{ flex: 1 }} />

        {canEdit && isDraft && (
          <>
            <Button size="small" variant="outlined" startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />} onClick={handleSave} disabled={saving}>
              Sauvegarder
            </Button>
            <Button size="small" variant="outlined" color="info" startIcon={<ValidateIcon />} onClick={handleValidate}>
              Valider
            </Button>
            <Button size="small" variant="contained" color="success" startIcon={<ActivateIcon />} onClick={handleActivate}>
              Activer
            </Button>
          </>
        )}

        {canEdit && isActive && (
          <Tooltip title="Archiver cette politique">
            <Button size="small" variant="outlined" color="warning" startIcon={<ArchiveIcon />} onClick={handleArchive}>
              Archiver
            </Button>
          </Tooltip>
        )}
      </Box>

      {message && (
        <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mx: 0 }}>
          {message.text}
        </Alert>
      )}

      {!isDraft && selectedPolicy && (
        <Alert severity="info" sx={{ mx: 0 }}>
          Cette politique est en statut <strong>{selectedPolicy.status}</strong> — lecture seule.
          {selectedPolicy.status === 'ACTIVE' && ' Archivez-la pour créer une nouvelle version.'}
        </Alert>
      )}

      {/* Corps 3 colonnes */}
      <Box sx={{ display: 'flex', flex: 1, gap: 0, overflow: 'hidden', bgcolor: 'background.paper', borderRadius: 2 }}>
        {/* Palette */}
        <Box sx={{ borderRight: '1px solid', borderColor: 'divider', bgcolor: '#fafafa' }}>
          <StepPalette onAddStep={handleAddStep} readOnly={!canEdit || !isDraft} />
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Liste des étapes */}
        <Box sx={{ flex: 1, p: 2, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <StepList
            steps={steps}
            onStepsChange={setSteps}
            creditTypes={creditTypes}
            readOnly={!canEdit || !isDraft}
          />
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Aperçu React Flow */}
        <Box sx={{ width: 380, borderLeft: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="caption" color="text.secondary" sx={{ p: 1.5, fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid', borderColor: 'divider' }}>
            Aperçu du workflow
          </Typography>
          <WorkflowPreview steps={steps} />
        </Box>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2 : Vérifier que `useUser` expose `hasPermission`**

```bash
grep -n "hasPermission\|permissions" src/contexts/UserContext.tsx | head -20
```

Si `hasPermission` n'existe pas, utiliser `isRole('admin') || isRole('super_admin')` à la place dans le composant.

- [ ] **Step 3 : Commit**

```bash
git add src/components/workflow-builder/WorkflowPolicyBuilder.tsx
git commit -m "feat(frontend): add WorkflowPolicyBuilder main container"
```

---

## Tâche 13 : Intégration dans CreditPolicyPage

**Fichiers :**
- Modifier : `src/pages/CreditPolicyPage.tsx`

- [ ] **Step 1 : Importer WorkflowPolicyBuilder**

En haut de `src/pages/CreditPolicyPage.tsx`, ajouter l'import :

```typescript
import { WorkflowPolicyBuilder } from '../components/workflow-builder/WorkflowPolicyBuilder';
```

- [ ] **Step 2 : Ajouter l'onglet "Éditeur visuel" (tab index = 2)**

La page a actuellement 2 onglets (ligne 315-317 de `CreditPolicyPage.tsx`) :
- Tab 0 : `<Tab label="Étapes de crédit" />`
- Tab 1 : `<Tab label="Simulation du circuit" />`

Ajouter le builder en **index 2** (ne pas toucher aux onglets existants) :

```typescript
// Dans le composant <Tabs> (ligne ~315), ajouter après les 2 Tab existants :
<Tab label="Éditeur visuel" icon={<PolicyIcon />} iconPosition="start" />
```

Puis ajouter le panel correspondant après les panels `tab === 0` et `tab === 1` existants :

```typescript
{tab === 2 && (
  <Box sx={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
    <WorkflowPolicyBuilder />
  </Box>
)}
```

- [ ] **Step 3 : Vérifier le rendu**

Démarrer le serveur de dev et ouvrir `/credit-policy` :

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npm run dev
```

Vérifier :
1. L'onglet "Éditeur visuel" apparaît
2. Le sélecteur de politique charge les politiques de la banque
3. Les types de crédit se chargent dans le GuardRulesEditor
4. Ajouter une étape depuis la palette fonctionne
5. L'aperçu React Flow se met à jour
6. En statut ACTIVE/ARCHIVED, les contrôles d'édition sont masqués

- [ ] **Step 4 : Commit final**

```bash
git add src/pages/CreditPolicyPage.tsx
git commit -m "feat(frontend): integrate WorkflowPolicyBuilder in CreditPolicyPage as visual editor tab"
```

---

## Récapitulatif des commits

| # | Message |
|---|---|
| 1 | `feat(db): add PolicyStatus enum + guards field to credit policy` |
| 2 | `feat(backend): add pure guard engine service` |
| 3 | `feat(backend): add guards persistence + optimistic locking to credit policy routes` |
| 4 | `feat(backend): add validate/activate/archive endpoints for credit policy lifecycle` |
| 5 | `feat(seed): add manage_credit_policy permission to ADMIN and SUPER_ADMIN` |
| 6 | `feat(frontend): add @xyflow/react + credit policy builder types` |
| 7 | `feat(frontend): add validate/activate/archive/save API methods` |
| 8 | `feat(frontend): add GuardRulesEditor component` |
| 9 | `feat(frontend): add StepConfigPanel component` |
| 10 | `feat(frontend): add StepPalette and StepList components` |
| 11 | `feat(frontend): add WorkflowPreview with React Flow` |
| 12 | `feat(frontend): add WorkflowPolicyBuilder main container` |
| 13 | `feat(frontend): integrate WorkflowPolicyBuilder in CreditPolicyPage as visual editor tab` |
