# Security Settings — Phase 3 Time Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer les règles horaires de bout en bout : matcher pur, CRUD REST avec preview, middleware d'enforcement après auth (whitelist strict), cache Redis 60s, population de `security_block_history`, UI tab + Dialog MUI avec aperçu inline.

**Spec:** `docs/superpowers/specs/2026-05-14-security-settings-phase3-time-rules.md`

(Plan condensé — détails dans le spec.)

---

## Tâches

- **T1** — `backend/src/services/timeRuleMatcher.ts` + tests unit (TDD, ~20 cas).
- **T2** — extension `backend/src/services/securityRulesCache.ts` (clés `sec:time-rules:*`).
- **T3** — `backend/src/services/securityTimeRulesService.ts` (CRUD + validation HH:MM / bitmask / timezone IANA).
- **T4** — `backend/src/middleware/timeAccess.ts` (`timeRulesGate`).
- **T5** — `backend/src/routes/security-time-rules.ts` (CRUD + GET `/:id/preview`) + tests intégration (~10 cas).
- **T6** — câblage `backend/src/server.ts` (insère `timeRulesGate` après `tenantIpGate` sur 3 routes démo).
- **T7** — `src/services/api.ts` : `ApiService.security.timeRules.*` (5 méthodes + preview).
- **T8** — `src/components/security/TimeRuleFormDialog.tsx` (Dialog MUI, chips jours, timezone, applies_to, preview inline).
- **T9** — réécriture `src/components/security/TimeRulesTab.tsx` (DataTable + actions + Snackbar).
- **T10** — smoke manuel + push.

Tous les détails de code, fichiers exacts, tests TDD, et commandes : voir le spec.

Convention de nommage (cohérence entre tâches) : `timeRuleMatcher`, `securityTimeRulesService`, `getCachedPlatformTimeRules` / `getCachedTenantTimeRules` / `invalidateTimeRulesCache`, `timeRulesGate`, `ApiService.security.timeRules`, `TimeRuleFormDialog`, `TimeRulesTab`.

L'exécution suit le même pattern que Phase 2 (déjà livrée et validée) — commits granulaires par tâche.
