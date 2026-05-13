# Refonte page d'accueil — banking pro sobre

**Date :** 2026-05-13
**Statut :** design validé, prêt pour plan d'implémentation

## 1. Contexte & objectif

`src/pages/HomePage.tsx` (639 lignes) présente aujourd'hui une grille de modules sur fond clair avec **des gradients très colorés** (bleu, indigo, violet, cyan, émeraude) et des effets visuels marqués. L'utilisateur juge cette esthétique inadaptée à un produit bancaire : il veut un design **clair, sobre, institutionnel** et **role-aware**, où chaque utilisateur voit un tableau de bord adapté à son profil.

Périmètre : la page d'accueil + un polish visuel de la Sidebar (palette, espacements, icônes) sans toucher au reste de l'application.

## 2. Direction visuelle — "sobre institutionnel"

### Design tokens

| Token | Valeur | Usage |
|---|---|---|
| `bg.page`      | `#F8FAFC` | Fond global de la home |
| `bg.surface`   | `#FFFFFF` | Cards modules, cards KPI |
| `bg.subtle`    | `#F1F5F9` | Conteneurs internes, hover discret |
| `accent.primary` | `#1F4E79` | Navy (déjà utilisé dans l'app — pas un nouveau brand) |
| `accent.hover`   | `#2A5E92` | Hover des cards & icônes |
| `accent.muted`   | `#E0E9F2` | Fond mono d'icône module |
| `text.primary`   | `#0F172A` | Titres |
| `text.secondary` | `#475569` | Sous-titres, descriptions |
| `text.muted`     | `#94A3B8` | Métadonnées (date, agence) |
| `border.default` | `#E2E8F0` | Filets de cards, séparateurs |
| `shadow.card`        | `0 1px 2px rgba(15,23,42,0.04), 0 1px 1px rgba(15,23,42,0.02)` | Cards au repos |
| `shadow.card.hover`  | `0 6px 16px rgba(15,23,42,0.08)` | Cards en hover |
| `radius.card`    | `12px` | Cards modules + KPI |
| `radius.chip`    | `999px` | Chips (rôle, agence, statut) |
| `transition.fast`| `180ms cubic-bezier(0.22,1,0.36,1)` | Hover |
| `transition.enter`| `320ms cubic-bezier(0.22,1,0.36,1)` | Entrée de page |

### Typographie

- Famille : `Inter, "Helvetica Neue", Roboto, sans-serif` (inchangé si déjà la stack du projet).
- Hero (`Bonjour, M. Diop`) : 28px / 700.
- Sous-titre hero (date · agence) : 14px / 500 / `text.muted`.
- KPI value : 26px / 700 monospaced numerals (`font-variant-numeric: tabular-nums`).
- KPI label : 12px / 500 / `text.secondary` / uppercase / letter-spacing 0.04em.
- Module titre : 15px / 600.
- Module description : 13px / 400 / `text.secondary`.

**Aucun gradient. Aucune couleur saturée autre que le navy d'accent.** L'œil doit pouvoir reposer sur la page.

## 3. Layout & composition

```
┌──────────────────────────────────────────────────┐
│  HERO                                            │
│   Bonjour, M. Diop · Mer 13 mai 2026             │
│   BCI · Agence Dakar                  [Chip rôle]│
├──────────────────────────────────────────────────┤
│  KPI BAND — 4 cards (grid responsive)            │
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │
│   │  12  │ │ 8.2M │ │ ▲3.2%│ │  47  │            │
│   │ Label│ │ Label│ │ Label│ │ Label│            │
│   └──────┘ └──────┘ └──────┘ └──────┘            │
├──────────────────────────────────────────────────┤
│  MODULES — groupes existants harmonisés          │
│                                                  │
│  Processus Crédit                                │
│  ────                                            │
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │
│   │ icon │ │ icon │ │ icon │ │ icon │            │
│   │titre │ │titre │ │titre │ │titre │            │
│   │desc  │ │desc  │ │desc  │ │desc  │            │
│   └──────┘ └──────┘ └──────┘ └──────┘            │
│                                                  │
│  Analyse Hors-Processus                          │
│  ────                                            │
│   ...                                            │
└──────────────────────────────────────────────────┘
```

### Modules — card unitaire

```
┌────────────────────────┐
│  ┌────┐                │
│  │ ▣  │  (icône navy   │   icon background = accent.muted (#E0E9F2)
│  └────┘   sur fond mat │
│                        │
│  Clients               │   text.primary 15/600
│  Annuaire & fiches…    │   text.secondary 13/400
└────────────────────────┘
   ↑ borders fins, radius 12px, shadow card.
   Hover : translateY(-1px) + shadow.card.hover + icône hover → accent.hover.
```

Pas d'icône blanche sur gradient, pas de glow coloré.

## 4. KPIs adaptés au rôle

### Mapping rôle → KPIs

| Rôle Prisma                        | KPI 1                          | KPI 2                          | KPI 3                          | KPI 4                          |
|------------------------------------|--------------------------------|--------------------------------|--------------------------------|--------------------------------|
| `CHARGE_AFFAIRES` / `ASSISTANT_COMMERCIAL` | Mes dossiers en cours          | Encours de mes clients         | Contrats signés ce mois        | Échéances en alerte            |
| `ANALYSTE_RISQUES` / `RESPONSABLE_RISQUES` / `BACK_OFFICE` | À traiter (file)               | SLA respecté (%)               | Taux d'approbation             | Étapes en retard               |
| `DIRECTION_GENERALE` / `COMITE_CREDIT` / `DIR_AG` | Volume global (dossiers)       | Encours total tenant           | Taux d'approbation             | Durée moyenne traitement       |
| `RESPONSABLE_ENGAGEMENTS` / `DIRECTION_JURIDIQUE` | À traiter (file)               | Contrats signés ce mois        | Délai juridique moyen          | Étapes en retard               |
| `ADMIN` / `SUPER_ADMIN`            | Volume global tenant           | Encours total tenant           | Utilisateurs actifs (30j)      | Anomalies / alertes système    |

### Endpoint

**Nouveau** : `GET /api/home/kpis` (`backend/src/routes/home-kpis.ts`)

- Middlewares hérités : `authenticate`, `requireCompany`.
- Service : `backend/src/services/homeKpiService.ts` qui exporte `buildHomeKpisForUser(user, companyId): Promise<HomeKpi[]>`.
- Réutilise au maximum les requêtes déjà présentes dans :
  - `workflowService.getApplicationProcessingStats` / `getNextWorkflowStep`
  - les routes analytics (taux d'approbation, encours, SLA)
  - `codir` (volume global)
- Réponse :
  ```json
  {
    "success": true,
    "kpis": [
      { "key": "in_progress",  "label": "Mes dossiers en cours",  "value": 12,      "format": "number",  "trend": null },
      { "key": "exposure",     "label": "Encours de mes clients", "value": 8200000, "format": "currency","trend": null },
      { "key": "signed_month", "label": "Contrats signés (mois)", "value": 7,       "format": "number",  "trend": { "delta": 0.18, "direction": "up" } },
      { "key": "alerts",       "label": "Échéances en alerte",    "value": 3,       "format": "number",  "trend": null }
    ]
  }
  ```
- Format gérés côté front : `number`, `currency` (XOF avec abbréviation M/K), `percent`.

### Tolérance aux pannes

Si une sous-requête échoue, le KPI concerné renvoie `value: null` avec `error: true` côté serveur. Le front affiche un `—` discret. L'erreur ne casse jamais la home.

## 5. Permissions & gating des modules

Le filtre actuel dans `Sidebar.tsx` (≈100 lignes de `hasPermission`/`canAccess`/`isRole`) **est extrait dans un hook partagé** : `src/hooks/useAccessibleModules.ts`.

```ts
export interface AccessibleModuleGroup {
  label: string;
  modules: AccessibleModule[];
}

export interface AccessibleModule {
  id: PageType;
  label: string;
  description: string;        // courte, pour la home
  icon: React.ElementType;
}

export function useAccessibleModules(): AccessibleModuleGroup[];
```

`Sidebar.tsx` et `HomePage.tsx` consomment tous deux ce hook : impossible que la home propose un module que la sidebar cache (ou inversement). Single source of truth.

Le hook lit `UserContext` (rôle + permissions) et applique les mêmes règles qu'aujourd'hui — pas de changement fonctionnel.

## 6. Animations (intensité "moyenne")

| Élément | Animation | Durée | Détail |
|---|---|---|---|
| Hero | fade-in + translateY(-8 → 0) | 320ms | À l'arrivée |
| KPI band | fade-in séquentiel des 4 cards | 80ms d'offset entre cards | Démarre après Hero (200ms delay) |
| Compteurs KPI | `requestAnimationFrame` 0 → value | 800ms ease-out | `tabular-nums`, pas de saccade |
| Module groups | fade-in séquentiel par groupe | 100ms entre groupes | Démarre après KPIs (320ms delay) |
| Module card hover | translateY(-1px) + shadow + icône → `accent.hover` | 180ms | `transition.fast` |
| Hero background | parallax subtil au scroll (3-5px max) | tied to scroll | `transform: translate3d` only — pas de JS lourd |
| Loading | shimmer skeleton sur KPI band et grille | infinite tant que loading | Linear gradient gris très pâle qui glisse |

**Préférence utilisateur** : respecter `prefers-reduced-motion: reduce` → réduire tout aux fade-in courts (200ms), désactiver parallax et counters (afficher la valeur finale directement).

## 7. Composants — décomposition

`src/pages/HomePage.tsx` actuel (639 lignes) → réécriture en orchestrateur léger (~120 lignes) + composants dédiés :

```
src/pages/HomePage.tsx                       ← orchestrateur (Hero + KpiBand + ModuleGrid)
src/components/home/HomeHero.tsx             ← bandeau bienvenue + meta (date, agence, chip rôle)
src/components/home/HomeKpiBand.tsx          ← grid 4 KPI + état loading/error
src/components/home/HomeKpiCard.tsx          ← unité KPI (value, label, trend, animation compteur)
src/components/home/HomeModuleGrid.tsx       ← groupes + filets de séparation
src/components/home/HomeModuleCard.tsx       ← card module unitaire
src/components/home/homeTokens.ts            ← export des design tokens (palette, transitions, shadows)
src/hooks/useAccessibleModules.ts            ← single source of truth permission → modules
src/hooks/useHomeKpis.ts                     ← fetch + cache du GET /home/kpis
backend/src/routes/home-kpis.ts              ← GET /api/home/kpis
backend/src/services/homeKpiService.ts       ← buildHomeKpisForUser(user, companyId)
backend/src/__tests__/homeKpiService.test.ts ← snapshot par rôle
```

`Sidebar.tsx` est modifié pour consommer `useAccessibleModules()` au lieu de sa logique interne — on extrait, on ne duplique pas.

## 8. Sidebar — polish visuel

Périmètre strict (pas de restructuration des groupes) :

1. Palette : tous les hover/sélections en `accent.primary` (`#1F4E79`). Fond items hover en `bg.subtle` (`#F1F5F9`). Séparateurs `border.default`.
2. Espacement : padding vertical des items aligné (9→10px), gap entre groupes uniforme (16px).
3. Icônes : passer en `*Outlined` partout (cohérence avec la home — la home utilise déjà cette famille).
4. Audit : vérifier qu'aucun item n'est manquant (nouvelle page non listée) ni périmé (page supprimée encore listée). Si un orphelin est trouvé, c'est signalé mais **traité hors de cette PR** (issue séparée).

## 9. Hors-périmètre

- Toggle dark/light : abandonné (besoin = clair, sobre).
- Refonte des autres pages (Analytics, CODIR, Approvals, Workflow, etc.).
- Internationalisation : chaînes en français comme aujourd'hui.
- Mobile-first redesign : la home garde un comportement responsive identique à l'existant (la grille reflow déjà).
- Nouveau back-end pour les modules accessibles : on ne change pas le contrat `permissions[]` du UserContext.
- Nouveaux KPIs / agrégations métier : on utilise les agrégations déjà disponibles dans `analytics` / `codir` / `workflowService`.

## 10. Limites connues

- **Tabular-nums et compteurs animés** : sur certaines polices système, les chiffres peuvent légèrement "danser" si la fonte n'expose pas `tabular-nums`. Si Inter n'est pas chargée, on tombe sur Helvetica/Roboto qui supportent l'option.
- **Latence du `/home/kpis`** : si l'agrégation est lente (>800ms), les compteurs ne démarrent qu'après chargement → l'utilisateur voit le shimmer puis le compteur. Acceptable.
- **Sidebar et Home synchrones** : si `useAccessibleModules` retourne une liste différente lors d'un re-render (ex : permissions actualisées après refresh token), les deux UIs se mettent à jour en même temps. Pas de désynchronisation possible.

## 11. Tests

- `homeKpiService.test.ts` (unit) : pour chacun des 5 buckets de rôle, vérifier que `buildHomeKpisForUser` retourne 4 KPIs avec les bons `key` + `format`.
- `home-kpis` route (integration léger) : 200 avec tableau de 4 éléments pour BACK_OFFICE et CHARGE_AFFAIRES ; 403 si pas de tenant.
- `useAccessibleModules` (unit) : avec un mock UserContext, 3 profils (CA, BO, ADMIN) → vérifie la liste retournée.
- Frontend (smoke manuel) :
  - Charger la home en BACK_OFFICE → voir les 4 KPIs corrects + compteurs anim → cards modules.
  - Switcher en CHARGE_AFFAIRES → constater le changement des KPIs.
  - Activer `prefers-reduced-motion` → compteurs et parallax désactivés.
  - Sidebar : palette navy, hover, séparateurs cohérents avec la home.

## 12. Migration / déploiement

Aucune migration de schéma. Aucun backfill. La feature est additive — désactivable en réintroduisant l'ancienne `HomePage.tsx` (sauvegardée dans l'historique git).
