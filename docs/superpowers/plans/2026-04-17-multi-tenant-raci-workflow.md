# Multi-Tenant SaaS + Workflow RACI Dynamique — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer kbsOC en plateforme SaaS multi-tenant avec isolation par `companyId`, nouveaux rôles organisationnels basés sur la RACI BCI, et Chinese Wall technique.

**Architecture:** Row-level tenancy — `companyId` sur tous les modèles, injecté depuis le JWT. Chaque compagnie configure son propre workflow via `CreditPolicy`. Un utilisateur peut appartenir à plusieurs compagnies avec des rôles différents (`CompanyMembership`).

**Tech Stack:** Node.js + Express + Prisma + PostgreSQL + Redis (blacklist JWT) · React + TypeScript + MUI

**Spec:** `docs/superpowers/specs/2026-04-17-multi-tenant-raci-workflow-design.md`

---

## Cartographie des fichiers

### Créer
- `backend/prisma/migrate-tenant.js` — script migration données existantes → compagnie BCI
- `backend/src/services/redis.ts` — blacklistToken / isTokenBlacklisted (invalidation JWT)
- `backend/src/routes/companies.ts` — CRUD compagnies (ADMIN + SUPER_ADMIN)
- `backend/src/routes/platform.ts` — admin plateforme cross-compagnie (SUPER_ADMIN)
- `src/contexts/CompanyContext.tsx` — contexte compagnie active + switchCompany
- `src/components/CompanySelector.tsx` — modal sélection compagnie post-login
- `src/components/CompanySwitcher.tsx` — switcher compagnie dans la navbar
- `src/pages/CompanySettingsPage.tsx` — settings compagnie (ADMIN)
- `src/pages/PlatformAdminPage.tsx` — admin plateforme (SUPER_ADMIN)

### Modifier
- `backend/prisma/schema.prisma` — Company, CompanyMembership, companyId partout, nouveaux UserRole
- `backend/src/middleware/auth.ts` — companyId dans JWT, requireCompany middleware
- `backend/src/routes/auth.ts` — login retourne companies, select-company, switch-company
- `backend/src/routes/workflows.ts` — filtrage companyId
- `backend/src/routes/applications.ts` — filtrage companyId
- `backend/src/routes/clients.ts` — filtrage companyId, drop contrainte unique rccm/ninea
- `backend/src/routes/users.ts` — filtrage companyId, memberships
- `backend/src/routes/credit-policy.ts` — filtrage companyId
- `backend/src/routes/approval-limits.ts` — filtrage companyId
- `backend/src/routes/delegations.ts` — filtrage companyId
- `backend/src/routes/departments.ts` — filtrage companyId
- `backend/src/routes/branches.ts` — filtrage companyId
- `backend/src/services/workflowService.ts` — Chinese Wall dans canApproveStep
- `backend/src/constants/stepNames.ts` — nouveaux noms d'étapes RACI
- `backend/src/server.ts` — monter routes companies et platform
- `src/types/index.ts` — nouveaux UserRole, types Company
- `src/contexts/UserContext.tsx` — intégrer CompanyContext
- `src/services/api.ts` — endpoints compagnie
- `src/pages/LoginPage.tsx` — appel sélecteur de compagnie
- `src/pages/WorkflowPage.tsx` — adapter nouveaux rôles
- `src/App.tsx` — nouvelles routes

---

## Phase 1 — Fondation backend

### Task 1 : Schéma Prisma — Company, CompanyMembership, companyId, nouveaux rôles

**Fichiers :**
- Modify: `backend/prisma/schema.prisma`

**Stratégie enum UserRole :** On garde les `@map` existants et on renomme uniquement les membres Prisma. Pas de `ALTER TYPE ... RENAME VALUE` en base — Prisma stocke la valeur `@map` en DB, pas le nom Prisma. Renommer `ACCOUNT_MANAGER` → `CHARGE_AFFAIRES` en gardant `@map("account_manager")` laisse la colonne DB inchangée. Pour les nouveaux rôles (SUPER_ADMIN, BACK_OFFICE, DIRECTION_JURIDIQUE) qui n'ont pas d'équivalent `@map` existant, Prisma génère `ALTER TYPE ... ADD VALUE` — aucun risque de perte de données.

- [ ] **Step 1 : Ajouter les nouveaux modèles et champs dans schema.prisma**

Remplacer le bloc `enum UserRole` existant (ligne ~442) par :

```prisma
enum UserRole {
  CHARGE_AFFAIRES         @map("account_manager")      // ex ACCOUNT_MANAGER
  ANALYSTE_RISQUES        @map("credit_analyst")        // ex CREDIT_ANALYST
  RESPONSABLE_RISQUES     @map("analyst_supervisor")    // ex ANALYST_SUPERVISOR
  RESPONSABLE_ENGAGEMENTS @map("branch_manager")        // ex BRANCH_MANAGER
  COMITE_CREDIT           @map("credit_committee")      // ex CREDIT_COMMITTEE
  DIRECTION_GENERALE      @map("management")            // ex MANAGEMENT
  ADMIN                   @map("admin")
  SUPER_ADMIN             @map("super_admin")           // nouveau
  BACK_OFFICE             @map("back_office")           // nouveau
  DIRECTION_JURIDIQUE     @map("direction_juridique")   // nouveau

  @@map("user_role")
}
```

Ajouter AVANT le modèle `User` :

```prisma
model Company {
  id          String   @id @default(cuid())
  name        String
  code        String   @unique
  logoUrl     String?  @map("logo_url")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  memberships  CompanyMembership[]
  clients      Client[]
  applications CreditApplication[]
  policies     CreditPolicy[]
  creditTypes  CreditType[]
  approvalLimits ApprovalLimit[]
  delegations  PowerDelegation[]
  notifications Notification[]
  announcements Announcement[]

  @@map("companies")
}

model CompanyMembership {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  companyId String   @map("company_id")
  role      UserRole
  isActive  Boolean  @default(true) @map("is_active")
  joinedAt  DateTime @default(now()) @map("joined_at")

  user    User    @relation(fields: [userId], references: [id])
  company Company @relation(fields: [companyId], references: [id])

  @@unique([userId, companyId])
  @@index([companyId])
  @@index([userId])
  @@map("company_memberships")
}
```

Ajouter `memberships CompanyMembership[]` dans le modèle `User`.

Ajouter `companyId String? @map("company_id")` + relation `company Company? @relation(...)` + `@@index([companyId])` sur les modèles :
- `Client`
- `CreditApplication`
- `CreditPolicy`
- `CreditType`
- `ApprovalLimit`
- `PowerDelegation`
- `Notification`
- `Announcement`

Sur `Client`, changer les contraintes `rccm` et `ninea` de `@unique` à un index composite `@@unique([companyId, rccm])` et `@@unique([companyId, ninea])` pour permettre deux clients de compagnies différentes avec le même RCCM.

- [ ] **Step 2 : Générer et appliquer la migration**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
npx prisma migrate dev --name add_multi_tenant
```

Expected: migration créée dans `prisma/migrations/`, schéma appliqué.

- [ ] **Step 3 : Vérifier la migration**

```bash
npx prisma studio
# Vérifier que les tables companies et company_memberships existent
```

- [ ] **Step 4 : Régénérer le client Prisma**

```bash
npx prisma generate
```

- [ ] **Step 5 : Commit**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
git add backend/prisma/
git commit -m "feat(schema): Company, CompanyMembership, companyId, nouveaux rôles RACI"
```

