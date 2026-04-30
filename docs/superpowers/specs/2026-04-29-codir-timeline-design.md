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

**Onglet 0 — Tableau de décision** : vue existante (KPI bar + PendingDecisionsTable + actions relance/réaffectation/escalade). Aucune modification.

**Onglet 1 — Timeline** : liste de cartes `ApplicationTimelineCard`, une par dossier, triées overdue en premier puis par ancienneté (daysWaiting desc).

---

## Filtre agence

### Comportement

Deux contrôles liés placés dans le header de `CodirDashboardPage` :

1. **`ToggleButtonGroup`** MUI compact — deux valeurs :
   - `client` → filtre sur `clientBranch`
   - `ca` → filtre sur `creatorBranch`

2. **`Select` agence** — peuplé dynamiquement depuis `agences.client` ou `agences.ca` selon le type actif. Valeur par défaut : `"all"` (Toutes les agences). Revient à `"all"` quand le type change.

### Application

- Filtrage côté frontend uniquement — aucun ré-appel API.
- Onglet Tableau : filtre le tableau `items` de `CodirDashboardData` sur `assignedRole`... non, sur `clientBranch` (champ à ajouter dans `PendingDecisionItem`) ou `creatorBranch`.
- Onglet Timeline : filtre `applications` du endpoint `/api/codir/timeline`.
- Les deux datasets sont chargés indépendamment et filtrés en mémoire.

> **Note schéma :** `User.branch` (String?) = agence du Charge d'Affaires. `Client.branch` (String?) = agence du client demandeur. Les deux existent déjà dans le schéma Prisma.

---

## Nouveau endpoint : `GET /api/codir/timeline`

**Auth :** `authorize(['codir_dashboard'])`

**Logique backend :**
1. Récupérer tous les dossiers en attente (même filtre que `/dashboard` : status PENDING/IN_REVIEW, application non clôturée).
2. Pour chaque dossier, récupérer toutes les `CreditPolicyStep` de sa politique (ordre complet).
3. Croiser avec les `WorkflowStep` existants (par `stepName`).
4. Les étapes sans `WorkflowStep` correspondant → statut `PENDING` (à venir).
5. Trier les dossiers : overdue en premier (`isOverdue desc`), puis `createdAt asc`.

**Structure de réponse :**

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
            "durationHours": 2
          },
          {
            "stepName": "credit_analysis",
            "stepLabel": "Analyse Crédit",
            "order": 2,
            "status": "IN_PROGRESS",
            "agentName": "Diallo M.",
            "startedAt": "2026-04-20T10:00:00Z",
            "completedAt": null,
            "durationHours": 72
          },
          {
            "stepName": "supervisor_approval",
            "stepLabel": "Approbation Superviseur",
            "order": 3,
            "status": "PENDING",
            "agentName": null,
            "startedAt": null,
            "completedAt": null,
            "durationHours": null
          }
        ]
      }
    ]
  }
}
```

**Types TypeScript à ajouter dans `src/types/index.ts` :**

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

---

## Composants React

### `ApplicationTimelineCard.tsx`

**Props :** `{ application: ApplicationTimeline }`

**Structure visuelle :**

```
┌────────────────────────────────────────────────────────────────┐
│  APP-2026-001  •  SARL Kaizen  •  5 000 000 XOF  [⚠ En retard]│
│  Agence client: Dakar  •  CA: Diallo M. (Agence Centrale)     │
│                                                                  │
│  ●━━━━━━━━━━━●━━━━━━━━━━━◉ · · · · · ○ · · · · · ○           │
│  Dispatching  Analyse     Superviseur   Engagements  CODIR      │
│  Sow A.       Diallo M.   —                                     │
│  2h           3j 4h←SLA                                         │
│  20/04 08h    20/04 10h                                         │
│  → 20/04 10h  → en cours                                        │
└────────────────────────────────────────────────────────────────┘
```

**États visuels des steps :**
- `COMPLETED` : icône check vert (`CheckCircle`), connecteur plein vert
- `IN_PROGRESS` : icône cercle violet (#5c35b5) avec animation `@keyframes pulse` (scale 1→1.15→1, 1.5s infinite), connecteur pointillé
- `PENDING` : icône cercle gris clair, connecteur pointillé gris

**Animation d'entrée :**
- Utiliser MUI `Fade` + `Grow` combinés avec un `transitionDelay` par step : `delay = stepIndex × 80ms`
- L'effet : les steps apparaissent en séquence de gauche à droite à l'affichage de l'onglet

**Durée affichée :**
- `durationHours < 1` → `"< 1h"`
- `1 ≤ durationHours < 24` → `"Xh"`
- `durationHours ≥ 24` → `"Xj Yh"`
- Si SLA dépassé sur l'étape en cours → durée en rouge

**Implémentation :**
- Utiliser `MUI Stepper` avec `alternativeLabel={false}` et un layout personnalisé (pas le Stepper standard qui est trop vertical) — implémenter avec `Box + flexbox` pour un contrôle total du design
- Le header de la carte : `MUI Card` + `CardContent`

### `CodirTimelineTab.tsx`

**Props :** `{ applications: ApplicationTimeline[]; agenceFilter: { type: 'client' | 'ca'; value: string } }`

**Logique de filtrage :**
```ts
const filtered = applications.filter(app => {
  if (agenceFilter.value === 'all') return true;
  const branch = agenceFilter.type === 'client' ? app.clientBranch : app.creatorBranch;
  return branch === agenceFilter.value;
});
```

**Structure :**
- En-tête : `"{N} dossiers" [badge rouge si overdue > 0]`
- Liste de `ApplicationTimelineCard` avec `gap: 2`
- État vide : icône `TimelineIcon` + "Aucun dossier en attente pour ce filtre"

---

## Filtre agence — composant

**`AgenceFilter.tsx`** (nouveau composant dans `src/components/codir/`) :

**Props :** `{ agences: { client: string[]; ca: string[] }; onChange: (type: 'client' | 'ca', value: string) => void }`

- `ToggleButtonGroup` : "Agence client" / "Agence CA" — taille `small`
- `Select` MUI taille `small` : "Toutes les agences" + valeurs dynamiques
- Quand le type change → reset value à `'all'`

---

## Modifications des fichiers existants

| Fichier | Modification |
|---------|-------------|
| `backend/src/routes/codir.ts` | Ajouter `GET /timeline` endpoint |
| `src/services/api.ts` | Ajouter `getCodirTimeline()` method |
| `src/types/index.ts` | Ajouter `TimelineStep`, `ApplicationTimeline`, `CodirTimelineData` |
| `src/pages/CodirDashboardPage.tsx` | Ajouter Tabs, état agenceFilter, charger timeline data |

## Nouveaux fichiers

| Fichier | Rôle |
|---------|------|
| `src/components/codir/ApplicationTimelineCard.tsx` | Carte stepper par dossier |
| `src/components/codir/CodirTimelineTab.tsx` | Conteneur de la liste timeline |
| `src/components/codir/AgenceFilter.tsx` | Toggle type + dropdown agence |

---

## Contraintes techniques

- Aucune nouvelle migration DB — toutes les données existent (`User.branch`, `Client.branch`, `WorkflowStep`, `CreditPolicyStep`)
- Le filtre agence s'applique côté frontend uniquement (les données sont déjà chargées)
- L'onglet Timeline charge ses données indépendamment de l'onglet Tableau (appel séparé au montage)
- Le stepper est implémenté en flexbox custom (pas `MUI Stepper` natif) pour un contrôle total de l'animation et du layout
