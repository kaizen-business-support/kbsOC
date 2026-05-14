# Security Settings — Phase 2 IP Rules

**Date :** 2026-05-14
**Statut :** design validé, prêt pour plan d'implémentation
**Dépend de :** Phase 1 (`docs/superpowers/specs/2026-05-13-security-settings-phase1-foundation.md` — schemas DB déjà créés).

## 1. Contexte & objectif

Phase 2 livre les règles IP de bout en bout :
- CRUD complet `/api/security/ip-rules` avec validation stricte IPv4/IPv6/CIDR.
- Middleware d'enforcement (plateforme avant auth, tenant après auth).
- Population du journal de blocages (`security_block_history`) — l'UI de lecture viendra en Phase 4.
- Cache Redis 60s pour éviter un hit DB par requête.
- UI tab "Règles IP" : table avec filtres ERPNext-style (DataTable existant) + Dialog MUI pour create/edit.
- Protection anti-self-lockout : empêche un admin de bloquer sa propre IP.

## 2. Cascade d'évaluation

Premier match arrête l'évaluation :

| # | Règle qui matche | Verdict |
|---|---|---|
| 1 | Plateforme DENY | BLOCK |
| 2 | Tenant DENY | BLOCK |
| 3 | Tenant ALLOW | ALLOW (explicite) |
| 4 | _aucune_ | ALLOW (par défaut) |

- DENY a priorité sur ALLOW dans le même scope.
- Plateforme a priorité sur tenant pour les denys.
- Les `ALLOW` documentent explicitement des IPs autorisées (utile pour audit). Pour Phase 2 ils ne changent pas le comportement par rapport à "no rule" mais sont préservés en DB pour usage futur (mode whitelist strict éventuel en Phase 5).

## 3. Helper de matching — `ipMatcher.ts`

`backend/src/services/ipMatcher.ts`. Pur, sans dépendance Prisma. Utilise `ipaddr.js`.

```typescript
export function validateIpOrCidr(input: string): { valid: boolean; normalized?: string; family?: 4 | 6; isCidr?: boolean };
export function ipMatches(ip: string, ruleIpOrCidr: string): boolean;
```

Règles :
- Une IP simple (sans `/`) → match exact (avec normalisation : trim, lowercase IPv6, expand `::`).
- Une CIDR → match par couverture (`ipaddr.parse(ip).match(ipaddr.parseCIDR(rule))`).
- IPv4-mappé-en-IPv6 (`::ffff:192.0.2.1`) considéré équivalent à `192.0.2.1` (option `toNormalizedString()`).
- Validation des limites : IPv4/CIDR prefix 0-32, IPv6/CIDR prefix 0-128.

## 4. CRUD Service — `securityIpRulesService.ts`

`backend/src/services/securityIpRulesService.ts`.

Méthodes :
```typescript
listIpRules(opts: { companyId: string | null; page: number; pageSize: number; isActive?: boolean; ruleType?: SecurityRuleType; search?: string })
createIpRule(input: { ipAddress: string; ruleType: SecurityRuleType; description?: string; isActive?: boolean; companyId: string | null; createdBy: string }, requesterIp: string)
updateIpRule(id: string, input: Partial<...>, requesterIp: string)
toggleIpRule(id: string, requesterIp: string)
softDeleteIpRule(id: string)
```

- Toutes filtrent `deletedAt: null`.
- Mutations invalident le cache Redis (cf. §6).
- Anti-self-lockout dans `createIpRule` / `updateIpRule` / `toggleIpRule` (cf. §7).
- `companyId: null` = règle plateforme ; n'est créable que par `SUPER_ADMIN` (vérifié côté route).

## 5. Middleware d'enforcement — `ipAccess.ts`

`backend/src/middleware/ipAccess.ts`. Deux exports :

### 5.1 `extractRealIp`
Helper léger qui pose `req.realIp` à partir de `X-Forwarded-For` (premier élément, trim) ou `req.ip`. Monté tôt dans la chaîne, AVANT `platformIpGate`. Nécessite `app.set('trust proxy', true)` (déjà actif dans `server.ts`, sinon à confirmer).

### 5.2 `platformIpGate`
Middleware monté **avant** l'authentification.
- Lit les règles plateforme (cache Redis, sinon DB).
- Si l'IP matche un DENY plateforme → 403, écriture `security_block_history` avec `company_id = null` + `block_reason = IP_BLACKLISTED`.
- Sinon `next()`.

### 5.3 `tenantIpGate`
Middleware monté **après** `authenticate` + `requireCompany` (donc `req.companyId` connu).
- Lit les règles tenant (cache Redis, sinon DB).
- Cascade : DENY tenant → BLOCK ; ALLOW tenant → next (early) ; sinon next.
- BLOCK → 403, écriture `security_block_history` avec `company_id = req.companyId`.