---

### Task 2 : Script de migration automatique des données BCI

**Fichiers :**
- Create: `backend/prisma/migrate-tenant.js`

- [ ] **Step 1 : Créer le script**

```javascript
// backend/prisma/migrate-tenant.js
// Script idempotent — peut être relancé sans effet de bord
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Migration multi-tenant — données existantes → BCI');

  // 1. Créer la compagnie BCI (idempotent via upsert)
  const bci = await prisma.company.upsert({
    where: { code: 'BCI' },
    update: {},
    create: {
      name: 'BCI – Banque de Crédit et d\'Investissement',
      code: 'BCI',
      isActive: true,
    },
  });
  console.log(`✅ Compagnie BCI : ${bci.id}`);

  // 2. Rattacher toutes les données existantes à BCI
  const models = [
    { name: 'client',            table: prisma.client },
    { name: 'creditApplication', table: prisma.creditApplication },
    { name: 'creditPolicy',      table: prisma.creditPolicy },
    { name: 'creditType',        table: prisma.creditType },
    { name: 'approvalLimit',     table: prisma.approvalLimit },
    { name: 'powerDelegation',   table: prisma.powerDelegation },
    { name: 'notification',      table: prisma.notification },
    { name: 'announcement',      table: prisma.announcement },
  ];

  for (const { name, table } of models) {
    const updated = await table.updateMany({
      where: { companyId: null },
      data:  { companyId: bci.id },
    });
    console.log(`✅ ${name}: ${updated.count} lignes rattachées à BCI`);
  }

  // 3. Créer CompanyMembership pour chaque User existant (idempotent)
  const users = await prisma.user.findMany({ select: { id: true, role: true } });
  let membershipsCreated = 0;
  for (const user of users) {
    const existing = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId: bci.id } },
    });
    if (!existing) {
      await prisma.companyMembership.create({
        data: { userId: user.id, companyId: bci.id, role: user.role, isActive: true },
      });
      membershipsCreated++;
    }
  }
  console.log(`✅ CompanyMembership : ${membershipsCreated} créées (${users.length - membershipsCreated} déjà existantes)`);

  // 4. Promouvoir un SUPER_ADMIN (idempotent)
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' }
  });
  if (!existingSuperAdmin) {
    const firstAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (firstAdmin) {
      await prisma.user.update({
        where: { id: firstAdmin.id },
        data:  { role: 'SUPER_ADMIN' },
      });
      await prisma.companyMembership.updateMany({
        where: { userId: firstAdmin.id, companyId: bci.id },
        data:  { role: 'SUPER_ADMIN' },
      });
      console.log(`✅ SUPER_ADMIN promu : ${firstAdmin.id}`);
    } else {
      console.warn('⚠️  Aucun ADMIN trouvé pour promotion SUPER_ADMIN');
    }
  } else {
    console.log(`ℹ️  SUPER_ADMIN déjà existant : ${existingSuperAdmin.id}`);
  }

  // 5. Vérification intégrité
  console.log('\n📋 Vérification intégrité :');
  const checks = [
    prisma.client.count({ where: { companyId: null } }),
    prisma.creditApplication.count({ where: { companyId: null } }),
    prisma.creditPolicy.count({ where: { companyId: null } }),
  ];
  const [c1, c2, c3] = await Promise.all(checks);
  if (c1 + c2 + c3 > 0) {
    console.error(`❌ Données orphelines : clients=${c1}, applications=${c2}, policies=${c3}`);
    process.exit(1);
  }
  console.log('✅ Zéro ligne orpheline — migration réussie');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2 : Lancer le script**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
node prisma/migrate-tenant.js
```

Expected:
```
✅ Compagnie BCI : cxxxxxxxx
✅ client: N lignes rattachées à BCI
✅ CompanyMembership : N créées
✅ SUPER_ADMIN promu : cxxxxxxxx
✅ Zéro ligne orpheline — migration réussie
```

- [ ] **Step 3 : Commit**

```bash
git add backend/prisma/migrate-tenant.js
git commit -m "feat(migration): script idempotent données existantes → compagnie BCI"
```

---

### Task 3 : Middleware auth — companyId dans JWT + requireCompany

**Fichiers :**
- Modify: `backend/src/middleware/auth.ts`

- [ ] **Step 1 : Mettre à jour JwtPayload et l'interface Request**

```typescript
// Nouveau JwtPayload
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  jti: string;
  companyId?: string;      // présent dans les tokens post-sélection
  readOnly?: boolean;      // présent dans les tokens d'impersonation
  iat?: number;
  exp?: number;
}

// Extend Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
        companyId?: string;
        readOnly?: boolean;
      };
      companyId?: string;  // raccourci req.companyId
    }
  }
}
```

- [ ] **Step 2 : Enrichir authenticate() pour extraire companyId**

Dans `authenticate()`, après `req.user = { ... }`, ajouter :

```typescript
if (decoded.companyId) {
  req.user!.companyId = decoded.companyId;
  req.companyId = decoded.companyId;
}
if (decoded.readOnly) {
  req.user!.readOnly = true;
}
```

- [ ] **Step 3 : Ajouter le middleware requireCompany**

```typescript
export const requireCompany = (req: Request, res: Response, next: NextFunction) => {
  if (!req.companyId) {
    return res.status(403).json({
      error: 'Compagnie non sélectionnée. Appelez POST /api/auth/select-company d\'abord.',
      code: 'COMPANY_NOT_SELECTED'
    });
  }
  next();
};

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      error: 'Accès réservé au Super Administrateur plateforme.',
      code: 'SUPER_ADMIN_REQUIRED'
    });
  }
  next();
};

export const blockReadOnly = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.readOnly) {
    return res.status(403).json({
      error: 'Mode impersonation : modifications interdites.',
      code: 'READ_ONLY_MODE'
    });
  }
  next();
};
```

- [ ] **Step 4 : Mettre à jour generateToken pour inclure jti et companyId optionnel**

```typescript
export const generateToken = (payload: {
  userId: string;
  email: string;
  role: string;
  companyId?: string;
  readOnly?: boolean;
}, expiresIn = '1h'): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not set');
  const jti = require('uuid').v4();
  return jwt.sign({ ...payload, jti }, jwtSecret, { expiresIn } as any);
};
```

- [ ] **Step 5 : Test rapide**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 erreur TypeScript sur auth.ts.

- [ ] **Step 6 : Commit**

```bash
git add backend/src/middleware/auth.ts
git commit -m "feat(auth): companyId dans JWT, requireCompany, requireSuperAdmin, blockReadOnly"
```

---

### Task 3b : Service Redis — blacklistToken / checkBlacklist

**Fichiers :**
- Create: `backend/src/services/redis.ts`

Cette tâche doit être réalisée AVANT Task 4 car `auth.ts` importe `blacklistToken`.

- [ ] **Step 1 : Créer backend/src/services/redis.ts**

