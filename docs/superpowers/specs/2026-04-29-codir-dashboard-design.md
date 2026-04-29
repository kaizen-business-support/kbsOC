# Tableau de Bord CODIR — Decision Support Dashboard — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Provide the executive committee (CODIR) with a real-time operational dashboard to identify workflow bottlenecks, hold individuals accountable, and take corrective actions (relance, reassignment, escalation) directly from the interface.

**Context:** OptimusCredit multi-tenant banking SaaS. Credit applications flow through a configurable approval workflow (WorkflowStep records linked to CreditApplication). Each step has an assigned agent, an SLA deadline, and an overdue flag. The CODIR currently has no centralized view of who is blocking which files or where the circuit is structurally congested.

---

## 1. Users & Access

Access is controlled by the module profile system (`moduleRegistry` + `useModuleAccess` hook), not hardcoded role checks. The CODIR dashboard is registered as module key `codir-dashboard`. Administrators configure per-role access via the module profiles UI. No role is hardcoded to have or not have access.

---

## 2. Page Layout

New page `CodirDashboardPage` at PageType `codir-dashboard`. Two visual zones stacked vertically.

### Zone 1 — Bottleneck KPI Bar

A horizontal row of cards, one per active workflow step type present in the data. Each card displays:
- Step label (e.g. "Comité de Crédit")
- Count of pending WorkflowSteps at this stage
- Count of overdue WorkflowSteps (red badge)
- Average wait time in hours

Cards with at least one overdue step use a red left border. Cards with zero pending steps are dimmed. Clicking a card filters Zone 2 to show only that step's items.

### Zone 2 — Pending Decisions Table

A paginated table where each row is one WorkflowStep in status `PENDING` or `IN_REVIEW` whose application is not yet `APPROVED`, `REJECTED`, or `DISBURSED`.

**Columns:**
| Column | Content |
|--------|---------|
| N° Dossier | applicationNumber, links to workflow detail |
| Client | clientName |
| Montant | amount + currency, formatted |
| Étape | stepLabel (e.g. "Analyse Risques") |
| Agent assigné | assigneeName + role chip. "Non assigné" if null |
| SLA | Chip: Vert (dans les délais) / Orange (< 24h restantes) / Rouge (overdue). Shows daysWaiting |
| Escaladé | Badge "Escaladé" if isEscalated = true |
| Actions | Three icon buttons: Relancer, Réaffecter, Escalader |

**Filters (above table):**
- Par étape (dropdown, synced with KPI bar click)
- Par agent (dropdown, list of currently assigned agents)
- En retard seulement (toggle)

**Sort:** Default by isOverdue DESC, then deadline ASC, then createdAt ASC (most urgent first).

**Auto-refresh:** Every 60 seconds. A countdown chip shows time to next refresh.

---

## 3. Actions

### 3.1 Relancer

Triggered by the "Relancer" button on a row. Opens a dialog:
- Pre-filled message: `"Le dossier [applicationNumber] — [clientName] attend votre action depuis [daysWaiting] jour(s). Merci de traiter ce dossier en priorité."`
- User can edit the message freely.
- Submit button: "Envoyer la relance"

On submit: calls `POST /api/codir/relance/:stepId` with `{ message }`. Backend creates a notification of type `STEP_PENDING_REMINDER` for the assigned agent. The row shows a "Relancé" chip (grey) with the timestamp of the last relance. A step can be relanced multiple times.

If the step has no assigned agent, the Relancer button is disabled with tooltip "Aucun agent assigné".

### 3.2 Réaffecter

Triggered by the "Réaffecter" button. Opens a dialog:
- Title: "Réaffecter le dossier [applicationNumber]"
- Dropdown: list of active users with the same role as the current step's `assignedRole`, excluding the current assignee.
- Optional comment field.
- Submit button: "Réaffecter"

On submit: calls `PUT /api/codir/reassign/:stepId` with `{ newAssigneeId, comment }`. Backend updates `workflowStep.assigneeId`. Sends a `STEP_ASSIGNED` notification to the new assignee, and an informational notification to the previous assignee if one existed. The table row updates immediately.

### 3.3 Escalader

Triggered by the "Escalader" button. Opens a confirmation dialog:
- Text: "Escalader le dossier [applicationNumber] au niveau supérieur ? Cette action notifie le supérieur hiérarchique et marque le dossier comme escaladé."
- Submit button: "Confirmer l'escalade"

On submit: calls `POST /api/codir/escalade/:stepId`. Backend:
1. Sets `workflowStep.isEscalated = true`, `escalatedAt = now()`, `escalatedById = currentUserId`
2. Determines the supervisor role (see §6 Role Hierarchy)
3. Sends a notification to all active users in the company with the supervisor role: `"Le dossier [applicationNumber] a été escaladé par la direction. Étape bloquante : [stepLabel] — Agent : [assigneeName]."`
4. Returns updated step data.

The "Escalader" button becomes disabled once `isEscalated = true` (cannot escalate twice). The row shows a permanent "Escaladé" badge.

---

## 4. Backend API

New route file: `backend/src/routes/codir.ts`. Mounted at `/api/codir`. Protected by `requireAuth` + a `requireCodirAccess` middleware that checks `user.permissions` includes `codir_dashboard` (derived from the module profile system).

