# Onboarding première connexion — ERPNext-style

**Date** : 2026-05-18
**Statut** : Design validé, prêt pour planification
**Branche cible** : `release/v1.0`

## Contexte & objectif

OptimusCredit n'a actuellement aucun parcours guidé pour les nouveaux utilisateurs. Quand un utilisateur se connecte pour la première fois (par exemple un employé d'une nouvelle banque cliente, ou un user fraîchement créé par un ADMIN), il arrive directement sur la HomePage sans introduction au produit.

**Objectif** : implémenter un tour guidé première connexion, fluide, sobre et professionnel, qui présente les grandes fonctionnalités de la plateforme adaptées aux permissions de l'utilisateur. Inspiration ERPNext : produit pro, peu de distraction visuelle, l'utilisateur apprend en voyant l'UI réelle.

## Cadrage validé en brainstorming

1. **Contenu** : tour guidé du produit (pédagogique, pas d'action requise de l'utilisateur).
2. **Adaptation rôle** : filtrage automatique des étapes selon les permissions (`canAccess` / `canAction`). Pas de variantes scriptées par famille de rôles.
3. **Format visuel** : coachmarks (tooltips ancrés sur les vrais éléments de l'UI, écran assombri autour).
4. **Persistance** : champ DB `User.onboardingCompletedAt`. Bouton "Refaire le tour" dans le menu profil pour relance manuelle.

## Stack technique

- **Lib tour** : `shepherd.js` + `react-shepherd` (v6+). Choix retenu après comparaison avec `react-joyride` (rejeté) et implémentation MUI maison (rejetée pour coût/maintenance).
- **Frontend** : React + TypeScript + MUI (existant).
- **Backend** : Express + Prisma + PostgreSQL (existant).
- **API** : appels via `axios` avec URL relative `window.location.origin/api` (convention projet).

## Architecture

### Détection première connexion (backend)

Migration Prisma : ajouter sur le modèle `User` (dans `backend/prisma/schema.prisma`) :

```prisma
onboardingCompletedAt DateTime? @map("onboarding_completed_at")
```

Trois endpoints REST exposés sous `/api/users/me/onboarding` (route protégée par le middleware d'auth existant) :

| Méthode | Chemin | Réponse | Action |
|---|---|---|---|
| GET | `/users/me/onboarding` | `{ shouldShow: boolean }` | `shouldShow = (onboardingCompletedAt === null)` |
| POST | `/users/me/onboarding/complete` | `{ success: true }` | `onboardingCompletedAt = new Date()` (idempotent) |
| POST | `/users/me/onboarding/reset` | `{ success: true }` | `onboardingCompletedAt = null` |

Pas de payload sur POST. Tous les endpoints utilisent `req.userId` extrait du JWT — aucun userId en paramètre.

### Déclenchement (frontend)

- Provider `OnboardingProvider` placé dans `App.tsx`, sous `UserProvider` et `CompanyProvider` (besoin du user et de l'entreprise active pour filtrer les étapes et obtenir les permissions).
- Le provider wrappe `ShepherdJourneyProvider` (de `react-shepherd`) avec la configuration des étapes.
- Au mount du provider, si user authentifié :
  1. Appel `GET /users/me/onboarding`.
  2. Si `shouldShow === true`, on attend 600 ms (laisser la HomePage finir son rendu et stabiliser les sélecteurs `data-tour`), puis on lance `tour.start()`.
- Hook `useOnboarding()` exposé : `{ start, restart, skip, isActive }` consommé par le menu profil dans `Header.tsx`.

### Étapes du tour

L'ordre suit la logique de découverte (welcome → modules dans l'ordre de la sidebar → profil → conclusion). Chaque étape sauf welcome/conclusion cible un élément réel via `data-tour="..."`.

| # | Cible sélecteur | Titre | Condition d'affichage |
|---|---|---|---|
| 1 | aucune (modal centré) | Bienvenue sur OptimusCredit | toujours |
| 2 | `[data-tour="sidebar-dashboard"]` | Pilotage & Rapports | `canViewAnalytics \|\| canViewReports \|\| canViewCodir` |
| 3 | `[data-tour="sidebar-credit"]` | Processus Crédit | `canViewApplications` |
| 4 | `[data-tour="sidebar-analysis"]` | Analyse financière | `canFinancialAnalysis` |
| 5 | `[data-tour="sidebar-config"]` | Configuration | `canViewConfiguration` |
| 6 | `[data-tour="header-profile"]` | Profil & notifications | toujours |
| 7 | aucune (modal centré) | C'est parti — explorez | toujours |

**Filtrage** : effectué AVANT le démarrage du tour, dans `onboardingSteps.ts`. Les étapes dont la condition est `false` ne sont jamais ajoutées à la liste passée à shepherd. Cela évite les étapes vides au runtime.

**Variante mobile** (`useMediaQuery('(max-width:600px)')`) : la sidebar est cachée derrière un drawer. Les étapes 2-5 sont remplacées par une étape unique qui cible `[data-tour="mobile-menu-trigger"]` avec un texte : "Tous les modules de la plateforme sont accessibles depuis ce menu, adaptés à votre rôle."

### Comportement du tour

- Backdrop assombri avec spotlight sur le target (option shepherd `useModalOverlay: true`).
- Boutons :
  - `Passer le tour` (haut-droit du tooltip, discret, gris).
  - `Précédent` / `Suivant` en bas.
  - Sur la dernière étape : `Terminer`.
- Indicateur de progression : `Étape 3 / 7` en footer.
- Skip et Terminer appellent tous les deux `POST /users/me/onboarding/complete` (idempotent côté serveur).
- Échec d'un appel API (status, complete, reset) : on log `console.warn`, on ne bloque pas l'UX, le tour reste pilotable.
- Si target absent au moment du show step (cas edge : DOM modifié) : shepherd attache la step en mode "centré" automatiquement (`attachTo: null`), pas de crash.

### Style (Prestige Light)

Override CSS dans `src/styles/shepherd.css`, importé après `shepherd.js/dist/css/shepherd.css` :

- Tooltip : `border-radius: 12px`, `box-shadow: 0 20px 40px -8px rgba(15,23,42,0.18)`, `border: 1px solid #E2E8F0`, `background: #FFFFFF`, `max-width: 380px`.
- Titre : `Plus Jakarta Sans`, weight 700, 18px, couleur `#1E293B`.
- Corps : `Inter`, 14px, line-height 1.6, couleur `#475569`.
- Bouton primaire : `background: #1F4E79`, `color: #FFFFFF`, `border-radius: 8px`, `padding: 8px 16px`, `transition: 150ms`.
- Bouton secondaire (Précédent / Passer) : texte `#64748B`, hover `#1E293B`.
- Flèche du tooltip : même `#E2E8F0` que le bord.
- Backdrop : `rgba(15, 23, 42, 0.55)` + `backdrop-filter: blur(2px)`.
- Animation entrée : fade-in 200 ms + `translate-y: 4px → 0`. Pas de bounce.

### Accessibilité

- Focus trap géré par shepherd sur le tooltip actif.
- Raccourcis clavier shepherd :
  - `Esc` → ferme le tour (équivalent à Passer).
  - `Enter` → Suivant.
  - `← / →` → navigation Précédent / Suivant.
- `aria-label` sur boutons, `role="dialog"` géré par shepherd.
- Respect `prefers-reduced-motion` : on désactive les transitions dans la CSS via media query.

### Accès ultérieur

Le bouton "Refaire le tour de bienvenue" (icône `TourOutlined` de `@mui/icons-material`) est ajouté dans le menu déroulant de l'avatar (`Header.tsx`). Comportement de `restart()` :

1. Appelle `POST /users/me/onboarding/reset` (set `onboardingCompletedAt = null`).
2. Ferme le menu de l'avatar.
3. Si l'utilisateur n'est pas sur la HomePage, navigue vers Home (les sélecteurs sidebar / header restent disponibles dans le layout, mais centrer le tour sur Home est plus cohérent narrativement).
4. Lance `tour.start()` après 300 ms.

Pas de bandeau de relance automatique. Le skip est définitif jusqu'à action manuelle de l'utilisateur.

## Structure des fichiers

### Nouveaux fichiers (frontend)

```
src/
├── components/
│   └── onboarding/
│       ├── OnboardingProvider.tsx
│       ├── useOnboarding.ts
│       └── onboardingSteps.ts
├── styles/
│   └── shepherd.css
└── services/
    └── onboardingApi.ts
```

- `OnboardingProvider.tsx` : provider qui gère le state `isActive`, lance le tour au mount si `shouldShow=true`, instancie `ShepherdJourneyProvider` avec les étapes filtrées.
- `useOnboarding.ts` : hook retournant `{ start, restart, skip, isActive }`.
- `onboardingSteps.ts` : fonction pure `buildSteps(permissions, isMobile, roleLabel) => Step[]`. Aucun side-effect, testable en isolation.
- `shepherd.css` : override visuel décrit ci-dessus.
- `onboardingApi.ts` : 3 fonctions axios : `getOnboardingStatus()`, `completeOnboarding()`, `resetOnboarding()`.

### Fichiers modifiés (frontend)

- `src/App.tsx` : ajouter `<OnboardingProvider>` autour des children (sous `UserProvider`, `CompanyProvider`).
- `src/components/Sidebar.tsx` : ajouter `data-tour="sidebar-{dashboard|credit|analysis|config}"` sur les `SectionHeader` correspondants.
- `src/components/Header.tsx` : ajouter `data-tour="header-profile"` sur l'avatar, ajouter `data-tour="mobile-menu-trigger"` sur le bouton hamburger mobile, et nouvelle entrée "Refaire le tour de bienvenue" dans le menu déroulant.
- `src/main.tsx` (ou point d'entrée CSS global) : importer `'shepherd.js/dist/css/shepherd.css'` puis `'./styles/shepherd.css'`.
- `package.json` : ajouter `shepherd.js` et `react-shepherd` en dépendances.

### Nouveaux fichiers / modifications (backend)

- `backend/prisma/schema.prisma` : ajout du champ `onboardingCompletedAt DateTime? @map("onboarding_completed_at")` sur `User`.
- `backend/prisma/migrations/{timestamp}_add_onboarding_completed_at/migration.sql` : migration SQL générée par `prisma migrate dev`.
- `backend/src/routes/users.ts` (ou fichier existant gérant `/me`) : ajouter les 3 endpoints décrits. Tous protégés par le middleware d'auth, multi-tenant respecté implicitement (le user est identifié par son JWT, aucun cross-tenant possible).

## Vérification manuelle

Pas de tests automatisés frontend ajoutés (cohérent avec le reste du projet, qui n'a pas de suite jest active sur les pages React). Plan de vérification manuelle :

1. **Première connexion d'un user neuf** : créer un user en DB (ou reset onboarding sur un user existant via `POST /onboarding/reset` manuellement) → login → vérifier que le tour apparaît après que la HomePage est rendue.
2. **Filtrage par rôle** :
   - SUPER_ADMIN → toutes les étapes 2-5 apparaissent.
   - CHARGE_AFFAIRES → étape Configuration (5) absente.
   - ANALYSTE_RISQUES → étape Configuration absente, étape Analyse présente.
   - BACK_OFFICE → étape Analyse absente.
3. **Persistance skip** : skip le tour → vérifier que `onboardingCompletedAt` est set en DB → relogger → tour n'apparaît pas.
4. **Persistance terminer** : aller jusqu'au bout → même vérification.
5. **Refaire le tour** : depuis le menu profil → cliquer "Refaire le tour" → le tour réapparaît, `onboardingCompletedAt` est revenu à null puis se re-définit après complétion.
6. **Mobile** (résolution `< 600px`) : la sidebar est cachée, vérifier que les étapes 2-5 sont remplacées par une seule étape ciblant le hamburger.
7. **Accessibilité clavier** : naviguer le tour entièrement au clavier (Tab, Enter, Esc, flèches).
8. **Erreur réseau** : couper le backend, déclencher "Refaire le tour" → vérifier que l'UI ne crashe pas, log de warning visible en console.

## Hors scope

- Pas d'onboarding différencié par tenant (le contenu ne dépend pas de `companyId`, uniquement des permissions).
- Pas de gamification (badges, progression XP).
- Pas de tracking analytics (Mixpanel/PostHog) — peut être ajouté plus tard si besoin.
- Pas de traduction i18n : tout le texte est en français (cohérent avec le reste du projet qui a un i18n partiel mais où l'onboarding est typiquement écrit dans la langue principale).
- Pas de vidéos / animations Lottie embarquées : icônes MUI suffisantes pour le "sobre & pro".

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Sélecteur `data-tour` disparaît suite à un refacto de Sidebar/Header | Convention documentée dans ce spec ; les attributs `data-tour` sont sémantiques (non couplés au CSS) donc grepables facilement. |
| Permissions chargées de façon asynchrone après le mount du provider | Le `useEffect` du provider dépend de `userState.currentUser` et `activeCompany`. Le tour ne se lance que quand les deux sont prêts. |
| Migration Prisma sur DB de prod | Champ nullable avec default null → migration sans risque (pas de backfill nécessaire). Tous les utilisateurs existants verront `onboardingCompletedAt = null` et donc le tour à leur prochaine connexion. Si non souhaité, ajouter une étape SQL post-migration `UPDATE users SET onboarding_completed_at = NOW() WHERE last_login IS NOT NULL` pour considérer les users déjà actifs comme ayant "déjà vu". À confirmer avec l'utilisateur au moment de l'implémentation. |
| Bundle size : shepherd.js + react-shepherd ≈ 35 KB gzip | Acceptable. Possibilité future de lazy-load le provider si critique. |
