# Page Approbations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer une page dédiée aux approbateurs listant leurs étapes de workflow en attente (financières et process), avec un dialog d'action simplifié et un badge sidebar.

**Architecture:** Deux endpoints backend `GET /api/workflows/pending-approvals` et `/count`. Page `ApprovalsPage.tsx` avec 3 onglets (Tout / Financière / Process). Dialog `ApprovalActionDialog.tsx` avec OTP. Badge numérique dans la sidebar, rafraîchi toutes les 60s.

**Tech Stack:** Prisma + PostgreSQL, Express/TypeScript backend, React/TypeScript + MUI frontend.

---

## Fichiers modifiés / créés

| Fichier | Rôle |
|---------|------|
| `backend/src/routes/workflows.ts` | 2 nouveaux endpoints GET |
| `src/types/index.ts` | Ajouter `ApprovalItem` + `'approvals'` à `PageType` |
| `src/services/api.ts` | 2 nouvelles méthodes + extension type `approveWorkflow` |
| `src/components/ApprovalActionDialog.tsx` | Nouveau — dialog compact d'action |
| `src/pages/ApprovalsPage.tsx` | Nouveau — page avec 3 onglets |
| `src/components/Sidebar.tsx` | Nouvelle entrée menu + badge count |
| `src/App.tsx` | Lazy import + nouvelle Route `/approvals` |

---

## Task 1 : Backend — endpoint `GET /pending-approvals`

**Files:**
- Modify: `backend/src/routes/workflows.ts` (après la route GET `/` ligne ~161)

- [ ] **Step 1 : Ajouter la route GET `/pending-approvals`**

Ajouter après le bloc `router.get('/', ...)` (ligne ~161) :

```ts
// GET /api/workflows/pending-approvals
// Retourne les WorkflowStep PENDING destinés au rôle de l'utilisateur connecté
router.get('/pending-approvals', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    if (!userId || !userRole) {
      return res.status(401).json({ success: false, error: 'Authentification requise' });
    }

    const steps = await prisma.workflowStep.findMany({
      where: {
        status: 'PENDING',
        completedAt: null,
        application: { companyId: req.companyId },
        OR: [
          { role: userRole },
          { assigneeId: userId },
        ],
      },
      include: {
        application: {
          include: {
            client: { select: { companyName: true } },
            creator: { select: { branch: true, department: true } },
            creditType: { select: { name: true } },
          },
        },
        policyStep: {
          select: { stepLabel: true, stepType: true, allowedActions: true },
        },
      },
      orderBy: [
        { isOverdue: 'desc' },
        { deadline: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const FINANCIAL_STEP_TYPES = ['APPROVAL', 'COMMITTEE'];
    const now = Date.now();

    const data = steps.map((step) => {
      const policyStep = (step as any).policyStep;
      const app = (step as any).application;
      const stepType: string = policyStep?.stepType ?? 'ANALYSIS';
      return {
        id: step.id,
        applicationId: step.applicationId,
        applicationNumber: app.applicationNumber,
        clientName: app.client.companyName,
        amount: Number(app.amount),
        currency: app.currency || 'XOF',
        stepName: step.stepName,
        stepLabel: policyStep?.stepLabel ?? step.stepName,
        stepType,
        allowedActions: policyStep?.allowedActions ?? [],
        type: FINANCIAL_STEP_TYPES.includes(stepType) ? 'financial' : 'process',
        creditType: app.creditType?.name ?? null,
        branch: app.creator?.branch ?? app.creator?.department ?? null,
        purpose: app.purpose,
        daysWaiting: Math.floor((now - new Date(step.createdAt).getTime()) / 86_400_000),
        deadline: step.deadline ? step.deadline.toISOString() : null,
        isOverdue: step.isOverdue,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('[workflows] GET /pending-approvals error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});
```

- [ ] **Step 2 : Ajouter la route GET `/pending-approvals/count`**

Ajouter immédiatement après la route précédente :

