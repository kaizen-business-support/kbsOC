# Security Settings — Module documentation

Module complet de gestion de la sécurité d'accès : règles IP, plages horaires, journal des blocages, détection brute-force.

Cette doc est destinée aux ops / DevSecOps / admins SUPER_ADMIN qui gèrent l'application en production.

---

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Variables d'environnement](#2-variables-denvironnement)
3. [Modèle de données](#3-modèle-de-données)
4. [Comportement des middlewares](#4-comportement-des-middlewares)
5. [API REST](#5-api-rest)
6. [Tests manuels](#6-tests-manuels)
7. [Runbook : récupération admin lockout](#7-runbook--récupération-admin-lockout)
8. [Limites & hors-périmètre](#8-limites--hors-périmètre)

---

## 1. Vue d'ensemble

Le module Security Settings expose trois sous-systèmes :

| Sous-système | Description | Effet |
|---|---|---|
| **IP Rules** | Listes d'IPs autorisées (`ALLOW`) ou bloquées (`DENY`), portée plateforme ou tenant. | Bloque toutes les requêtes API depuis une IP DENY. Page `/blocked` côté frontend. |
| **Time Rules** | Plages horaires pendant lesquelles les utilisateurs peuvent agir (lun-ven 9h-18h…). Whitelist strict. | Hors fenêtre : mutations bloquées en 423. GET libéré uniquement si la règle a `allow_read_only=true`. |
| **Brute-Force** | Compte les échecs `POST /api/auth/login` par email. Verrouillage Redis + audit + email user. | Compte verrouillé après N échecs en M minutes pendant T minutes. |
| **Block History** | Journal d'audit de tous les blocages, déblocable individuellement ou en masse, exportable CSV. | UI dédiée onglet "Journal des blocages". |

L'UI complète est accessible aux utilisateurs ayant la permission `manage_security` (par défaut : rôles `ADMIN` via le wildcard `*`, et `SUPER_ADMIN`).

---

## 2. Variables d'environnement

Ajouter dans `backend/.env` :

```bash
# Brute-Force Detection
BF_THRESHOLD="5"              # nombre d'échecs déclenchant le verrouillage (défaut 5)
BF_WINDOW_SEC="300"           # fenêtre d'observation en secondes (défaut 300 = 5 min)
BF_BLOCK_DURATION_SEC="900"   # durée du verrouillage en secondes (défaut 900 = 15 min)
```

Les valeurs par défaut s'appliquent si les variables sont absentes. À ajuster selon la tolérance/sensibilité voulue par tenant.

Pas de variable spécifique pour les règles IP / horaires : tout est en base.

### Trust proxy

`app.set('trust proxy', true)` est activé dans `server.ts`. Conséquence : le serveur fait confiance au header `X-Forwarded-For`. **Cette configuration ne doit être active qu'en présence d'un reverse-proxy fiable (nginx, Cloudflare)** qui réécrit ce header. En direct sur Internet, un attaquant peut forger l'IP.

---

## 3. Modèle de données

Trois tables :
- `security_ip_rules` : règles IP. `companyId IS NULL` = règle plateforme.
- `security_time_rules` : règles horaires (`days_of_week` bitmask, `time_start`/`time_end` HH:MM, `timezone` IANA, `allow_read_only` bool).
- `security_block_history` : audit des blocages. Statuts `BLOCKED` / `UNBLOCKED`. Reasons : `IP_BLACKLISTED`, `OUTSIDE_TIME_WINDOW`, `BRUTE_FORCE`, `MANUAL`.

Migrations appliquées :
- `add_security_settings_module` (Phase 1)
- `add_time_rule_allow_read_only` (Phase 6a)

Aucun seed initial. Les règles sont créées via UI ou directement en base par un SUPER_ADMIN.

---

## 4. Comportement des middlewares

Ordre dans `server.ts` :

```
extractRealIp        ← pose req.realIp depuis X-Forwarded-For
platformIpGate       ← bloque (403) si IP match une règle plateforme DENY
helmet / compression / globalLimiter / express.json / cookieParser / auditLogger
... routes publiques (auth/login, refresh, health) ...
authenticate         ← pose req.user, req.companyId
tenantIpGate         ← bloque (403) si IP match une règle tenant DENY
timeRulesGate        ← 423 si hors fenêtre, GET libéré conditionnellement
... handler de route ...
```

`tenantIpGate` + `timeRulesGate` sont :
- Appliqués via le tableau `protect` sur 32 routes authentifiées.
- Réappliqués À L'INTÉRIEUR de `codir.ts`, `contracts.ts`, `contract-templates.ts` (qui ont leur propre `router.use(authenticate)`).

Routes intentionnellement non protégées par ces gates :
- `/api/auth/*` (login, refresh) : publiques.
- `/api/health` : monitoring.
- `/api/security/time-status` : doit toujours répondre pour permettre le polling frontend (idem audit en cas de lock).
- `/api/companies` : auth inline par route (pré-context tenant).
- `/api/platform` : routes SUPER_ADMIN exclusivement (auth inline + `requireSuperAdmin`).

### Sémantique précise

**IP block** : premier match arrête.
1. Une règle DENY plateforme → 403.
2. Sinon une règle DENY tenant → 403.
3. Sinon → next().

**Time block (Phase 6a)** : whitelist strict.
1. Aucune règle ne vise l'utilisateur (via `applies_to` + `target_values`) → next().
2. Au moins une fenêtre ouverte maintenant → next().
3. Hors fenêtre :
   - Méthode mutation (POST/PUT/PATCH/DELETE) → **423**.
   - Méthode GET ET toutes les règles applicables ont `allow_read_only=true` → next().
   - Méthode GET ET au moins une règle a `allow_read_only=false` → **423**.
4. Audit `security_block_history` : 1 entrée max par utilisateur par 5 min (clé Redis `tr:denied:<userId>`).

**Brute-force** :
1. À chaque échec `POST /api/auth/login` (user inconnu, inactif ou bad password) → `INCR bf:fail:user:<email>` avec `EX BF_WINDOW_SEC`.
2. À la transition au seuil (5ᵉ échec) → poser flag `bf:block:user:<email> EX BF_BLOCK_DURATION_SEC` + audit + email à l'user (si email match en DB).
3. Tant que le flag existe, le middleware `bruteForceGate` retourne 429 sans vérifier le mot de passe.
4. Login réussi → purge des deux clés.

---

## 5. API REST

Toutes les routes ci-dessous nécessitent permission `manage_security` (admin/wildcard bypass).

### IP Rules
- `GET    /api/security/ip-rules` — liste paginée (filtres : `isActive`, `ruleType`, `search`, `scope`).
- `POST   /api/security/ip-rules` — créer (validation IP/CIDR + anti-self-lockout).
- `PUT    /api/security/ip-rules/:id` — mise à jour.
- `PATCH  /api/security/ip-rules/:id/toggle` — activer/désactiver.
- `DELETE /api/security/ip-rules/:id` — soft delete.

### Time Rules
- `GET    /api/security/time-rules` — liste paginée.
- `POST   /api/security/time-rules` — créer (validation jours/HH:MM/timezone/targetValues).
- `PUT    /api/security/time-rules/:id` — mise à jour.
- `PATCH  /api/security/time-rules/:id/toggle` — activer/désactiver.
- `DELETE /api/security/time-rules/:id` — soft delete.
- `GET    /api/security/time-rules/:id/preview` — 7 prochains jours `[{ date, allowed, slots }]`.

### Time Status (polling-friendly, NON bloqué par timeRulesGate)
- `GET    /api/security/time-status` — `{ locked, message, nextOpen, allowReadOnly }`. Frontend poll ce endpoint toutes les 60s.

### Block History
- `GET    /api/security/block-history` — liste paginée (filtres : `blockedIp`, `reason`, `status`, `userId`, `dateFrom`, `dateTo`, `scope`).
- `POST   /api/security/block-history/:id/unblock` — body `{ note }` (5-500 chars). 422 si déjà UNBLOCKED.
- `POST   /api/security/block-history/unblock-all` — body `{ filter, note }`. Renvoie `{ affected }`.
- `GET    /api/security/block-history/export` — CSV stream (cap 10 000 lignes, header `X-Truncated: true` au-delà).

### Réponses spécifiques (frontend interceptors)
- **403 + `error: 'ip_blocked'`** : axios redirige vers `/blocked` (sessionStorage stocke `blockedIp`).
- **423 + `error: 'outside_time_window'`** : axios dispatch event `security:time-locked` → SecurityLockContext met à jour banner + désactive CTAs.

---

## 6. Tests manuels

### 6.1 IP rule DENY local
1. UI > Sécurité > Règles IP > "Ajouter une règle".
2. IP `127.0.0.1/32`, type DENY → tentative refusée par anti-lockout (422 `self_lockout_prevented`).
3. À la place, créer DENY pour `198.51.100.0/24` (range de test RFC 5737).
4. ```bash
   curl -s -o /dev/null -w "%{http_code}\n" \
     -H "X-Forwarded-For: 198.51.100.42" http://localhost:5007/api/clients
   # → 403
   ```
5. SQL :
   ```sql
   SELECT blocked_ip, request_path, status FROM security_block_history
   WHERE block_reason='IP_BLACKLISTED' ORDER BY created_at DESC LIMIT 5;
   ```

### 6.2 Time rule
1. Créer une plage Lun-Ven 09:00-18:00 `Europe/Paris`, applies_to=ALL, `allow_read_only=false`.
2. Si hors fenêtre : POST sur `/api/clients` → **423** avec `next_open`.
3. UI : banner ambre visible en haut, boutons "+ Nouveau Client" / "Approuver" grisés (tooltip = message de la règle).
4. Modifier la règle à `allow_read_only=true` → GET passe à 200, POST reste 423.
5. Recharger l'UI : les boutons Display sont grisés ; les pages affichent leurs listes normalement.

### 6.3 Brute-force
1. POST `/api/auth/login` avec un email valide + mot de passe faux × 5.
2. 6ᵉ requête → **429** `rate_limited`.
3. SQL :
   ```sql
   SELECT * FROM security_block_history
   WHERE block_reason='BRUTE_FORCE' ORDER BY created_at DESC LIMIT 5;
   ```
4. Inbox de l'user : email "Verrouillage temporaire de votre compte".
5. UI Block History > débloquer l'entrée → flag Redis `bf:block:user:<email>` purgé → re-login fonctionne immédiatement.

### 6.4 Page /blocked (frontend)
1. Créer DENY couvrant l'IP courante.
2. Recharger l'app → redirection automatique `/blocked` avec IP affichée.
3. Aucun appel API depuis `/blocked` (vérifier Network tab).

---

## 7. Runbook : récupération admin lockout

Si un admin se verrouille (malgré l'anti-self-lockout sur la création) :

**Cas 1 : DENY IP qui couvre l'IP admin**
- Se connecter depuis une autre IP (VPN, tethering) → désactiver/supprimer la règle.
- Si aucun accès alternatif disponible, en DB :
  ```sql
  UPDATE security_ip_rules SET is_active = false
  WHERE id = '<rule_id>';
  ```
  + ```sh
  redis-cli DEL "sec:ip-rules:platform" "sec:ip-rules:tenant:<companyId>"
  ```

**Cas 2 : Time rule qui bloque l'admin hors fenêtre**
- Idem : `UPDATE security_time_rules SET is_active = false WHERE id = '<rule_id>';`
- Invalider le cache : `redis-cli DEL "sec:time-rules:platform" "sec:time-rules:tenant:<companyId>"`
- L'admin retrouve l'accès au prochain poll (≤ 60s).

**Cas 3 : Compte admin lock BF**
- ```sh
  redis-cli DEL "bf:fail:user:<email>" "bf:block:user:<email>"
  ```
- Ou via UI par un autre admin : Block History > débloquer (purge Redis automatique en Phase 5).

---

## 8. Limites & hors-périmètre

- **Pas de cache local côté middleware** : chaque requête fait un HIT Redis (mais Redis répond en sub-millisecond). Acceptable.
- **Fail-open Redis** : si Redis tombe, les middlewares laissent passer + log warn. Trade-off : disponibilité > sécurité dégradée.
- **Pas de configuration UI des seuils BF** : env vars uniquement (redémarrage requis).
- **Pas de WebSocket protection** : l'app n'en utilise pas.
- **Pas de géolocalisation IP** : seules IP/CIDR sont supportées.
- **Pas de captcha** : la défense BF repose sur lockout + email seulement.
- **CSV export** : capé à 10 000 lignes (header `X-Truncated` au-delà).
- **Brute-force IP-level** : explicitement non implémenté pour éviter les faux positifs NAT. Seul l'email est protégé.

Tout suivi (Phase 7+ éventuelle) : captcha, géoloc, UI config seuils, mode whitelist strict global, alertes Slack.