Écriture du journal en `try/catch` + `logger.warn` — un échec d'écriture ne casse pas la réponse 403.

## 6. Cache Redis — `securityRulesCache.ts`

`backend/src/services/securityRulesCache.ts`.

Clés :
- `sec:ip-rules:platform` → JSON `Array<{ ipAddress, ruleType }>` des règles plateforme actives non supprimées.
- `sec:ip-rules:tenant:<companyId>` → idem pour ce tenant.

TTL : 60 secondes (constante `IP_RULES_CACHE_TTL_SEC = 60`).

API :
```typescript
getCachedPlatformIpRules(): Promise<CachedRule[]>      // hit Redis, sinon DB + SET
getCachedTenantIpRules(companyId: string): Promise<CachedRule[]>
invalidatePlatformIpRules(): Promise<void>             // DEL
invalidateTenantIpRules(companyId: string | null): Promise<void>   // DEL conditionnel
```

`createIpRule` / `updateIpRule` / `toggleIpRule` / `softDeleteIpRule` appellent `invalidate*` après commit. Si Redis indisponible : on tolère (log warn, on lit la DB).

## 7. Anti-self-lockout

Dans `createIpRule` et `updateIpRule` et `toggleIpRule`, juste avant le write, si la règle est :
- `ruleType = DENY`
- `isActive = true` (à l'issue de l'opération)

→ vérifier que `ipMatches(requesterIp, rule.ipAddress) === false`.

Sinon : lever une erreur applicative `SelfLockoutError` interceptée par la route et transformée en :

```json
{ "success": false, "error": "self_lockout_prevented",
  "message": "Cette règle bloquerait votre propre IP (X.X.X.X). Modifiez la portée ou désactivez la règle." }
```

avec status `422`.

## 8. Routes API — `security-ip-rules.ts`

`backend/src/routes/security-ip-rules.ts`.

Toutes les routes :
- Middlewares : `authenticate` (global), `requirePermission('manage_security')` (helper existant ou inline check `hasPermission`).
- Mounting : `app.use('/api/security/ip-rules', authenticate, securityIpRulesRoutes)` dans `server.ts`.

| Méthode | Path | Comportement |
|---|---|---|
| GET    | `/`           | Liste paginée, filtres `isActive`, `ruleType`, `search` (`ipAddress` ou `description`). Scope par défaut : règles du `req.companyId` + règles plateforme (visibles à tous les admins). Pour ne voir que les règles plateforme : `?scope=platform` (réservé SUPER_ADMIN). |
| POST   | `/`           | Crée une règle. `companyId` du body : `null` autorisé uniquement si SUPER_ADMIN ; sinon écrasé par `req.companyId`. Validation IP/CIDR stricte. Anti-lockout. |
| PUT    | `/:id`        | Update. Empêche le changement de `companyId` (immuable une fois créée). Anti-lockout. |
| PATCH  | `/:id/toggle` | Toggle `isActive`. Anti-lockout si passage à actif+DENY. |
| DELETE | `/:id`        | Soft delete (`deletedAt = now`). |

Réponses standard :
```json
GET  → { "success": true, "data": { "items": [...], "total": N, "page": P, "pageSize": 20 } }
POST → { "success": true, "data": <created rule> }
PUT/PATCH → { "success": true, "data": <updated rule> }
DELETE → { "success": true, "data": { "id": "..." } }
```

Erreurs : `{ "success": false, "error": "<code>", "message": "<fr>" }` avec status approprié (400, 403, 404, 422).

## 9. Câblage `server.ts`

Ordre des middlewares :

```ts
app.set('trust proxy', true);             // déjà présent ou à ajouter
app.use(helmet());
app.use(extractRealIp);                   // nouveau
app.use(platformIpGate);                  // nouveau — bloque AVANT auth
app.use(globalLimiter);
// ... routes publiques (login, refresh, health) ...
app.use('/api/auth', authRoutes);
// ... routes protégées : middleware authenticate + tenantIpGate ...
app.use('/api/clients',  authenticate, tenantIpGate, clientRoutes);
app.use('/api/security/ip-rules', authenticate, tenantIpGate, ipRulesRoutes);
// ... etc pour toutes les routes protégées ...
```

Note : `tenantIpGate` étant après `authenticate`, il a accès à `req.companyId`. Le middleware retombe gracieusement (next) si `req.companyId` est absent (cas SUPER_ADMIN sans tenant courant).

## 10. Frontend

### 10.1 `src/components/security/IPRuleFormDialog.tsx`

Modal MUI (`Dialog`). Champs :
- IP / CIDR (TextField avec validation regex légère côté client + helper "Format: 192.168.1.0/24 ou 2001:db8::/32").
- Type (RadioGroup ALLOW / DENY).
- Description (TextField multiline, optionnel).
- Actif (Switch).
- Pour SUPER_ADMIN uniquement : checkbox "Règle plateforme" (sinon companyId = req.companyId implicite).

