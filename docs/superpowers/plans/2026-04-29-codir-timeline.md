# CODIR Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un onglet "Timeline" au tableau de bord CODIR affichant un stepper horizontal animé par dossier (toutes les étapes, durées, agents, dates), avec un filtre par agence (agence client ou agence CA) global aux deux onglets.

**Architecture:** Nouveau endpoint `GET /api/codir/timeline` qui retourne les dossiers en attente avec leur historique complet d'étapes. La page `CodirDashboardPage` est enrichie de Tabs MUI (onglet Tableau + onglet Timeline) et d'un `AgenceFilter` contrôlé global. Le stepper est implémenté en flexbox custom avec animations `MUI Grow` séquentielles (délai 80ms par étape).

**Tech Stack:** React 18 + MUI v5, Express + Prisma 6 + PostgreSQL, TypeScript. Worktree: `.worktrees/feature-codir-dashboard` — branche `feature/codir-dashboard`.

**Spec:** `docs/superpowers/specs/2026-04-29-codir-timeline-design.md`

---

## File Map

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `backend/prisma/schema.prisma` | Modify | Ajouter `branch String?` au model `Client` |
| `backend/prisma/migrations/20260430000000_add_client_branch/migration.sql` | Create | ALTER TABLE clients ADD COLUMN branch |
| `backend/src/routes/codir.ts` | Modify | Ajouter `GET /timeline` + ajouter `clientBranch`/`creatorBranch` à `/dashboard` |
| `src/types/index.ts` | Modify | Ajouter `TimelineStep`, `ApplicationTimeline`, `CodirTimelineData` + mettre à jour `PendingDecisionItem` |
| `src/services/api.ts` | Modify | Ajouter `getCodirTimeline()` |
| `src/components/codir/AgenceFilter.tsx` | Create | Toggle type + dropdown agence (composant contrôlé) |
| `src/components/codir/ApplicationTimelineCard.tsx` | Create | Carte stepper animée par dossier |
| `src/components/codir/CodirTimelineTab.tsx` | Create | Conteneur + filtrage de la liste timeline |
| `src/pages/CodirDashboardPage.tsx` | Modify | Tabs MUI + état agenceFilter + chargement timeline |

---

## Task 1: Migration DB — Client.branch

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260430000000_add_client_branch/migration.sql`

- [ ] **Step 1: Ajouter `branch String?` au model Client dans schema.prisma**

Lire `backend/prisma/schema.prisma`. Trouver `model Client` (ligne ~120). Après le champ `companyName String @map("company_name")`, ajouter :

```prisma
  branch      String?   @map("branch")
```

- [ ] **Step 2: Créer la migration SQL**

```bash
mkdir -p backend/prisma/migrations/20260430000000_add_client_branch
```

Créer `backend/prisma/migrations/20260430000000_add_client_branch/migration.sql` :

```sql
-- Migration: ajouter le champ agence sur les clients

ALTER TABLE "clients" ADD COLUMN "branch" TEXT;
```

- [ ] **Step 3: Régénérer le client Prisma**

```bash
cd backend && npx prisma generate
```

Attendu : `✔ Generated Prisma Client`

- [ ] **Step 4: Appliquer la migration (environnement de développement)**

> `prisma migrate deploy` est réservé à la production. En dev, appliquer directement le SQL puis marquer la migration comme appliquée :

```bash
cd backend && npx prisma db execute --file prisma/migrations/20260430000000_add_client_branch/migration.sql --schema prisma/schema.prisma
cd backend && npx prisma migrate resolve --applied 20260430000000_add_client_branch
```

Attendu : aucune erreur — la colonne `branch` existe maintenant dans `clients`.

- [ ] **Step 5: Vérifier TypeScript backend**

```bash
cd backend && npx tsc --noEmit
```

Attendu : aucune sortie (0 erreurs)

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260430000000_add_client_branch/
git commit -m "feat(db): ajouter champ branch sur les clients"
```

---

## Task 2: Types TypeScript frontend

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Ajouter `clientBranch` et `creatorBranch` à `PendingDecisionItem`**

Lire `src/types/index.ts`. Trouver l'interface `PendingDecisionItem`. Ajouter après `lastRelancedAt`:

