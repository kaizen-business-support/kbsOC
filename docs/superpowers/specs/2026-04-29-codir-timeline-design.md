# CODIR Timeline — Spec Design

**Date:** 2026-04-29
**Contexte:** Extension du tableau de bord CODIR existant (`feature/codir-dashboard`). Ajout d'un onglet "Timeline" montrant la progression de chaque dossier étape par étape, avec un filtre par agence global.

---

## Objectif

Permettre au CODIR de visualiser, pour chaque dossier en attente, à quelle étape du workflow il se trouve, combien de temps il a passé à chaque étape, et qui l'a traité — dans une vue stepper horizontale animée.

---

## Architecture générale

### Structure de la page

`CodirDashboardPage` reçoit un composant `Tabs` MUI (deux onglets) en dessous du header. Le filtre agence et le chip de refresh restent au-dessus des onglets et s'appliquent aux deux vues.

```
┌─────────────────────────────────────────────────────────────────┐
│  Tableau de Bord CODIR                                           │
│  Vue 360° — X dossiers — Y en retard    [Agence ▾] [Refresh]   │
│                                                                   │
│  [ Tableau de décision ]  [ Timeline ]                           │
│ ─────────────────────────────────────────────────────────────── │
│  (contenu de l'onglet actif)                                     │
└─────────────────────────────────────────────────────────────────┘
```

**Onglet 0 — Tableau de décision** : vue existante (KPI bar + PendingDecisionsTable + actions relance/réaffectation/escalade). Aucune modification structurelle — seulement ajout des champs `clientBranch` et `creatorBranch` à `PendingDecisionItem` pour le filtre agence.

**Onglet 1 — Timeline** : liste de cartes `ApplicationTimelineCard`, une par dossier, triées overdue en premier puis par ancienneté (daysWaiting desc).

---

## Migration DB requise

`Client.branch` n'existe pas dans le schéma actuel. Une migration est nécessaire :

```sql
ALTER TABLE "clients" ADD COLUMN "branch" TEXT;
```

Prisma schema (`model Client`) :
```prisma
  branch    String?   @map("branch")
```

> Cette colonne nullable n'a pas de valeur par défaut — migration sûre sur une table existante.

---

## Filtre agence

### Comportement

Deux contrôles liés placés dans le header de `CodirDashboardPage` :

1. **`ToggleButtonGroup`** MUI compact — deux valeurs :
   - `client` → filtre sur `clientBranch`
   - `ca` → filtre sur `creatorBranch`

2. **`Select` agence** — peuplé dynamiquement depuis `agences.client` ou `agences.ca` selon le type actif. Valeur par défaut : `"all"` (Toutes les agences). Revient à `"all"` quand le type change. Les valeurs `null` sont exclues des deux listes.

### Application

- Filtrage côté frontend uniquement — aucun ré-appel API.
- Onglet Tableau : filtre `items` sur `clientBranch` ou `creatorBranch` (champs ajoutés au type `PendingDecisionItem` et au endpoint `/dashboard`).
- Onglet Timeline : filtre `applications` du endpoint `/api/codir/timeline`.

### Sources schéma

- **Agence CA** : `User.branch` (String?) — champ existant sur le User créateur du dossier
- **Agence client** : `Client.branch` (String?) — champ ajouté par migration

---

## Nouveau endpoint : `GET /api/codir/timeline`

**Auth :** `authorize(['codir_dashboard'])`

### Requête Prisma (structure include)

```ts
const applications = await prisma.creditApplication.findMany({
  where: {
    companyId,
    status: { notIn: ['APPROVED', 'REJECTED', 'DISBURSED'] },
    workflowSteps: { some: { status: { in: ['PENDING', 'IN_REVIEW'] } } },
  },
  include: {
    client: { select: { companyName: true, branch: true } },
    creator: { select: { name: true, branch: true } },
    policy: {
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: { stepRoles: { select: { role: true } } },
        },
      },
    },
    workflowSteps: {
      include: { assignee: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    },
  },
  orderBy: [
    // overdue en premier, puis ancienneté
  ],
});
```