```typescript
import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    redisClient.on('error', (err) => console.error('Redis error:', err));
    await redisClient.connect();
  }
  return redisClient;
}

/**
 * Blacklist un JTI (JSON Token ID) avec TTL = durée de vie restante du token.
 * Utilisé lors de switch-company, select-company et logout.
 */
export async function blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.set(`blacklist:${jti}`, '1', { EX: Math.max(1, ttlSeconds) });
  } catch (err) {
    console.error('Redis blacklistToken error:', err);
    // Non-fatal: si Redis est indisponible, le token reste valide jusqu'à expiration naturelle
  }
}

/**
 * Vérifie si un JTI est blacklisté.
 * Retourne true si le token doit être rejeté.
 */
export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    const val = await client.get(`blacklist:${jti}`);
    return val !== null;
  } catch (err) {
    console.error('Redis isTokenBlacklisted error:', err);
    return false; // En cas d'erreur Redis, laisser passer (fail open)
  }
}
```

- [ ] **Step 2 : Vérifier que redis est dans les dépendances backend**

```bash
cd backend && cat package.json | grep '"redis"'
```

Si absent :
```bash
npm install redis
```

- [ ] **Step 3 : Intégrer la vérification blacklist dans authenticate() de auth.ts**

Dans `backend/src/middleware/auth.ts`, après la vérification JWT, ajouter :

```typescript
import { isTokenBlacklisted } from '../services/redis';

// Dans authenticate(), après jwt.verify() :
if (decoded.jti) {
  const blacklisted = await isTokenBlacklisted(decoded.jti);
  if (blacklisted) {
    return res.status(401).json({ error: 'Token révoqué', code: 'TOKEN_REVOKED' });
  }
}
```

- [ ] **Step 4 : Build test**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 erreur TypeScript.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/services/redis.ts backend/src/middleware/auth.ts
git commit -m "feat(auth): service Redis blacklist JWT (blacklistToken, isTokenBlacklisted)"
```

---

### Task 4 : Routes auth — login multi-compagnie, select-company, switch-company

**Fichiers :**
- Modify: `backend/src/routes/auth.ts`

- [ ] **Step 0 : Ajouter les imports manquants en tête de auth.ts**

```typescript
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { blacklistToken } from '../services/redis';
```

Si `uuid` absent des dépendances backend :
```bash
cd backend && npm install uuid && npm install -D @types/uuid
```

- [ ] **Step 0b : Ajouter la helper generateRefreshToken**

```typescript
function generateRefreshToken(userId: string): string {
  const jti = uuidv4();
  return jwt.sign(
    { userId, jti, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'dev-refresh-secret',
    { expiresIn: '7d' }
  );
}
```

- [ ] **Step 1 : Modifier POST /login pour retourner la liste des compagnies**

Après la vérification du mot de passe et avant la génération du token complet, récupérer les memberships :

```typescript
// Dans le handler POST /login, remplacer la génération de l'accessToken par :

// Récupérer les compagnies de l'utilisateur
const memberships = await prisma.companyMembership.findMany({
  where: { userId: user.id, isActive: true },
  include: { company: { select: { id: true, name: true, code: true, logoUrl: true, isActive: true } } },
});

const companies = memberships
  .filter(m => m.company.isActive)
  .map(m => ({
    id: m.company.id,
    name: m.company.name,
    code: m.company.code,
    logoUrl: m.company.logoUrl,
    role: m.role,
  }));

// Si une seule compagnie : générer le token final directement
if (companies.length === 1) {
  const accessToken = generateAccessTokenWithCompany({
    userId: user.id,
    email: user.email,
    role: companies[0].role,
    companyId: companies[0].id,
  });
  const refreshToken = generateRefreshToken(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
  return res.json({ success: true, accessToken, refreshToken, user: { ...userData }, companies, autoSelected: true });
}

// Plusieurs compagnies : token partiel (sans companyId, valide 5 min)
const partialToken = jwt.sign(
  { userId: user.id, email: user.email, type: 'company_selection' },
  process.env.JWT_SECRET || 'dev-secret',
  { expiresIn: '5m' }
);

return res.json({ success: true, requiresCompanySelection: true, partialToken, companies, user: { ...userData } });
```

- [ ] **Step 2 : Ajouter POST /select-company**

```typescript
router.post('/select-company', async (req: Request, res: Response) => {
  try {
    const { companyId, partialToken } = req.body;
    if (!companyId || !partialToken) {
      return res.status(400).json({ error: 'companyId et partialToken requis' });
    }

    // Vérifier le partialToken
    let decoded: any;
    try {
      decoded = jwt.verify(partialToken, process.env.JWT_SECRET || 'dev-secret') as any;
    } catch {
      return res.status(401).json({ error: 'Token de sélection invalide ou expiré' });
    }
    if (decoded.type !== 'company_selection') {
      return res.status(401).json({ error: 'Type de token invalide' });
    }

    // Vérifier que l'utilisateur est membre de cette compagnie
    const membership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: decoded.userId, companyId } },
      include: { company: true },
    });
    if (!membership || !membership.isActive || !membership.company.isActive) {
      return res.status(403).json({ error: 'Accès à cette compagnie non autorisé' });
    }

    // Invalider le partialToken (jti blacklist)
    if (decoded.jti) {
      const ttl = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 300;
      await blacklistToken(decoded.jti, ttl);
    }

    // Générer le token final avec companyId
    const accessToken = generateAccessTokenWithCompany({
      userId: decoded.userId,
      email: decoded.email,
      role: membership.role,
      companyId,
    });
    const refreshToken = generateRefreshToken(decoded.userId);

    await prisma.user.update({ where: { id: decoded.userId }, data: { lastLogin: new Date() } });

    return res.json({ success: true, accessToken, refreshToken, company: membership.company, role: membership.role });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur sélection compagnie' });
  }
});
```

- [ ] **Step 3 : Ajouter POST /switch-company**

```typescript
router.post('/switch-company', authenticate, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ error: 'companyId requis' });

    const userId = req.user!.id;

    const membership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: { company: true },
    });
    if (!membership || !membership.isActive || !membership.company.isActive) {
      return res.status(403).json({ error: 'Accès à cette compagnie non autorisé' });
    }

    // Invalider l'ancien token (blacklist par jti)
    const authHeader = req.headers.authorization!;
    const oldToken = authHeader.substring(7);
    const oldDecoded = jwt.decode(oldToken) as any;
    if (oldDecoded?.jti && oldDecoded?.exp) {
      const ttl = oldDecoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) await blacklistToken(oldDecoded.jti, ttl);
    }

    const accessToken = generateAccessTokenWithCompany({
      userId,
      email: req.user!.email,
      role: membership.role,
      companyId,
    });

    return res.json({ success: true, accessToken, company: membership.company, role: membership.role });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur switch compagnie' });
  }
});
```

- [ ] **Step 4 : Ajouter GET /companies**

```typescript
router.get('/companies', authenticate, async (req: Request, res: Response) => {
  const memberships = await prisma.companyMembership.findMany({
    where: { userId: req.user!.id, isActive: true },
    include: { company: { select: { id: true, name: true, code: true, logoUrl: true, isActive: true } } },
  });
  const companies = memberships
    .filter(m => m.company.isActive)
    .map(m => ({ ...m.company, role: m.role }));
  return res.json({ success: true, data: companies });
});
```

- [ ] **Step 5 : Ajouter la fonction helper generateAccessTokenWithCompany**

```typescript
function generateAccessTokenWithCompany(payload: {
  userId: string; email: string; role: string; companyId: string; readOnly?: boolean;
}): string {
  const jti = uuidv4();
  return jwt.sign(
    { ...payload, jti },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '1h' }
  );
}
```

- [ ] **Step 6 : Build test**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 7 : Commit**

```bash
git add backend/src/routes/auth.ts
git commit -m "feat(auth): login multi-compagnie, select-company, switch-company, GET companies"
```

---

### Task 5 : Route companies.ts + platform.ts

**Fichiers :**
- Create: `backend/src/routes/companies.ts`
- Create: `backend/src/routes/platform.ts`

- [ ] **Step 1 : Créer backend/src/routes/companies.ts**

```typescript
import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticate, requireCompany, requireSuperAdmin, blockReadOnly } from '../middleware/auth';

