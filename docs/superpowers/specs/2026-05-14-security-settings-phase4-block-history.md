# Security Settings — Phase 4 Block History UI

**Date :** 2026-05-14
**Statut :** design validé, prêt pour plan d'implémentation
**Dépend de :** Phase 1 (tables DB), Phase 2 (population `IP_BLACKLISTED`), Phase 3 (population `OUTSIDE_TIME_WINDOW`).

## 1. Contexte & objectif

Phase 4 livre l'UI de lecture/gestion du `security_block_history` :
- 4 routes API (list paginé, unblock unitaire, unblock bulk, export CSV).
- UI tab "Journal des blocages" avec filtres ERPNext + bouton export + actions unblock.
- Filtres URL-persistants pour partage de liens.
- `unblock` = acquittement du log (no rule mutation).

Brute-force detection : **hors périmètre Phase 4** (renvoyée en Phase 5). Phase 4 affiche le `block_reason='BRUTE_FORCE'` si jamais une entrée existe mais ne génère pas elle-même de telles entrées.

## 2. Sémantique unblock

`unblock(id, note)` :
- `securityBlockHistory.update` : `status: 'UNBLOCKED'`, `unblockedBy: req.user.id`, `unblockedAt: now`, `unblockNote: note`.
- **Ne touche pas** aux règles IP/Time qui ont causé le block. L'admin gère manuellement les règles dans leurs onglets respectifs.
- Note requise (min 5 caractères, max 500).

`unblockAll(filter, note)` :
- Server-side : applique exactement le même `where` que `list(filter)`, **plus** `status: 'BLOCKED'`.
- `updateMany` en une transaction.
- Renvoie `{ affected: N }`.

## 3. Routes API

Toutes gardées par `authorize(['manage_security'])`. Scope tenant par défaut (`companyId = req.companyId`).

### 3.1 GET /api/security/block-history

Query params :
- `blockedIp?: string` — match `contains` insensitive.
- `reason?: 'IP_BLACKLISTED' | 'OUTSIDE_TIME_WINDOW' | 'BRUTE_FORCE' | 'MANUAL'`.
- `status?: 'BLOCKED' | 'UNBLOCKED'`.
- `userId?: string` — match exact sur `attemptedUserId`.
- `dateFrom?: string` (`YYYY-MM-DD`) — ≥ start of that day.
- `dateTo?: string` (`YYYY-MM-DD`) — ≤ end of that day.
- `scope?: 'tenant' | 'platform' | 'all'` (SUPER_ADMIN only pour `platform`/`all`).
- `page?: number` (default 0).
- `pageSize?: number` (default 20, max 100).

Réponse :
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "...",
        "blockedIp": "198.51.100.42",
        "attemptedUser": { "id": "...", "name": "..." } | null,
        "blockReason": "IP_BLACKLISTED",
        "requestPath": "/api/clients",
        "userAgent": "Mozilla/5.0 ...",
        "status": "BLOCKED",
        "unblockedBy": { "id": "...", "name": "..." } | null,
        "unblockedAt": "..." | null,
        "unblockNote": "..." | null,
        "createdAt": "..."
      }
    ],
    "total": 145,
    "page": 0,
    "pageSize": 20
  }
}
```

### 3.2 POST /api/security/block-history/:id/unblock

Body : `{ "note": "Faux positif vérifié" }`.

Erreurs :
- 400 `invalid_note` : note manquante, vide, ou < 5 chars.
- 404 `not_found`.
- 422 `already_unblocked` si l'entrée est déjà UNBLOCKED.

Réponse : `{ success: true, data: <updated row> }`.

### 3.3 POST /api/security/block-history/unblock-all

Body :
```json
{
  "filter": { "blockedIp": "...", "reason": "...", "dateFrom": "..." },
  "note": "Déblocage groupé post-incident"
}
```

Sécurité : la note est obligatoire (idem unblock unitaire). Le `filter` accepte les mêmes paramètres que le GET (sauf `status` forcé à `BLOCKED` côté serveur — on ne peut pas "unblocker" du déjà-unblocked).

Réponse : `{ success: true, data: { affected: 23 } }`.

### 3.4 GET /api/security/block-history/export

Query params = ceux du GET (sans `page`/`pageSize`).

Réponse :
- Headers : `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="block-history-<timestamp>.csv"`.
- Body : CSV RFC 4180.
- Limite pragmatique : tronqué à 10 000 lignes (warn dans `X-Truncated: true` header si dépassement).

## 4. Schéma CSV

Header :
```
id,blocked_ip,attempted_user_id,attempted_user_name,block_reason,request_path,user_agent,status,unblocked_by_id,unblocked_by_name,unblocked_at,unblock_note,created_at
```

Échappement RFC 4180 : si valeur contient `,` `"` ou `\n` → entourer de `"` + doubler les `"` internes. `null` → champ vide.

## 5. Service & helpers

### 5.1 `backend/src/services/securityBlockHistoryService.ts`

```typescript
export interface BlockHistoryFilter {
  companyId: string | null;        // null = scope plateforme (SUPER_ADMIN)
  scope: 'tenant' | 'platform' | 'all';
  isSuperAdmin: boolean;
  blockedIp?: string;
  reason?: SecurityBlockReason;
  status?: SecurityBlockStatus;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function listBlockHistory(filter: BlockHistoryFilter, page: number, pageSize: number);
export async function unblockOne(id: string, requesterId: string, note: string);
export async function unblockMany(filter: BlockHistoryFilter, requesterId: string, note: string);
export async function streamForExport(filter: BlockHistoryFilter, max?: number): Promise<{ rows; truncated }>;
```