```ts
// GET /api/workflows/pending-approvals/count
router.get('/pending-approvals/count', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    if (!userId || !userRole) {
      return res.status(401).json({ success: false, error: 'Authentification requise' });
    }

    const count = await prisma.workflowStep.count({
      where: {
        status: 'PENDING',
        completedAt: null,
        application: { companyId: req.companyId },
        OR: [
          { role: userRole },
          { assigneeId: userId },
        ],
      },
    });

    res.json({ success: true, count });
  } catch (error) {
    console.error('[workflows] GET /pending-approvals/count error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});
```

> **Important :** Ces routes DOIVENT être déclarées AVANT toute route `/:applicationId` pour ne pas être capturées par le paramètre dynamique.

- [ ] **Step 3 : Vérifier TypeScript backend**

```bash
cd backend && npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add backend/src/routes/workflows.ts
git commit -m "feat(api): GET /pending-approvals et /count pour la page approbations"
```

---

## Task 2 : Types TypeScript

**Files:**
- Modify: `src/types/index.ts:114` (PageType)
- Modify: `src/types/index.ts` (après WorkflowStep interface)

- [ ] **Step 1 : Ajouter `'approvals'` à `PageType` (ligne 114)**

```ts
// Avant
export type PageType = 'home' | ... | 'raci-matrix';

// Après — ajouter 'approvals' en fin de liste
export type PageType = 'home' | ... | 'raci-matrix' | 'approvals';
```

- [ ] **Step 2 : Ajouter l'interface `ApprovalItem`**

Après l'interface `WorkflowStep` (ligne ~215), ajouter :

```ts
export interface ApprovalItem {
  id: string;
  applicationId: string;
  applicationNumber: string;
  clientName: string;
  amount: number;
  currency: string;
  stepName: string;
  stepLabel: string;
  stepType: string;
  allowedActions: string[];
  type: 'financial' | 'process';
  creditType: string | null;
  branch: string | null;
  purpose: string;
  daysWaiting: number;
  deadline: string | null;
  isOverdue: boolean;
}
```

- [ ] **Step 3 : Vérifier TypeScript frontend**

```bash
npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): ApprovalItem + 'approvals' dans PageType"
```

---

## Task 3 : API Service

**Files:**
- Modify: `src/services/api.ts` (après la méthode `approveWorkflow`, ligne ~195)

- [ ] **Step 1 : Étendre le type `decision` dans `approveWorkflow` (ligne 187)**

```ts
// Avant
payload: { userId: string; decision: 'APPROVED' | 'REJECTED'; comments?: string }

// Après
payload: { userId: string; decision: 'APPROVED' | 'REJECTED' | 'REQUEST_INFO' | 'TRANSFER'; comments?: string }
```

- [ ] **Step 2 : Ajouter `getPendingApprovals` et `getPendingApprovalsCount`**

Après la méthode `approveWorkflow` (ligne ~195), ajouter :

```ts
  static async getPendingApprovals(): Promise<ApiResponse<ApprovalItem[]>> {
    try {
      const response = await api.get('/workflows/pending-approvals');
      return { success: true, data: response.data.data || [] };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur chargement approbations' };
    }
  }

  static async getPendingApprovalsCount(): Promise<ApiResponse<{ count: number }>> {
    try {
      const response = await api.get('/workflows/pending-approvals/count');
      return { success: true, data: { count: response.data.count ?? 0 } };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur comptage' };
    }
  }
```

- [ ] **Step 3 : Ajouter l'import `ApprovalItem` en haut du fichier**

```ts
// Avant (ligne 2)
import { AnalysisData, FileUploadResult, ApiResponse } from '../types';

// Après
import { AnalysisData, FileUploadResult, ApiResponse, ApprovalItem } from '../types';
```

