# Security Settings — Phase 5 Brute-Force Detection

**Date :** 2026-05-14
**Statut :** design validé, prêt pour plan d'implémentation
**Dépend de :** Phase 1 (enum `BRUTE_FORCE`), Phase 4 (UI lecture et déblocage via BlockHistoryTab).

## 1. Contexte & objectif

Détecter les tentatives répétées de login échouées et verrouiller le compte concerné. Spécificités :
- **Block au niveau utilisateur (email)** uniquement — pas de block IP (évite faux positifs derrière NAT).
- Compteurs Redis avec TTL.
- Notification email à l'utilisateur dont le compte est verrouillé (si email match un user en DB).
- Audit dans `security_block_history` (`reason='BRUTE_FORCE'`), visible/débloquable depuis l'UI Phase 4.
- Déblocage manuel via Phase 4 purge également le flag Redis.

Brute-force = ce sous-système. Aucune autre détection (timing, distributed, etc.) en Phase 5.

## 2. Sémantique

### Compteur
- Clé Redis : `bf:fail:user:<emailLower>`.
- À chaque échec d'authentification sur `POST /api/auth/login` (mauvais mot de passe pour email donné) : `INCR` + `EX BF_WINDOW_SEC` lors du 1er incrément.
- À chaque login **réussi** : `DEL bf:fail:user:<emailLower>` + `DEL bf:block:user:<emailLower>`.

### Block
- Quand le compteur atteint `BF_THRESHOLD` :
  - `SET bf:block:user:<emailLower> 1 EX BF_BLOCK_DURATION_SEC`.
  - Insert d'une entrée `security_block_history` (`reason='BRUTE_FORCE'`).
  - Envoi d'un email à l'user (si email correspond à un user en DB).
- Tant que le flag `bf:block:user:<email>` est présent, `POST /login` avec cet email → **429** (avant même la vérification du mot de passe).

### Pas de block IP
- L'IP est journalisée (`blockedIp` dans l'audit) pour traçabilité.
- Aucun flag Redis IP, aucun blocage d'IP côté login.
- Conséquence : les autres users d'un même réseau (NAT, bureau partagé) ne sont jamais impactés.

## 3. Configuration (env vars)

`backend/.env.example` :
```
BF_THRESHOLD=5             # nombre d'échecs déclenchant le block
BF_WINDOW_SEC=300          # fenêtre d'observation (5 min)
BF_BLOCK_DURATION_SEC=900  # durée du block (15 min)
```

Defaults sensés (5/300/900) si absent. Pas d'UI de config en Phase 5.

## 4. Composants

### 4.1 `backend/src/services/bruteForceTracker.ts`

API publique :
```typescript
export async function recordFailedAttempt(email: string): Promise<{ blocked: boolean }>;
export async function recordSuccessfulAttempt(email: string): Promise<void>;
export async function isBlocked(email: string): Promise<{ blocked: boolean; ttlSec?: number }>;
export async function purgeBlocksForEmail(email: string): Promise<void>;

export interface BruteForceConfig {
  threshold: number;
  windowSec: number;
  blockDurationSec: number;
}
export function getBruteForceConfig(): BruteForceConfig;
```

Implémentation :
- Normalise l'email (`trim`, `toLowerCase`).
- Utilise les helpers `cacheGet`/`cacheSet`/`cacheDel` existants + appel direct au client Redis pour `INCR`/`TTL` (à voir : si l'API actuelle ne l'expose pas, on importera `redis` default depuis `services/redis.ts`).
- `recordFailedAttempt` retourne `blocked: true` uniquement la **première fois** que le seuil est franchi (pas à chaque incrément subséquent), pour éviter les audits dupliqués.
- Fail-open si Redis indisponible : on retourne `{ blocked: false }` et log un warn. Le block ne peut pas s'appliquer mais le système reste opérationnel.

### 4.2 `backend/src/middleware/bruteForceGate.ts`

```typescript
export async function bruteForceGate(req, res, next): Promise<void>
```

- Lit `req.body.email` (string ou null).
- Si null/vide → `next()` (le handler login renverra 400 plus tard).
- Si `isBlocked(email)` → 429 `{ success: false, error: 'rate_limited', message: 'Trop de tentatives. Compte temporairement verrouillé.' }`.
- Sinon → `next()`.

### 4.3 `backend/src/services/bruteForceEmail.ts`

Helper pur de templating :
```typescript
export function buildBruteForceLockoutEmail(opts: {
  recipientName: string;
  failedAttempts: number;
  windowMinutes: number;
  unlockAt: Date;
}): { subject: string; bodyHtml: string; bodyText: string };
```

Sujet : `[OptimusCredit] Verrouillage temporaire de votre compte`.
Corps FR (HTML et texte plain) avec les détails (N tentatives, fenêtre, datetime de déverrouillage).

### 4.4 Modifications de `backend/src/routes/auth.ts`

Mount `bruteForceGate` avant le handler login. Dans le handler :
- À l'issue **succès** (token émis) : `await recordSuccessfulAttempt(email)`.
- À l'issue **bad creds** : `const { blocked } = await recordFailedAttempt(email);` ; si `blocked === true`, on a une transition : lookup user en DB → si trouvé, créer l'audit + enqueue email (helper `triggerBruteForceLockout`).