```ts
  clientBranch?: string | null;
  creatorBranch?: string | null;
```

> Ces champs sont **optionnels** (`?`) pour éviter une rupture de contrat TypeScript entre le moment où les types sont mis à jour (Task 2) et celui où le backend les retourne (Task 3). Une fois Task 3 déployé, les deux champs seront toujours présents — mais ils resteront optionnels dans le type car cela n'affecte pas la sécurité du filtre (la vérification `=== agenceValue` retourne `false` si le champ est `undefined`, comportement correct).

- [ ] **Step 2: Ajouter les 3 nouveaux interfaces en bas du fichier**

```ts
export interface TimelineStep {
  stepName: string;
  stepLabel: string;
  order: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
  agentName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationHours: number | null;
  isSlaBroken: boolean;
}

export interface ApplicationTimeline {
  applicationId: string;
  applicationNumber: string;
  clientName: string;
  clientBranch: string | null;
  amount: number;
  currency: string;
  creatorName: string;
  creatorBranch: string | null;
  isOverdue: boolean;
  daysWaiting: number;
  isEscalated: boolean;
  steps: TimelineStep[];
}

export interface CodirTimelineData {
  agences: { client: string[]; ca: string[] };
  applications: ApplicationTimeline[];
}
```

- [ ] **Step 3: Vérifier TypeScript frontend**

```bash
npx tsc --noEmit
```

Attendu : aucune sortie

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): ajouter TimelineStep, ApplicationTimeline, CodirTimelineData"
```

---

## Task 3: Backend — enrichir /dashboard + créer /timeline

**Files:**
- Modify: `backend/src/routes/codir.ts`

- [ ] **Step 1: Enrichir la réponse de `GET /dashboard` avec `clientBranch` et `creatorBranch`**

Lire `backend/src/routes/codir.ts`. Trouver le handler `GET /dashboard`.

La requête existante est un `prisma.workflowStep.findMany` avec `application.include.client`. Il faut y ajouter `creator` dans le même `application.include` :

```ts
application: {
  include: {
    client: { select: { name: true } },    // déjà présent — companyName dans le vrai schéma
    creator: { select: { branch: true } }, // ajouter ici
  }
},
```

> Note : le `creator` est nested sous `application`, pas au niveau de `workflowStep`. Le type retourné par Prisma pour cette include combinée n'inclut pas `creator` dans le type statique — utiliser `(step.application as any).creator` pour éviter l'erreur TypeScript (pattern déjà en place dans ce fichier via `as any` pour d'autres champs).

Dans le `items.map`, ajouter les deux champs :

```ts
    clientBranch: (step.application.client as any)?.branch ?? null,
    creatorBranch: (step.application as any).creator?.branch ?? null,