const router = Router();

// GET /api/companies/current — infos de la compagnie active
router.get('/current', authenticate, requireCompany, async (req: Request, res: Response) => {
  const company = await prisma.company.findUnique({
    where: { id: req.companyId },
    include: { memberships: { include: { user: { select: { id: true, name: true, email: true, role: true } } } } }
  });
  if (!company) return res.status(404).json({ error: 'Compagnie introuvable' });
  return res.json({ success: true, data: company });
});

// PATCH /api/companies/current — mise à jour settings compagnie (ADMIN)
router.patch('/current', authenticate, requireCompany, blockReadOnly, async (req: Request, res: Response) => {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
    return res.status(403).json({ error: 'Réservé aux administrateurs' });
  }
  const { name, logoUrl } = req.body;
  const company = await prisma.company.update({
    where: { id: req.companyId },
    data: { ...(name && { name }), ...(logoUrl !== undefined && { logoUrl }) },
  });
  return res.json({ success: true, data: company });
});

// GET /api/companies/members — liste des membres
router.get('/members', authenticate, requireCompany, async (req: Request, res: Response) => {
  const members = await prisma.companyMembership.findMany({
    where: { companyId: req.companyId },
    include: { user: { select: { id: true, name: true, email: true, isActive: true, department: true, branch: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  return res.json({ success: true, data: members });
});

// POST /api/companies/members — inviter un utilisateur
router.post('/members', authenticate, requireCompany, blockReadOnly, async (req: Request, res: Response) => {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
    return res.status(403).json({ error: 'Réservé aux administrateurs' });
  }
  const { userId, role } = req.body;
  if (!userId || !role) return res.status(400).json({ error: 'userId et role requis' });

  const membership = await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId, companyId: req.companyId! } },
    update: { role, isActive: true },
    create: { userId, companyId: req.companyId!, role },
  });
  return res.status(201).json({ success: true, data: membership });
});

// PATCH /api/companies/members/:userId — changer le rôle
router.patch('/members/:userId', authenticate, requireCompany, blockReadOnly, async (req: Request, res: Response) => {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
    return res.status(403).json({ error: 'Réservé aux administrateurs' });
  }
  const { role, isActive } = req.body;
  const membership = await prisma.companyMembership.update({
    where: { userId_companyId: { userId: req.params.userId, companyId: req.companyId! } },
    data: { ...(role && { role }), ...(isActive !== undefined && { isActive }) },
  });
  return res.json({ success: true, data: membership });
});

export default router;
```

- [ ] **Step 2 : Créer backend/src/routes/platform.ts**

```typescript
import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticate, requireSuperAdmin } from '../middleware/auth';
import { blacklistToken } from '../services/redis';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/platform/companies — liste toutes les compagnies
router.get('/companies', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  const companies = await prisma.company.findMany({
    include: { _count: { select: { memberships: true, applications: true, clients: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ success: true, data: companies });
});

// POST /api/platform/companies — créer une compagnie
router.post('/companies', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  const { name, code, logoUrl } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'name et code requis' });
  const company = await prisma.company.create({ data: { name, code, logoUrl } });
  return res.status(201).json({ success: true, data: company });
});

// PATCH /api/platform/companies/:id — activer/désactiver
router.patch('/companies/:id', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  const { isActive } = req.body;
  const company = await prisma.company.update({
    where: { id: req.params.id },
    data: { isActive },
  });
  return res.json({ success: true, data: company });
});

// POST /api/platform/impersonate — token d'impersonation (readOnly)
router.post('/impersonate', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  const { companyId } = req.body;
  if (!companyId) return res.status(400).json({ error: 'companyId requis' });

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return res.status(404).json({ error: 'Compagnie introuvable' });

  const jti = uuidv4();
  const impersonationToken = jwt.sign(
    { userId: req.user!.id, email: req.user!.email, role: 'SUPER_ADMIN', companyId, readOnly: true, jti },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '30m' }
  );

  // Audit log
  await (prisma as any).auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'IMPERSONATION_STARTED',
      resourceType: 'COMPANY',
      resourceId: companyId,
      details: { companyName: company.name, jti },
    }
  }).catch(() => {});

  return res.json({ success: true, impersonationToken, company, expiresIn: '30m' });
});

