# Page Approbations — Design Spec

**Goal:** Créer une page dédiée permettant à chaque utilisateur de voir et traiter ses approbations en attente (financières et process) depuis une interface unique, inspirée du dispatching.

**Architecture:** Nouvel endpoint `GET /api/workflows/pending-approvals` + page `ApprovalsPage.tsx` + dialog `ApprovalActionDialog.tsx`. La distinction financier/process est calculée backend sur `stepType`. Le badge sidebar est alimenté par un endpoint `/count` léger.

**Tech Stack:** Prisma (PostgreSQL), Express/TypeScript backend, React/TypeScript + MUI frontend.

---

## Contexte

### Situation actuelle

- Les approbateurs doivent naviguer dans "Suivi des workflows", chercher les dossiers à leur étape, puis ouvrir le `WorkflowDetailsDialog` (>3000 lignes) pour approuver
- Aucune vue centralisée "mes approbations en attente"
- Pas de distinction visuelle entre approbations financières (avec montant) et approbations process (sans montant)
- `WorkflowStep` a les champs `role`, `assigneeId`, `status`, `isOverdue`, `deadline`, `policyStepId`
- `CreditPolicyStep` a désormais `allowedActions String[]` (feature précédente)

### Objectif

Donner aux approbateurs une page de travail efficace : liste filtrée de ce qui leur est destiné, actions rapides via dialog simplifié, badge de comptage dans la sidebar.

---

## Périmètre V1

- **Inclus** : étapes de workflow crédit (financières et process)
- **Exclu** : moteur de processus génériques (RH, achat, conformité) — prévu V2

---

## Backend

### 1. `GET /api/workflows/pending-approvals`

**Fichier** : `backend/src/routes/workflows.ts`

Retourne les `WorkflowStep` PENDING assignés au rôle de l'utilisateur connecté (ou assignés directement via `assigneeId`).

**Filtre** :
```ts
{
  application: { companyId: req.companyId },  // multi-tenant (WorkflowStep n'a pas companyId direct)
  status: 'PENDING',
  completedAt: null,
  OR: [
    { role: user.role },          // toutes les étapes destinées à son rôle
    { assigneeId: user.id },      // ou assignées directement à lui
  ]
}
```

> Note: `WorkflowStep` n'a pas de `companyId` direct — le filtre passe par `application.companyId`.

**Include** :
```ts
include: {
  application: {
    include: {
      client: { select: { companyName: true } },
      creator: { select: { branch: true, department: true } },
      creditType: { select: { name: true } },
    }
  },
  policyStep: {
    select: { stepLabel: true, stepType: true, allowedActions: true }
  }
}
```

**Réponse par item** :
```ts
{
  id: string                     // workflowStep.id
  applicationId: string
  applicationNumber: string
  clientName: string
  amount: number
  currency: string
  stepName: string
  stepLabel: string              // policyStep.stepLabel ?? stepName (fallback si policyStep null)
  stepType: string               // policyStep.stepType ?? 'ANALYSIS' (fallback → classé process)
  allowedActions: string[]       // policyStep.allowedActions ?? [] ([] = aucune restriction)
  type: 'financial' | 'process'  // calculé: APPROVAL|COMMITTEE → financial, reste → process
  creditType: string | null
  branch: string | null
  purpose: string
  daysWaiting: number            // Math.floor((now - createdAt) / 86400000)
  deadline: string | null
  isOverdue: boolean
}
```

**Calcul `type`** :
```ts
// PolicyStepType enum : CREATION | DISPATCH | ANALYSIS | APPROVAL | COMMITTEE
const FINANCIAL_STEP_TYPES = ['APPROVAL', 'COMMITTEE'];
const type = FINANCIAL_STEP_TYPES.includes(policyStep?.stepType ?? '')
  ? 'financial'
  : 'process';
// CREATION, DISPATCH, ANALYSIS → 'process'
```

### 2. `GET /api/workflows/pending-approvals/count`

Retourne `{ count: number }` — même filtre que l'endpoint principal, sans les includes. Utilisé par la sidebar pour le badge. Appelé toutes les 60s.

---

## Frontend

### 1. `src/pages/ApprovalsPage.tsx`

Page principale avec :

**Onglets** (3) :
| Onglet | Contenu | Badge |
|--------|---------|-------|
| Tout | Tous les items en attente | count total |
| Financière | `type = 'financial'` | count financier |
| Process | `type = 'process'` | count process |

**Tri par défaut** : overdue en premier, puis deadline croissante, puis daysWaiting décroissant.

**Colonnes du tableau** :

