# Tableau de Bord CODIR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time CODIR decision-support dashboard that shows all pending credit applications, identifies bottlenecks per workflow step, names the blocking agent, and lets the CODIR relancer/réaffecter/escalader directly from the table.

**Architecture:** New page `codir-dashboard` registered in the module profile system (no hardcoded role check). Backend route `/api/codir/*` handles data aggregation and three action endpoints. Frontend has a KPI bar (Zone 1) and a filtered table with inline action dialogs (Zone 2).

**Tech Stack:** React 18 + MUI v5, Express + Prisma 6 + PostgreSQL, existing `authenticate`/`requireCompany`/`authorize` middleware, `createInAppNotification` for notifications, `asyncHandler`/`AppError` from errorHandler.

**Spec:** `docs/superpowers/specs/2026-04-29-codir-dashboard-design.md`

**Branch:** Create `feature/codir-dashboard` worktree before starting.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/prisma/schema.prisma` | Modify | Add 4 fields to WorkflowStep |
| `backend/prisma/migrations/…/migration.sql` | Create | ALTER TABLE SQL |
| `backend/src/constants/moduleToPermissionsMap.ts` | Modify | Add codir-dashboard permissions |
| `backend/src/routes/codir.ts` | Create | 5 CODIR endpoints |
| `backend/src/server.ts` | Modify | Mount /api/codir route |
| `src/utils/derivePermissions.ts` | Modify | Sync frontend copy |
| `src/config/moduleRegistry.ts` | Modify | Add codir-dashboard module |
| `src/types/index.ts` | Modify | Add types + PageType |
| `src/services/api.ts` | Modify | Add 5 CODIR API methods |
| `src/components/codir/BottleneckKpiBar.tsx` | Create | KPI cards row |
| `src/components/codir/RelanceDialog.tsx` | Create | Relance dialog |
| `src/components/codir/ReassignDialog.tsx` | Create | Reassign dialog |
| `src/components/codir/EscaladeDialog.tsx` | Create | Escalation confirmation dialog |
| `src/components/codir/PendingDecisionsTable.tsx` | Create | Main filtered table + actions |
| `src/pages/CodirDashboardPage.tsx` | Create | Page shell + data fetch + auto-refresh |
| `src/components/Sidebar.tsx` | Modify | Add canViewCodir + NavItem |
| `src/App.tsx` | Modify | Lazy import + Route |

---

## Task 1: DB Migration — WorkflowStep escalation + relance fields

**Files:**
- Modify: `backend/prisma/schema.prisma` (WorkflowStep model ~line 231)
- Create: `backend/prisma/migrations/20260429000000_add_codir_fields/migration.sql`

- [ ] **Step 1: Add 4 fields to WorkflowStep in schema.prisma**

Find the WorkflowStep model (line ~231). Add the 4 lines after `notifiedAt`:

```prisma
  isEscalated    Boolean   @default(false) @map("is_escalated")
  escalatedAt    DateTime? @map("escalated_at")
  escalatedById  String?   @map("escalated_by_id")
  lastRelancedAt DateTime? @map("last_relanced_at")
```

The block before `@@index` should now look like:
```prisma
  notifiedAt      DateTime?         @map("notified_at")
  isEscalated     Boolean           @default(false) @map("is_escalated")
  escalatedAt     DateTime?         @map("escalated_at")
  escalatedById   String?           @map("escalated_by_id")
  lastRelancedAt  DateTime?         @map("last_relanced_at")
  createdAt       DateTime          @default(now()) @map("created_at")
```

- [ ] **Step 2: Create migration directory and SQL file**

```bash
mkdir -p backend/prisma/migrations/20260429000000_add_codir_fields
```

Create `backend/prisma/migrations/20260429000000_add_codir_fields/migration.sql`:

```sql
-- Migration: ajouter les champs d'escalade et de relance sur workflow_steps

ALTER TABLE "workflow_steps" ADD COLUMN "is_escalated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workflow_steps" ADD COLUMN "escalated_at" TIMESTAMP(3);
ALTER TABLE "workflow_steps" ADD COLUMN "escalated_by_id" TEXT;
ALTER TABLE "workflow_steps" ADD COLUMN "last_relanced_at" TIMESTAMP(3);
```

- [ ] **Step 3: Regenerate Prisma client**

```bash
cd backend && npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Apply migration to database**

```bash
cd backend && npx prisma migrate deploy
```