```

- [ ] **Step 2: Ajouter le endpoint `GET /timeline`**

Après le dernier handler dans `codir.ts`, ajouter :

```ts
// GET /api/codir/timeline
router.get('/timeline', authorize(['codir_dashboard']), asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId!;

  const applications = await prisma.creditApplication.findMany({
    where: {
      companyId,
      status: { notIn: ['APPROVED', 'REJECTED', 'DISBURSED'] },
      workflowSteps: { some: { status: { in: ['PENDING', 'IN_REVIEW'] } } },
    },
    include: {
      client:   { select: { companyName: true, branch: true } },
      creator:  { select: { name: true, branch: true } },
      policy: {
        include: {
          steps: {
            orderBy: { order: 'asc' },
            select: { id: true, stepName: true, stepLabel: true, order: true, maxDurationHours: true },
            // stepRoles intentionnellement omis — non utilisé par buildStep
          },
        },
      },
      workflowSteps: {
        include: { assignee: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const now = Date.now();

  const mappedApps = applications.map(app => {
    const wfSteps = app.workflowSteps;

    // Calculer isOverdue et daysWaiting sur l'ensemble des étapes en attente
    const oldestPendingStep = wfSteps
      .filter(s => s.status === 'PENDING' || s.status === 'IN_REVIEW')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    const daysWaiting = oldestPendingStep
      ? Math.floor((now - oldestPendingStep.createdAt.getTime()) / 86_400_000)
      : 0;
    const isOverdue = wfSteps.some(s => s.isOverdue);

    // Construire la liste des étapes ordonnées
    let steps: any[];

    if (!app.policy) {
      // Pas de politique : utiliser les workflowSteps bruts
      steps = wfSteps.map((ws, idx) => buildStep(ws, null, idx + 1, now));
    } else {
      // Croiser PolicyStep (ordre théorique) avec WorkflowStep réel via policyStepId
      steps = app.policy.steps.map(ps => {
        const ws = wfSteps.find(w => w.policyStepId === ps.id) ?? null;
        return buildStep(ws, ps, ps.order, now);
      });
    }

    return {
      applicationId:   app.id,
      applicationNumber: app.applicationNumber,
      clientName:      app.client.companyName,
      clientBranch:    app.client.branch ?? null,
      amount:          Number(app.amount),
      currency:        app.currency,
      creatorName:     app.creator.name,
      creatorBranch:   app.creator.branch ?? null,
      isOverdue,
      daysWaiting,
      isEscalated:     wfSteps.some(s => s.isEscalated),
      steps,
    };
  });

  // Tri : overdue en premier, puis daysWaiting desc
  mappedApps.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return b.daysWaiting - a.daysWaiting;
  });

  // Listes d'agences (sans null)
  const clientBranches = [...new Set(mappedApps.map(a => a.clientBranch).filter(Boolean))] as string[];
  const caBranches     = [...new Set(mappedApps.map(a => a.creatorBranch).filter(Boolean))] as string[];

  res.json({ success: true, data: { agences: { client: clientBranches, ca: caBranches }, applications: mappedApps } });
}));

function buildStep(ws: any | null, ps: any | null, order: number, now: number) {
  const stepLabel = ps?.stepLabel ?? ws?.stepName ?? `Étape ${order}`;
  const stepName  = ps?.stepName ?? ws?.stepName ?? `step_${order}`;
  const maxDurationHours = ps?.maxDurationHours ?? 72;

  let status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
  let durationHours: number | null = null;
  let isSlaBroken = false;

  if (!ws) {
    status = 'PENDING';
  } else if (['COMPLETED', 'APPROVED', 'REJECTED'].includes(ws.status)) {
    status = 'COMPLETED';
    if (ws.durationMinutes != null) {
      durationHours = ws.durationMinutes / 60;
    } else if (ws.completedAt && ws.startedAt) {
      durationHours = (ws.completedAt.getTime() - ws.startedAt.getTime()) / 3_600_000;
    }
  } else {
    // WorkflowStep existe mais pas encore complété → étape active, afficher comme IN_PROGRESS
    // Ne pas confondre avec le display 'PENDING' qui signifie qu'aucun WorkflowStep n'existe du tout
    status = 'IN_PROGRESS';
    const from = (ws.startedAt ?? ws.createdAt).getTime();
    durationHours = (now - from) / 3_600_000;
    isSlaBroken   = durationHours > maxDurationHours;
  }

  return {
    stepName,
    stepLabel,
    order,
    status,
    agentName:    ws?.assignee?.name ?? null,
    startedAt:    ws?.startedAt?.toISOString() ?? null,
    completedAt:  ws?.completedAt?.toISOString() ?? null,
    durationHours: durationHours != null ? Math.round(durationHours * 10) / 10 : null,
    isSlaBroken,
  };
}
```

- [ ] **Step 3: Vérifier TypeScript backend**

```bash
cd backend && npx tsc --noEmit
```

Attendu : aucune sortie

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/codir.ts
git commit -m "feat(codir): endpoint GET /timeline + clientBranch/creatorBranch sur /dashboard"
```

---

## Task 4: API service frontend

**Files:**
- Modify: `src/services/api.ts`

- [ ] **Step 1: Ajouter l'import de `CodirTimelineData`**

Lire la ligne d'import en haut de `src/services/api.ts` (ligne 2). Ajouter `CodirTimelineData` à l'import depuis `'../types'` :

```ts
import { AnalysisData, FileUploadResult, ApiResponse, ApprovalItem, CodirDashboardData, CodirTimelineData } from '../types';
```

- [ ] **Step 2: Ajouter la méthode `getCodirTimeline()` dans la section CODIR**

Après `codirGetAgents`, ajouter :

```ts
  static async getCodirTimeline(): Promise<ApiResponse<CodirTimelineData>> {
    try {
      const response = await api.get('/codir/timeline');
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur chargement timeline CODIR' };
    }
  }
```

- [ ] **Step 3: Vérifier TypeScript frontend**

```bash
npx tsc --noEmit
```

Attendu : aucune sortie

- [ ] **Step 4: Commit**

```bash
git add src/services/api.ts
git commit -m "feat(api): ajouter getCodirTimeline()"
```

---

## Task 5: AgenceFilter component

**Files:**
- Create: `src/components/codir/AgenceFilter.tsx`

- [ ] **Step 1: Créer le fichier**

```tsx
import React from 'react';
import {
  Box, ToggleButtonGroup, ToggleButton, FormControl,
  InputLabel, Select, MenuItem, Typography,
} from '@mui/material';

interface Props {
  agences: { client: string[]; ca: string[] };
  type: 'client' | 'ca';
  value: string;
  onChange: (type: 'client' | 'ca', value: string) => void;
}

export const AgenceFilter: React.FC<Props> = ({ agences, type, value, onChange }) => {
  const options = type === 'client' ? agences.client : agences.ca;

  const handleTypeChange = (_: React.MouseEvent<HTMLElement>, newType: 'client' | 'ca' | null) => {
    if (!newType) return;
    onChange(newType, 'all');
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <ToggleButtonGroup
        size="small"
        value={type}
        exclusive
        onChange={handleTypeChange}
        sx={{ height: 32 }}
      >
        <ToggleButton value="client" sx={{ px: 1.5, fontSize: '0.75rem' }}>
          Agence client
        </ToggleButton>
        <ToggleButton value="ca" sx={{ px: 1.5, fontSize: '0.75rem' }}>
          Agence CA
        </ToggleButton>
      </ToggleButtonGroup>

      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel sx={{ fontSize: '0.8rem' }}>Agence</InputLabel>
        <Select
          value={value}
          label="Agence"
          onChange={e => onChange(type, e.target.value)}
          sx={{ fontSize: '0.8rem', height: 32 }}
        >
          <MenuItem value="all">
            <Typography variant="body2">Toutes les agences</Typography>
          </MenuItem>
          {options.map(agence => (
            <MenuItem key={agence} value={agence}>
              <Typography variant="body2">{agence}</Typography>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Attendu : aucune sortie

- [ ] **Step 3: Commit**

```bash
git add src/components/codir/AgenceFilter.tsx
git commit -m "feat(codir): composant AgenceFilter contrôlé (toggle type + dropdown)"
```

---

## Task 6: ApplicationTimelineCard component

**Files:**
- Create: `src/components/codir/ApplicationTimelineCard.tsx`

- [ ] **Step 1: Créer le fichier**

```tsx
import React from 'react';
import { Box, Card, CardContent, Typography, Chip, Grow } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { ApplicationTimeline, TimelineStep } from '../../types';

// Animation pulse pour l'étape en cours
const pulseKeyframes = `
  @keyframes codir-pulse {
    0%   { transform: scale(1); opacity: 1; }
    50%  { transform: scale(1.18); opacity: 0.75; }
    100% { transform: scale(1); opacity: 1; }
  }
`;

function fmtDuration(h: number | null): string {
  if (h === null) return '—';
  if (h < 1) return '< 1h';
  if (h < 24) return `${Math.round(h)}h`;
  const days = Math.floor(h / 24);
  const rem  = Math.round(h % 24);
  return rem > 0 ? `${days}j ${rem}h` : `${days}j`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}h`;
}

function fmtAmount(v: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);
}

function StepIcon({ status, isSlaBroken }: { status: TimelineStep['status']; isSlaBroken: boolean }) {
  if (status === 'COMPLETED') return <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 22 }} />;
  if (status === 'IN_PROGRESS') return (
    <RadioButtonCheckedIcon
      sx={{
        color: '#5c35b5',
        fontSize: 22,
        animation: 'codir-pulse 1.5s ease-in-out infinite',
        ...(isSlaBroken && { color: '#ef4444' }),
      }}
    />
  );
  return <RadioButtonUncheckedIcon sx={{ color: '#cbd5e1', fontSize: 22 }} />;
}

function Connector({ status }: { status: TimelineStep['status'] }) {
  const isCompleted = status === 'COMPLETED';
  return (
    <Box
      sx={{
        flex: 1,
        height: 2,
        background: isCompleted
          ? '#22c55e'
          : 'repeating-linear-gradient(90deg, #cbd5e1 0 4px, transparent 4px 8px)',
        mt: '10px',
      }}
    />
  );
}

interface Props {
  application: ApplicationTimeline;
}

export const ApplicationTimelineCard: React.FC<Props> = ({ application }) => {
  const { steps, applicationNumber, clientName, clientBranch, amount, currency,
          creatorName, creatorBranch, isOverdue, daysWaiting, isEscalated } = application;

  return (
    <>
      <style>{pulseKeyframes}</style>
      <Card
        variant="outlined"
        sx={{
          mb: 2,
          borderLeft: `4px solid ${isOverdue ? '#ef4444' : isEscalated ? '#f97316' : '#e2e8f0'}`,
        }}
      >
        <CardContent sx={{ pb: '12px !important' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2" fontWeight={700}>{applicationNumber}</Typography>
                <Typography variant="body2" color="text.secondary">•</Typography>
                <Typography variant="body2" fontWeight={600}>{clientName}</Typography>
                <Typography variant="body2" color="text.secondary">•</Typography>
                <Typography variant="body2">{fmtAmount(amount, currency)}</Typography>
                {isOverdue && <Chip label={`En retard — ${daysWaiting}j`} size="small" color="error" sx={{ height: 20, fontSize: '0.65rem' }} />}
                {isEscalated && !isOverdue && <Chip label="Escaladé" size="small" color="warning" sx={{ height: 20, fontSize: '0.65rem' }} />}
              </Box>
              <Typography variant="caption" color="text.secondary">
                Agence client : {clientBranch ?? '—'}
                {' • '}
                CA : {creatorName}{creatorBranch ? ` (${creatorBranch})` : ''}
              </Typography>
            </Box>
          </Box>

          {/* Stepper */}
          <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', minWidth: steps.length * 140 }}>
              {steps.map((step, idx) => (
                <React.Fragment key={step.stepName}>
                  {/* timeout = durée de l'animation ; transitionDelay = délai avant départ (effet séquentiel) */}
                  <Grow in timeout={300} style={{ transitionDelay: `${idx * 80}ms` }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 120, px: 0.5 }}>
                      {/* Icône + connecteur horizontal */}
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        {idx > 0 && <Connector status={steps[idx - 1].status} />}
                        <StepIcon status={step.status} isSlaBroken={step.isSlaBroken} />
                        {idx < steps.length - 1 && <Connector status={step.status} />}
                      </Box>

                      {/* Infos étape */}
                      <Box sx={{ textAlign: 'center', mt: 0.75, px: 0.25 }}>
                        <Typography variant="caption" fontWeight={600} display="block" sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'text.secondary' }}>
                          {step.stepLabel}
                        </Typography>
                        <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', mt: 0.25 }}>
                          {step.agentName ?? <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>}
                        </Typography>
                        {step.durationHours !== null && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25, mt: 0.25 }}>
                            {step.isSlaBroken && <WarningAmberIcon sx={{ fontSize: 11, color: '#ef4444' }} />}
                            <Typography
                              variant="caption"
                              sx={{ fontSize: '0.68rem', color: step.isSlaBroken ? '#ef4444' : 'text.secondary', fontWeight: step.isSlaBroken ? 700 : 400 }}
                            >
                              {fmtDuration(step.durationHours)}
                            </Typography>
                          </Box>
                        )}
                        {step.startedAt && (
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.63rem', color: '#94a3b8', mt: 0.25 }}>
                            {fmtDate(step.startedAt)}
                            {step.completedAt
                              ? ` → ${fmtDate(step.completedAt)}`
                              : step.status === 'IN_PROGRESS' ? ' → en cours' : ''}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Grow>
                </React.Fragment>
              ))}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </>
  );
};
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Attendu : aucune sortie

- [ ] **Step 3: Commit**

```bash
git add src/components/codir/ApplicationTimelineCard.tsx
git commit -m "feat(codir): ApplicationTimelineCard — stepper animé par dossier"
```

---

## Task 7: CodirTimelineTab component

**Files:**
- Create: `src/components/codir/CodirTimelineTab.tsx`

- [ ] **Step 1: Créer le fichier**

```tsx
import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import { ApplicationTimeline } from '../../types';
import { ApplicationTimelineCard } from './ApplicationTimelineCard';

interface Props {
  applications: ApplicationTimeline[];
  agenceType: 'client' | 'ca';
  agenceValue: string;
}

export const CodirTimelineTab: React.FC<Props> = ({ applications, agenceType, agenceValue }) => {
  const filtered = applications.filter(app => {
    if (agenceValue === 'all') return true;
    const branch = agenceType === 'client' ? app.clientBranch : app.creatorBranch;
    return branch === agenceValue;
  });

  const overdueCount = filtered.filter(a => a.isOverdue).length;

  return (
    <Box>
      {/* En-tête */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {filtered.length} dossier{filtered.length !== 1 ? 's' : ''} en attente
        </Typography>
        {overdueCount > 0 && (
          <Chip label={`${overdueCount} en retard`} size="small" color="error" sx={{ height: 20, fontSize: '0.65rem' }} />
        )}
      </Box>

      {/* Liste */}
      {filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <TimelineIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body2">Aucun dossier en attente pour ce filtre</Typography>
        </Box>
      ) : (
        filtered.map(app => (
          <ApplicationTimelineCard key={app.applicationId} application={app} />
        ))
      )}
    </Box>
  );
};
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Attendu : aucune sortie

- [ ] **Step 3: Commit**

```bash
git add src/components/codir/CodirTimelineTab.tsx
git commit -m "feat(codir): CodirTimelineTab — conteneur filtré de la liste timeline"
```

---

## Task 8: Refonte CodirDashboardPage — Tabs + AgenceFilter + Timeline

**Files:**
- Modify: `src/pages/CodirDashboardPage.tsx`

- [ ] **Step 1: Réécrire CodirDashboardPage.tsx**

Remplacer le contenu complet du fichier par :

```tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Alert, CircularProgress, Chip,
  Tabs, Tab,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { CodirDashboardData, CodirTimelineData } from '../types';
import { ApiService } from '../services/api';
import { BottleneckKpiBar } from '../components/codir/BottleneckKpiBar';
import { PendingDecisionsTable } from '../components/codir/PendingDecisionsTable';
import { AgenceFilter } from '../components/codir/AgenceFilter';
import { CodirTimelineTab } from '../components/codir/CodirTimelineTab';

const REFRESH_INTERVAL = 60;

export const CodirDashboardPage: React.FC = () => {
  const [dashData, setDashData]       = useState<CodirDashboardData | null>(null);
  const [timelineData, setTimelineData] = useState<CodirTimelineData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [activeTab, setActiveTab]     = useState(0);
  const [stepFilter, setStepFilter]   = useState<string | null>(null);
  const [agenceType, setAgenceType]   = useState<'client' | 'ca'>('client');
  const [agenceValue, setAgenceValue] = useState('all');
  const [countdown, setCountdown]     = useState(REFRESH_INTERVAL);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [dashRes, timelineRes] = await Promise.all([
        ApiService.getCodirDashboard(),
        ApiService.getCodirTimeline(),
      ]);
      if (dashRes.success && dashRes.data)         setDashData(dashRes.data);
      if (timelineRes.success && timelineRes.data) setTimelineData(timelineRes.data);
      if (!dashRes.success || !timelineRes.success)
        setError(dashRes.error || timelineRes.error || 'Erreur de chargement');
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

  const handleAgenceChange = (type: 'client' | 'ca', value: string) => {
    setAgenceType(type);
    setAgenceValue(value);
  };

  // Filtrage de l'onglet Tableau par agence
  const filteredItems = dashData?.items.filter(item => {
    if (agenceValue === 'all') return true;
    const branch = agenceType === 'client' ? item.clientBranch : item.creatorBranch;
    return branch === agenceValue;
  }) ?? [];

  const totalPending = filteredItems.length;
  const totalOverdue = filteredItems.filter(i => i.isOverdue).length;

  // Agences disponibles (union des deux sources)
  const agences = timelineData?.agences ?? { client: [], ca: [] };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Tableau de Bord CODIR</Typography>
          <Typography variant="body2" color="text.secondary">
            Vue 360° des dossiers en attente — {totalPending} dossier{totalPending !== 1 ? 's' : ''}
            {totalOverdue > 0 && ` — `}
            {totalOverdue > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>{totalOverdue} en retard</span>}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <AgenceFilter
            agences={agences}
            type={agenceType}
            value={agenceValue}
            onChange={handleAgenceChange}
          />
          <Chip
            icon={<RefreshIcon fontSize="small" />}
            label={`Actualisation dans ${countdown}s`}
            size="small"
            variant="outlined"
            onClick={() => reload()}
            sx={{ cursor: 'pointer' }}
          />
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Onglets */}
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Tab label="Tableau de décision" />
            <Tab label="Timeline" />
          </Tabs>

          {/* Onglet 0 — Tableau */}
          {activeTab === 0 && dashData && (
            <>
              <BottleneckKpiBar
                kpis={dashData.kpis}
                selectedStep={stepFilter}
                onSelectStep={setStepFilter}
              />
              <PendingDecisionsTable
                items={filteredItems}
                stepFilter={stepFilter}
                onRefresh={() => reload(true)}
              />
            </>
          )}

          {/* Onglet 1 — Timeline */}
          {activeTab === 1 && timelineData && (
            <CodirTimelineTab
              applications={timelineData.applications}
              agenceType={agenceType}
              agenceValue={agenceValue}
            />
          )}
        </>
      )}
    </Box>
  );
};
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Attendu : aucune sortie

- [ ] **Step 3: Build de production**

```bash
npm run build 2>&1 | tail -10
```

Attendu : `✓ built in` ou `Compiled successfully` (aucune erreur)

- [ ] **Step 4: Commit**

```bash
git add src/pages/CodirDashboardPage.tsx
git commit -m "feat(codir): refonte CodirDashboardPage — onglets + filtre agence + timeline"
```

---

## Task 9: Vérification end-to-end

- [ ] **Step 1: Vérifier TypeScript frontend complet**

```bash
npx tsc --noEmit
```

Attendu : 0 erreur

- [ ] **Step 2: Vérifier TypeScript backend complet**

```bash
cd backend && npx tsc --noEmit
```

Attendu : 0 erreur

- [ ] **Step 3: Vérifier le build frontend**

```bash
npm run build 2>&1 | tail -10
```

Attendu : build réussi

- [ ] **Step 4: Vérifier tous les commits de la feature**

```bash
git log --oneline origin/release/v1.0..HEAD
```

Attendu : voir les nouveaux commits (db, types, backend, api, AgenceFilter, TimelineCard, TimelineTab, DashboardPage)

- [ ] **Step 5: Tester manuellement (checklist)**

Démarrer le backend et le frontend en dev, se connecter avec un rôle `codir_dashboard` :

- [ ] Naviguer vers `/codir-dashboard` → les deux onglets s'affichent
- [ ] Onglet "Tableau de décision" → KPI bar et table fonctionnent comme avant
- [ ] Onglet "Timeline" → cartes avec stepper animé (étapes en séquence de gauche à droite)
- [ ] Étape IN_PROGRESS → icône pulse violet ; si SLA dépassé → rouge + ⚠
- [ ] Étapes complétées → icône check verte + durée affichée
- [ ] Filtre "Agence client" + sélection agence → cartes et tableau filtrés
- [ ] Filtre "Agence CA" → liste d'agences différente dans le dropdown
- [ ] Changer de type d'agence → dropdown revient à "Toutes les agences"
- [ ] Refresh countdown → auto-refresh toutes les 60s sans loader visible

- [ ] **Step 6: Tester l'état dégradé du filtre agence**

Simuler un échec du chargement timeline (couper le backend momentanément) :
- Le filtre agence doit afficher uniquement "Toutes les agences" sans erreur visible dans le dropdown
- L'`Alert` d'erreur en haut de page doit s'afficher
- L'onglet Tableau doit rester fonctionnel si `/dashboard` a répondu correctement

- [ ] **Step 7: Commit final si ajustements**

```bash
git add -p && git commit -m "fix(codir): ajustements suite aux tests timeline"
```