export default router;
```

- [ ] **Step 3 : Monter les routes dans server.ts**

Dans `backend/src/server.ts`, ajouter :

```typescript
import companyRoutes from './routes/companies';
import platformRoutes from './routes/platform';
```

Et dans les app.use :

```typescript
app.use('/api/companies', authenticate, companyRoutes);
app.use('/api/platform', authenticate, platformRoutes);
```

- [ ] **Step 4 : Build test**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 5 : Commit**

```bash
git add backend/src/routes/companies.ts backend/src/routes/platform.ts backend/src/server.ts
git commit -m "feat(api): routes companies (ADMIN) et platform (SUPER_ADMIN)"
```

---

## Phase 2 — Isolation companyId + métier RACI

### Task 6 : Filtrage companyId sur toutes les routes existantes

**Fichiers :**
- Modify: `backend/src/routes/workflows.ts`
- Modify: `backend/src/routes/applications.ts`
- Modify: `backend/src/routes/clients.ts`
- Modify: `backend/src/routes/users.ts`
- Modify: `backend/src/routes/credit-policy.ts`
- Modify: `backend/src/routes/approval-limits.ts`
- Modify: `backend/src/routes/delegations.ts`
- Modify: `backend/src/routes/departments.ts`
- Modify: `backend/src/routes/branches.ts`

**Principe :** Pour chaque route, ajouter `requireCompany` dans le middleware chain et `companyId: req.companyId` dans toutes les conditions `where` et `data` des requêtes Prisma.

- [ ] **Step 1 : Ajouter requireCompany sur le routeur de chaque fichier**

Dans chaque route file, importer `requireCompany` et l'ajouter sur le router :

```typescript
import { authenticate, requireCompany } from '../middleware/auth';
// ...
router.use(requireCompany); // toutes les routes de ce fichier nécessitent companyId
```

- [ ] **Step 2 : Filtrer workflows.ts**

Dans le GET `/` (findMany), ajouter :

```typescript
whereConditions.companyId = req.companyId;
```

Dans tous les GET par ID, ajouter `companyId: req.companyId` dans le `where`.

Dans les POST de création, ajouter `companyId: req.companyId` dans le `data`.

- [ ] **Step 3 : Filtrer applications.ts**

Même principe — ajouter `companyId: req.companyId` dans tous les `where` et `data` de création.

- [ ] **Step 4 : Filtrer clients.ts**

Même principe. Note : la contrainte `@@unique([companyId, rccm])` remplace `@unique` sur `rccm`, donc vérifier l'unicité avec `{ rccm: value, companyId: req.companyId }`.

- [ ] **Step 5 : Filtrer users.ts**

Les users appartenant à une compagnie se récupèrent via les CompanyMembership :

```typescript
// GET /api/users — liste des users de la compagnie courante
const members = await prisma.companyMembership.findMany({
  where: { companyId: req.companyId, isActive: true },
  include: { user: true },
});
const users = members.map(m => ({ ...m.user, membershipRole: m.role }));
```

- [ ] **Step 6 : Filtrer credit-policy.ts, approval-limits.ts, delegations.ts**

Ajouter `companyId: req.companyId` dans tous les `where` (lecture) et `data` (création).

- [ ] **Step 7 : Filtrer departments.ts et branches.ts**

Même principe.

- [ ] **Step 8 : Build test complet**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 erreur TypeScript.

- [ ] **Step 9 : Commit**

```bash
git add backend/src/routes/
git commit -m "feat(isolation): filtrage companyId sur toutes les routes API"
```

---

### Task 7 : Nouveaux noms d'étapes RACI + Chinese Wall dans workflowService

**Fichiers :**
- Modify: `backend/src/constants/stepNames.ts`
- Modify: `backend/src/services/workflowService.ts`

- [ ] **Step 1 : Mettre à jour stepNames.ts**

```typescript
export const STEP_NAME_FR: Record<string, string> = {
  // Étapes RACI BCI
  application_created:           'Création du dossier',
  charge_affaires_dispatch:      'Dépôt dossier — Chargé d\'Affaires',
  verification_completude:       'Vérification complétude — Engagements',
  contre_analyse:                'Contre-analyse — Direction Risques',
  calcul_ratios_prudentiels:     'Calcul ratios prudentiels — Risques',
  validation_responsable_risques:'Validation Responsable Risques',
  organisation_comite:           'Organisation Comité Crédit — Engagements',
  comite_credit:                 'Comité de Crédit',
  validation_direction_generale: 'Validation Direction Générale',
  mise_en_place_sib:             'Mise en place crédits SIB — Back-office',
  saisie_garanties:              'Saisie garanties — Back-office',
  formalisation_garanties:       'Formalisation garanties — Direction Juridique',
  final_decision:                'Décision finale',
  // Rétrocompatibilité
  credit_analysis:               'Analyse crédit',
  credit_analyst_review:         'Analyse par l\'Analyste Crédit',
  analyst_supervisor_review:     'Validation Superviseur Analyste',
  branch_manager_review:         'Validation Directeur d\'Agence',
  credit_committee_review:       'Passage en Comité de Crédit',
  management_review:             'Validation Direction Générale',
  dispatch:                      'Dispatch',
  account_manager_dispatch:      'Dispatch Chargé de Compte',
  approval:                      'Approbation',
  documentation:                 'Documentation',
};
```

- [ ] **Step 2 : Ajouter le Chinese Wall dans canApproveStep()**

Dans `workflowService.ts`, dans la fonction `canApproveStep()`, ajouter AVANT la vérification des plafonds :

```typescript
import { UserRole } from '@prisma/client';

const CHINESE_WALL_RULES: Partial<Record<UserRole, { forbiddenStepNames: string[]; reason: string }>> = {
  ANALYSTE_RISQUES: {
    forbiddenStepNames: ['mise_en_place_sib', 'saisie_garanties', 'tirage_fonds', 'back_office_setup'],
    reason: 'Direction Risques ne peut pas exécuter des opérations SIB (principe de séparation fonctionnelle)',
  },
  RESPONSABLE_ENGAGEMENTS: {
    forbiddenStepNames: ['contre_analyse', 'calcul_ratios_prudentiels', 'notation_interne', 'avis_risques'],
    reason: 'Direction Engagements ne peut pas émettre un avis Risques',
  },
};

// Dans canApproveStep(), après récupération du user et de l'étape :
const wall = CHINESE_WALL_RULES[user.role as UserRole];
if (wall && wall.forbiddenStepNames.includes(step.stepName)) {
  // Audit log de la tentative de violation
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'CHINESE_WALL_VIOLATION',
      resourceType: 'WORKFLOW_STEP',
      resourceId: step.id,
      details: { stepName: step.stepName, role: user.role, reason: wall.reason },
    }
  }).catch(() => {});
  return { allowed: false, reason: wall.reason };
}
```

- [ ] **Step 3 : Build test**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add backend/src/constants/stepNames.ts backend/src/services/workflowService.ts
git commit -m "feat(workflow): étapes RACI BCI + Chinese Wall dans canApproveStep"
```

---

## Phase 3 — Frontend multi-tenant

### Task 8 : Types TypeScript frontend

**Fichiers :**
- Modify: `src/types/index.ts`

- [ ] **Step 1 : Mettre à jour UserRole et ajouter types Company**

Dans `src/types/index.ts`, remplacer le type UserRole :

```typescript
export type UserRole =
  | 'charge_affaires'          // ex account_manager — Dir. Commerciale
  | 'analyste_risques'         // ex credit_analyst — Dir. Risques
  | 'responsable_risques'      // ex analyst_supervisor — Dir. Risques (superviseur)
  | 'responsable_engagements'  // ex branch_manager — Dir. Engagements
  | 'comite_credit'            // ex credit_committee
  | 'direction_generale'       // ex management
  | 'admin'
  | 'super_admin'              // nouveau — admin plateforme
  | 'back_office'              // nouveau — saisie SIB
  | 'direction_juridique';     // nouveau

export interface Company {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyMembership {
  id: string;
  userId: string;
  companyId: string;
  role: UserRole;
  isActive: boolean;
  joinedAt: string;
  company: Company;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  charge_affaires:          'Chargé d\'Affaires',
  analyste_risques:         'Analyste Risques',
  responsable_risques:      'Responsable Risques',
  responsable_engagements:  'Responsable Engagements',
  comite_credit:            'Comité de Crédit',
  direction_generale:       'Direction Générale',
  admin:                    'Administrateur',
  super_admin:              'Super Administrateur',
  back_office:              'Back-office Crédit',
  direction_juridique:      'Direction Juridique',
};
```

- [ ] **Step 2 : Build test frontend**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): nouveaux UserRole RACI, types Company et CompanyMembership"
```

---

### Task 9 : CompanyContext + UserContext mis à jour

**Fichiers :**
- Create: `src/contexts/CompanyContext.tsx`
- Modify: `src/contexts/UserContext.tsx`

- [ ] **Step 1 : Créer src/contexts/CompanyContext.tsx**

```typescript
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Company, CompanyMembership } from '../types';
import { ApiService, tokenManager } from '../services/api';

