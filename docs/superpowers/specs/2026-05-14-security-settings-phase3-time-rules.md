# Security Settings — Phase 3 Time Rules

**Date :** 2026-05-14
**Statut :** design validé, prêt pour plan d'implémentation
**Dépend de :** Phase 1 (schemas DB) et Phase 2 (cache Redis pattern, block history population).

## 1. Contexte & objectif

Phase 3 livre les règles horaires de bout en bout :
- CRUD `/api/security/time-rules` avec validation (jours, plages, timezone).
- Endpoint preview "next 7 days" par règle.
- Middleware `timeRulesGate` (après auth) qui bloque les requêtes hors fenêtres applicables à l'utilisateur.
- Cache Redis 60s (extension du cache IP existant).
- Population du `security_block_history` (`block_reason = OUTSIDE_TIME_WINDOW`).
- UI tab "Plages horaires" : table avec filtres ERPNext + Dialog MUI create/edit avec preview inline.
- Anti-self-lockout : warning UI seulement (l'admin assume).

## 2. Sémantique d'évaluation — whitelist strict

Pour chaque requête après auth :

1. Collecter les règles actives (`isActive=true && deletedAt=null`) qui s'appliquent à l'utilisateur (matching `applies_to` / `targetValues`).
2. Si la liste est **vide** → ALLOW. (Aucune restriction définie pour cet utilisateur.)
3. Sinon : si **au moins une** règle a sa fenêtre `[timeStart, timeEnd]` ouverte maintenant (dans la timezone de la règle, jour de semaine correspondant) → ALLOW.
4. Sinon → DENY 403 avec le `deniedMessage` de la **première** règle (par `order=createdAt asc`) qui vise l'utilisateur, ou message générique si null.

## 3. Matching utilisateur → règle

| `applies_to` | Match si |
|---|---|
| `ALL` | toujours |
| `BRANCH` | `user.branch ∈ targetValues` |
| `DEPARTMENT` | `user.department ∈ targetValues` |
| `ROLE` | `user.role ∈ targetValues` |
| `USER` | `user.id ∈ targetValues` |

Si `applies_to ∈ {BRANCH, DEPARTMENT, ROLE, USER}` et `targetValues` est vide → la règle ne matche personne (effective no-op).

Multi-tenant : seules les règles dont `companyId ∈ { null, req.companyId }` sont prises en compte. Les règles plateforme s'ajoutent aux règles tenant (union logique).

## 4. Fenêtre temporelle

- `daysOfWeek` : bitmask ISO (`lun=1`, `mar=2`, `mer=4`, `jeu=8`, `ven=16`, `sam=32`, `dim=64`).
- `timeStart`, `timeEnd` : format `HH:MM` (24h).
- `timezone` : nom IANA (ex `Europe/Paris`, `Africa/Dakar`, `UTC`).

### 4.1 Cas même journée
Si `timeStart < timeEnd` :
- match si `(bitmask & (1 << (isoWeekdayNow - 1))) != 0 && timeStart ≤ now ≤ timeEnd` (dans la timezone de la règle).

### 4.2 Chevauchement minuit
Si `timeStart > timeEnd` (ex : `22:00` → `06:00`) :
- match si `(bitmask & (1 << (isoWeekdayToday - 1))) != 0 && now ≥ timeStart` (fenêtre commence aujourd'hui) **OU** `(bitmask & (1 << (isoWeekdayYesterday - 1))) != 0 && now ≤ timeEnd` (fenêtre a commencé hier).

### 4.3 Cas dégénérés
- `timeStart == timeEnd` → fenêtre vide (la règle ne matche jamais).
- `daysOfWeek == 0` → la règle ne matche jamais.

## 5. Lib timezone

À T1 du plan : vérifier la présence de `luxon` dans `backend/package.json`.
- Présent → utiliser `DateTime.now().setZone(rule.timezone)`.
- Absent → utiliser `Intl.DateTimeFormat` avec option `timeZone` (suffisant : on n'a besoin que de l'heure/jour locale).

Pas de nouvelle dépendance introduite sans confirmation.

## 6. Helper pur — `timeRuleMatcher.ts`

`backend/src/services/timeRuleMatcher.ts`. Sans dépendance Prisma.

```typescript
export interface MatchableTimeRule {
  id: string;
  daysOfWeek: number;
  timeStart: string;
  timeEnd: string;
  timezone: string;
  appliesTo: 'ALL' | 'BRANCH' | 'DEPARTMENT' | 'ROLE' | 'USER';
  targetValues: string[];
  deniedMessage?: string | null;
}

export interface MatchableUser {
  id: string;
  role: string;
  branch?: string | null;
  department?: string | null;
}

export function userMatches(user: MatchableUser, rule: MatchableTimeRule): boolean;
export function windowIsOpen(rule: MatchableTimeRule, now: Date): boolean;
export function ruleAppliesNow(rule: MatchableTimeRule, user: MatchableUser, now: Date): boolean;

export interface PreviewSlot { start: string; end: string; }
export interface PreviewDay { date: string; allowed: boolean; slots: PreviewSlot[]; }
export function nextWindows(rule: MatchableTimeRule, fromDate: Date, days?: number): PreviewDay[];
```

## 7. Service CRUD — `securityTimeRulesService.ts`

Méthodes (signatures, calquées sur Phase 2) :
```typescript
listTimeRules(opts): Promise<{ items, total, page, pageSize }>
createTimeRule(input, requesterUser): Promise<SecurityTimeRule>
updateTimeRule(id, input, requesterUser): Promise<SecurityTimeRule>
toggleTimeRule(id): Promise<SecurityTimeRule>
softDeleteTimeRule(id): Promise<{ id }>
```

Validations à `create`/`update` :
- `name` non vide.
- `daysOfWeek` ∈ [1, 127] (bitmask non-zéro, ≤ tous les jours).
- `timeStart`/`timeEnd` au format `HH:MM` strict.
- `timezone` valide (vérifier via `Intl.DateTimeFormat` qui throw si invalide).
- `appliesTo` ∈ enum ; si non `ALL`, `targetValues` doit être non vide.

Erreurs : `SecurityTimeRuleError` typée → mappée par la route en codes (400 invalid_*, 404 not_found, 422 self_lockout (NON utilisé en Phase 3 — warning UI seulement).

Soft delete = `deletedAt = now()` + `isActive = false`. Lists filtrent `deletedAt: null` par défaut.

Mutations invalident le cache Redis (cf. §9).

## 8. Cache Redis — extension de `securityRulesCache.ts`

Nouvelles fonctions ajoutées au module existant :
```typescript
export async function getCachedPlatformTimeRules(): Promise<CachedTimeRule[]>
export async function getCachedTenantTimeRules(companyId: string): Promise<CachedTimeRule[]>
export async function invalidateTimeRulesCache(companyId: string | null): Promise<void>
```

Clés Redis :
- `sec:time-rules:platform`
- `sec:time-rules:tenant:<companyId>`

`CachedTimeRule` = subset de `SecurityTimeRule` utile au matcher (id, daysOfWeek, timeStart, timeEnd, timezone, appliesTo, targetValues, deniedMessage).

TTL = `IP_RULES_CACHE_TTL_SEC` réutilisé (60s). Fallback DB transparent si Redis down.

## 9. Middleware — `timeAccess.ts`

`backend/src/middleware/timeAccess.ts` :

```typescript
export async function timeRulesGate(req, res, next): Promise<void>
```

Algorithme :
1. Si pas de `req.user` → `next()` (auth non requise — par sécurité, ne devrait pas arriver après `authenticate`).
2. Construire `MatchableUser` depuis `req.user`.
3. Charger les règles plateforme + tenant (`getCachedPlatformTimeRules` + `getCachedTenantTimeRules(req.companyId)` si companyId).
4. Filtrer les règles qui visent l'utilisateur (`userMatches`).
5. Si liste vide → `next()` (ALLOW).
6. Si au moins une `windowIsOpen` → `next()` (ALLOW).
7. Sinon : 403 + écrire `security_block_history` (`block_reason = OUTSIDE_TIME_WINDOW`, message issu de la première règle qui vise l'utilisateur).

Écriture audit en `try/catch` + `logger.warn` (n'altère pas la réponse 403).

## 10. Routes API — `security-time-rules.ts`

`backend/src/routes/security-time-rules.ts`. Toutes gardées par `authorize(['manage_security'])`.

| Méthode | Path | Description |
|---|---|---|
| GET | `/` | List paginée. Filtres : `isActive`, `appliesTo`, `search` (sur `name` + `description`), `scope` (`platform`/`tenant`/`all`). |
| POST | `/` | Create. `companyId: null` réservé SUPER_ADMIN ; sinon `req.companyId`. Validation stricte. |
| PUT | `/:id` | Update. |
| PATCH | `/:id/toggle` | Toggle `isActive`. |
| DELETE | `/:id` | Soft delete. |
| GET | `/:id/preview` | Renvoie 7 prochains jours `[{ date, allowed, slots }]` dans la timezone de la règle. |

Mount : `app.use('/api/security/time-rules', authenticate, tenantIpGate, timeRulesGate, securityTimeRulesRoutes)` — note que `timeRulesGate` est appliqué AU MIDDLEWARE GLOBAL des routes protégées (cf. §11), pas spécifiquement à cette route. L'admin avec `manage_security` n'aura jamais de règle qui le bloque s'il a un rôle ADMIN/SUPER_ADMIN exclus des time rules (UX choice → à confirmer Phase 3 ; pour l'instant les admins sont sujets aux règles comme les autres).

## 11. Câblage `server.ts`

Suite de Phase 2 (`extractRealIp → platformIpGate → ... → authenticate → tenantIpGate → ...`). On insère `timeRulesGate` juste après `tenantIpGate` sur `/api/clients` et `/api/security/time-rules` :

```typescript
app.use('/api/clients',                 authenticate, tenantIpGate, timeRulesGate, clientRoutes);
app.use('/api/security/ip-rules',       authenticate, tenantIpGate, timeRulesGate, securityIpRulesRoutes);
app.use('/api/security/time-rules',     authenticate, tenantIpGate, timeRulesGate, securityTimeRulesRoutes);
```

Limitation explicite documentée dans le commit : seules ces 3 routes sont protégées en démo. Migration des autres → follow-up.

## 12. Frontend

### 12.1 `TimeRuleFormDialog.tsx`

Modal MUI. Champs :
- **Nom** (TextField, requis).
- **Jours** : 7 chips toggle (lun/mar/mer/jeu/ven/sam/dim) avec lecture/écriture du bitmask. Bouton raccourci "Tous les jours ouvrés" (lun-ven).
- **Heure début** (`<TextField type="time">`).
- **Heure fin** (`<TextField type="time">`).
- **Timezone** (Select à options préfixées : `Europe/Paris`, `Africa/Dakar`, `Africa/Abidjan`, `UTC`).
- **S'applique à** (Select : `ALL / BRANCH / DEPARTMENT / ROLE / USER`).
- **Cibles** (`targetValues`) : visible si `appliesTo ≠ ALL`. Multi-select texte (Chips créés à la saisie + Enter), sans dropdown peuplé (suffisant Phase 3).
- **Message de refus** (TextField multiline, optionnel).
- **Actif** (Switch).
- **Règle plateforme** (Checkbox, SUPER_ADMIN uniquement).
- **Bouton "Aperçu 7 jours"** : visible uniquement en mode édition. Appelle `preview(id)`, affiche un panneau inline avec 7 lignes `[date / autorisé / créneaux]`.

À la sauvegarde réussie : si l'admin courant est concerné par la règle ET serait bloqué dans les 24h prochaines → affichage d'un warning visuel "Cette règle vous bloquera dans X heures". Pas de blocage.

### 12.2 `TimeRulesTab.tsx`

Réécriture du placeholder. `DataTable` avec colonnes :
- **Nom** (text filter)
- **Jours** (custom render compact : "L M M J V" pour les jours actifs ; filter `enum`)
- **Plage** (`timeStart - timeEnd`, text filter)
- **Timezone** (enum filter)
- **Portée** (`scope` plateforme/tenant + `applies_to`)
- **Statut** (enum, toggle inline)
- **Actions** (édit, suppression).

Bouton "+ Ajouter une règle". Snackbar local pour feedback. `window.confirm` pour delete (cohérent avec IPRulesTab).

### 12.3 `ApiService.security.timeRules.*`

```typescript
static security = {
  ipRules: { ... },  // existant Phase 2
  timeRules: {
    list, create, update, toggle, remove,
    preview: async (id) => api.get(`/security/time-rules/${id}/preview`),
  },
};
```

## 13. Tests

### 13.1 Unit — `timeRuleMatcher.test.ts`

- `userMatches` : ALL toujours vrai ; BRANCH/DEPT/ROLE/USER match exact ; targetValues vide → faux ; missing field user → faux.
- `windowIsOpen` :
  - même journée : in-window, before, after.
  - chevauchement minuit (22h-06h) : 23h match, 03h match (jour précédent), 12h pas match.
  - bitmask : lundi 1, mardi 0 → lundi match, mardi pas.
  - timezone : `Europe/Paris` 22h alors qu'à `UTC` il est 20h → match si fenêtre Paris est 21h-23h.
- `nextWindows` : pour règle "lun-ven 9h-18h Europe/Paris", 7 jours depuis lundi → 5 entries `allowed=true`, slots `[09:00,18:00]`, 2 weekend `allowed=false`.

### 13.2 Intégration — `securityTimeRulesRoute.test.ts`

Similaire à Phase 2. Cas :
- ADMIN crée règle ALL lun-ven 9-18 Europe/Paris → 201.
- ANALYSTE → 403.
- daysOfWeek=0 → 400.
- timeStart format invalide ("9h") → 400.
- timezone "Invalide/Zone" → 400.
- SUPER_ADMIN crée règle plateforme → 201.
- ADMIN tente règle plateforme → 403.
- Preview : GET /:id/preview renvoie 7 entrées avec champs `date`, `allowed`, `slots`.

Pas de test middleware automatisé (Phase 3 reste limitée comme Phase 2). Smoke test manuel.

## 14. Hors-périmètre

- Brute-force detection (Phase 4).
- UI de lecture du block history (Phase 4).
- Mode "anti-fenêtre" (DENY windows) — Phase 5 si demandé.
- Exclusion explicite des admins (ADMIN/SUPER_ADMIN soumis aux mêmes règles que les autres, à confirmer si problématique).
- Force logout de sessions en cours quand la fenêtre se ferme (la session reste valide ; chaque nouvelle requête est bloquée, ce qui est suffisant).
- Multi-fenêtres par jour dans une seule règle (créer plusieurs règles si besoin).
- Audit complet des modifications de règles (juste un `updatedAt` ; pas de table d'historique des versions).

## 15. Risques

- **Décalage d'horloge serveur** : la fenêtre est évaluée avec `new Date()` côté serveur. Si l'horloge dérive, l'évaluation est faussée. Mitigation : NTP/chrony.
- **Timezone DST** : `Intl.DateTimeFormat` gère DST automatiquement, mais une règle "22h-06h" peut sauter ou doubler une heure les jours de changement DST. Comportement : on accepte l'imprécision DST (≤ 2 h/an) sans logique spéciale.
- **Cache stale** : ≤ 60s entre une mutation et la prochaine évaluation par les requêtes en cours. Mitigation : invalidation synchrone du cache à la mutation.
- **Lockout serveur global** : un SUPER_ADMIN qui crée une règle ALL trop restrictive bloque tout le monde. Phase 4 fournira l'UI de déblocage (lecture du block history). En attendant, récupération via DB direct.

## 16. Migration / déploiement

Aucune migration de schéma (table créée en Phase 1). Désactivable en revert du commit `feat(security): middleware timeAccess`.
