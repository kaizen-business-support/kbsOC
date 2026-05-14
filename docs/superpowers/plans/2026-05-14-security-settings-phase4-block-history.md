# Security Settings — Phase 4 Block History UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer l'UI de gestion du journal des blocages : 4 routes API (list paginé filtrable, unblock unitaire avec note, unblock bulk filtré, export CSV) + UI tab "Journal des blocages" avec filtres ERPNext URL-persistants + Dialog modal d'unblock.

**Architecture:** Service `securityBlockHistoryService` (queries Prisma filtrables) + sérialiseur CSV pur (`blockHistoryCsv`) + 4 routes Express gardées par `authorize(['manage_security'])`. Côté front : `BlockHistoryTab` réécrit avec `DataTable`, filtres synchronisés URL via `useSearchParams`, `UnblockDialog` MUI pour la note, bouton export → download CSV via token query param.

**Tech Stack:** Node.js + Express + Prisma + Jest (back) ; React + TypeScript + MUI + react-router (front).

**Spec:** `docs/superpowers/specs/2026-05-14-security-settings-phase4-block-history.md`

---

## File structure

- **Backend — Create**
  - `backend/src/services/blockHistoryCsv.ts` — sérialiseur CSV pur.
  - `backend/src/services/securityBlockHistoryService.ts` — queries + unblock + unblockMany.
  - `backend/src/routes/security-block-history.ts` — 4 routes.
  - `backend/src/__tests__/blockHistoryCsv.test.ts` — unit.
  - `backend/src/__tests__/securityBlockHistoryRoute.test.ts` — intégration.

- **Backend — Modify**
  - `backend/src/server.ts` — mount route.

- **Frontend — Create**
  - `src/components/security/UnblockDialog.tsx` — Dialog MUI note.

- **Frontend — Modify**
  - `src/services/api.ts` — `ApiService.security.blockHistory.*`.
  - `src/components/security/BlockHistoryTab.tsx` — réécriture.

---

## Tâches (concision — détails complets dans le spec)

- **T1** — `blockHistoryCsv.ts` (header RFC 4180, escape `,`/`"`/`\n`) + ~6 tests unit.
- **T2** — `securityBlockHistoryService.ts` (list filtrable, unblockOne avec note ≥ 5 chars, unblockMany avec même filtre serveur-side).
- **T3** — routes `security-block-history.ts` (GET list, POST `:id/unblock`, POST `unblock-all`, GET `export` CSV stream) + ~9 tests d'intégration.
- **T4** — câblage `server.ts` (mount `/api/security/block-history` avec `tenantIpGate` + `timeRulesGate`).
- **T5** — `ApiService.security.blockHistory.*` (list, unblock, unblockAll, exportCsv via window.location avec `?token=`).
- **T6** — `UnblockDialog` (Dialog MUI, TextField multiline note min 5 chars, mode unitaire + bulk).
- **T7** — `BlockHistoryTab` rewrite : header avec bouton export, bandeau filtres (dateFrom/dateTo/blockedIp/reason/status/userId) synchronisés URL via `useSearchParams`, bouton "Débloquer tout (N)" conditionnel + confirm, DataTable avec chip raison coloré (rouge/ambre/rose/gris), action unblock par ligne, Snackbar.
- **T8** — Smoke manuel + push (login ADMIN → onglet "Journal", filtres URL fonctionnels, unblock unitaire/bulk, export CSV téléchargeable).

Convention de nommage cohérente : `securityBlockHistoryService`, `blockHistoryToCsv`, `BlockHistoryFilter`, `UnblockDialog`, `BlockHistoryTab`, `ApiService.security.blockHistory`.

L'exécution suit le même pattern que Phases 2/3 (déjà livrées et validées) — commits granulaires par tâche, format de code et structure des routes/tests identiques.
