# Security Settings — Phase 6a Enforcement Behavior Backend

**Date :** 2026-05-14
**Statut :** design validé, prêt pour plan d'implémentation
**Dépend de :** Phases 1-5.
**Suivi par :** Phase 6b (frontend : page /blocked + SecurityLockContext + banner + polling + hook CTAs).

## 1. Contexte & objectif

Le brief "PATCH" client réécrit le comportement d'enforcement des règles IP et horaires :
- **IP block** : 403 sur tout, redirect frontend vers `/blocked`. Backend : pas de changement structurel (le gate plateforme tourne déjà avant auth depuis Phase 2). On enrichit la réponse JSON avec `blockedIp` pour permettre l'affichage frontend.
- **Time block** : passage de 403 → 423 (Locked). Distinction `GET` vs mutation. Nouveau champ `allow_read_only` sur les règles. Dédoublonnage de l'audit (1 entrée par session). Endpoint `current-status` non-bloquable pour le polling frontend.
- **Ordre middleware** : conforme à PATCH 3 sans modification.

Cette phase livre **uniquement la partie backend**. Le frontend (page /blocked, context, banner, polling, hook) est en Phase 6b.

## 2. Schema Prisma

Ajout sur `SecurityTimeRule` :
```prisma
allowReadOnly Boolean @default(false) @map("allow_read_only")
```

Migration `add_time_rule_allow_read_only` créée via `prisma migrate dev --create-only` puis appliquée. Aucun backfill (default `false` = strict).

## 3. Réponse IP block — enrichie

`backend/src/middleware/ipAccess.ts` : `BLOCKED_RESPONSE` enrichi avec `blockedIp` :
```typescript
res.status(403).json({
  success: false,
  error: 'ip_blocked',
  blockedIp: ip,
  message: 'Accès refusé : votre adresse IP est bloquée.',
});
```

Aucun changement de logique. Le platformIpGate continue de tourner globalement avant auth ; tenantIpGate après auth.

## 4. Helper `nextOpenAt`

Ajout dans `backend/src/services/timeRuleMatcher.ts` :
```typescript
export function nextOpenAt(
  rules: MatchableTimeRule[],
  user: MatchableUser,
  fromDate: Date,
  maxDays?: number
): Date | null;
```

Comportement :
1. Filtre les règles qui ciblent l'utilisateur (`userMatches`).
2. Pour chaque règle, génère les prochaines ouvertures de fenêtre sur `maxDays` (défaut 14) via `nextWindows`.
3. Pour chaque jour `allowed=true`, calcule `Date(date + timeStart)` dans la timezone de la règle.
4. Renvoie le minimum strictement supérieur à `fromDate`, ou `null` si aucune ouverture dans la fenêtre de recherche.

Tests à ajouter dans `timeRuleMatcher.test.ts` :
- Aucune règle applicable → `null`.
- Une règle, fenêtre future le même jour → renvoie le bon datetime.
- Une règle weekend-only le vendredi 23h → renvoie samedi matin.
- Deux règles concurrentes → renvoie la plus proche.

## 5. Cache

Ajouter `allowReadOnly: boolean` à `CachedTimeRule` (`backend/src/services/securityRulesCache.ts`) et au `SELECT` Prisma de `loadTimeRulesFromDb`.

## 6. Service CRUD

`backend/src/services/securityTimeRulesService.ts` :
- `CreateTimeRuleInput` accepte `allowReadOnly?: boolean`.
- `UpdateTimeRuleInput` idem.
- `createTimeRule` persiste `allowReadOnly: input.allowReadOnly ?? false`.
- `updateTimeRule` met à jour si fourni.

Aucune validation supplémentaire (booléen simple).

## 7. Middleware `timeRulesGate` — réécriture

`backend/src/middleware/timeAccess.ts` :