| Colonne | Tout | Financière | Process |
|---------|------|-----------|---------|
| N° dossier | ✓ | ✓ | ✓ |
| Client | ✓ | ✓ | ✓ |
| Étape | ✓ | ✓ | ✓ |
| Montant | ✓ | ✓ | — |
| Type crédit | ✓ | ✓ | ✓ |
| Agence | ✓ | ✓ | ✓ |
| Attente | ✓ | ✓ | ✓ |
| Deadline | ✓ | ✓ | ✓ |
| SLA | ✓ | ✓ | ✓ |
| Actions | ✓ | ✓ | ✓ |

**Indicateur SLA** : chip coloré — vert (dans les délais), orange (< 24h), rouge (overdue).

**Refresh** : auto toutes les 30s avec countdown (pattern dispatching). Bouton refresh manuel.

**Filtre agence** : select déroulant (toutes les agences présentes dans la liste).

### 2. `src/components/ApprovalActionDialog.tsx`

Dialog compact déclenché par le bouton "Traiter" de chaque ligne.

**Structure** :
```
┌─────────────────────────────────────────┐
│ [N° dossier] — [Client]          [×]   │
├─────────────────────────────────────────┤
│ Étape : [stepLabel]                     │
│ Type crédit : [name]  |  Agence : [br]  │
│ Objet : [purpose]                       │
│ Montant : [amount] (si financial)       │
│ Durée : [durationMonths] mois           │
├─────────────────────────────────────────┤
│ Commentaire (optionnel)                 │
│ [TextField multiline]                   │
├─────────────────────────────────────────┤
│ [Demander infos] [Transférer]           │
│                  [Rejeter] [Approuver]  │
└─────────────────────────────────────────┘
```

- Les boutons sont filtrés par `allowedActions` de l'étape (même logique que `WorkflowDetailsDialog`)
- Si `allowedActions = []` → tous les boutons affichés (rétrocompatibilité)
- Cliquer Approuver ou Rejeter ouvre un dialog OTP (réutilise `OtpConfirmDialog` existant)
- Appel : `POST /api/workflows/:applicationId/approve { decision, comments, userId }`
- Succès : fermeture dialog + suppression optimiste de l'item dans la liste + refresh silencieux

### 3. `src/components/Sidebar.tsx`

Nouvelle entrée de menu "Approbations" :
- Icône : `HowToVote` ou `AssignmentTurnedIn` (MUI)
- Visible si `hasPermission('view_applications')` ou `hasPermission('approve_applications')` ou `isAdmin`
- Badge numérique avec le count en attente (appel `/count` toutes les 60s)
- Route : `/approvals`

### 4. `src/App.tsx`

Nouvelle route : `<Route path="/approvals" element={<ApprovalsPage />} />`

### 5. `src/services/api.ts`

Deux nouvelles méthodes :
```ts
static async getPendingApprovals(): Promise<ApiResponse<ApprovalItem[]>>
static async getPendingApprovalsCount(): Promise<ApiResponse<{ count: number }>>
```

### 6. `src/types/index.ts`

Nouveau type `ApprovalItem` :
```ts
export interface ApprovalItem {
  id: string
  applicationId: string
  applicationNumber: string
  clientName: string
  amount: number
  currency: string
  stepName: string
  stepLabel: string
  stepType: string
  allowedActions: string[]
  type: 'financial' | 'process'
  creditType: string | null
  branch: string | null
  purpose: string
  daysWaiting: number
  deadline: string | null
  isOverdue: boolean
}
```

---

## Flux de bout en bout

```
1. Utilisateur (DIRECTEUR_AGENCE) ouvre "Approbations"
   → GET /api/workflows/pending-approvals
   → 3 dossiers PENDING avec role = DIRECTEUR_AGENCE
   → Onglet "Tout" affiche 3 items, badge = 3
   → Onglet "Financière" = 2, "Process" = 1

2. Clique "Traiter" sur un dossier financier
   → ApprovalActionDialog s'ouvre
   → Montant visible, boutons Approuver + Rejeter (allowedActions = ['approve','reject'])

3. Clique "Approuver"
   → OtpConfirmDialog s'ouvre
   → Saisit OTP → POST /api/workflows/:id/approve { decision: 'APPROVED', comments: '...', userId }
   → canApproveStep vérifie rôle + montant + allowedActions ✓
   → Dossier avance au step suivant
   → Item retiré de la liste, badge passe à 2

4. Sidebar badge mis à jour toutes les 60s via /count
```

---

## Rétrocompatibilité

- Le `WorkflowDetailsDialog` existant n'est pas modifié
- La page "Suivi des workflows" existante n'est pas modifiée
- Les workflows sans `policyStep` (policyStepId = null) ont `allowedActions = []` → tous les boutons affichés
- Les étapes sans `stepType` dans la policyStep sont classées `process` par défaut

---

## Hors scope

- Approbations de processus génériques (RH, achat) — V2
- Notifications push en temps réel (WebSocket) — V2
- Délégation depuis la page approbations — V2
- Historique des approbations traitées — V2
