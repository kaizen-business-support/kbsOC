# Security Settings — Phase 6b Enforcement Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Traduire les réponses backend Phase 6a en UX cohérente côté frontend : page `/blocked` publique sur 403 IP, banner persistant + désactivation des CTAs sur 423 time-lock, polling 60s pour réactivation auto.

**Architecture:** `SecurityLockContext` + Provider qui polle `/api/security/time-status` toutes les 60s et écoute un event window dispatché par l'axios interceptor sur 423. Hook `useSecurityLock()` consommé par les CTAs métier des pages critiques. Route `/blocked` publique au top niveau de `<Routes>`. Banner sticky non-dismissible avec countdown.

**Tech Stack:** React + TypeScript + MUI + axios + react-router-dom.

**Spec:** `docs/superpowers/specs/2026-05-15-security-settings-phase6b-enforcement-frontend.md`

---

## File structure

- **Frontend — Create**
  - `src/contexts/SecurityLockContext.tsx` — Provider + Context.
  - `src/hooks/useSecurityLock.ts` — hook { disabled, reason, nextOpenAt }.
  - `src/components/security/LockedBanner.tsx` — banner sticky avec countdown.
  - `src/pages/BlockedPage.tsx` — page publique (no auth, no API calls).

- **Frontend — Modify**
  - `src/services/api.ts` — `ApiService.security.timeStatus()` + axios interceptors (403 ip_blocked, 423 outside_time_window).
  - `src/App.tsx` — route `/blocked` au top + wrap dans `SecurityLockProvider` + render `<LockedBanner />`.
  - `src/components/security/IPRulesTab.tsx` — appliquer hook aux CTAs.
  - `src/components/security/TimeRulesTab.tsx` — appliquer hook.
  - `src/components/security/BlockHistoryTab.tsx` — appliquer hook.
  - `src/pages/ApprovalsPage.tsx` — appliquer hook aux boutons d'approbation.
  - `src/pages/CreditApplicationPage.tsx` — appliquer hook.
  - Pages workflow équivalentes — appliquer hook (à identifier au moment de l'impl).

---

## Tâches (concision — détails complets dans le spec)

- **T1** — `src/services/api.ts` :
  - Ajouter `ApiService.security.timeStatus()` retournant `{ success, data: { locked, message, nextOpen, allowReadOnly } }`.
  - Ajouter axios `response` interceptor :
    - 403 + `error: 'ip_blocked'` → `sessionStorage.setItem('blockedIp', resp.data.blockedIp)` + `window.location.href = '/blocked'` (skip si déjà sur /blocked).
    - 423 + `error: 'outside_time_window'` → `window.dispatchEvent(new CustomEvent('security:time-locked', { detail: resp.data }))`.

- **T2** — `src/contexts/SecurityLockContext.tsx` :
  - State `{ timeLocked, timeLockedMessage, nextOpenAt }`.
  - `refresh()` appelle `ApiService.security.timeStatus()` + met à jour le state (best-effort, catch + log warn).
  - `useEffect` au mount : `refresh()` + `setInterval(refresh, 60000)` + `addEventListener('security:time-locked', ...)`. Cleanup au unmount.
  - Skip le polling si pas authentifié (check `useUser().state.currentUser` ou token absent).

- **T3** — `src/hooks/useSecurityLock.ts` : hook simple, lit le context, retourne `{ disabled: timeLocked, reason: timeLockedMessage, nextOpenAt }`.

- **T4** — `src/components/security/LockedBanner.tsx` :
  - Sticky en haut (position fixed avec z-index élevé).
  - Couleur ambre (`#fef3c7` bg, `#92400e` texte).
  - Icône Lock + message + countdown vers `nextOpenAt` (refresh 30s).
  - Non-dismissible (pas de bouton X).
  - Affiché uniquement si `timeLocked === true`.

- **T5** — `src/pages/BlockedPage.tsx` :
  - Composant React simple. **Aucun appel à `api`/`ApiService`** (sinon boucle).
  - Lit `sessionStorage.getItem('blockedIp')` au mount.
  - Layout centré : icône Shield, titre, paragraphe, IP en monospace, message support FR statique.
  - Max-width 600px, padding généreux.

- **T6** — `src/App.tsx` :
  - Route `<Route path="/blocked" element={<BlockedPage />} />` AVANT le pattern catch-all qui force l'auth.
  - Wrap les routes auth dans `<SecurityLockProvider>` (entre AuthProvider et MainLayout).
  - Render `<LockedBanner />` au top du layout authentifié.

- **T7** — Application du hook aux composants sécurité :
  - `IPRulesTab.tsx` : bouton "+ Ajouter", IconButton Toggle/Edit/Delete dans les rows → `disabled={lockDisabled}`.
  - `TimeRulesTab.tsx` : idem.
  - `BlockHistoryTab.tsx` : boutons Unblock par ligne + "Débloquer tout".

- **T8** — Application du hook aux pages métier :
  - `ApprovalsPage.tsx` (ou équivalent) : boutons Approuver/Rejeter/Demander info → identifier les composants et appliquer.
  - `CreditApplicationPage.tsx` : boutons Soumettre/Sauvegarder/Modifier.
  - `WorkflowPage.tsx` : transitions de workflow.
  - Pour chaque fichier : `const { disabled, reason } = useSecurityLock();` puis `<Button disabled={disabled} title={disabled ? reason ?? '' : undefined}>`.

- **T9** — Smoke + push :
  - `tsc --noEmit -p .` clean.
  - Smoke manuel : fenêtre fermée → banner apparaît ≤ 60s + boutons grisés ; IP DENY → redirect /blocked avec IP affichée ; recovery auto quand fenêtre réouvre.
  - Push origin release/v1.0.

Convention de nommage : `SecurityLockContext`, `SecurityLockProvider`, `useSecurityLock`, `LockedBanner`, `BlockedPage`, `ApiService.security.timeStatus`. Event window : `security:time-locked`. SessionStorage key : `blockedIp`.

Pas de tests automatisés (CRA test pipeline non utilisé). Validation = tsc + smoke manuel.