```typescript
const TIME_DENIAL_DEDUP_KEY = (userId: string) => `tr:denied:${userId}`;
const DEDUP_TTL_SEC = 300;

export async function timeRulesGate(req, res, next) {
  if (!req.user) return next();
  const matchableUser = { /* ... inchangé ... */ };

  let allRules: CachedTimeRule[] = [];
  try {
    const platform = await getCachedPlatformTimeRules();
    const tenant = req.companyId ? await getCachedTenantTimeRules(req.companyId) : [];
    allRules = [...platform, ...tenant];
  } catch (e) {
    logger.warn('[timeRulesGate] failed reading rules, allowing through', { err: String(e) });
    return next();
  }

  const rules: MatchableTimeRule[] = allRules.map(/* ... + allowReadOnly */);
  const targeting = rules.filter(r => userMatches(matchableUser, r));
  if (targeting.length === 0) return next();

  const now = new Date();
  if (targeting.some(r => ruleAppliesNow(r, matchableUser, now))) return next();

  // → fenêtre fermée pour cet utilisateur
  const method = req.method.toUpperCase();
  const isMutation = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
  const allReadOnlyEnabled = targeting.every(r => r.allowReadOnly === true);

  if (!isMutation && allReadOnlyEnabled) {
    return next();   // GET autorisée
  }

  // Audit dédoublonné (1 entrée par session via Redis TTL 5min)
  await maybeRecordTimeBlock({
    userId: req.user.id,
    companyId: req.companyId ?? null,
    ip: req.realIp ?? req.ip ?? 'unknown',
    req,
  });

  const firstRule = targeting[0];
  const message = firstRule.deniedMessage ?? 'Accès restreint en dehors des heures autorisées.';
  const next_open = nextOpenAt(rules, matchableUser, now);

  res.status(423).json({
    success: false,
    error: 'outside_time_window',
    message,
    next_open: next_open ? next_open.toISOString() : null,
    allow_read_only: allReadOnlyEnabled,
  });
}

async function maybeRecordTimeBlock(opts: { userId, companyId, ip, req }): Promise<void> {
  try {
    const key = TIME_DENIAL_DEDUP_KEY(opts.userId);
    const exists = await redis.exists(key);
    if (exists) return;  // déjà loggé dans cette session
    await redis.set(key, '1', 'EX', DEDUP_TTL_SEC);
    await prisma.securityBlockHistory.create({
      data: {
        blockedIp: opts.ip,
        attemptedUserId: opts.userId,
        blockReason: 'OUTSIDE_TIME_WINDOW',
        requestPath: opts.req.path,
        userAgent: opts.req.get('user-agent') ?? null,
        status: 'BLOCKED',
        companyId: opts.companyId,
      },
    });
  } catch (e) {
    logger.warn('[timeAccess] dedup or audit failed', { err: String(e) });
  }
}
```

Notes :
- **423 Locked** (RFC 4918, sémantique "resource locked") — distinct du 403 Forbidden permanent.
- **Dédoublonnage Redis** : 1 audit max par 5 min par utilisateur. Évite la pollution par les polls toutes les 60s.
- **Fail-open** sur erreur Redis (log warn, on laisse passer la requête — sécurité dégradée vs disponibilité).

## 8. Endpoint `GET /api/security/time-status`

### 8.1 Service

`backend/src/services/securityTimeStatusService.ts` :
```typescript
export interface TimeStatusResult {
  locked: boolean;
  message: string | null;
  nextOpen: Date | null;
  allowReadOnly: boolean;
}

export async function getCurrentTimeStatus(
  user: MatchableUser,
  companyId: string | null
): Promise<TimeStatusResult>;
```

Logique :
1. Charger règles plateforme + tenant via cache.
2. Filtrer celles qui visent l'utilisateur (`userMatches`).
3. Si la liste est vide → `{ locked: false, message: null, nextOpen: null, allowReadOnly: false }`.
4. Si au moins une fenêtre ouverte maintenant → idem (locked: false).
5. Sinon : `locked: true`, `message` du premier rule (fallback générique), `nextOpen` via `nextOpenAt`, `allowReadOnly` = `every(r.allowReadOnly)`.

### 8.2 Route

