# Security Settings — Phase 6a Enforcement Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner le comportement backend d'enforcement sur le PATCH client : 423 (Locked) sur mutations hors fenêtre temporelle (avec distinction GET via `allow_read_only`), dédoublonnage de l'audit par session, endpoint `current-status` non-bloquable pour le polling frontend, réponse IP block enrichie de `blockedIp`. Aucun changement structurel à l'ordre des middlewares.

**Architecture:** Migration additive `allowReadOnly` sur `SecurityTimeRule`. Réécriture de `timeRulesGate` (423, method filter, allow_read_only, dedup Redis). Nouveau helper pur `nextOpenAt` dans le matcher. Nouveau service `securityTimeStatusService` + route `/api/security/time-status` (montée sans timeRulesGate). Réponse IP block enrichie (1 ligne).

**Tech Stack:** Node.js + Express + Prisma + Redis + Jest.

**Spec:** `docs/superpowers/specs/2026-05-14-security-settings-phase6a-enforcement-behavior-backend.md`

---

## File structure

- **Backend — Create**
  - `backend/prisma/migrations/<ts>_add_time_rule_allow_read_only/migration.sql` — auto-générée.
  - `backend/src/services/securityTimeStatusService.ts` — calcul du statut courant.
  - `backend/src/routes/security-time-status.ts` — GET /.
  - `backend/src/__tests__/securityTimeStatusRoute.test.ts` — intégration.

- **Backend — Modify**
  - `backend/prisma/schema.prisma` — ajout `allowReadOnly` sur `SecurityTimeRule`.
  - `backend/src/services/timeRuleMatcher.ts` — ajout `nextOpenAt` + tests.
  - `backend/src/services/securityRulesCache.ts` — inclure `allowReadOnly` dans `CachedTimeRule` + select.
  - `backend/src/services/securityTimeRulesService.ts` — accepter `allowReadOnly` au create/update.
  - `backend/src/middleware/timeAccess.ts` — réécriture (423, method filter, allow_read_only, dedup).
  - `backend/src/middleware/ipAccess.ts` — réponse JSON `blockedIp`.
  - `backend/src/server.ts` — mount `/api/security/time-status`.
  - `backend/src/__tests__/timeRuleMatcher.test.ts` — tests `nextOpenAt`.
  - `backend/src/__tests__/securityTimeRulesRoute.test.ts` — accepter `allowReadOnly`.

---

## Tâches (concision — détails complets dans le spec)

- **T1** — Schema + migration `add_time_rule_allow_read_only` (Bool default false). `prisma generate`.
- **T2** — Extension `securityRulesCache.ts` : `CachedTimeRule` inclut `allowReadOnly` (select + map). Idempotent : la lecture du cache d'un payload existant sans le champ retourne `false`.
- **T3** — Extension `securityTimeRulesService.ts` : `CreateTimeRuleInput`/`UpdateTimeRuleInput` acceptent `allowReadOnly?: boolean`, persisté avec default false. Tests ajoutés dans `securityTimeRulesRoute.test.ts` (POST avec/sans `allowReadOnly`, PUT modifie le champ).
- **T4** — Helper `nextOpenAt(rules, user, fromDate, maxDays=14)` dans `timeRuleMatcher.ts` : itère sur les règles ciblant l'user, calcule via `nextWindows` la prochaine ouverture, renvoie le min strictement après `fromDate` ou null. Tests : aucune règle → null ; règle weekend-only ven 23h → samedi début ; deux règles → min.
- **T5** — Réécriture `timeRulesGate` : `res.status(423)` au lieu de 403, distinguer méthode, libérer GET si `targeting.every(r.allowReadOnly)`, dédoublonnage audit via Redis key `tr:denied:<userId>` TTL 300s, inclure `next_open` + `allow_read_only` dans la réponse.
- **T6** — `ipAccess.ts` : enrichir `BLOCKED_RESPONSE` de `blockedIp: ip` dans les deux gates.
- **T7** — Service `securityTimeStatusService.getCurrentTimeStatus(user, companyId)` qui agrège plateforme+tenant, applique `userMatches`/`windowIsOpen`/`nextOpenAt`. Retourne `{ locked, message, nextOpen, allowReadOnly }`.
- **T8** — Route `security-time-status.ts` : GET / monté via `authenticate + tenantIpGate` (sans timeRulesGate, par design). Câblage `server.ts`. Tests intégration : user non visé → not locked ; fenêtre ouverte → not locked ; fenêtre fermée → locked + nextOpen ; toutes règles allowReadOnly → flag dans la réponse.
- **T9** — Smoke + push : suite tests Phase 1-6a complète, vérifier 423 sur POST hors fenêtre, GET libéré si allowReadOnly, polling current-status non bloqué.

Convention de nommage cohérente : `allowReadOnly` (camelCase TS) / `allow_read_only` (snake_case DB et réponse API). `nextOpenAt`, `getCurrentTimeStatus`, `TIME_DENIAL_DEDUP_KEY`.

L'exécution suit le même pattern que les Phases précédentes — commits granulaires par tâche.