### Logique de construction des steps

Pour chaque `CreditApplication` :

1. Si `policyId === null` : utiliser uniquement les `workflowSteps` existants, triés par `createdAt asc`. Pas d'étapes futures disponibles.

2. Si `policyId !== null` : itérer sur `policy.steps` (les étapes théoriques dans l'ordre). Pour chaque `CreditPolicyStep`, chercher le `WorkflowStep` correspondant via `workflowStep.policyStepId === policyStep.id` (FK directe, pas matching par `stepName`).

**Mapping de statut** (DB → display) :

| DB `WorkflowStep.status` | Display `TimelineStep.status` |
|--------------------------|-------------------------------|
| `COMPLETED` / `APPROVED` / `REJECTED` | `'COMPLETED'` |
| `IN_REVIEW` | `'IN_PROGRESS'` |
| `PENDING` | `'IN_PROGRESS'` (si c'est le step courant actif) |
| Aucun WorkflowStep trouvé | `'PENDING'` (étape future) |

**Calcul de `durationHours`** :

| Statut | Formule |
|--------|---------|
| `COMPLETED` | `workflowStep.durationMinutes / 60` si non null, sinon `(completedAt - startedAt) / 3 600 000` |
| `IN_PROGRESS` | `(Date.now() - (startedAt ?? createdAt).getTime()) / 3 600 000` — `startedAt` en fallback sur `createdAt` |
| `PENDING` (futur) | `null` |

**SLA dépassé** sur l'étape en cours : `durationHours > policyStep.maxDurationHours` → champ `isSlaBroken: boolean` retourné dans `TimelineStep`.

### Structure de réponse

```json
{
  "success": true,
  "data": {
    "agences": {
      "client": ["Dakar", "Thiès", "Saint-Louis"],
      "ca": ["Agence Centrale", "Agence Plateau"]
    },
    "applications": [
      {
        "applicationId": "cuid",
        "applicationNumber": "APP-2026-001",
        "clientName": "SARL Kaizen",
        "clientBranch": "Dakar",
        "amount": 5000000,
        "currency": "XOF",
        "creatorName": "Diallo M.",
        "creatorBranch": "Agence Centrale",
        "isOverdue": true,
        "daysWaiting": 7,
        "isEscalated": false,
        "steps": [
          {
            "stepName": "dispatch",
            "stepLabel": "Dispatching",
            "order": 1,
            "status": "COMPLETED",
            "agentName": "Sow A.",
            "startedAt": "2026-04-20T08:00:00Z",
            "completedAt": "2026-04-20T10:00:00Z",
            "durationHours": 2,
            "isSlaBroken": false
          },
          {
            "stepName": "credit_analysis",
            "stepLabel": "Analyse Crédit",
            "order": 2,
            "status": "IN_PROGRESS",
            "agentName": "Diallo M.",
            "startedAt": "2026-04-20T10:00:00Z",
            "completedAt": null,
            "durationHours": 72,
            "isSlaBroken": true
          },
          {
            "stepName": "supervisor_approval",
            "stepLabel": "Approbation Superviseur",
            "order": 3,
            "status": "PENDING",
            "agentName": null,
            "startedAt": null,
            "completedAt": null,
            "durationHours": null,
            "isSlaBroken": false
          }
        ]
      }
    ]
  }
}
```

---

## Types TypeScript

### Nouveaux types à ajouter dans `src/types/index.ts`

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

### Modification de `PendingDecisionItem` (types existants)

Ajouter deux champs à `PendingDecisionItem` pour le filtre agence sur l'onglet Tableau :

```ts
  clientBranch: string | null;
  creatorBranch: string | null;
```

---

## Composants React

### `AgenceFilter.tsx`

**Props (composant contrôlé) :**
```ts
interface Props {
  agences: { client: string[]; ca: string[] };
  type: 'client' | 'ca';
  value: string;
  onChange: (type: 'client' | 'ca', value: string) => void;
}
```

- `ToggleButtonGroup` : "Agence client" / "Agence CA" — taille `small`
- `Select` MUI taille `small` : "Toutes les agences" (`value="all"`) + valeurs dynamiques
- Quand le type change → appelle `onChange(newType, 'all')`

### `ApplicationTimelineCard.tsx`

**Props :** `{ application: ApplicationTimeline }`

**Structure visuelle :**

```
┌────────────────────────────────────────────────────────────────┐
│  APP-2026-001  •  SARL Kaizen  •  5 000 000 XOF  [⚠ En retard]│
│  Agence: Dakar  •  CA: Diallo M. (Agence Centrale)            │
│                                                                  │
│  ●━━━━━━━━━━━●━━━━━━━━━━━◉ · · · · · ○ · · · · · ○           │
│  Dispatching  Analyse     Superviseur   Engagements  CODIR      │
│  Sow A.       Diallo M.   —                                     │
│  2h           72h←SLA!                                           │
│  20/04 08h    20/04 10h                                          │
│  → 20/04 10h  → en cours                                        │
└────────────────────────────────────────────────────────────────┘
```

**Implémentation du stepper** : `Box + flexbox` custom (pas `MUI Stepper` natif) pour contrôle total du layout et de l'animation. Chaque étape est une colonne flex avec icône, label, agent, durée, dates.

**États visuels :**
- `COMPLETED` : icône `CheckCircleIcon` vert, connecteur plein vert
- `IN_PROGRESS` : icône `RadioButtonCheckedIcon` violet (#5c35b5) avec animation CSS `@keyframes pulse` (scale 1→1.15→1, 1.5s infinite), connecteur pointillé
- `PENDING` : icône `RadioButtonUncheckedIcon` gris clair, connecteur pointillé gris

**Animation d'entrée :** `MUI Grow` uniquement (pas de combinaison Fade+Grow) avec `transitionDelay = stepIndex × 80ms`. Les étapes apparaissent en séquence de gauche à droite au montage du composant.

**Formatage de la durée :**
- `< 1h` → `"< 1h"`
- `1–23h` → `"Xh"`
- `≥ 24h` → `"Xj Yh"`
- Si `isSlaBroken === true` → couleur rouge + icône `⚠`

**Dates affichées :** `"DD/MM HHh"` (format court)

### `CodirTimelineTab.tsx`

**Props :**
```ts
interface Props {
  applications: ApplicationTimeline[];
  agenceType: 'client' | 'ca';
  agenceValue: string;
}
```

**Logique de filtrage :**
```ts
const filtered = applications.filter(app => {
  if (agenceValue === 'all') return true;
  const branch = agenceType === 'client' ? app.clientBranch : app.creatorBranch;
  return branch === agenceValue;
});
```

**Structure :** en-tête avec compte + badge overdue, liste de `ApplicationTimelineCard` avec gap, état vide avec icône `TimelineIcon`.

---

## Modifications fichiers existants

| Fichier | Modification |
|---------|-------------|
| `backend/prisma/schema.prisma` | Ajouter `branch String? @map("branch")` à `Client` |
| `backend/prisma/migrations/…` | Migration SQL: `ALTER TABLE "clients" ADD COLUMN "branch" TEXT` |
| `backend/src/routes/codir.ts` | Ajouter `GET /timeline` endpoint + ajouter `clientBranch`/`creatorBranch` à `/dashboard` |
| `src/services/api.ts` | Ajouter `getCodirTimeline()` method |
| `src/types/index.ts` | Ajouter `TimelineStep`, `ApplicationTimeline`, `CodirTimelineData` + mettre à jour `PendingDecisionItem` |
| `src/pages/CodirDashboardPage.tsx` | Ajouter Tabs MUI, état `agenceFilter`, charger timeline data, intégrer `AgenceFilter` |

## Nouveaux fichiers

| Fichier | Rôle |
|---------|------|
| `src/components/codir/AgenceFilter.tsx` | Toggle type + dropdown agence (composant contrôlé) |
| `src/components/codir/ApplicationTimelineCard.tsx` | Carte stepper animée par dossier |
| `src/components/codir/CodirTimelineTab.tsx` | Conteneur + filtrage de la liste timeline |