Expected: `1 migration applied` (or use `prisma db push` in dev if migrate deploy fails)

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no output (zero errors)

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(db): ajouter champs escalade et relance sur workflow_steps"
```

---

## Task 2: Backend permissions mapping

**Files:**
- Modify: `backend/src/constants/moduleToPermissionsMap.ts`

- [ ] **Step 1: Add codir-dashboard entries to MODULE_ACTION_TO_PERMISSIONS**

In `backend/src/constants/moduleToPermissionsMap.ts`, find the visibilité section and add after the last `.visible` entry:

```ts
  'codir-dashboard.visible':           ['codir_dashboard'],
  'codir-dashboard.actions.relance':   ['codir_relance'],
  'codir-dashboard.actions.reassign':  ['codir_reassign'],
  'codir-dashboard.actions.escalade':  ['codir_escalade'],
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add backend/src/constants/moduleToPermissionsMap.ts
git commit -m "feat(permissions): ajouter les permissions codir-dashboard"
```

---

## Task 3: Frontend module registry + derivePermissions sync

**Files:**
- Modify: `src/config/moduleRegistry.ts`
- Modify: `src/utils/derivePermissions.ts`

- [ ] **Step 1: Add codir-dashboard to MODULE_REGISTRY in moduleRegistry.ts**

In `src/config/moduleRegistry.ts`, append to the `MODULE_REGISTRY` array before the closing `]`:

```ts
  {
    key: 'codir-dashboard',
    label: 'Tableau de Bord CODIR',
    actions: [
      { key: 'relance',  label: 'Relancer un agent' },
      { key: 'reassign', label: 'Réaffecter un dossier' },
      { key: 'escalade', label: 'Escalader un dossier' },
    ],
    sections: [],
  },
```

- [ ] **Step 2: Add entries to derivePermissions.ts (frontend copy)**

In `src/utils/derivePermissions.ts`, find the `MODULE_ACTION_TO_PERMISSIONS` object and add after the last `.visible` entry:

```ts
  'codir-dashboard.visible':           ['codir_dashboard'],
  'codir-dashboard.actions.relance':   ['codir_relance'],
  'codir-dashboard.actions.reassign':  ['codir_reassign'],
  'codir-dashboard.actions.escalade':  ['codir_escalade'],
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add src/config/moduleRegistry.ts src/utils/derivePermissions.ts
git commit -m "feat(module-registry): ajouter module codir-dashboard"
```

---

## Task 4: Frontend types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add PageType entry**

In `src/types/index.ts`, find the `PageType` union (line ~114). Add `'codir-dashboard'` to the union:

```ts
export type PageType = 'home' | 'configuration' | ... | 'legal-step' | 'codir-dashboard';
```

- [ ] **Step 2: Add StepKpi and PendingDecisionItem interfaces**

Add after the existing interfaces in `src/types/index.ts`:

```ts
export interface StepKpi {
  stepName: string;
  stepLabel: string;
  role: string;
  count: number;
  overdueCount: number;
  avgWaitHours: number;
}

export interface PendingDecisionItem {
  stepId: string;
  applicationId: string;
  applicationNumber: string;
  clientName: string;
  amount: number;
  currency: string;
  stepName: string;
  stepLabel: string;
  assignedRole: string;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: string;
  deadline: string | null;
  isOverdue: boolean;
  daysWaiting: number;
  isEscalated: boolean;
  escalatedAt: string | null;
  lastRelancedAt: string | null;
}