`backend/src/routes/security-time-status.ts` :
```typescript
const router = Router();
router.use(authorize([]));  // pas de permission spécifique, juste authenticate (via mount)

router.get('/', async (req, res) => {
  try {
    const user: MatchableUser = {
      id: req.user!.id,
      role: req.user!.role,
      branch: req.user!.branch ?? null,
      department: req.user!.department ?? null,
    };
    const result = await getCurrentTimeStatus(user, req.companyId ?? null);
    res.json({ success: true, data: result });
  } catch (e) {
    console.error('[security-time-status]', e);
    res.status(500).json({ success: false, error: 'internal' });
  }
});
```

### 8.3 Câblage

Dans `backend/src/server.ts`, juste après l'extraction `protect` :

```typescript
// Time status : route de polling, NE PAS appliquer timeRulesGate (la route doit
// répondre même quand l'utilisateur est verrouillé pour permettre le polling
// frontend depuis le banner /blocked).
app.use('/api/security/time-status', authenticate, tenantIpGate, securityTimeStatusRoutes);
```

Cette route applique `authenticate` + `tenantIpGate` (un IP-bloqué reste bloqué) mais **pas** `timeRulesGate`.

## 9. Tests

### 9.1 Unit — `timeRuleMatcher.test.ts` (extension)

Tests pour `nextOpenAt` :
- Aucune règle → `null`.
- Règle lun-ven 09-18 `Europe/Paris`, on samedi → renvoie lundi 09:00 Paris.
- Règle lun-ven, on lundi 08:30 → renvoie lundi 09:00.
- Règle lun-ven, on lundi 12:00 (DANS la fenêtre — n'est pas censé être appelé en pratique, mais doit renvoyer la prochaine ouverture après aujourd'hui ou null suivant convention) → spec : renvoie le prochain `timeStart >= now`, donc mardi 09:00.
- Deux règles concurrentes (dimanche, weekend `Africa/Dakar` + lun-ven `Europe/Paris`) → renvoie la plus proche.

### 9.2 Intégration — `securityTimeRulesRoute.test.ts` (extension)

- POST avec `allowReadOnly: true` → 201 + champ persisté.
- PUT pour modifier `allowReadOnly` → champ mis à jour.

### 9.3 Intégration — `securityTimeStatusRoute.test.ts` (nouveau)

- GET avec user non visé par aucune règle → `locked: false, nextOpen: null`.
- GET avec fenêtre ouverte → `locked: false`.
- GET avec fenêtre fermée et règle (`allowReadOnly: false`) → `locked: true, nextOpen` non null, `allowReadOnly: false`.
- GET avec fenêtre fermée et toutes règles `allowReadOnly: true` → `locked: true, allowReadOnly: true` (le front peut décider GET=OK).

### 9.4 Intégration — `timeRulesGate` (smoke via `clientContractsRoute` ou ajout d'un test dédié)

- POST hors fenêtre → 423 + `next_open` + `allow_read_only` dans la réponse.
- GET hors fenêtre avec `allowReadOnly: true` → 200 (passe).
- GET hors fenêtre avec `allowReadOnly: false` → 423.
- Polling après le 423 initial : pas de nouvelle entrée block_history (dédoublonnage).

## 10. Hors-périmètre Phase 6a

- Toute la partie frontend (Phase 6b).
- Bloquer les routes **hors `/api/*`** (pages SPA servies par autre serveur — c'est un sujet 6b côté axios interceptor + react-router).
- Websockets : pas d'usage actuel.
- Notification email aux admins pour les blocs IP/time (Phase 7 éventuelle).

## 11. Risques

- **Code 423** : moins répandu que 403. Les axios interceptors et clients tiers peuvent ne pas avoir de handler dédié. Mitigation : le frontend (6b) ajoute un interceptor explicite.
- **`maybeRecordTimeBlock` fail-open** : si Redis est down, on log à chaque requête (pas de dédoublonnage). Acceptable comme sécurité-dégradée.
- **Migration `allow_read_only` en prod** : default `false` — les règles existantes deviennent strictes (cohérent avec le comportement actuel). Aucun downtime.

## 12. Migration / déploiement

- 1 migration Prisma (additive, sûre).
- Pas de coordination front/back : la 6a peut être déployée avant la 6b. Le frontend actuel verra des 423 au lieu de 403 — comportement gracieux (les pages affichent l'erreur normale jusqu'à 6b).