interface CompanyContextType {
  currentCompany: Company | null;
  companies: (Company & { role: string })[];
  isLoading: boolean;
  setCurrentCompany: (company: Company | null) => void;
  setCompanies: (companies: (Company & { role: string })[]) => void;
  switchCompany: (companyId: string) => Promise<void>;
  requiresCompanySelection: boolean;
  setRequiresCompanySelection: (val: boolean) => void;
  partialToken: string | null;
  setPartialToken: (token: string | null) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
};

export const CompanyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<(Company & { role: string })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requiresCompanySelection, setRequiresCompanySelection] = useState(false);
  const [partialToken, setPartialToken] = useState<string | null>(null);

  const switchCompany = useCallback(async (companyId: string) => {
    setIsLoading(true);
    try {
      const response = await ApiService.switchCompany(companyId);
      tokenManager.setAccessToken(response.accessToken);
      setCurrentCompany(response.company);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <CompanyContext.Provider value={{
      currentCompany, companies, isLoading,
      setCurrentCompany, setCompanies,
      switchCompany,
      requiresCompanySelection, setRequiresCompanySelection,
      partialToken, setPartialToken,
    }}>
      {children}
    </CompanyContext.Provider>
  );
};
```

- [ ] **Step 2 : Mettre à jour UserContext.tsx — mapping des nouveaux rôles**

Remplacer le `roleMapping` dans `UserContext.tsx` par :

```typescript
const roleMapping: Record<string, UserRole> = {
  'SUPER_ADMIN':              'super_admin',
  'ADMIN':                    'admin',
  'DIRECTION_GENERALE':       'direction_generale',
  'RESPONSABLE_ENGAGEMENTS':  'responsable_engagements',
  'CHARGE_AFFAIRES':          'charge_affaires',
  'ANALYSTE_RISQUES':         'analyste_risques',
  'RESPONSABLE_RISQUES':      'responsable_risques',
  'COMITE_CREDIT':            'comite_credit',
  'BACK_OFFICE':              'back_office',
  'DIRECTION_JURIDIQUE':      'direction_juridique',
  // rétrocompatibilité
  'MANAGEMENT':               'direction_generale',
  'BRANCH_MANAGER':           'responsable_engagements',
  'ACCOUNT_MANAGER':          'charge_affaires',
  'CREDIT_ANALYST':           'analyste_risques',
  'ANALYST_SUPERVISOR':       'responsable_risques',
  'CREDIT_COMMITTEE':         'comite_credit',
};
```

Mettre à jour `getRoleLabel` pour utiliser `ROLE_LABELS` depuis les types.

Envelopper le provider avec `CompanyProvider` dans `App.tsx` (étape suivante).

- [ ] **Step 3 : Mettre à jour src/services/api.ts — nouveaux endpoints**

Ajouter dans `ApiService` :

```typescript
static async selectCompany(companyId: string, partialToken: string) {
  const response = await fetch(`${API_BASE}/auth/select-company`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, partialToken }),
  });
  if (!response.ok) throw new Error('Sélection compagnie échouée');
  return response.json();
}

static async switchCompany(companyId: string) {
  const response = await fetch(`${API_BASE}/auth/switch-company`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
    },
    body: JSON.stringify({ companyId }),
  });
  if (!response.ok) throw new Error('Switch compagnie échoué');
  return response.json();
}

static async getCompanies() {
  const response = await fetch(`${API_BASE}/auth/companies`, {
    headers: { 'Authorization': `Bearer ${tokenManager.getAccessToken()}` },
  });
  if (!response.ok) throw new Error('Chargement compagnies échoué');
  return response.json();
}

static async getCurrentCompany() {
  const response = await fetch(`${API_BASE}/companies/current`, {
    headers: { 'Authorization': `Bearer ${tokenManager.getAccessToken()}` },
  });
  if (!response.ok) throw new Error('Chargement compagnie courante échoué');
  return response.json();
}
```

- [ ] **Step 4 : Build test**

```bash
npx tsc --noEmit
```

- [ ] **Step 5 : Commit**

```bash
git add src/contexts/ src/services/api.ts
git commit -m "feat(frontend): CompanyContext, roleMapping RACI, endpoints API compagnie"
```

---

### Task 10 : CompanySelector modal + sélecteur login

**Fichiers :**
- Create: `src/components/CompanySelector.tsx`
- Create: `src/components/CompanySwitcher.tsx`
- Modify: `src/pages/LoginPage.tsx`

- [ ] **Step 1 : Créer src/components/CompanySelector.tsx**

```tsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Box, Typography,
  Card, CardActionArea, CardContent, Avatar, CircularProgress, Chip
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import { Company } from '../types';
import { ROLE_LABELS, UserRole } from '../types';

interface Props {
  open: boolean;
  companies: (Company & { role: string })[];
  onSelect: (companyId: string) => Promise<void>;
  timeoutSeconds?: number;
}