### 4.5 Modifications de `backend/src/services/securityBlockHistoryService.ts`

Dans `unblockOne` : si l'entrée a `block_reason === 'BRUTE_FORCE'` ET `attemptedUserId` non null :
- Charger `email` du user.
- `await purgeBlocksForEmail(email)`.

Best-effort : un échec Redis n'empêche pas l'unblock du log.

### 4.6 `backend/src/services/triggerBruteForceLockout.ts`

Fonction orchestratrice appelée par le handler login quand `blocked` passe de `false` à `true` :
```typescript
export async function triggerBruteForceLockout(opts: {
  email: string;
  ip: string;
  userAgent: string | null;
}): Promise<void>
```

Étapes :
1. `const user = await prisma.user.findUnique({ where: { email }, include: { memberships: { take: 1 } } })`.
2. Insert `prisma.securityBlockHistory.create({...})` avec :
   - `blockedIp = ip`
   - `attemptedUserId = user?.id ?? null`
   - `blockReason = 'BRUTE_FORCE'`
   - `requestPath = '/api/auth/login'`
   - `userAgent`
   - `status = 'BLOCKED'`
   - `companyId = user?.memberships[0]?.companyId ?? null`
3. Si `user` existe :
   - Calcul `unlockAt = now + BF_BLOCK_DURATION_SEC * 1000`.
   - Compose mail via `buildBruteForceLockoutEmail`.
   - Enqueue via le service email existant (à câbler avec ce qui est dispo : `emailQueueService` ou `notificationService`).
4. Toute exception → `logger.warn` (best-effort). On ne fait pas remonter d'erreur au handler login.

## 5. Réponses HTTP

| Cas | Code | Body |
|---|---|---|
| Login avec compte verrouillé BF | 429 | `{ success: false, error: 'rate_limited', message: 'Trop de tentatives. Compte temporairement verrouillé.' }` |
| Login bad creds avant seuil | 401 (inchangé) | (réponse existante) |
| Login bad creds au seuil | 429 | Même message que ci-dessus |

Pas de détail (durée restante exacte, compteur) — évite le leak d'état à un attaquant.

## 6. Tests

### 6.1 Unit — `bruteForceTracker.test.ts`

Avec Redis mocké :
- `recordFailedAttempt(email)` premier appel → `blocked: false`, counter=1.
- 4ᵉ appel → counter=4, `blocked: false`.
- 5ᵉ appel → counter=5, `blocked: true` (le flag a été posé).
- 6ᵉ appel → `blocked: false` (transition déjà passée — pas de re-audit).
- `recordSuccessfulAttempt` → counter et flag purgés.
- `isBlocked` avec flag → `{ blocked: true, ttlSec > 0 }`.
- `isBlocked` sans flag → `{ blocked: false }`.
- `purgeBlocksForEmail` → flag supprimé.
- Normalisation : `"   USER@Mail.com  "` → key `bf:fail:user:user@mail.com`.

### 6.2 Intégration — `bruteForceFlow.test.ts`

Avec Redis local + Prisma :
- Créer un User test.
- POST `/api/auth/login` 5× avec mauvais password → 401 × 4 puis 429 ou 401 (au 5ᵉ).
- POST 6ᵉ → 429.
- Vérifier `security_block_history` : 1 entrée `BRUTE_FORCE` avec `attemptedUserId = user.id`.
- Mock `triggerBruteForceLockout`'s email enqueue → vérifier qu'il est appelé 1×.
- `purgeBlocksForEmail` → POST suivant → handler reprend normalement.

Pour email inconnu : POST login 5× avec un email qui n'existe pas en DB → 1 audit créé avec `attemptedUserId = null` + pas d'email envoyé.

## 7. Hors-périmètre

- Captcha visible après N échecs.
- Notification SMS / Slack.
- Configuration via UI ou DB (modulable Phase 6).
- Compteur IP informatif pour admin.
- Détection de patterns avancés (timing, distributed, low-and-slow).
- Tests automatisés couvrant le rendu HTML de l'email (snapshot via Vitest/Jest si nécessaire — Phase 6).

## 8. Risques

- **Email inconnu = pas d'audit ?** Non : on crée toujours l'audit avec `attemptedUserId = null`. L'admin voit dans Phase 4 que quelqu'un a tenté de force des emails inexistants (utile pour détection d'énumération).
- **Redis down** : tout le système BF est fail-open. Trade-off accepté (préfère le service up sans BF que down avec BF).
- **Lookup user en DB ralentit le login** : ajout d'1 query à chaque échec qui atteint le seuil. Acceptable car rare.
- **Email enqueue avant unlock** : si l'email arrive après que l'admin a déjà unlock manuellement, l'user reçoit un mail "verrouillé jusqu'à HH:MM" mais peut se connecter. Mineur, mention dans le mail "ou jusqu'à intervention administrateur".

## 9. Migration / déploiement

Aucune migration de schéma. Ajout des 3 env vars dans `backend/.env.example` (le déployeur doit les ajouter au `.env` de prod). Désactivable en revert des commits.