- [ ] **Step 4 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add src/services/api.ts
git commit -m "feat(api-service): getPendingApprovals, getPendingApprovalsCount, extension decision type"
```

---

## Task 4 : `ApprovalActionDialog.tsx`

**Files:**
- Create: `src/components/ApprovalActionDialog.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Chip, CircularProgress,
  Alert, Divider,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  HelpOutline as InfoIcon,
  SwapHoriz as TransferIcon,
} from '@mui/icons-material';
import { ApprovalItem } from '../types';
import { ApiService } from '../services/api';
import { useUser } from '../contexts/UserContext';
import { OtpVerificationDialog } from './OtpVerificationDialog';

interface Props {
  item: ApprovalItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (itemId: string) => void;
}

function fmtAmount(v: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);
}

const ACTION_CONFIG = {
  approve:      { label: 'Approuver',         color: 'success' as const, icon: ApproveIcon,  decision: 'APPROVED'     },
  reject:       { label: 'Rejeter',            color: 'error'   as const, icon: RejectIcon,   decision: 'REJECTED'     },
  request_info: { label: 'Demander des infos', color: 'warning' as const, icon: InfoIcon,     decision: 'REQUEST_INFO' },
  transfer:     { label: 'Transférer',         color: 'info'    as const, icon: TransferIcon, decision: 'TRANSFER'     },
};

type ActionKey = keyof typeof ACTION_CONFIG;
const ALL_ACTIONS: ActionKey[] = ['approve', 'reject', 'request_info', 'transfer'];

