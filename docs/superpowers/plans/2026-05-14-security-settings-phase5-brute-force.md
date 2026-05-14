# Security Settings — Phase 5 Brute-Force Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Détecter les tentatives de connexion répétées sur un même compte, verrouiller le compte (pas l'IP) via Redis TTL, notifier l'utilisateur par email, auditer dans `security_block_history`, et purger le flag Redis automatiquement lors du déblocage manuel via l'UI Phase 4.

**Architecture:** Service `bruteForceTracker` (Redis INCR + flag) + middleware `bruteForceGate` monté uniquement sur `POST /api/auth/login` + orchestrateur `triggerBruteForceLockout` (audit + email) + hook dans `securityBlockHistoryService.unblockOne` pour purger le flag Redis. Email via `enqueueEmail` existant.

**Tech Stack:** Node.js + Express + Redis (clés `bf:fail:user:*`, `bf:block:user:*`) + Prisma + Jest.

**Spec:** `docs/superpowers/specs/2026-05-14-security-settings-phase5-brute-force.md`

---

## File structure

- **Backend — Create**
  - `backend/src/services/bruteForceTracker.ts` — counters + flag + getConfig.
  - `backend/src/services/bruteForceEmail.ts` — template du mail (subject/html/text).
  - `backend/src/services/triggerBruteForceLockout.ts` — orchestrateur (audit + email).
  - `backend/src/middleware/bruteForceGate.ts` — 429 si email verrouillé.
  - `backend/src/__tests__/bruteForceTracker.test.ts` — unit (Redis mocké).
  - `backend/src/__tests__/bruteForceFlow.test.ts` — intégration end-to-end.

- **Backend — Modify**
  - `backend/.env.example` — `BF_THRESHOLD`, `BF_WINDOW_SEC`, `BF_BLOCK_DURATION_SEC`.
  - `backend/src/routes/auth.ts` — mount middleware + appel tracker dans le handler.
  - `backend/src/services/securityBlockHistoryService.ts` — purge Redis dans `unblockOne` si reason BRUTE_FORCE.

---

## Tâches (concision — détails complets dans le spec)

- **T1** — `bruteForceTracker.ts` : `recordFailedAttempt` (INCR + EX, retourne `blocked: true` UNIQUEMENT lors de la transition au seuil), `recordSuccessfulAttempt` (purge), `isBlocked`, `purgeBlocksForEmail`, `getBruteForceConfig`. Normalisation email (trim+lowercase). Fail-open Redis. Tests unit ~8 cas (mock Redis client via `jest.mock`).
- **T2** — `bruteForceEmail.ts` : helper pur `buildBruteForceLockoutEmail({ recipientName, failedAttempts, windowMinutes, unlockAt })` → `{ subject, bodyHtml, bodyText }`. Sujet FR. Pas de test dédié (validation par snapshot dans T3).
- **T3** — `triggerBruteForceLockout.ts` : lookup user par email + insert `securityBlockHistory` (reason BRUTE_FORCE, attemptedUserId nullable selon match, companyId via memberships[0]) + enqueue email si user existe. Wrap try/catch + log warn (best-effort).
- **T4** — `bruteForceGate.ts` : middleware mince qui appelle `isBlocked(req.body.email)` et retourne 429 si vrai. Pas de test dédié (couvert par T5).
- **T5** — `backend/.env.example` : ajout des 3 variables. Modification `auth.ts` : mount `bruteForceGate` avant le handler login, appel `recordFailedAttempt`/`recordSuccessfulAttempt`/`triggerBruteForceLockout` aux bons endroits. Test intégration `bruteForceFlow.test.ts` : 5 échecs → 6ᵉ = 429 + audit créé + email enqueued (mock).
- **T6** — modification `securityBlockHistoryService.ts.unblockOne` : si `existing.blockReason === 'BRUTE_FORCE'` ET `existing.attemptedUserId` non null → load user.email → `purgeBlocksForEmail(email)`. Best-effort.
- **T7** — Smoke + push.

Convention de nommage cohérente : `bruteForceTracker`, `bruteForceGate`, `triggerBruteForceLockout`, `buildBruteForceLockoutEmail`, `purgeBlocksForEmail`.

Pattern d'implémentation identique aux Phases 2-4 (commits granulaires par tâche, tests TDD côté backend, fail-open Redis).