export interface CodirDashboardData {
  kpis: StepKpi[];
  items: PendingDecisionItem[];
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): ajouter StepKpi, PendingDecisionItem, CodirDashboardData"
```

---

## Task 5: API service methods

**Files:**
- Modify: `src/services/api.ts`

- [ ] **Step 1: Add CODIR API methods to ApiService class**

In `src/services/api.ts`, import the new types at the top (if not already imported via wildcard):

```ts
import type { CodirDashboardData, PendingDecisionItem } from '../types';
```

Then add these static methods to the `ApiService` class after `getPendingApprovalsCount`:

```ts
  // ── CODIR Dashboard ───────────────────────────────────────────────────────

  static async getCodirDashboard(): Promise<ApiResponse<CodirDashboardData>> {
    try {
      const response = await api.get('/codir/dashboard');
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur chargement dashboard CODIR' };
    }
  }

  static async codirRelance(stepId: string, message: string): Promise<ApiResponse<void>> {
    try {
      await api.post(`/codir/relance/${stepId}`, { message });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur relance' };
    }
  }

  static async codirEscalade(stepId: string): Promise<ApiResponse<void>> {
    try {
      await api.post(`/codir/escalade/${stepId}`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur escalade' };
    }
  }

  static async codirReassign(stepId: string, newAssigneeId: string, comment?: string): Promise<ApiResponse<void>> {
    try {
      await api.put(`/codir/reassign/${stepId}`, { newAssigneeId, comment });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur réaffectation' };
    }
  }

  static async codirGetAgents(role: string): Promise<ApiResponse<Array<{ id: string; name: string; role: string }>>> {
    try {
      const response = await api.get(`/codir/agents/${role}`);
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur chargement agents' };
    }
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/services/api.ts
git commit -m "feat(api): ajouter méthodes CODIR dashboard"
```

---

## Task 6: Backend codir route

**Files:**
- Create: `backend/src/routes/codir.ts`

- [ ] **Step 1: Create the route file**

Create `backend/src/routes/codir.ts`:

```ts
import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticate, requireCompany, authorize } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { createInAppNotification } from '../services/notificationService';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

const SUPERVISOR_ROLE: Record<string, string> = {
  CHARGE_AFFAIRES:          'ANALYSTE_RISQUES',
  ANALYSTE_RISQUES:         'RESPONSABLE_RISQUES',
  RESPONSABLE_RISQUES:      'RESPONSABLE_ENGAGEMENTS',
  RESPONSABLE_ENGAGEMENTS:  'COMITE_CREDIT',
  COMITE_CREDIT:            'DIRECTION_GENERALE',
  DIRECTION_GENERALE:       'DIRECTION_GENERALE',
  DIRECTION_JURIDIQUE:      'DIRECTION_GENERALE',
  BACK_OFFICE:              'RESPONSABLE_ENGAGEMENTS',
};

// GET /api/codir/dashboard
router.get('/dashboard', authorize(['codir_dashboard']), asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId!;

  const steps = await prisma.workflowStep.findMany({
    where: {
      status: { in: ['PENDING', 'IN_REVIEW'] },
      application: {
        companyId,
        status: { notIn: ['APPROVED', 'REJECTED', 'DISBURSED'] },
      },
    },
    include: {
      application: { include: { client: { select: { name: true } } } },
      assignee: { select: { id: true, name: true } },
      policyStep: { select: { stepLabel: true } },
    },
    orderBy: [{ isOverdue: 'desc' }, { deadline: 'asc' }, { createdAt: 'asc' }],
  });

  // Aggregate KPIs per step
  const kpiMap = new Map<string, {
    stepName: string; stepLabel: string; role: string;
    count: number; overdueCount: number; totalWaitHours: number;
  }>();

  for (const step of steps) {
    const label = step.policyStep?.stepLabel ?? step.stepName;
    const waitHours = (Date.now() - step.createdAt.getTime()) / 3_600_000;
    const existing = kpiMap.get(step.stepName);
    if (existing) {
      existing.count++;
      if (step.isOverdue) existing.overdueCount++;
      existing.totalWaitHours += waitHours;
    } else {
      kpiMap.set(step.stepName, {
        stepName: step.stepName,
        stepLabel: label,
        role: step.role,
        count: 1,
        overdueCount: step.isOverdue ? 1 : 0,
        totalWaitHours: waitHours,
      });
    }
  }

  const kpis = Array.from(kpiMap.values()).map(k => ({
    stepName: k.stepName,
    stepLabel: k.stepLabel,
    role: k.role,
    count: k.count,
    overdueCount: k.overdueCount,
    avgWaitHours: Math.round(k.totalWaitHours / k.count),
  }));

  const items = steps.map(step => ({
    stepId: step.id,
    applicationId: step.applicationId,
    applicationNumber: step.application.applicationNumber,
    clientName: (step.application.client as any)?.name ?? '—',
    amount: step.application.amount,
    currency: step.application.currency,
    stepName: step.stepName,
    stepLabel: step.policyStep?.stepLabel ?? step.stepName,
    assignedRole: step.role,
    assigneeId: step.assigneeId,
    assigneeName: step.assignee?.name ?? null,
    createdAt: step.createdAt.toISOString(),
    deadline: step.deadline?.toISOString() ?? null,
    isOverdue: step.isOverdue,
    daysWaiting: Math.floor((Date.now() - step.createdAt.getTime()) / 86_400_000),
    isEscalated: step.isEscalated,
    escalatedAt: step.escalatedAt?.toISOString() ?? null,
    lastRelancedAt: step.lastRelancedAt?.toISOString() ?? null,
  }));

  res.json({ success: true, data: { kpis, items } });
}));