Construction du `where` Prisma :
- `companyId` : si `scope=tenant` → `companyId: req.companyId`, si `platform` → `companyId: null`, si `all` → pas de filtre.
- Autres filtres mappés directement (contains insensitive pour IP, equals pour le reste).
- Date range : `createdAt: { gte: startOfDay(dateFrom), lte: endOfDay(dateTo) }`.

### 5.2 `backend/src/services/blockHistoryCsv.ts`

```typescript
export interface BlockHistoryRow { /* shape du SELECT enrichi avec user/unblocker */ }
export function blockHistoryToCsv(rows: BlockHistoryRow[]): string;
```

Pur, sans dépendance Prisma. Testable.

## 6. Frontend

### 6.1 `BlockHistoryTab.tsx`

Remplace le placeholder.

Structure :
- **Header** : bouton "Exporter CSV" (right-aligned) avec icône download.
- **Bandeau de filtres** : compact, sous le header.
  - `dateFrom` / `dateTo` (TextField type="date").
  - `blockedIp` (TextField).
  - `reason` (Select avec options).
  - `status` (Select).
  - `userId` (TextField, ID exact).
  - Bouton "Reset filtres".
- **Actions groupées** : si au moins 1 entrée BLOCKED dans la vue → bouton "Débloquer tout (X)" qui ouvre un confirm + note.
- **DataTable** avec colonnes : Date, IP (monospace), Raison (chip coloré par type), Utilisateur, Path (monospace), Statut (chip), Débloqué par, Actions (icône "Débloquer" si status=BLOCKED).
- **Snackbar** local pour feedback.

Filtres → URL synchronisée via `useSearchParams`. À l'arrivée sur l'onglet, lecture initiale des params. À chaque changement de filtre, write.

### 6.2 `UnblockDialog.tsx`

Petit Dialog MUI :
- Titre : "Débloquer cette entrée" ou "Débloquer X entrées" (selon contexte).
- Champ "Note de déblocage" (TextField multiline, min 5 chars, validation côté front + serveur).
- Affichage de l'entrée concernée si unitaire (IP, date, raison).
- Boutons "Annuler" / "Confirmer le déblocage".

### 6.3 `ApiService.security.blockHistory.*`

```typescript
list(params): Promise<{ data: { items, total, page, pageSize } }>
unblock(id: string, note: string): Promise<...>
unblockAll(filter, note: string): Promise<{ data: { affected } }>
exportCsv(params): triggers download (window.location ou fetch + blob)
```

Pour `exportCsv` : `window.location.href = '/api/security/block-history/export?...&token=' + jwtToken` (pattern déjà utilisé pour les contrats).

## 7. Couleurs des chips raison

| `block_reason` | Couleur (fond / texte) |
|---|---|
| `IP_BLACKLISTED` | `#fee2e2` / `#9F1239` (rouge) |
| `OUTSIDE_TIME_WINDOW` | `#fef3c7` / `#92400e` (ambre) |
| `BRUTE_FORCE` | `#fce7f3` / `#9d174d` (rose foncé) |
| `MANUAL` | `#f1f5f9` / `#475569` (gris) |

## 8. Tests

### 8.1 Unit — `blockHistoryCsv.test.ts`

- Header présent.
- Une ligne avec tous les champs simples.
- Valeurs nullables → champ vide.
- Valeur avec virgule, quote, retour ligne → escape correct.
- Tableau vide → seulement le header.

### 8.2 Intégration — `securityBlockHistoryRoute.test.ts`

- ANALYSTE → 403.
- ADMIN list → 200 + pagination.
- Filtres `reason=IP_BLACKLISTED` appliqué.
- Filtre `dateFrom`/`dateTo` exclut une entrée hors range.
- POST `unblock` sans note → 400 `invalid_note`.
- POST `unblock` avec note 3 chars → 400.
- POST `unblock` sur entrée déjà UNBLOCKED → 422 `already_unblocked`.
- POST `unblock` valide → 200 + status changé + audit fields renseignés.
- POST `unblock-all` → `affected` correct + rows mis à jour.
- GET `export` → 200 + Content-Type `text/csv`.

## 9. Hors-périmètre

- Brute-force detection (Phase 5).
- Format Excel (xlsx).
- Export streamé pour > 10000 lignes.
- Notifications email/Slack à chaque block.
- Géolocalisation IP.
- "Whitelist depuis le log" (création directe d'une règle ALLOW).
- Action "Bannir l'IP" depuis le log (création directe d'une règle DENY).

## 10. Risques

- **Bulk unblock filtré** : si le frontend envoie un filtre qui matche plus que ce que l'utilisateur croit voir, des entrées inattendues sont déblocquées. Mitigation : afficher `affected` count avant le commit (deux étapes : preview + confirm).
- **Export massif** : > 10000 lignes tronquées. Mitigation : header `X-Truncated`, UI affiche un warning.
- **URL-persistent filters** : un lien partagé peut leaker des info dans le navigateur d'un autre user. Mitigation : pas d'info sensible dans les filtres (juste IP, dates, enum). Lien valable uniquement pour un user déjà authentifié de toute façon.

## 11. Migration / déploiement

Aucune migration de schéma. Aucun backfill. Désactivable en revert du commit `feat(security): BlockHistoryTab`.