Props : `{ open, onClose, initialRule?: IpRule, onSaved: (rule) => void }`. Si `initialRule` fourni → mode édition.

Bouton "Enregistrer" : appelle `ApiService.security.ipRules.create` ou `.update`, traite l'erreur `self_lockout_prevented` en affichant un `Alert error` dans la modal (sans la fermer).

### 10.2 `src/components/security/IPRulesTab.tsx`

Remplace le placeholder de Phase 1.

Structure :
- Header avec bouton "+ Ajouter une règle".
- `DataTable` (composant existant `src/components/common/DataTable.tsx`) avec colonnes :
  - **IP / CIDR** (text filter)
  - **Type** (enum filter : Allow / Deny)
  - **Portée** (custom filter : tenant / plateforme)
  - **Description** (text filter)
  - **Statut** (enum : Active / Inactive — toggle inline via icône)
  - **Actions** (icônes : éditer, supprimer)
- Pagination 20.
- Loading skeleton pendant le fetch initial.
- Toast de succès / erreur via le système existant (à confirmer côté codebase — vraisemblablement `notistack` ou MUI Snackbar via context).

Si pas de notistack en place : utiliser un `Snackbar` MUI local par défaut.

### 10.3 `src/services/api.ts`

Ajouter sous `ApiService` :

```typescript
static security = {
  ipRules: {
    list: (params: { isActive?: boolean; ruleType?: 'ALLOW' | 'DENY'; search?: string; page?: number; pageSize?: number; scope?: 'platform' }) => Promise<{...}>,
    create: (body: {...}) => Promise<{...}>,
    update: (id: string, body: Partial<...>) => Promise<{...}>,
    toggle: (id: string) => Promise<{...}>,
    remove: (id: string) => Promise<{...}>,
  }
};
```

## 11. Tests

### 11.1 Unit — `ipMatcher.test.ts`

Cas couverts :
- `validateIpOrCidr` : 6 cas valides (IPv4, IPv4/CIDR /16, IPv6, IPv6/CIDR /64, IPv4-mappé) + 6 invalides (vide, hors range, mauvais format, CIDR > 32 pour IPv4, etc.).
- `ipMatches` : IP simple ↔ IP simple (equal / different) ; IP dans CIDR IPv4 ; IP hors CIDR IPv4 ; même pour IPv6 ; IPv4-mappé-IPv6 matche son équivalent IPv4 ; CIDR /32 et /128 = identité.

### 11.2 Intégration — `securityIpRulesRoute.test.ts`

Pattern existant (express + supertest, mock middleware auth) :
- Create comme ADMIN → 201.
- Create comme CHARGE_AFFAIRES → 403.
- Create avec IP invalide → 400.
- Create DENY couvrant l'IP requester (mock `x-forwarded-for`) → 422 `self_lockout_prevented`.
- Toggle d'une règle DENY vers actif qui couvrirait l'IP → 422.
- Cross-tenant : ADMIN du tenant A ne peut lister/modifier les règles du tenant B → 403/404.
- Soft delete : `deletedAt` peuplé, plus visible dans `list()`.

### 11.3 Middleware (smoke)

Pas de tests automatisés dédiés en Phase 2 (couverts par les tests d'intégration + smoke manuel). Phase 3 pourra ajouter un test dédié si le besoin émerge.

## 12. Hors-périmètre Phase 2

- Time rules (Phase 3).
- UI lecture du `security_block_history` (Phase 4) — Phase 2 écrit seulement.
- Brute-force detection (Phase 4).
- Mode whitelist strict global (Phase 5 si demandé).
- Bulk import de règles (CSV).
- Géolocalisation des IPs bloquées.

## 13. Risques connus

- **`X-Forwarded-For` spoofing** : si l'app est mal configurée derrière un proxy non-fiable, un client peut forger son IP. Mitigation : `app.set('trust proxy', true)` ne doit être activé QUE derrière un reverse-proxy connu (nginx avec `X-Real-IP` ou similaire). Documenter dans le README.
- **Cache stale** : un admin qui supprime une règle DENY voit le cache encore actif pendant ≤ 60s. Mitigation : `invalidateTenantIpRules` synchrone à la mutation.
- **Self-lockout via VPN** : un admin connecté via VPN crée une règle DENY qui couvre l'IP de sortie du VPN — l'anti-lockout protège seulement contre son IP COURANTE, pas son IP réelle de bureau. Acceptable : c'est le comportement standard.
- **Race condition mutation/lecture** : entre l'invalidation du cache et la prochaine lecture, un client peut être mal évalué. Acceptable pour ce cas d'usage (sécurité best-effort, pas critique transactionnel).

## 14. Migration / déploiement

Aucune migration de schéma (tables créées en Phase 1). Aucun backfill. Désactivable en revert du commit `feat(security): middleware ipAccess`.