export const CompanySelector: React.FC<Props> = ({ open, companies, onSelect, timeoutSeconds = 270 }) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelect = async (companyId: string) => {
    setLoading(companyId);
    try {
      await onSelect(companyId);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
      <DialogTitle>
        <Typography variant="h6" fontWeight={600}>Sélectionnez votre compagnie</Typography>
        <Typography variant="body2" color="text.secondary">
          Vous avez accès à {companies.length} compagnie{companies.length > 1 ? 's' : ''}.
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} pb={2}>
          {companies.map(company => (
            <Card key={company.id} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardActionArea onClick={() => handleSelect(company.id)} disabled={!!loading}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar src={company.logoUrl || undefined} sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}>
                    {!company.logoUrl && <BusinessIcon />}
                  </Avatar>
                  <Box flex={1}>
                    <Typography variant="subtitle1" fontWeight={600}>{company.name}</Typography>
                    <Chip
                      label={ROLE_LABELS[company.role as UserRole] || company.role}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                  {loading === company.id && <CircularProgress size={24} />}
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
```

- [ ] **Step 2 : Créer src/components/CompanySwitcher.tsx**

```tsx
import React, { useState } from 'react';
import { Button, Menu, MenuItem, Avatar, Typography, Box, CircularProgress, Divider } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import BusinessIcon from '@mui/icons-material/Business';
import { useCompany } from '../contexts/CompanyContext';

export const CompanySwitcher: React.FC = () => {
  const { currentCompany, companies, switchCompany, isLoading } = useCompany();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  if (!currentCompany || companies.length <= 1) return null;

  return (
    <>
      <Button
        onClick={e => setAnchorEl(e.currentTarget)}
        endIcon={isLoading ? <CircularProgress size={16} /> : <KeyboardArrowDownIcon />}
        sx={{ textTransform: 'none', color: 'inherit' }}
      >
        <Avatar src={currentCompany.logoUrl || undefined} sx={{ width: 24, height: 24, mr: 1 }}>
          <BusinessIcon sx={{ fontSize: 14 }} />
        </Avatar>
        <Typography variant="body2" noWrap maxWidth={120}>{currentCompany.name}</Typography>
      </Button>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary' }}>
          Changer de compagnie
        </Typography>
        <Divider />
        {companies.map(c => (
          <MenuItem
            key={c.id}
            selected={c.id === currentCompany.id}
            onClick={async () => { setAnchorEl(null); await switchCompany(c.id); }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar src={c.logoUrl || undefined} sx={{ width: 24, height: 24 }}>
                <BusinessIcon sx={{ fontSize: 14 }} />
              </Avatar>
              {c.name}
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
```

- [ ] **Step 3 : Modifier LoginPage.tsx pour afficher CompanySelector**

Dans la fonction de login, après succès :

```typescript
// Si la réponse contient requiresCompanySelection
if (response.requiresCompanySelection) {
  setCompanies(response.companies);
  setPartialToken(response.partialToken);
  setRequiresCompanySelection(true);
  return;
}

// Si auto-sélection (1 seule compagnie)
if (response.autoSelected) {
  tokenManager.setAccessToken(response.accessToken);
  setCurrentCompany(response.companies[0]);
  dispatch({ type: 'LOGIN_SUCCESS', payload: mapUser(response.user, response.companies[0].role) });
}
```

Ajouter le composant dans le JSX :

```tsx
<CompanySelector
  open={requiresCompanySelection}
  companies={companies}
  onSelect={async (companyId) => {
    const result = await ApiService.selectCompany(companyId, partialToken!);
    tokenManager.setAccessToken(result.accessToken);
    setCurrentCompany(result.company);
    setRequiresCompanySelection(false);
    dispatch({ type: 'LOGIN_SUCCESS', payload: mapUser(currentUser, result.role) });
  }}
/>
```

- [ ] **Step 4 : Build test**

```bash
npx tsc --noEmit
```

- [ ] **Step 5 : Commit**

```bash
git add src/components/CompanySelector.tsx src/components/CompanySwitcher.tsx src/pages/LoginPage.tsx
git commit -m "feat(ui): CompanySelector modal, CompanySwitcher navbar, LoginPage multi-compagnie"
```

---

### Task 11 : WorkflowPage — adapter les nouveaux rôles RACI

**Fichiers :**
- Modify: `src/pages/WorkflowPage.tsx`

- [ ] **Step 1 : Mettre à jour les filtres de rôle**

Dans `WorkflowPage.tsx`, chercher toutes les références aux anciens rôles et les remplacer :

```typescript
// Mapping pour la rétrocompatibilité et l'affichage
const ROLE_DISPLAY: Record<string, string> = {
  'charge_affaires':          'Chargé d\'Affaires',
  'analyste_risques':         'Analyste Risques',
  'responsable_risques':      'Responsable Risques',
  'responsable_engagements':  'Responsable Engagements',
  'comite_credit':            'Comité de Crédit',
  'direction_generale':       'Direction Générale',
  'admin':                    'Administrateur',
  'super_admin':              'Super Admin',
  'back_office':              'Back-office',
  'direction_juridique':      'Direction Juridique',
  // rétrocompatibilité (anciens slugs en DB)
  'account_manager':          'Chargé d\'Affaires',
  'credit_analyst':           'Analyste Risques',
  'analyst_supervisor':       'Responsable Risques',
  'branch_manager':           'Responsable Engagements',
  'credit_committee':         'Comité de Crédit',
  'management':               'Direction Générale',
};
```

Dans les filtres de visibilité des workflows, mettre à jour les rôles :

```typescript
// Anciens rôles → nouveaux équivalents pour le filtrage
const ROLE_STEP_MAPPING: Record<string, string[]> = {
  'charge_affaires':          ['charge_affaires_dispatch', 'account_manager_dispatch'],
  'analyste_risques':         ['contre_analyse', 'calcul_ratios_prudentiels', 'credit_analysis', 'credit_analyst_review'],
  'responsable_risques':      ['validation_responsable_risques', 'analyst_supervisor_review'],
  'responsable_engagements':  ['verification_completude', 'organisation_comite', 'branch_manager_review'],
  'comite_credit':            ['comite_credit', 'credit_committee_review'],
  'direction_generale':       ['validation_direction_generale', 'management_review'],
  'back_office':              ['mise_en_place_sib', 'saisie_garanties'],
  'direction_juridique':      ['formalisation_garanties'],
};
```

- [ ] **Step 2 : Build test**

```bash
npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add src/pages/WorkflowPage.tsx
git commit -m "feat(workflow): adapter WorkflowPage aux nouveaux rôles RACI"
```

---

### Task 12 : CompanySettingsPage + PlatformAdminPage

**Fichiers :**
- Create: `src/pages/CompanySettingsPage.tsx`
- Create: `src/pages/PlatformAdminPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1 : Créer CompanySettingsPage.tsx (squelette fonctionnel)**

```tsx
import React, { useState, useEffect } from 'react';
import { Box, Tabs, Tab, Typography, Paper, Button, TextField,
         Table, TableBody, TableCell, TableHead, TableRow,
         Chip, IconButton, CircularProgress } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { ApiService, tokenManager } from '../services/api';
import { ROLE_LABELS, UserRole } from '../types';

const CompanySettingsPage: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [company, setCompany] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${(window as any).API_BASE || ''}/api/companies/current`, {
        headers: { Authorization: `Bearer ${tokenManager.getAccessToken()}` }
      }).then(r => r.json()),
      fetch(`${(window as any).API_BASE || ''}/api/companies/members`, {
        headers: { Authorization: `Bearer ${tokenManager.getAccessToken()}` }
      }).then(r => r.json()),
    ]).then(([c, m]) => {
      setCompany(c.data);
      setMembers(m.data || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;

  return (
    <Box p={3}>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Paramètres — {company?.name}
      </Typography>
      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Général" />
          <Tab label="Membres" />
        </Tabs>
        <Box p={3}>
          {tab === 0 && (
            <Box display="flex" flexDirection="column" gap={2} maxWidth={400}>
              <TextField label="Nom de la compagnie" value={company?.name || ''} fullWidth />
              <TextField label="Code" value={company?.code || ''} fullWidth disabled />
              <Button variant="contained">Enregistrer</Button>
            </Box>
          )}
          {tab === 1 && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nom</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Rôle</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.user?.name}</TableCell>
                    <TableCell>{m.user?.email}</TableCell>
                    <TableCell><Chip label={ROLE_LABELS[m.role as UserRole] || m.role} size="small" /></TableCell>
                    <TableCell><Chip label={m.isActive ? 'Actif' : 'Inactif'} color={m.isActive ? 'success' : 'default'} size="small" /></TableCell>
                    <TableCell><IconButton size="small"><EditIcon /></IconButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default CompanySettingsPage;
```

- [ ] **Step 2 : Créer PlatformAdminPage.tsx**

```tsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Button, Table, TableBody, TableCell,
         TableHead, TableRow, Chip, CircularProgress, Dialog,
         DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { tokenManager } from '../services/api';

const PlatformAdminPage: React.FC = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', code: '' });

  const API_BASE = `${window.location.origin}/api`;

  const load = () => {
    fetch(`${API_BASE}/platform/companies`, {
      headers: { Authorization: `Bearer ${tokenManager.getAccessToken()}` }
    }).then(r => r.json()).then(d => setCompanies(d.data || [])).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    await fetch(`${API_BASE}/platform/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenManager.getAccessToken()}` },
      body: JSON.stringify(newCompany),
    });
    setCreateOpen(false);
    setNewCompany({ name: '', code: '' });
    load();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`${API_BASE}/platform/companies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenManager.getAccessToken()}` },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  };

  if (loading) return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Administration Plateforme</Typography>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>+ Nouvelle compagnie</Button>
      </Box>
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nom</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Membres</TableCell>
              <TableCell>Dossiers</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {companies.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.code}</TableCell>
                <TableCell>{c._count?.memberships ?? '-'}</TableCell>
                <TableCell>{c._count?.applications ?? '-'}</TableCell>
                <TableCell><Chip label={c.isActive ? 'Active' : 'Inactive'} color={c.isActive ? 'success' : 'default'} size="small" /></TableCell>
                <TableCell>
                  <Button size="small" onClick={() => handleToggle(c.id, c.isActive)}>
                    {c.isActive ? 'Désactiver' : 'Activer'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)}>
        <DialogTitle>Nouvelle compagnie</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2, minWidth: 360 }}>
          <TextField label="Nom" value={newCompany.name} onChange={e => setNewCompany(p => ({ ...p, name: e.target.value }))} fullWidth />
          <TextField label="Code (ex: BCI)" value={newCompany.code} onChange={e => setNewCompany(p => ({ ...p, code: e.target.value.toUpperCase() }))} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newCompany.name || !newCompany.code}>Créer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlatformAdminPage;
```

- [ ] **Step 3 : Ajouter les routes dans App.tsx**

```tsx
import CompanySettingsPage from './pages/CompanySettingsPage';
import PlatformAdminPage from './pages/PlatformAdminPage';

// Dans les routes protégées :
<Route path="/company-settings" element={<CompanySettingsPage />} />
<Route path="/platform-admin" element={<PlatformAdminPage />} />
```

Envelopper `UserProvider` avec `CompanyProvider` dans `App.tsx` :

```tsx
<CompanyProvider>
  <UserProvider>
    {/* reste de l'app */}
  </UserProvider>
</CompanyProvider>
```

- [ ] **Step 4 : Build test complet**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit
```

Expected: 0 erreur TypeScript.

- [ ] **Step 5 : Commit**

```bash
git add src/pages/CompanySettingsPage.tsx src/pages/PlatformAdminPage.tsx src/App.tsx
git commit -m "feat(pages): CompanySettingsPage, PlatformAdminPage, routes App.tsx"
```

---

## Phase 4 — Tests + Vérification + Déploiement

### Task 13 : Tests d'intégration isolation multi-tenant

- [ ] **Step 1 : Démarrer le serveur en mode dev**

```bash
cd backend && npm run dev
```

- [ ] **Step 1b : Récupérer l'ID de la compagnie BCI pour les tests**

```bash
# Récupérer l'ID BCI depuis la base (après migration)
BCI_ID=$(cd backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.company.findUnique({ where: { code: 'BCI' } }).then(c => { console.log(c.id); p.\$disconnect(); });
")
echo "BCI_ID=$BCI_ID"
# Expected: cxxxxxxxx (non vide)
```

- [ ] **Step 2 : Test isolation — token sans companyId bloqué sur routes protégées**

```bash
# Login → obtenir partialToken
TOKEN=$(curl -s -X POST http://localhost:5007/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bank.sn","password":"demo123"}' | jq -r '.partialToken // .accessToken')

# Tenter d'accéder à /api/workflows avec un partialToken → doit retourner 403
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5007/api/workflows | jq '.code'
# Expected: "COMPANY_NOT_SELECTED"
```

- [ ] **Step 3 : Test sélection compagnie et accès**

```bash
# Sélectionner la compagnie BCI
RESULT=$(curl -s -X POST http://localhost:5007/api/auth/select-company \
  -H "Content-Type: application/json" \
  -d "{\"companyId\":\"$BCI_ID\",\"partialToken\":\"$TOKEN\"}")
ACCESS=$(echo $RESULT | jq -r '.accessToken')

# Accéder aux workflows → doit retourner 200
curl -s -H "Authorization: Bearer $ACCESS" http://localhost:5007/api/workflows | jq '.success'
# Expected: true
```

- [ ] **Step 4 : Test Chinese Wall**

```bash
# Connecté en tant qu'ANALYSTE_RISQUES, tenter d'approuver une étape 'mise_en_place_sib'
# → doit retourner { allowed: false }
curl -s -X POST "http://localhost:5007/api/workflows/$APP_ID/approve" \
  -H "Authorization: Bearer $ANALYSTE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"...","decision":"APPROVED","stepName":"mise_en_place_sib"}' | jq '.error'
# Expected: message contenant "Direction Risques ne peut pas..."
```

- [ ] **Step 5 : Test migration idempotence**

```bash
# Relancer le script 2 fois → même résultat, zéro doublon
node prisma/migrate-tenant.js
node prisma/migrate-tenant.js
# Expected: "X créées (N déjà existantes)" — pas d'erreur de contrainte unique
```

- [ ] **Step 6 : Vérifier l'interface frontend**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npm start
```

Ouvrir `http://localhost:3006` :
- [ ] Login avec `admin@bank.sn` / `demo123` → sélecteur de compagnie si plusieurs, sinon auto-sélection
- [ ] Vérifier que le nom de la compagnie apparaît dans la navbar
- [ ] Vérifier que WorkflowPage affiche les nouveaux libellés de rôles
- [ ] Vérifier que `/company-settings` est accessible pour ADMIN
- [ ] Vérifier que `/platform-admin` est accessible pour SUPER_ADMIN

- [ ] **Step 7 : Build de production**

```bash
CI=false npm run build
cd backend && npx tsc --outDir dist
```

Expected: build sans erreur.

- [ ] **Step 8 : Commit final**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
git add -A
git commit -m "feat: multi-tenant SaaS complet — Company, RACI, Chinese Wall, migration BCI"
```

---

### Task 14 : Mise à jour bci-update.sh

**Fichiers :**
- Modify: `bci-update.sh`

- [ ] **Step 1 : Ajouter l'exécution du migrate-tenant.js après prisma migrate deploy**

Dans la section 7 (Prisma migration) de `bci-update.sh`, après `npx prisma migrate deploy`, ajouter :

```bash
info "Migration données multi-tenant..."
node "$BACKEND_DIR/prisma/migrate-tenant.js" 2>&1 | tail -10 \
  && ok "Migration multi-tenant : OK" \
  || warn "migrate-tenant.js : erreur non bloquante (données peut-être déjà migrées)"
```

- [ ] **Step 2 : Commit et push**

```bash
git add bci-update.sh
git commit -m "feat(deploy): bci-update.sh intègre migrate-tenant.js"
git push origin release/v1.0
```

---

## Checklist finale

- [ ] `npx tsc --noEmit` côté backend : 0 erreur
- [ ] `npx tsc --noEmit` côté frontend : 0 erreur
- [ ] `CI=false npm run build` : build réussi
- [ ] Test isolation multi-tenant : token sans companyId bloqué
- [ ] Test Chinese Wall : violation détectée et auditée
- [ ] Test migration idempotente : 2 exécutions sans erreur
- [ ] Login → sélecteur compagnie → accès à l'app
- [ ] WorkflowPage affiche les nouveaux rôles RACI
- [ ] CompanySettingsPage accessible pour ADMIN
- [ ] PlatformAdminPage accessible pour SUPER_ADMIN