export const ApprovalActionDialog: React.FC<Props> = ({ item, open, onClose, onSuccess }) => {
  const { userState } = useUser();
  const [comments, setComments]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const [otpDialog, setOtpDialog]   = useState<{ open: boolean; action: ActionKey | null }>({
    open: false, action: null,
  });

  if (!item) return null;

  const visibleActions: ActionKey[] = item.allowedActions.length === 0
    ? ALL_ACTIONS
    : ALL_ACTIONS.filter((a) => item.allowedActions.includes(a));

  const handleAction = (action: ActionKey) => {
    if (action === 'approve' || action === 'reject') {
      setOtpDialog({ open: true, action });
    } else {
      submitDecision(action);
    }
  };

  const submitDecision = async (action: ActionKey) => {
    if (!userState.currentUser) return;
    const cfg = ACTION_CONFIG[action];
    setSubmitting(true);
    setError(null);
    try {
      const data = await ApiService.approveWorkflow(item.applicationId, {
        userId: userState.currentUser.id,
        decision: cfg.decision as 'APPROVED' | 'REJECTED' | 'REQUEST_INFO' | 'TRANSFER',
        comments: comments.trim() || undefined,
      });
      if (!data.success) throw new Error(data.error || 'Erreur');
      setSuccess(cfg.label + ' — décision enregistrée');
      setComments('');
      setTimeout(() => {
        onSuccess(item.id);
        onClose();
        setSuccess(null);
      }, 1500);
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '14px' } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            {item.applicationNumber} — {item.clientName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Étape : {item.stepLabel}
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            {item.creditType && (
              <Box>
                <Typography variant="caption" color="text.secondary">Type crédit</Typography>
                <Typography variant="body2" fontWeight={600}>{item.creditType}</Typography>
              </Box>
            )}
            {item.branch && (
              <Box>
                <Typography variant="caption" color="text.secondary">Agence</Typography>
                <Typography variant="body2" fontWeight={600}>{item.branch}</Typography>
              </Box>
            )}
            {item.type === 'financial' && (
              <Box>
                <Typography variant="caption" color="text.secondary">Montant</Typography>
                <Typography variant="body2" fontWeight={700} color="primary.main">
                  {fmtAmount(item.amount, item.currency)}
                </Typography>
              </Box>
            )}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {item.purpose}
          </Typography>

          <Divider sx={{ mb: 2 }} />

          {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <TextField
            label="Commentaire (optionnel)"
            multiline
            minRows={2}
            maxRows={4}
            fullWidth
            size="small"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            disabled={submitting}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={onClose} disabled={submitting} sx={{ textTransform: 'none', color: '#636366' }}>
            Fermer
          </Button>
          <Box sx={{ flex: 1 }} />
          {visibleActions.map((action) => {
            const cfg = ACTION_CONFIG[action];
            const IconComponent = cfg.icon;
            return (
              <Button
                key={action}
                variant={action === 'approve' ? 'contained' : 'outlined'}
                color={cfg.color}
                size="small"
                startIcon={submitting ? <CircularProgress size={13} /> : <IconComponent sx={{ fontSize: 14 }} />}
                onClick={() => handleAction(action)}
                disabled={submitting}
                sx={{
                  borderRadius: '10px', px: 2, fontSize: '13px',
                  fontWeight: 600, textTransform: 'none', whiteSpace: 'nowrap',
                  boxShadow: 'none', '&:hover': { boxShadow: 'none' },
                }}
              >
                {cfg.label}
              </Button>
            );
          })}
        </DialogActions>
      </Dialog>

      <OtpVerificationDialog
        open={otpDialog.open}
        actionLabel={otpDialog.action === 'approve' ? 'Approuver la demande' : 'Rejeter la demande'}
        purpose={otpDialog.action === 'approve' ? 'approve_credit' : 'reject_credit'}
        onClose={() => setOtpDialog({ open: false, action: null })}
        onVerified={async () => {
          setOtpDialog({ open: false, action: null });
          if (otpDialog.action) await submitDecision(otpDialog.action);
        }}
      />
    </>
  );
};
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add src/components/ApprovalActionDialog.tsx
git commit -m "feat(component): ApprovalActionDialog — dialog compact avec OTP"
```

---

## Task 5 : `ApprovalsPage.tsx`

**Files:**
- Create: `src/pages/ApprovalsPage.tsx`

- [ ] **Step 1 : Créer la page**

```tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Tabs, Tab, Table, TableBody, TableCell,
  TableHead, TableRow, Paper, Chip, Button, CircularProgress,
  Alert, IconButton, Select, MenuItem, FormControl, InputLabel,
  Badge, Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  HowToVote as ApprovalIcon,
  Warning as WarningIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { ApprovalItem } from '../types';
import { ApiService } from '../services/api';
import { ApprovalActionDialog } from '../components/ApprovalActionDialog';

const ACCENT = '#5c35b5';
const REFRESH_INTERVAL = 30;

function fmtAmount(v: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);
}

function SlaChip({ item }: { item: ApprovalItem }) {
  if (item.isOverdue) return <Chip label="En retard" color="error" size="small" />;
  if (item.deadline) {
    const hoursLeft = (new Date(item.deadline).getTime() - Date.now()) / 3_600_000;
    if (hoursLeft < 24) return <Chip label="< 24h" color="warning" size="small" />;
  }
  return <Chip label="Dans les délais" color="success" size="small" variant="outlined" />;
}

export const ApprovalsPage: React.FC = () => {
  const [items, setItems]           = useState<ApprovalItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [tab, setTab]               = useState(0);
  const [branchFilter, setBranchFilter] = useState('all');
  const [countdown, setCountdown]   = useState(REFRESH_INTERVAL);
  const [dialog, setDialog]         = useState<ApprovalItem | null>(null);
  const lastReloadRef               = useRef(Date.now());

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await ApiService.getPendingApprovals();
      if (res.success) setItems(res.data || []);
      else setError(res.error || 'Erreur chargement');
      lastReloadRef.current = Date.now();
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Countdown + auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastReloadRef.current) / 1000);
      const remaining = REFRESH_INTERVAL - elapsed;
      if (remaining <= 0) {
        reload(true);
        setCountdown(REFRESH_INTERVAL);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [reload]);

  // Branches disponibles dans la liste
  const branches = Array.from(new Set(items.map(i => i.branch).filter(Boolean) as string[])).sort();

  const filtered = items.filter(item => {
    const matchBranch = branchFilter === 'all' || item.branch === branchFilter;
    const matchTab = tab === 0 || (tab === 1 && item.type === 'financial') || (tab === 2 && item.type === 'process');
    return matchBranch && matchTab;
  });

  const countFinancial = items.filter(i => i.type === 'financial').length;
  const countProcess   = items.filter(i => i.type === 'process').length;

  const handleSuccess = (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const showAmount = tab === 0 || tab === 1;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <ApprovalIcon sx={{ fontSize: 32, color: ACCENT }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={700}>Mes Approbations</Typography>
          <Typography variant="body2" color="text.secondary">
            {items.length} élément{items.length !== 1 ? 's' : ''} en attente
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">{countdown}s</Typography>
          <Tooltip title="Rafraîchir">
            <IconButton size="small" onClick={() => reload()} disabled={loading}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filtres */}
      {branches.length > 0 && (
        <FormControl size="small" sx={{ mb: 2, minWidth: 200 }}>
          <InputLabel>Agence</InputLabel>
          <Select value={branchFilter} label="Agence" onChange={(e) => setBranchFilter(e.target.value)}>
            <MenuItem value="all">Toutes les agences</MenuItem>
            {branches.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
          </Select>
        </FormControl>
      )}

      {/* Onglets */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: '1px solid #e0e0e0' }}
      >
        <Tab label={
          <Badge badgeContent={items.length} color="primary" max={99}>
            <Box sx={{ pr: 1 }}>Tout</Box>
          </Badge>
        } />
        <Tab label={
          <Badge badgeContent={countFinancial} color="success" max={99}>
            <Box sx={{ pr: 1 }}>Financière</Box>
          </Badge>
        } />
        <Tab label={
          <Badge badgeContent={countProcess} color="warning" max={99}>
            <Box sx={{ pr: 1 }}>Process</Box>
          </Badge>
        } />
      </Tabs>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <ApprovalIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">Aucune approbation en attente</Typography>
        </Box>
      ) : (
        <Paper sx={{ borderRadius: '12px', overflow: 'hidden' }} elevation={0} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8f8f8' }}>
                <TableCell><strong>N° dossier</strong></TableCell>
                <TableCell><strong>Client</strong></TableCell>
                <TableCell><strong>Étape</strong></TableCell>
                {showAmount && <TableCell align="right"><strong>Montant</strong></TableCell>}
                <TableCell><strong>Type crédit</strong></TableCell>
                <TableCell><strong>Agence</strong></TableCell>
                <TableCell align="center"><strong>Attente</strong></TableCell>
                <TableCell align="center"><strong>SLA</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((item) => (
                <TableRow
                  key={item.id}
                  sx={{
                    bgcolor: item.isOverdue ? 'rgba(220,38,38,0.03)' : 'white',
                    '&:hover': { bgcolor: 'rgba(92,53,181,0.04)' },
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} color="primary.main">
                      {item.applicationNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.clientName}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.stepLabel}</Typography>
                  </TableCell>
                  {showAmount && (
                    <TableCell align="right">
                      {item.type === 'financial'
                        ? <Typography variant="body2" fontWeight={600}>{fmtAmount(item.amount, item.currency)}</Typography>
                        : <Typography variant="body2" color="text.disabled">—</Typography>
                      }
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body2">{item.creditType ?? '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.branch ?? '—'}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      {item.isOverdue && <WarningIcon sx={{ fontSize: 14, color: '#dc2626' }} />}
                      <Typography variant="body2" color={item.daysWaiting > 5 ? 'error.main' : 'text.primary'}>
                        {item.daysWaiting}j
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <SlaChip item={item} />
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => setDialog(item)}
                      sx={{
                        borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                        textTransform: 'none', bgcolor: ACCENT, boxShadow: 'none',
                        '&:hover': { bgcolor: '#4a2a9e', boxShadow: 'none' },
                      }}
                    >
                      Traiter
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <ApprovalActionDialog
        item={dialog}
        open={!!dialog}
        onClose={() => setDialog(null)}
        onSuccess={handleSuccess}
      />
    </Box>
  );
};

export default ApprovalsPage;
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add src/pages/ApprovalsPage.tsx
git commit -m "feat(page): ApprovalsPage — 3 onglets, table, dialog Traiter"
```

---

## Task 6 : Sidebar — entrée menu + badge count

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1 : Importer l'icône `HowToVote`**

Dans le bloc d'imports MUI Icons (ligne ~21) :

```ts
// Ajouter dans la liste des imports @mui/icons-material
HowToVote as ApprovalMenuIcon,
```

- [ ] **Step 2 : Ajouter l'import `ApiService` et l'état pour le badge count**

En haut de `Sidebar.tsx`, après `import { useCompany } from '../contexts/CompanyContext';` (ligne ~47), ajouter :

```ts
import { ApiService } from '../services/api';
```

Puis, dans le corps du composant `Sidebar` (après les premiers états locaux), ajouter :

```ts
const [pendingApprovalsCount, setPendingApprovalsCount] = React.useState(0);

React.useEffect(() => {
  const fetchCount = async () => {
    try {
      const res = await ApiService.getPendingApprovalsCount();
      if (res.success) setPendingApprovalsCount(res.data?.count ?? 0);
    } catch { /* silencieux */ }
  };
  fetchCount();
  const interval = setInterval(fetchCount, 60_000);
  return () => clearInterval(interval);
}, []);
```

- [ ] **Step 3 : Ajouter l'entrée menu dans `creditProcessItems`**

Dans le tableau `creditProcessItems` (ligne ~125), ajouter après le dispatching :

```ts
...(canViewApplications ? [{
  id: 'approvals' as PageType,
  label: 'Approbations',
  icon: ApprovalMenuIcon,
  badgeCount: pendingApprovalsCount,
}] : []),
```

- [ ] **Step 4 : Mettre à jour le composant `NavItem` pour supporter `badgeCount`**

Chercher l'interface/type du `NavItem` (ligne ~266) et ajouter `badgeCount?: number` :

```ts
// Avant
badge?: boolean;

// Après — les deux coexistent
badge?: boolean;
badgeCount?: number;
```

Dans le rendu du NavItem, remplacer le Badge dot par un badge numérique si `badgeCount > 0` :

```tsx
// Dans le rendu de l'icône (ligne ~291 et ~314)
// Remplacer le pattern existant par :
{(badge || (badgeCount && badgeCount > 0)) ? (
  badgeCount && badgeCount > 0 ? (
    <Badge badgeContent={badgeCount} color="error" max={99}>
      <Icon />
    </Badge>
  ) : (
    <Badge color="success" variant="dot">
      <Icon />
    </Badge>
  )
) : (
  <Icon />
)}
```

- [ ] **Step 5 : Passer `badgeCount` dans les items du rendu**

Chercher l'endroit où `creditProcessItems` est rendu (ligne ~480) et s'assurer que `badgeCount` est passé au composant NavItem.

- [ ] **Step 6 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 7 : Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(sidebar): entrée Approbations avec badge count en temps réel"
```

---

## Task 7 : App.tsx — route `/approvals`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1 : Ajouter le lazy import**

Après la ligne `const DispatchingPage = lazy(...)` (ligne ~43) :

```ts
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage').then(m => ({ default: m.ApprovalsPage })));
```

- [ ] **Step 2 : Ajouter la route**

Après la route `/dispatching` (ligne ~360) :

```tsx
<Route
  path="/approvals"
  element={<ApprovalsPage />}
/>
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add src/App.tsx
git commit -m "feat(router): route /approvals → ApprovalsPage"
```

---

## Task 8 : Build final + push

- [ ] **Step 1 : Build backend**

```bash
cd backend && npm run build 2>&1 | tail -5
```

Résultat attendu : aucune erreur.

- [ ] **Step 2 : TypeScript check frontend**

```bash
cd .. && npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 3 : Instructions de déploiement serveur**

```bash
sudo git pull
cd backend && sudo npm run build
sudo systemctl restart optimuscredit-backend.service
```

- [ ] **Step 4 : Push**

```bash
git push
```