// POST /api/codir/relance/:stepId
router.post('/relance/:stepId', authorize(['codir_relance']), asyncHandler(async (req: Request, res: Response) => {
  const { stepId } = req.params;
  const { message } = req.body;
  const companyId = req.companyId!;

  const step = await prisma.workflowStep.findFirst({
    where: { id: stepId, application: { companyId } },
    include: { application: { select: { applicationNumber: true } } },
  });
  if (!step) throw new AppError('Étape introuvable', 404, 'NOT_FOUND');
  if (!step.assigneeId) throw new AppError('Aucun agent assigné à cette étape', 400, 'NO_ASSIGNEE');

  const appNumber = step.application.applicationNumber;
  const finalMessage = message?.trim()
    || `Le dossier ${appNumber} attend votre action depuis ${Math.floor((Date.now() - step.createdAt.getTime()) / 86_400_000)} jour(s). Merci de traiter ce dossier en priorité.`;

  await createInAppNotification(step.assigneeId, {
    title: `Relance — Dossier ${appNumber}`,
    message: finalMessage,
    type: 'ACTION_REQUIRED',
    relatedType: 'workflow_step',
    relatedId: step.id,
    companyId,
  });

  await prisma.workflowStep.update({
    where: { id: stepId },
    data: { lastRelancedAt: new Date() },
  });

  res.json({ success: true });
}));

// POST /api/codir/escalade/:stepId
router.post('/escalade/:stepId', authorize(['codir_escalade']), asyncHandler(async (req: Request, res: Response) => {
  const { stepId } = req.params;
  const companyId = req.companyId!;
  const escalatedById = req.user!.id;

  const step = await prisma.workflowStep.findFirst({
    where: { id: stepId, application: { companyId } },
    include: {
      application: { select: { applicationNumber: true } },
      assignee: { select: { name: true } },
    },
  });
  if (!step) throw new AppError('Étape introuvable', 404, 'NOT_FOUND');
  if (step.isEscalated) throw new AppError('Ce dossier est déjà escaladé', 400, 'ALREADY_ESCALATED');

  const supervisorRole = SUPERVISOR_ROLE[step.role] ?? 'DIRECTION_GENERALE';
  const appNumber = step.application.applicationNumber;
  const assigneeName = step.assignee?.name ?? 'Agent non assigné';

  // Fetch supervisors via membership (no direct enum comparison on CompanyMembership)
  const memberships = await prisma.companyMembership.findMany({
    where: { companyId, isActive: true },
    include: { user: { select: { id: true, role: true } } },
  });
  const supervisorIds = memberships
    .filter(m => m.user.role === supervisorRole)
    .map(m => m.user.id);

  await prisma.workflowStep.update({
    where: { id: stepId },
    data: { isEscalated: true, escalatedAt: new Date(), escalatedById },
  });

  await Promise.all(supervisorIds.map(supId =>
    createInAppNotification(supId, {
      title: `Escalade — Dossier ${appNumber}`,
      message: `Le dossier ${appNumber} a été escaladé par la direction. Étape bloquante : ${step.stepName} — Agent : ${assigneeName}.`,
      type: 'WARNING',
      relatedType: 'workflow_step',
      relatedId: step.id,
      companyId,
    })
  ));

  res.json({ success: true });
}));