### GET /api/codir/dashboard

Returns the full dashboard data in a single request.

**Response:**
```ts
{
  success: true,
  data: {
    kpis: StepKpi[];
    items: PendingDecisionItem[];
  }
}
```

**StepKpi:**
```ts
{
  stepName: string;        // e.g. "credit_committee_review"
  stepLabel: string;       // e.g. "Comité de Crédit"
  role: string;            // e.g. "COMITE_CREDIT"
  count: number;           // total pending at this step
  overdueCount: number;    // steps past deadline
  avgWaitHours: number;    // average hours since step created
}
```

**PendingDecisionItem:**
```ts
{
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
  createdAt: string;           // ISO
  deadline: string | null;     // ISO
  isOverdue: boolean;
  daysWaiting: number;
  isEscalated: boolean;
  escalatedAt: string | null;
  lastRelancedAt: string | null;
}
```

**Query logic:** `WorkflowStep WHERE status IN (PENDING, IN_REVIEW)`, joined with `CreditApplication WHERE status IN (SUBMITTED, UNDER_REVIEW)`, with `User` for assignee name and `Client` for client name.

### POST /api/codir/relance/:stepId

Body: `{ message: string }`

Creates a notification for the assigned agent. Stores `lastRelancedAt` as a derived value (from the notification timestamp — no new DB column needed). Returns `{ success: true }`.

### POST /api/codir/escalade/:stepId

No body required. Sets escalation fields on the WorkflowStep. Finds supervisor role via the static hierarchy map. Sends notifications to all users of that role in the company. Returns the updated `PendingDecisionItem`.

### PUT /api/codir/reassign/:stepId

Body: `{ newAssigneeId: string, comment?: string }`

Validates that `newAssigneeId` exists, is active, and belongs to the same company. Validates their role matches `workflowStep.role`. Updates `workflowStep.assigneeId`. Creates notifications. Returns updated `PendingDecisionItem`.

### GET /api/codir/agents/:role

Returns active users of the given role in the current user's company.

```ts
{ success: true, data: Array<{ id: string; name: string; role: string }> }
```

---

## 5. Database Migration

Add 3 fields to `WorkflowStep`:

```prisma
isEscalated    Boolean   @default(false) @map("is_escalated")
escalatedAt    DateTime? @map("escalated_at")
escalatedById  String?   @map("escalated_by_id")
```

No foreign key on `escalatedById` (user might be deleted). Stored as plain string.

---

## 6. Role Hierarchy (Escalation)

Static map used by the backend to determine the supervisor role for escalation notifications:

```ts
const SUPERVISOR_ROLE: Record<string, string> = {
  CHARGE_AFFAIRES:          'ANALYSTE_RISQUES',
  ANALYSTE_RISQUES:         'RESPONSABLE_RISQUES',
  RESPONSABLE_RISQUES:      'RESPONSABLE_ENGAGEMENTS',
  RESPONSABLE_ENGAGEMENTS:  'COMITE_CREDIT',
  COMITE_CREDIT:            'DIRECTION_GENERALE',
  DIRECTION_GENERALE:       'DIRECTION_GENERALE', // notifie la DG elle-même
  DIRECTION_JURIDIQUE:      'DIRECTION_GENERALE',
  BACK_OFFICE:              'RESPONSABLE_ENGAGEMENTS',
};
```

---

## 7. Module Registry & Navigation

**moduleRegistry.ts:** Add entry:
```ts
{
  key: 'codir-dashboard',
  label: 'Tableau de Bord CODIR',
  actions: [
    { key: 'relance', label: 'Relancer un agent' },
    { key: 'reassign', label: 'Réaffecter un dossier' },
    { key: 'escalade', label: 'Escalader un dossier' },
  ],
  sections: [],
}
```

**Permission derived:** `codir_dashboard` (view), `codir_relance`, `codir_reassign`, `codir_escalade`

**PageType:** Add `'codir-dashboard'` to the union.

**Sidebar:** New `NavItem` in a "Direction" section (or top-level), visible only when `useModuleAccess('codir-dashboard').canView`.

**App.tsx:** Add route rendering `CodirDashboardPage` when `currentPage === 'codir-dashboard'`.

---

## 8. Frontend Components

```
src/pages/CodirDashboardPage.tsx          — page shell, data fetch, auto-refresh
src/components/codir/BottleneckKpiBar.tsx — KPI cards row (Zone 1)
src/components/codir/PendingDecisionsTable.tsx — main table with filters (Zone 2)
src/components/codir/RelanceDialog.tsx    — relance dialog with editable message
src/components/codir/ReassignDialog.tsx   — reassign dialog with agent picker
src/components/codir/EscaladeDialog.tsx   — escalation confirmation dialog
```

`CodirDashboardPage` fetches `/api/codir/dashboard` on mount and every 60 seconds. Passes `kpis` to `BottleneckKpiBar` and `items` to `PendingDecisionsTable`. Each action dialog calls its API endpoint and triggers a re-fetch on success.

---

## 9. Out of Scope

- Export CSV/PDF of the dashboard (future)
- Historical bottleneck trends / analytics over time (future — use AnalyticsDashboardPage)
- Bulk actions (relance all in a step at once) — future
- Push notifications / email for relance — current system uses in-app notifications only