// PUT /api/codir/reassign/:stepId
router.put('/reassign/:stepId', authorize(['codir_reassign']), asyncHandler(async (req: Request, res: Response) => {
  const { stepId } = req.params;
  const { newAssigneeId, comment } = req.body;
  const companyId = req.companyId!;

  if (!newAssigneeId) throw new AppError('newAssigneeId est requis', 400, 'MISSING_FIELD');

  const step = await prisma.workflowStep.findFirst({
    where: { id: stepId, application: { companyId } },
    include: {
      application: { select: { applicationNumber: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
  if (!step) throw new AppError('Étape introuvable', 404, 'NOT_FOUND');

  // Validate new assignee belongs to this company
  const membership = await prisma.companyMembership.findFirst({
    where: { userId: newAssigneeId, companyId, isActive: true },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!membership) throw new AppError('Agent introuvable dans cette organisation', 404, 'ASSIGNEE_NOT_FOUND');

  const appNumber = step.application.applicationNumber;
  const newAssigneeName = membership.user.name;
  const oldAssignee = step.assignee;

  await prisma.workflowStep.update({
    where: { id: stepId },
    data: { assigneeId: newAssigneeId },
  });

  await createInAppNotification(newAssigneeId, {
    title: `Dossier réaffecté — ${appNumber}`,
    message: `Le dossier ${appNumber} vous a été réaffecté.${comment ? ` Note : ${comment}` : ''}`,
    type: 'ACTION_REQUIRED',
    relatedType: 'workflow_step',
    relatedId: step.id,
    companyId,
  });

  if (oldAssignee && oldAssignee.id !== newAssigneeId) {
    await createInAppNotification(oldAssignee.id, {
      title: `Dossier réaffecté — ${appNumber}`,
      message: `Le dossier ${appNumber} a été réaffecté à ${newAssigneeName}.`,
      type: 'INFO',
      relatedType: 'workflow_step',
      relatedId: step.id,
      companyId,
    });
  }

  res.json({ success: true });
}));

// GET /api/codir/agents/:role
router.get('/agents/:role', authorize(['codir_dashboard']), asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.params;
  const companyId = req.companyId!;

  // Fetch all active members and filter by role in-memory (avoids PostgreSQL enum cast issue)
  const memberships = await prisma.companyMembership.findMany({
    where: { companyId, isActive: true },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { user: { name: 'asc' } },
  });

  const agents = memberships
    .filter(m => m.user.role === role)
    .map(m => ({ id: m.user.id, name: m.user.name, role: m.user.role }));

  res.json({ success: true, data: agents });
}));

export default router;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/codir.ts
git commit -m "feat(codir): route /api/codir avec dashboard, relance, escalade, réaffectation"
```

---

## Task 7: Mount route in server.ts

**Files:**
- Modify: `backend/src/server.ts`

- [ ] **Step 1: Import and mount the codir route**

In `backend/src/server.ts`, add import after the moduleProfileRoutes import:

```ts
import codirRoutes from './routes/codir';
```

Add mount after the scope-delegates line (`app.use('/api/scope-delegates', ...)`):

```ts
app.use('/api/codir', authenticate, codirRoutes);
```

- [ ] **Step 2: Verify TypeScript compiles and start server**

```bash
cd backend && npx tsc --noEmit
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat(server): monter /api/codir"
```

---

## Task 8: BottleneckKpiBar + Action Dialogs

**Files:**
- Create: `src/components/codir/BottleneckKpiBar.tsx`
- Create: `src/components/codir/RelanceDialog.tsx`
- Create: `src/components/codir/ReassignDialog.tsx`
- Create: `src/components/codir/EscaladeDialog.tsx`

- [ ] **Step 1: Create BottleneckKpiBar.tsx**

```tsx
import React from 'react';
import { Box, Card, CardContent, Typography, Chip } from '@mui/material';
import { StepKpi } from '../../types';

interface Props {
  kpis: StepKpi[];
  selectedStep: string | null;
  onSelectStep: (stepName: string | null) => void;
}

export const BottleneckKpiBar: React.FC<Props> = ({ kpis, selectedStep, onSelectStep }) => (
  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
    {kpis.map(k => {
      const isSelected = selectedStep === k.stepName;
      const hasOverdue = k.overdueCount > 0;
      return (
        <Card
          key={k.stepName}
          onClick={() => onSelectStep(isSelected ? null : k.stepName)}
          sx={{
            minWidth: 180, cursor: 'pointer', flex: '1 1 180px',
            borderLeft: `4px solid ${hasOverdue ? '#ef4444' : isSelected ? '#5c35b5' : '#e2e8f0'}`,
            boxShadow: isSelected ? 3 : 1,
            transition: 'box-shadow 0.15s',
            '&:hover': { boxShadow: 3 },
          }}
        >
          <CardContent sx={{ pb: '12px !important', pt: 1.5, px: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
              {k.stepLabel}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
              <Typography variant="h4" fontWeight={700}>{k.count}</Typography>
              <Typography variant="body2" color="text.secondary">dossier{k.count !== 1 ? 's' : ''}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
              {hasOverdue && (
                <Chip label={`${k.overdueCount} en retard`} size="small" color="error" sx={{ fontSize: '0.65rem', height: 20 }} />
              )}
              <Chip label={`moy. ${k.avgWaitHours}h`} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
            </Box>
          </CardContent>
        </Card>
      );
    })}
  </Box>
);
```

- [ ] **Step 2: Create RelanceDialog.tsx**

```tsx
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress } from '@mui/material';
import { PendingDecisionItem } from '../../types';
import { ApiService } from '../../services/api';

interface Props {
  item: PendingDecisionItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const RelanceDialog: React.FC<Props> = ({ item, onClose, onSuccess }) => {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const defaultMessage = item
    ? `Le dossier ${item.applicationNumber} — ${item.clientName} attend votre action depuis ${item.daysWaiting} jour(s). Merci de traiter ce dossier en priorité.`
    : '';

  const handleOpen = () => { setMessage(''); setSaving(false); };
  const handleSubmit = async () => {
    if (!item) return;
    setSaving(true);
    const res = await ApiService.codirRelance(item.stepId, message || defaultMessage);
    setSaving(false);
    if (res.success) { onSuccess(); onClose(); }
  };

  return (
    <Dialog open={!!item} onClose={onClose} maxWidth="sm" fullWidth TransitionProps={{ onEnter: handleOpen }}>
      <DialogTitle>Relancer — Dossier {item?.applicationNumber}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth multiline rows={4} sx={{ mt: 1 }}
          label="Message de relance"
          value={message || defaultMessage}
          onChange={e => setMessage(e.target.value)}
          placeholder={defaultMessage}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Annuler</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} /> : undefined}>
          Envoyer la relance
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

- [ ] **Step 3: Create ReassignDialog.tsx**

```tsx
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, CircularProgress, FormControl, InputLabel, Select, MenuItem, Typography,
} from '@mui/material';
import { PendingDecisionItem } from '../../types';
import { ApiService } from '../../services/api';

interface Props {
  item: PendingDecisionItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReassignDialog: React.FC<Props> = ({ item, onClose, onSuccess }) => {
  const [agents, setAgents] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);

  useEffect(() => {
    if (!item) return;
    setNewAssigneeId(''); setComment('');
    setLoadingAgents(true);
    ApiService.codirGetAgents(item.assignedRole).then(res => {
      if (res.success) setAgents((res.data ?? []).filter(a => a.id !== item.assigneeId));
      setLoadingAgents(false);
    });
  }, [item]);

  const handleSubmit = async () => {
    if (!item || !newAssigneeId) return;
    setSaving(true);
    const res = await ApiService.codirReassign(item.stepId, newAssigneeId, comment || undefined);
    setSaving(false);
    if (res.success) { onSuccess(); onClose(); }
  };

  return (
    <Dialog open={!!item} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Réaffecter — Dossier {item?.applicationNumber}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
        {loadingAgents ? <CircularProgress size={24} sx={{ alignSelf: 'center' }} /> : (
          <>
            {agents.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Aucun autre agent disponible pour le rôle {item?.assignedRole}.
              </Typography>
            )}
            <FormControl fullWidth size="small" disabled={agents.length === 0}>
              <InputLabel>Nouvel agent</InputLabel>
              <Select value={newAssigneeId} label="Nouvel agent" onChange={e => setNewAssigneeId(e.target.value)}>
                {agents.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth size="small" label="Commentaire (optionnel)" value={comment}
              onChange={e => setComment(e.target.value)} />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Annuler</Button>
        <Button variant="contained" onClick={handleSubmit}
          disabled={saving || !newAssigneeId || loadingAgents}
          startIcon={saving ? <CircularProgress size={14} /> : undefined}>
          Réaffecter
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

- [ ] **Step 4: Create EscaladeDialog.tsx**

```tsx
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, CircularProgress } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { PendingDecisionItem } from '../../types';
import { ApiService } from '../../services/api';

interface Props {
  item: PendingDecisionItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const EscaladeDialog: React.FC<Props> = ({ item, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!item) return;
    setSaving(true);
    const res = await ApiService.codirEscalade(item.stepId);
    setSaving(false);
    if (res.success) { onSuccess(); onClose(); }
  };

  return (
    <Dialog open={!!item} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="warning" />
        Escalader le dossier
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          Escalader le dossier <strong>{item?.applicationNumber}</strong> au niveau supérieur ?
          Cette action notifie le supérieur hiérarchique et marque le dossier comme escaladé de façon permanente.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Annuler</Button>
        <Button variant="contained" color="warning" onClick={handleSubmit} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} /> : undefined}>
          Confirmer l'escalade
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output

- [ ] **Step 6: Commit**

```bash
git add src/components/codir/
git commit -m "feat(codir): BottleneckKpiBar et dialogs Relance/Réaffectation/Escalade"
```

---

## Task 9: PendingDecisionsTable

**Files:**
- Create: `src/components/codir/PendingDecisionsTable.tsx`

- [ ] **Step 1: Create PendingDecisionsTable.tsx**

```tsx
import React, { useState } from 'react';
import {
  Box, Table, TableBody, TableCell, TableHead, TableRow, Paper,
  Chip, IconButton, Tooltip, Typography, FormControl, InputLabel,
  Select, MenuItem, Switch, FormControlLabel,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { PendingDecisionItem } from '../../types';
import { RelanceDialog } from './RelanceDialog';
import { ReassignDialog } from './ReassignDialog';
import { EscaladeDialog } from './EscaladeDialog';

interface Props {
  items: PendingDecisionItem[];
  stepFilter: string | null;
  onRefresh: () => void;
}

function SlaChip({ item }: { item: PendingDecisionItem }) {
  if (item.isOverdue) return <Chip label="En retard" color="error" size="small" />;
  if (item.deadline) {
    const h = (new Date(item.deadline).getTime() - Date.now()) / 3_600_000;
    if (h < 24) return <Chip label="< 24h" color="warning" size="small" />;
  }
  return <Chip label="Dans les délais" color="success" size="small" variant="outlined" />;
}

function fmtAmount(v: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);
}

export const PendingDecisionsTable: React.FC<Props> = ({ items, stepFilter, onRefresh }) => {
  const navigate = useNavigate();
  const [agentFilter, setAgentFilter]     = useState('all');
  const [overdueOnly, setOverdueOnly]     = useState(false);
  const [relanceItem, setRelanceItem]     = useState<PendingDecisionItem | null>(null);
  const [reassignItem, setReassignItem]   = useState<PendingDecisionItem | null>(null);
  const [escaladeItem, setEscaladeItem]   = useState<PendingDecisionItem | null>(null);

  const agents = Array.from(new Set(
    items.filter(i => i.assigneeName).map(i => i.assigneeId!)
  )).map(id => ({ id, name: items.find(i => i.assigneeId === id)!.assigneeName! }));

  const filtered = items.filter(item => {
    if (stepFilter && item.stepName !== stepFilter) return false;
    if (agentFilter !== 'all' && item.assigneeId !== agentFilter) return false;
    if (overdueOnly && !item.isOverdue) return false;
    return true;
  });

  return (
    <Box>
      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Agent</InputLabel>
          <Select value={agentFilter} label="Agent" onChange={e => setAgentFilter(e.target.value)}>
            <MenuItem value="all">Tous les agents</MenuItem>
            {agents.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControlLabel
          control={<Switch checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} size="small" />}
          label={<Typography variant="body2">En retard uniquement</Typography>}
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
          {filtered.length} dossier{filtered.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Table */}
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell><Typography variant="caption" fontWeight={600}>N° Dossier</Typography></TableCell>
              <TableCell><Typography variant="caption" fontWeight={600}>Client</Typography></TableCell>
              <TableCell><Typography variant="caption" fontWeight={600}>Montant</Typography></TableCell>
              <TableCell><Typography variant="caption" fontWeight={600}>Étape</Typography></TableCell>
              <TableCell><Typography variant="caption" fontWeight={600}>Agent assigné</Typography></TableCell>
              <TableCell><Typography variant="caption" fontWeight={600}>SLA</Typography></TableCell>
              <TableCell><Typography variant="caption" fontWeight={600}>Attente</Typography></TableCell>
              <TableCell align="right"><Typography variant="caption" fontWeight={600}>Actions</Typography></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">Aucun dossier en attente</Typography>
                </TableCell>
              </TableRow>
            ) : filtered.map(item => (
              <TableRow
                key={item.stepId}
                sx={{
                  bgcolor: item.isEscalated ? '#fff7ed' : item.isOverdue ? '#fef2f2' : 'inherit',
                  '&:hover': { bgcolor: item.isEscalated ? '#ffedd5' : item.isOverdue ? '#fee2e2' : '#f8fafc' },
                }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>{item.applicationNumber}</Typography>
                    {item.isEscalated && (
                      <Chip label="Escaladé" size="small" color="warning" sx={{ fontSize: '0.6rem', height: 18 }} />
                    )}
                    {item.lastRelancedAt && !item.isEscalated && (
                      <Chip label="Relancé" size="small" sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#f1f5f9' }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell><Typography variant="body2">{item.clientName}</Typography></TableCell>
                <TableCell><Typography variant="body2" noWrap>{fmtAmount(item.amount, item.currency)}</Typography></TableCell>
                <TableCell><Typography variant="body2">{item.stepLabel}</Typography></TableCell>
                <TableCell>
                  {item.assigneeName
                    ? <Typography variant="body2">{item.assigneeName}</Typography>
                    : <Typography variant="body2" color="text.disabled" fontStyle="italic">Non assigné</Typography>}
                </TableCell>
                <TableCell><SlaChip item={item} /></TableCell>
                <TableCell>
                  <Typography variant="body2" color={item.daysWaiting > 3 ? 'error' : 'text.secondary'}>
                    {item.daysWaiting}j
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Voir le dossier">
                    <IconButton size="small" onClick={() => navigate(`/workflow`)}>
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={item.assigneeId ? 'Relancer l\'agent' : 'Aucun agent assigné'}>
                    <span>
                      <IconButton size="small" disabled={!item.assigneeId} onClick={() => setRelanceItem(item)}>
                        <NotificationsActiveIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Réaffecter">
                    <IconButton size="small" onClick={() => setReassignItem(item)}>
                      <SwapHorizIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={item.isEscalated ? 'Déjà escaladé' : 'Escalader'}>
                    <span>
                      <IconButton size="small" color="warning" disabled={item.isEscalated}
                        onClick={() => setEscaladeItem(item)}>
                        <ReportProblemIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <RelanceDialog  item={relanceItem}  onClose={() => setRelanceItem(null)}  onSuccess={onRefresh} />
      <ReassignDialog item={reassignItem} onClose={() => setReassignItem(null)} onSuccess={onRefresh} />
      <EscaladeDialog item={escaladeItem} onClose={() => setEscaladeItem(null)} onSuccess={onRefresh} />
    </Box>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/components/codir/PendingDecisionsTable.tsx
git commit -m "feat(codir): PendingDecisionsTable avec filtres et actions inline"
```

---

## Task 10: CodirDashboardPage

**Files:**
- Create: `src/pages/CodirDashboardPage.tsx`

- [ ] **Step 1: Create CodirDashboardPage.tsx**

```tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, Alert, CircularProgress, Chip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { CodirDashboardData } from '../types';
import { ApiService } from '../services/api';
import { BottleneckKpiBar } from '../components/codir/BottleneckKpiBar';
import { PendingDecisionsTable } from '../components/codir/PendingDecisionsTable';

const REFRESH_INTERVAL = 60;

export const CodirDashboardPage: React.FC = () => {
  const [data, setData]           = useState<CodirDashboardData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [stepFilter, setStepFilter] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await ApiService.getCodirDashboard();
      if (res.success && res.data) setData(res.data);
      else setError(res.error || 'Erreur de chargement');
    } finally {
      if (!silent) setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { reload(true); return REFRESH_INTERVAL; }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [reload]);

  const totalPending = data?.items.length ?? 0;
  const totalOverdue = data?.items.filter(i => i.isOverdue).length ?? 0;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Tableau de Bord CODIR</Typography>
          <Typography variant="body2" color="text.secondary">
            Vue 360° des dossiers en attente — {totalPending} dossier{totalPending !== 1 ? 's' : ''}
            {totalOverdue > 0 && ` — `}
            {totalOverdue > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>{totalOverdue} en retard</span>}
          </Typography>
        </Box>
        <Chip
          icon={<RefreshIcon fontSize="small" />}
          label={`Actualisation dans ${countdown}s`}
          size="small"
          variant="outlined"
          onClick={() => reload()}
          sx={{ cursor: 'pointer' }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : data ? (
        <>
          <BottleneckKpiBar
            kpis={data.kpis}
            selectedStep={stepFilter}
            onSelectStep={setStepFilter}
          />
          <PendingDecisionsTable
            items={data.items}
            stepFilter={stepFilter}
            onRefresh={() => reload(true)}
          />
        </>
      ) : null}
    </Box>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/pages/CodirDashboardPage.tsx
git commit -m "feat(codir): CodirDashboardPage avec KPI bar + table + auto-refresh 60s"
```

---

## Task 11: App.tsx + Sidebar wiring

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add lazy import and Route in App.tsx**

In `src/App.tsx`, add the lazy import after the last lazy import block:

```ts
const CodirDashboardPage = lazy(() => import('./pages/CodirDashboardPage').then(m => ({ default: m.CodirDashboardPage })));
```

Add the route inside the authenticated `<Routes>` block (after the `/approvals` route):

```tsx
<Route path="/codir-dashboard" element={<CodirDashboardPage />} />
```

- [ ] **Step 2: Add canViewCodir and NavItem in Sidebar.tsx**

In `src/components/Sidebar.tsx`, after the line `const canViewCreditPolicy = ...` (around line 137), add:

```ts
const canViewCodir = (hasPermission('codir_dashboard') || isAdmin) && canAccess('codir-dashboard');
```

Then add the NavItem in the sidebar JSX. Add a "Direction" section before the "Support" section:

```tsx
{canViewCodir && (
  <>
    <StaticLabel label="Direction" />
    <List disablePadding sx={{ px: 0.5 }}>
      <NavItem id="codir-dashboard" label="Tableau de Bord CODIR" icon={InsightsIcon} />
    </List>
  </>
)}
```

Place this block just before the `{/* Support */}` comment (around line 658).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output

- [ ] **Step 4: Verify frontend builds**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ built in` (no errors)

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/Sidebar.tsx
git commit -m "feat(codir): intégrer CodirDashboardPage dans la navigation"
```

---

## Task 12: End-to-end verification

- [ ] **Step 1: Start backend and apply migration**

```bash
cd backend && npx prisma migrate deploy
# Verify: "1 migration applied successfully"
```

- [ ] **Step 2: Start frontend dev server**

```bash
npm run dev
```

- [ ] **Step 3: Log in as a user with codir_dashboard permission (ADMIN or configured role)**

Navigate to `/codir-dashboard`. Verify:
- KPI bar shows per-step counts
- Table shows pending dossiers with agent, SLA chip, days waiting
- Clicking a KPI card filters the table
- "Relancer" opens dialog with pre-filled message, editable, sends notification
- "Réaffecter" shows agent dropdown for the correct role
- "Escalader" shows confirmation dialog, marks row as "Escaladé", disables button

- [ ] **Step 4: Final commit and push**

```bash
git push origin feature/codir-dashboard
```
