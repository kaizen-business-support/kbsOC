# Délégation de Pouvoir Temporaire — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un utilisateur (ou un Admin) de déléguer temporairement des droits d'approbation partiels à un autre utilisateur quand il est en congé, afin de garantir la continuité des activités sans bloquer le circuit de traitement des dossiers de crédit.

**Architecture:** Nouveau modèle `PowerDelegation` en base + helper `resolveDelegation` dans `delegationService.ts` qui est appelé dans les 3 points de contrôle existants (canApproveStep, start-step, dispatching/assign). Les actions déléguées sont une liste explicite stockée en JSON. Le champ `isOnLeave` sur `User` est géré automatiquement à la création/révocation/expiration.

**Tech Stack:** TypeScript, Node.js/Express, Prisma ORM (PostgreSQL), React/MUI, Axios.

---

## File Map

| Fichier | Action | Responsabilité |
|---|---|---|
| `backend/prisma/schema.prisma` | Modifier | Ajouter `PowerDelegation`, `isOnLeave` sur User, relations |
| `backend/prisma/migrations/20260413000000_add_power_delegation/migration.sql` | Créer | DDL PostgreSQL |
| `backend/src/services/delegationService.ts` | Créer | `resolveDelegation`, `createDelegation`, `revokeDelegation`, `syncLeaveStatus` |
| `backend/src/routes/delegations.ts` | Créer | 5 endpoints REST |
| `backend/src/server.ts` | Modifier | Monter `/api/delegations` |
| `backend/src/services/workflowService.ts` | Modifier | Intégrer `resolveDelegation` dans `canApproveStep` |
| `backend/src/routes/workflows.ts` | Modifier | Intégrer délégation dans `start-step` |
| `backend/src/routes/dispatching.ts` | Modifier | Intégrer délégation dans `assign` |
| `src/types/delegation.ts` | Créer | Types TypeScript partagés frontend |
| `src/services/api.ts` | Modifier | Fonctions API délégation |
| `src/components/DelegationBadge.tsx` | Créer | Badge "En congé" + délégué |
| `src/components/DelegationForm.tsx` | Créer | Formulaire création/révocation |
| `src/pages/UserManagementPage.tsx` | Modifier | Onglet "Délégations" (admin) |
| `src/pages/ProfilePage.tsx` | Modifier | Section "Ma délégation" |

---

## Task 1 — Schéma Prisma + Migration SQL

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260413000000_add_power_delegation/migration.sql`

- [ ] **Step 1.1 — Ajouter `isOnLeave` sur le modèle `User` dans schema.prisma**

  Dans `backend/prisma/schema.prisma`, après la ligne `isActive Boolean @default(true) @map("is_active")`, ajouter :

  ```prisma
  isOnLeave           Boolean             @default(false) @map("is_on_leave")
  ```

  Et dans les relations du modèle User, ajouter :

  ```prisma
  delegationsGiven    PowerDelegation[]   @relation("DelegatorRelation")
  delegationsReceived PowerDelegation[]   @relation("DelegateRelation")
  delegationsCreated  PowerDelegation[]   @relation("DelegationCreatedBy")
  delegationsRevoked  PowerDelegation[]   @relation("DelegationRevokedBy")
  ```

- [ ] **Step 1.2 — Ajouter le modèle `PowerDelegation` dans schema.prisma**

  Ajouter avant `enum UserRole {` :

  ```prisma
  model PowerDelegation {
    id          String    @id @default(cuid())
    delegatorId String    @map("delegator_id")
    delegateId  String    @map("delegate_id")
    startDate   DateTime  @map("start_date")
    endDate     DateTime  @map("end_date")
    reason      String?
    permissions Json      // string[] — ex: ["APPROVE_WORKFLOW","REJECT_WORKFLOW"]
    isActive    Boolean   @default(true) @map("is_active")
    createdById String    @map("created_by_id")
    revokedAt   DateTime? @map("revoked_at")
    revokedById String?   @map("revoked_by_id")
    createdAt   DateTime  @default(now()) @map("created_at")
    updatedAt   DateTime  @updatedAt @map("updated_at")

    delegator   User      @relation("DelegatorRelation", fields: [delegatorId], references: [id])
    delegate    User      @relation("DelegateRelation", fields: [delegateId], references: [id])
    createdBy   User      @relation("DelegationCreatedBy", fields: [createdById], references: [id])
    revokedBy   User?     @relation("DelegationRevokedBy", fields: [revokedById], references: [id])

    @@index([delegatorId])
    @@index([delegateId])
    @@index([isActive, startDate, endDate])
    @@map("power_delegations")
  }
  ```

- [ ] **Step 1.3 — Créer le fichier de migration SQL**

  Créer `backend/prisma/migrations/20260413000000_add_power_delegation/migration.sql` :

  ```sql
  -- Ajouter is_on_leave sur les utilisateurs
  ALTER TABLE "users" ADD COLUMN "is_on_leave" BOOLEAN NOT NULL DEFAULT false;

  -- Créer la table power_delegations
  CREATE TABLE "power_delegations" (
    "id"             TEXT NOT NULL,
    "delegator_id"   TEXT NOT NULL,
    "delegate_id"    TEXT NOT NULL,
    "start_date"     TIMESTAMP(3) NOT NULL,
    "end_date"       TIMESTAMP(3) NOT NULL,
    "reason"         TEXT,
    "permissions"    JSONB NOT NULL,
    "is_active"      BOOLEAN NOT NULL DEFAULT true,
    "created_by_id"  TEXT NOT NULL,
    "revoked_at"     TIMESTAMP(3),
    "revoked_by_id"  TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "power_delegations_pkey" PRIMARY KEY ("id")
  );

  -- Index
  CREATE INDEX "power_delegations_delegator_id_idx"  ON "power_delegations"("delegator_id");
  CREATE INDEX "power_delegations_delegate_id_idx"   ON "power_delegations"("delegate_id");
  CREATE INDEX "power_delegations_active_dates_idx"  ON "power_delegations"("is_active", "start_date", "end_date");

  -- Foreign keys
  ALTER TABLE "power_delegations"
    ADD CONSTRAINT "power_delegations_delegator_id_fkey"
      FOREIGN KEY ("delegator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "power_delegations_delegate_id_fkey"
      FOREIGN KEY ("delegate_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "power_delegations_created_by_id_fkey"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "power_delegations_revoked_by_id_fkey"
      FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ```

- [ ] **Step 1.4 — Régénérer le client Prisma**

  ```bash
  cd backend && npx prisma generate
  ```

  Attendu : `✔ Generated Prisma Client` sans erreur.

- [ ] **Step 1.5 — Vérifier la compilation TypeScript du backend**

  ```bash
  cd backend && npx tsc --noEmit
  ```

  Attendu : aucune erreur.

- [ ] **Step 1.6 — Commit**

  ```bash
  git add backend/prisma/schema.prisma backend/prisma/migrations/20260413000000_add_power_delegation/migration.sql
  git commit -m "feat(db): ajout PowerDelegation + isOnLeave sur User"
  ```

---

## Task 2 — Service de délégation (`delegationService.ts`)

**Files:**
- Create: `backend/src/services/delegationService.ts`

Ce service centralise toute la logique métier. Aucune règle ne doit être dans les routes.

- [ ] **Step 2.1 — Créer `backend/src/services/delegationService.ts`**

  ```typescript
  import { UserRole } from '@prisma/client';
  import { prisma } from '../prismaClient';

  // ─── Actions déléguables ──────────────────────────────────────────────────────
  export const DELEGATABLE_ACTIONS = [
    'APPROVE_WORKFLOW',
    'REJECT_WORKFLOW',
    'DISPATCH_APPLICATION',
    'START_STEP',
  ] as const;

  export type DelegatableAction = typeof DELEGATABLE_ACTIONS[number];

  // ─── Résolution d'une délégation active ──────────────────────────────────────
  /**
   * Si l'utilisateur est délégué actif pour l'action donnée, retourne les
   * informations du délégant. Sinon, retourne null.
   *
   * Conditions d'activation :
   *   - isActive = true
   *   - startDate <= now <= endDate
   *   - action dans permissions
   */
  export async function resolveDelegation(
    userId: string,
    action: DelegatableAction
  ): Promise<{
    delegationId: string;
    delegatorId: string;
    delegatorRole: UserRole;
    delegatorBranch: string | null;
    delegatorDepartment: string | null;
    delegatorName: string;
  } | null> {
    const now = new Date();

    const delegation = await prisma.powerDelegation.findFirst({
      where: {
        delegateId: userId,
        isActive: true,
        startDate: { lte: now },
        endDate:   { gte: now },
      },
      include: {
        delegator: {
          select: { id: true, name: true, role: true, branch: true, department: true },
        },
      },
    });

    if (!delegation) return null;

    const perms = delegation.permissions as string[];
    if (!perms.includes(action)) return null;

    return {
      delegationId:        delegation.id,
      delegatorId:         delegation.delegator.id,
      delegatorRole:       delegation.delegator.role,
      delegatorBranch:     delegation.delegator.branch,
      delegatorDepartment: delegation.delegator.department,
      delegatorName:       delegation.delegator.name,
    };
  }

  // ─── Synchronisation du statut "En congé" ────────────────────────────────────
  /**
   * Met à jour isOnLeave sur le délégant en fonction de ses délégations actives.
   * À appeler après création, révocation, ou expiration d'une délégation.
   */
  export async function syncLeaveStatus(delegatorId: string): Promise<void> {
    const now = new Date();
    const activeDelegation = await prisma.powerDelegation.findFirst({
      where: {
        delegatorId,
        isActive: true,
        startDate: { lte: now },
        endDate:   { gte: now },
      },
    });

    await prisma.user.update({
      where: { id: delegatorId },
      data: { isOnLeave: !!activeDelegation } as any,
    });
  }

  // ─── Création d'une délégation ────────────────────────────────────────────────
  export interface CreateDelegationInput {
    delegatorId: string;
    delegateId:  string;
    startDate:   Date;
    endDate:     Date;
    reason?:     string;
    permissions: DelegatableAction[];
    createdById: string;
    maxDurationDays?: number; // si fourni, vérifie la durée max
  }

  export async function createDelegation(input: CreateDelegationInput) {
    const {
      delegatorId, delegateId, startDate, endDate,
      reason, permissions, createdById, maxDurationDays,
    } = input;

    // ── Validation durée ──────────────────────────────────────────────────────
    const durationMs  = endDate.getTime() - startDate.getTime();
    const durationDays = durationMs / (1000 * 60 * 60 * 24);
    if (durationDays <= 0) {
      throw new Error('La date de fin doit être après la date de début.');
    }
    if (maxDurationDays && durationDays > maxDurationDays) {
      throw new Error(`Durée maximale de délégation : ${maxDurationDays} jours.`);
    }

    // ── Pas de re-délégation ──────────────────────────────────────────────────
    const delegateUser = await prisma.user.findUnique({
      where: { id: delegateId },
      select: { isOnLeave: true, isActive: true, branch: true, department: true, name: true },
    });
    if (!delegateUser || !delegateUser.isActive) {
      throw new Error('Délégué introuvable ou inactif.');
    }

    const now = new Date();
    const delegateHasActiveDelegation = await prisma.powerDelegation.findFirst({
      where: {
        delegatorId: delegateId,
        isActive: true,
        startDate: { lte: endDate },
        endDate:   { gte: startDate },
      },
    });
    if (delegateHasActiveDelegation) {
      throw new Error('Le délégué a lui-même une délégation active : la re-délégation est interdite.');
    }

    // ── Permissions valides ───────────────────────────────────────────────────
    const invalidPerms = permissions.filter(p => !DELEGATABLE_ACTIONS.includes(p));
    if (invalidPerms.length > 0) {
      throw new Error(`Actions invalides : ${invalidPerms.join(', ')}`);
    }

    // ── Révoquer toute délégation active existante pour ce délégant ──────────
    const existing = await prisma.powerDelegation.findFirst({
      where: { delegatorId, isActive: true },
    });
    if (existing) {
      await prisma.powerDelegation.update({
        where: { id: existing.id },
        data:  { isActive: false, revokedAt: now, revokedById: createdById } as any,
      });
    }

    // ── Créer la délégation ───────────────────────────────────────────────────
    const delegation = await (prisma as any).powerDelegation.create({
      data: {
        delegatorId,
        delegateId,
        startDate,
        endDate,
        reason: reason || null,
        permissions,
        isActive: true,
        createdById,
      },
    });

    // ── Mettre à jour isOnLeave si la délégation commence maintenant ──────────
    if (startDate <= now) {
      await syncLeaveStatus(delegatorId);
    }

    return delegation;
  }

  // ─── Révocation d'une délégation ─────────────────────────────────────────────
  export async function revokeDelegation(
    delegationId: string,
    revokedById: string
  ): Promise<void> {
    const delegation = await (prisma as any).powerDelegation.findUnique({
      where: { id: delegationId },
    });
    if (!delegation || !delegation.isActive) {
      throw new Error('Délégation introuvable ou déjà inactive.');
    }

    await (prisma as any).powerDelegation.update({
      where: { id: delegationId },
      data: {
        isActive:    false,
        revokedAt:   new Date(),
        revokedById,
      },
    });

    await syncLeaveStatus(delegation.delegatorId);
  }

  // ─── Expiration automatique (peut être appelée par un cron) ──────────────────
  /**
   * Désactive toutes les délégations dont endDate est passé.
   * À appeler périodiquement ou au démarrage du serveur.
   */
  export async function expireStaleActiveDelegations(): Promise<number> {
    const now = new Date();
    const result = await (prisma as any).powerDelegation.findMany({
      where: { isActive: true, endDate: { lt: now } },
      select: { id: true, delegatorId: true },
    });

    for (const d of result) {
      await (prisma as any).powerDelegation.update({
        where: { id: d.id },
        data:  { isActive: false } as any,
      });
      await syncLeaveStatus(d.delegatorId);
    }

    return result.length;
  }
  ```

- [ ] **Step 2.2 — Vérifier la compilation**

  ```bash
  cd backend && npx tsc --noEmit
  ```

  Attendu : aucune erreur.

- [ ] **Step 2.3 — Commit**

  ```bash
  git add backend/src/services/delegationService.ts
  git commit -m "feat(delegation): service central resolveDelegation + CRUD"
  ```

---

## Task 3 — Route REST `/api/delegations`

**Files:**
- Create: `backend/src/routes/delegations.ts`

- [ ] **Step 3.1 — Créer `backend/src/routes/delegations.ts`**

  ```typescript
  import { Router, Request, Response } from 'express';
  import { prisma } from '../prismaClient';
  import {
    DELEGATABLE_ACTIONS,
    createDelegation,
    revokeDelegation,
  } from '../services/delegationService';
  import { createInAppNotification } from '../services/notificationService';

  const router = Router();

  // Helper pour extraire l'userId du token JWT (cohérent avec le reste de l'app)
  const getActorId = (req: Request): string =>
    (req as any).user?.userId || (req as any).user?.id;

  // ─── GET /api/delegations/delegatable-actions ─────────────────────────────────
  // Retourne les actions que l'utilisateur courant peut déléguer selon son rôle
  router.get('/delegatable-actions', (req: Request, res: Response) => {
    res.json({ success: true, data: DELEGATABLE_ACTIONS });
  });

  // ─── GET /api/delegations/my ──────────────────────────────────────────────────
  // Délégations données ET reçues par l'utilisateur courant
  router.get('/my', async (req: Request, res: Response) => {
    try {
      const userId = getActorId(req);
      const delegations = await (prisma as any).powerDelegation.findMany({
        where: {
          OR: [{ delegatorId: userId }, { delegateId: userId }],
        },
        include: {
          delegator:  { select: { id: true, name: true, role: true, branch: true } },
          delegate:   { select: { id: true, name: true, role: true, branch: true } },
          createdBy:  { select: { id: true, name: true } },
          revokedBy:  { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: delegations });
    } catch (error) {
      console.error('GET /my error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─── GET /api/delegations ─────────────────────────────────────────────────────
  // Admin uniquement — toutes les délégations avec filtres optionnels
  router.get('/', async (req: Request, res: Response) => {
    const actor = (req as any).user;
    if (!actor || actor.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Accès réservé à l\'administrateur' });
    }
    try {
      const { status, delegatorId, delegateId } = req.query as Record<string, string>;
      const where: any = {};
      if (status === 'active')   where.isActive = true;
      if (status === 'inactive') where.isActive = false;
      if (delegatorId) where.delegatorId = delegatorId;
      if (delegateId)  where.delegateId  = delegateId;

      const delegations = await (prisma as any).powerDelegation.findMany({
        where,
        include: {
          delegator: { select: { id: true, name: true, role: true, branch: true } },
          delegate:  { select: { id: true, name: true, role: true, branch: true } },
          createdBy: { select: { id: true, name: true } },
          revokedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: delegations });
    } catch (error) {
      console.error('GET / error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─── POST /api/delegations ────────────────────────────────────────────────────
  // Créer une délégation (admin ou utilisateur lui-même)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const actorId   = getActorId(req);
      const actorRole = (req as any).user?.role;
      const {
        delegatorId,
        delegateId,
        startDate,
        endDate,
        reason,
        permissions,
      } = req.body;

      // L'utilisateur ne peut créer que pour lui-même ; l'admin peut pour n'importe qui
      if (actorRole !== 'ADMIN' && actorId !== delegatorId) {
        return res.status(403).json({
          success: false,
          error: 'Vous ne pouvez créer une délégation que pour vous-même.',
        });
      }

      if (!delegatorId || !delegateId || !startDate || !endDate || !permissions?.length) {
        return res.status(400).json({ success: false, error: 'Champs requis manquants.' });
      }

      // Vérification cohérence agence (délégué même agence que délégant, sauf Admin)
      if (actorRole !== 'ADMIN') {
        const [delegator, delegate] = await Promise.all([
          prisma.user.findUnique({ where: { id: delegatorId }, select: { branch: true, department: true } }),
          prisma.user.findUnique({ where: { id: delegateId }, select: { branch: true, department: true } }),
        ]);
        const dBranch = delegator?.branch || delegator?.department;
        const eBranch = delegate?.branch  || delegate?.department;
        if (dBranch && eBranch && dBranch !== eBranch) {
          return res.status(403).json({
            success: false,
            error: `Le délégué doit appartenir à la même agence que vous ("${dBranch}").`,
          });
        }
      }

      const delegation = await createDelegation({
        delegatorId,
        delegateId,
        startDate: new Date(startDate),
        endDate:   new Date(endDate),
        reason,
        permissions,
        createdById: actorId,
      });

      // Notifier le délégué
      const delegator = await prisma.user.findUnique({
        where: { id: delegatorId },
        select: { name: true },
      });
      const startStr = new Date(startDate).toLocaleDateString('fr-FR');
      const endStr   = new Date(endDate).toLocaleDateString('fr-FR');
      await createInAppNotification(delegateId, {
        title:       `Délégation de pouvoir reçue de ${delegator?.name}`,
        message:     `${delegator?.name} vous a délégué des droits du ${startStr} au ${endStr}. Vous pouvez agir en son nom pendant cette période.`,
        type:        'ACTION_REQUIRED',
        relatedType: 'delegation',
        relatedId:   delegation.id,
        actionUrl:   '/profile',
      });

      res.status(201).json({ success: true, data: delegation });
    } catch (error: any) {
      console.error('POST / error:', error);
      const status = error.message?.includes('interdite') || error.message?.includes('invalide')
        ? 400 : 500;
      res.status(status).json({ success: false, error: error.message || 'Erreur serveur' });
    }
  });

  // ─── PATCH /api/delegations/:id/revoke ────────────────────────────────────────
  // Révoquer une délégation (admin ou délégant)
  router.patch('/:id/revoke', async (req: Request, res: Response) => {
    try {
      const actorId   = getActorId(req);
      const actorRole = (req as any).user?.role;
      const { id }    = req.params;

      const delegation = await (prisma as any).powerDelegation.findUnique({
        where: { id },
        include: {
          delegator: { select: { id: true, name: true } },
          delegate:  { select: { id: true, name: true } },
        },
      });

      if (!delegation) {
        return res.status(404).json({ success: false, error: 'Délégation introuvable.' });
      }

      if (actorRole !== 'ADMIN' && delegation.delegatorId !== actorId) {
        return res.status(403).json({
          success: false,
          error: 'Seul le délégant ou un administrateur peut révoquer cette délégation.',
        });
      }

      await revokeDelegation(id, actorId);

      // Notifier les deux parties
      await Promise.all([
        createInAppNotification(delegation.delegatorId, {
          title:       'Votre délégation de pouvoir a été révoquée',
          message:     `La délégation accordée à ${delegation.delegate.name} a été révoquée.`,
          type:        'INFO',
          relatedType: 'delegation',
          relatedId:   id,
          actionUrl:   '/profile',
        }),
        createInAppNotification(delegation.delegateId, {
          title:       'Délégation de pouvoir révoquée',
          message:     `La délégation reçue de ${delegation.delegator.name} a été révoquée.`,
          type:        'INFO',
          relatedType: 'delegation',
          relatedId:   id,
          actionUrl:   '/profile',
        }),
      ]);

      res.json({ success: true, message: 'Délégation révoquée.' });
    } catch (error: any) {
      console.error('PATCH /:id/revoke error:', error);
      res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
    }
  });

  export default router;
  ```

- [ ] **Step 3.2 — Vérifier la compilation**

  ```bash
  cd backend && npx tsc --noEmit
  ```

  Attendu : aucune erreur.

- [ ] **Step 3.3 — Commit**

  ```bash
  git add backend/src/routes/delegations.ts
  git commit -m "feat(delegation): route REST /api/delegations (5 endpoints)"
  ```

---

## Task 4 — Monter la route dans `server.ts`

**Files:**
- Modify: `backend/src/server.ts`

- [ ] **Step 4.1 — Ajouter l'import et le mount**

  Dans `backend/src/server.ts`, ajouter l'import avec les autres imports de routes (ligne ~40) :

  ```typescript
  import delegationRoutes from './routes/delegations';
  ```

  Puis ajouter le mount après la ligne `app.use('/api/credit-policies', ...)` :

  ```typescript
  app.use('/api/delegations', authenticate, delegationRoutes);
  ```

- [ ] **Step 4.2 — Ajouter l'expiration automatique au démarrage du serveur**

  Dans `server.ts`, après les imports, ajouter l'appel à `expireStaleActiveDelegations` au démarrage (après la connexion DB) :

  ```typescript
  import { expireStaleActiveDelegations } from './services/delegationService';
  ```

  Et dans la fonction de démarrage (ou juste avant `app.listen`), appeler :

  ```typescript
  expireStaleActiveDelegations()
    .then(n => { if (n > 0) console.log(`[delegation] ${n} délégation(s) expirée(s) au démarrage`); })
    .catch(err => console.error('[delegation] expiration error:', err));
  ```

- [ ] **Step 4.3 — Vérifier la compilation**

  ```bash
  cd backend && npx tsc --noEmit
  ```

  Attendu : aucune erreur.

- [ ] **Step 4.4 — Commit**

  ```bash
  git add backend/src/server.ts
  git commit -m "feat(delegation): monter /api/delegations + expiration au démarrage"
  ```

---

## Task 5 — Intégrer la délégation dans `canApproveStep`

**Files:**
- Modify: `backend/src/services/workflowService.ts`

- [ ] **Step 5.1 — Ajouter l'import de `resolveDelegation`**

  Au début de `backend/src/services/workflowService.ts`, ajouter :

  ```typescript
  import { resolveDelegation } from './delegationService';
  ```

- [ ] **Step 5.2 — Modifier `canApproveStep` pour vérifier la délégation**

  Dans `canApproveStep`, après le bloc "1. Vérification du rôle" (qui retourne `{ allowed: false }` si rôle ne correspond pas), remplacer le return immédiat par une vérification de délégation :

  ```typescript
  // ── 1. Vérification du rôle (direct ou par délégation) ───────────────────
  let effectiveRole   = user.role;
  let effectiveBranch = (user as any).branch;
  let effectiveDept   = (user as any).department;
  let delegationContext: { delegationId: string; delegatorId: string; delegatorName: string } | null = null;

  if (step.role !== user.role) {
    // Rôle direct insuffisant — vérifier si une délégation couvre cette action
    const delegation = await resolveDelegation(userId, 'APPROVE_WORKFLOW');
    if (!delegation || delegation.delegatorRole !== step.role) {
      return {
        allowed: false,
        reason: `Rôle requis : ${step.role}, rôle actuel : ${user.role}`,
      };
    }
    // Utiliser le contexte du délégant pour la suite des vérifications
    effectiveRole   = delegation.delegatorRole;
    effectiveBranch = delegation.delegatorBranch;
    effectiveDept   = delegation.delegatorDepartment;
    delegationContext = {
      delegationId:  delegation.delegationId,
      delegatorId:   delegation.delegatorId,
      delegatorName: delegation.delegatorName,
    };
  }
  ```

  Puis mettre à jour la vérification d'agence pour utiliser `effectiveBranch`/`effectiveDept` :

  ```typescript
  // ── 2. Vérification de l'agence (basée sur le délégant si délégation) ────
  if (!GLOBAL_SCOPE_ROLES.includes(effectiveRole as UserRole)) {
    const approverBranch = effectiveBranch || effectiveDept;
    const creatorBranch  = application.creator?.branch || application.creator?.department;
    if (approverBranch && creatorBranch && approverBranch !== creatorBranch) {
      return {
        allowed: false,
        reason: `Ce dossier appartient à l'agence "${creatorBranch}". Vous ne pouvez traiter que les dossiers de votre agence ("${approverBranch}").`,
      };
    }
  }
  ```

  Mettre à jour le type de retour pour inclure le contexte de délégation :

  ```typescript
  return { allowed: true, delegationContext };
  ```

  Mettre à jour la signature de retour de la fonction :

  ```typescript
  export async function canApproveStep(
    userId: string,
    applicationId: string,
    stepName: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    delegationContext?: { delegationId: string; delegatorId: string; delegatorName: string } | null;
  }>
  ```

- [ ] **Step 5.3 — Vérifier la compilation**

  ```bash
  cd backend && npx tsc --noEmit
  ```

  Attendu : aucune erreur.

- [ ] **Step 5.4 — Commit**

  ```bash
  git add backend/src/services/workflowService.ts
  git commit -m "feat(delegation): intégrer délégation dans canApproveStep"
  ```

---

## Task 6 — Intégrer la délégation dans `workflows.ts` (`start-step`)

**Files:**
- Modify: `backend/src/routes/workflows.ts`

- [ ] **Step 6.1 — Ajouter l'import**

  ```typescript
  import { resolveDelegation } from '../services/delegationService';
  ```

- [ ] **Step 6.2 — Modifier la route `start-step`**

  Dans le bloc de vérification du rôle de la route `start-step`, après la récupération du user et du step, ajouter la logique de délégation avant le guard de rôle :

  ```typescript
  // Déterminer le contexte effectif (direct ou par délégation)
  let effectiveRole   = user.role;
  let effectiveBranch = user.branch;
  let effectiveDept   = user.department;
  let delegationCtx: { delegationId: string; delegatorId: string; delegatorName: string } | null = null;

  if (step.role !== user.role) {
    const delegation = await resolveDelegation(userId, 'START_STEP');
    if (!delegation || delegation.delegatorRole !== step.role) {
      return res.status(403).json({
        success: false,
        error: `Cette étape requiert le rôle ${step.role}.`,
      });
    }
    effectiveRole   = delegation.delegatorRole;
    effectiveBranch = delegation.delegatorBranch;
    effectiveDept   = delegation.delegatorDepartment;
    delegationCtx   = {
      delegationId:  delegation.delegationId,
      delegatorId:   delegation.delegatorId,
      delegatorName: delegation.delegatorName,
    };
  }
  ```

  Et mettre à jour le guard d'agence existant pour utiliser `effectiveBranch`/`effectiveDept`.

  Si `delegationCtx` est non-null, inclure dans les `comments` ou dans l'audit : `"Au nom de [delegatorName]"`.

- [ ] **Step 6.3 — Vérifier la compilation**

  ```bash
  cd backend && npx tsc --noEmit
  ```

  Attendu : aucune erreur.

- [ ] **Step 6.4 — Commit**

  ```bash
  git add backend/src/routes/workflows.ts
  git commit -m "feat(delegation): intégrer délégation dans start-step"
  ```

---

## Task 7 — Intégrer la délégation dans `dispatching.ts` (`assign`)

**Files:**
- Modify: `backend/src/routes/dispatching.ts`

- [ ] **Step 7.1 — Ajouter l'import**

  ```typescript
  import { resolveDelegation } from '../services/delegationService';
  ```

- [ ] **Step 7.2 — Modifier le middleware `requireSupervisor`**

  Remplacer le middleware `requireSupervisor` (qui bloque si rôle ≠ ANALYST_SUPERVISOR/ADMIN) par une vérification qui accepte aussi les délégués :

  ```typescript
  const requireSupervisorOrDelegate = async (req: Request, res: Response, next: any) => {
    const user = (req as any).user;
    if (!user) return res.status(403).json({ success: false, error: 'Non authentifié' });

    const isSupervisor = ['ANALYST_SUPERVISOR', 'ADMIN'].includes(user.role);
    if (isSupervisor) return next();

    // Vérifier si délégué avec droit DISPATCH_APPLICATION
    const userId = user?.userId || user?.id;
    const delegation = await resolveDelegation(userId, 'DISPATCH_APPLICATION');
    if (delegation && ['ANALYST_SUPERVISOR', 'ADMIN'].includes(delegation.delegatorRole)) {
      (req as any).delegationContext = delegation;
      return next();
    }

    return res.status(403).json({ success: false, error: 'Accès réservé au Responsable Analyste' });
  };
  ```

  Remplacer `router.use(requireSupervisor)` par `router.use(requireSupervisorOrDelegate)`.

- [ ] **Step 7.3 — Utiliser la branche du délégant dans les guards d'agence**

  Dans la route `assign`, après récupération de `supervisorUser`, vérifier si `(req as any).delegationContext` est défini et utiliser la branche du délégant pour les guards d'agence.

- [ ] **Step 7.4 — Vérifier la compilation**

  ```bash
  cd backend && npx tsc --noEmit
  ```

  Attendu : aucune erreur.

- [ ] **Step 7.5 — Commit**

  ```bash
  git add backend/src/routes/dispatching.ts
  git commit -m "feat(delegation): intégrer délégation dans dispatching/assign"
  ```

---

## Task 8 — Types TypeScript + fonctions API frontend

**Files:**
- Create: `src/types/delegation.ts`
- Modify: `src/services/api.ts`

- [ ] **Step 8.1 — Créer `src/types/delegation.ts`**

  ```typescript
  export type DelegatableAction =
    | 'APPROVE_WORKFLOW'
    | 'REJECT_WORKFLOW'
    | 'DISPATCH_APPLICATION'
    | 'START_STEP';

  export const DELEGATION_ACTION_LABELS: Record<DelegatableAction, string> = {
    APPROVE_WORKFLOW:     'Approuver un dossier',
    REJECT_WORKFLOW:      'Rejeter un dossier',
    DISPATCH_APPLICATION: 'Dispatcher un dossier',
    START_STEP:           'Démarrer une étape d\'analyse',
  };

  export interface DelegationUser {
    id:     string;
    name:   string;
    role:   string;
    branch: string | null;
  }

  export interface PowerDelegation {
    id:          string;
    delegatorId: string;
    delegateId:  string;
    startDate:   string;
    endDate:     string;
    reason:      string | null;
    permissions: DelegatableAction[];
    isActive:    boolean;
    revokedAt:   string | null;
    createdAt:   string;
    delegator:   DelegationUser;
    delegate:    DelegationUser;
    createdBy:   { id: string; name: string };
    revokedBy:   { id: string; name: string } | null;
  }

  export interface CreateDelegationPayload {
    delegatorId: string;
    delegateId:  string;
    startDate:   string; // ISO
    endDate:     string; // ISO
    reason?:     string;
    permissions: DelegatableAction[];
  }
  ```

- [ ] **Step 8.2 — Ajouter les fonctions API dans `src/services/api.ts`**

  À la fin de `src/services/api.ts`, ajouter :

  ```typescript
  // ─── Délégations ──────────────────────────────────────────────────────────────
  getDelegations: async (params?: { status?: string; delegatorId?: string; delegateId?: string }) => {
    const response = await api.get('/delegations', { params });
    return response.data;
  },

  getMyDelegations: async () => {
    const response = await api.get('/delegations/my');
    return response.data;
  },

  getDelegatableActions: async () => {
    const response = await api.get('/delegations/delegatable-actions');
    return response.data;
  },

  createDelegation: async (payload: import('../types/delegation').CreateDelegationPayload) => {
    const response = await api.post('/delegations', payload);
    return response.data;
  },

  revokeDelegation: async (id: string) => {
    const response = await api.patch(`/delegations/${id}/revoke`);
    return response.data;
  },
  ```

- [ ] **Step 8.3 — Vérifier la compilation frontend**

  ```bash
  cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit
  ```

  Attendu : aucune erreur.

- [ ] **Step 8.4 — Commit**

  ```bash
  git add src/types/delegation.ts src/services/api.ts
  git commit -m "feat(delegation): types + fonctions API frontend"
  ```

---

## Task 9 — Composant `DelegationBadge`

**Files:**
- Create: `src/components/DelegationBadge.tsx`

- [ ] **Step 9.1 — Créer `src/components/DelegationBadge.tsx`**

  ```tsx
  import React from 'react';
  import { Chip, Tooltip, Box, Typography } from '@mui/material';
  import BeachAccessIcon from '@mui/icons-material/BeachAccess';

  interface DelegationBadgeProps {
    isOnLeave:    boolean;
    delegateName?: string; // Nom du délégué actif si connu
    size?:        'small' | 'medium';
  }

  /**
   * Badge affiché à côté du nom d'un utilisateur en congé.
   * Affiche "EN CONGÉ" et optionnellement le nom du délégué.
   */
  const DelegationBadge: React.FC<DelegationBadgeProps> = ({
    isOnLeave,
    delegateName,
    size = 'small',
  }) => {
    if (!isOnLeave) return null;

    const tooltip = delegateName
      ? `Délégué à : ${delegateName}`
      : 'Cet utilisateur est en congé';

    return (
      <Tooltip title={tooltip} arrow>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <Chip
            icon={<BeachAccessIcon />}
            label="EN CONGÉ"
            size={size}
            color="warning"
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: '0.65rem', height: 20 }}
          />
          {delegateName && (
            <Typography variant="caption" color="text.secondary">
              → {delegateName}
            </Typography>
          )}
        </Box>
      </Tooltip>
    );
  };

  export default DelegationBadge;
  ```

- [ ] **Step 9.2 — Commit**

  ```bash
  git add src/components/DelegationBadge.tsx
  git commit -m "feat(delegation): composant DelegationBadge"
  ```

---

## Task 10 — Composant `DelegationForm`

**Files:**
- Create: `src/components/DelegationForm.tsx`

- [ ] **Step 10.1 — Créer `src/components/DelegationForm.tsx`**

  Formulaire MUI Dialog pour créer une délégation. Champs :
  - Sélecteur du délégué (liste des utilisateurs actifs de la même agence)
  - Date début (DatePicker MUI)
  - Date fin (DatePicker MUI)
  - Motif (TextField optionnel)
  - Cases à cocher pour chaque action déléguable (avec label français via `DELEGATION_ACTION_LABELS`)

  ```tsx
  import React, { useState, useEffect } from 'react';
  import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, FormGroup, FormControlLabel, Checkbox,
    MenuItem, Select, InputLabel, FormControl, Alert, CircularProgress,
    Box, Typography,
  } from '@mui/material';
  import { DELEGATION_ACTION_LABELS, DelegatableAction, CreateDelegationPayload } from '../types/delegation';

  interface DelegationFormProps {
    open:           boolean;
    onClose:        () => void;
    onSuccess:      () => void;
    delegatorId:    string;       // ID du délégant (utilisateur courant ou sélectionné par admin)
    users:          { id: string; name: string; role: string; branch: string | null }[];
    isAdmin?:       boolean;
  }

  const DelegationForm: React.FC<DelegationFormProps> = ({
    open, onClose, onSuccess, delegatorId, users, isAdmin = false,
  }) => {
    const [delegateId,   setDelegateId]   = useState('');
    const [startDate,    setStartDate]    = useState('');
    const [endDate,      setEndDate]      = useState('');
    const [reason,       setReason]       = useState('');
    const [permissions,  setPermissions]  = useState<DelegatableAction[]>([]);
    const [loading,      setLoading]      = useState(false);
    const [error,        setError]        = useState<string | null>(null);

    const today = new Date().toISOString().split('T')[0];

    const togglePermission = (action: DelegatableAction) => {
      setPermissions(prev =>
        prev.includes(action) ? prev.filter(p => p !== action) : [...prev, action]
      );
    };

    const handleSubmit = async () => {
      if (!delegateId || !startDate || !endDate || permissions.length === 0) {
        setError('Veuillez remplir tous les champs obligatoires.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const ApiService = (await import('../services/api')).default;
        const payload: CreateDelegationPayload = {
          delegatorId,
          delegateId,
          startDate: new Date(startDate).toISOString(),
          endDate:   new Date(endDate + 'T23:59:59').toISOString(),
          reason:    reason || undefined,
          permissions,
        };
        await ApiService.createDelegation(payload);
        onSuccess();
        onClose();
      } catch (err: any) {
        setError(err?.response?.data?.error || err.message || 'Erreur lors de la création.');
      } finally {
        setLoading(false);
      }
    };

    // Reset form on open
    useEffect(() => {
      if (open) {
        setDelegateId(''); setStartDate(''); setEndDate('');
        setReason(''); setPermissions([]); setError(null);
      }
    }, [open]);

    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Créer une délégation de pouvoir</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Délégué *</InputLabel>
            <Select value={delegateId} onChange={e => setDelegateId(e.target.value)} label="Délégué *">
              {users
                .filter(u => u.id !== delegatorId)
                .map(u => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.name} — {u.role}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="Date de début *" type="date" fullWidth
              InputLabelProps={{ shrink: true }} inputProps={{ min: today }}
              value={startDate} onChange={e => setStartDate(e.target.value)}
            />
            <TextField
              label="Date de fin *" type="date" fullWidth
              InputLabelProps={{ shrink: true }} inputProps={{ min: startDate || today }}
              value={endDate} onChange={e => setEndDate(e.target.value)}
            />
          </Box>

          <TextField
            label="Motif (optionnel)" multiline rows={2} fullWidth
            value={reason} onChange={e => setReason(e.target.value)} sx={{ mb: 2 }}
          />

          <Typography variant="subtitle2" gutterBottom>Actions déléguées *</Typography>
          <FormGroup>
            {(Object.keys(DELEGATION_ACTION_LABELS) as DelegatableAction[]).map(action => (
              <FormControlLabel
                key={action}
                control={
                  <Checkbox
                    checked={permissions.includes(action)}
                    onChange={() => togglePermission(action)}
                  />
                }
                label={DELEGATION_ACTION_LABELS[action]}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>Annuler</Button>
          <Button
            onClick={handleSubmit} variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
          >
            Créer la délégation
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  export default DelegationForm;
  ```

- [ ] **Step 10.2 — Commit**

  ```bash
  git add src/components/DelegationForm.tsx
  git commit -m "feat(delegation): composant DelegationForm (Dialog MUI)"
  ```

---

## Task 11 — Onglet "Délégations" dans `UserManagementPage`

**Files:**
- Modify: `src/pages/UserManagementPage.tsx`

- [ ] **Step 11.1 — Ajouter le state et le chargement des délégations**

  Dans `UserManagementPage`, ajouter un state :

  ```typescript
  const [delegations, setDelegations] = useState<PowerDelegation[]>([]);
  const [delegationsLoading, setDelegationsLoading] = useState(false);
  const [delegationFormOpen, setDelegationFormOpen] = useState(false);
  const [selectedDelegatorId, setSelectedDelegatorId] = useState('');
  ```

  Ajouter une fonction `loadDelegations` :

  ```typescript
  const loadDelegations = async () => {
    setDelegationsLoading(true);
    try {
      const res = await ApiService.getDelegations();
      setDelegations(res.data || []);
    } catch (err) {
      console.error('Erreur chargement délégations:', err);
    } finally {
      setDelegationsLoading(false);
    }
  };
  ```

  Appeler `loadDelegations()` dans `useEffect` avec les autres chargements.

- [ ] **Step 11.2 — Ajouter l'onglet dans la navigation des tabs**

  Ajouter un onglet `Délégations` dans la liste des tabs existants de la page (là où sont définis les autres onglets Admin, Utilisateurs, etc.).

- [ ] **Step 11.3 — Implémenter le panneau de l'onglet Délégations**

  Le panneau contient :
  - Bouton "Créer une délégation" (ouvre `DelegationForm` avec `selectedDelegatorId` vide → l'admin sélectionne le délégant dans le formulaire)
  - Tableau des délégations avec colonnes : Délégant, Délégué, Début, Fin, Actions déléguées, Statut, Motif, Actions
  - Chip coloré pour le statut : vert `ACTIVE`, gris `EXPIRÉE`, orange `RÉVOQUÉE`
  - Bouton "Révoquer" sur les délégations actives

  ```tsx
  {activeTab === 'delegations' && (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" onClick={() => { setSelectedDelegatorId(''); setDelegationFormOpen(true); }}>
          Créer une délégation
        </Button>
      </Box>
      {delegationsLoading ? (
        <CircularProgress />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Délégant</TableCell>
                <TableCell>Délégué</TableCell>
                <TableCell>Début</TableCell>
                <TableCell>Fin</TableCell>
                <TableCell>Actions déléguées</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Motif</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {delegations.map(d => {
                const now = new Date();
                const isExpired = new Date(d.endDate) < now;
                const status = !d.isActive
                  ? (d.revokedAt ? 'Révoquée' : 'Expirée')
                  : isExpired ? 'Expirée' : 'Active';
                const statusColor = status === 'Active' ? 'success' : status === 'Révoquée' ? 'warning' : 'default';
                return (
                  <TableRow key={d.id}>
                    <TableCell>{d.delegator.name}</TableCell>
                    <TableCell>{d.delegate.name}</TableCell>
                    <TableCell>{new Date(d.startDate).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{new Date(d.endDate).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      {(d.permissions as DelegatableAction[]).map(p => (
                        <Chip key={p} label={DELEGATION_ACTION_LABELS[p]} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                      ))}
                    </TableCell>
                    <TableCell><Chip label={status} color={statusColor as any} size="small" /></TableCell>
                    <TableCell>{d.reason || '—'}</TableCell>
                    <TableCell>
                      {d.isActive && !isExpired && (
                        <Button
                          size="small" color="error"
                          onClick={async () => {
                            await ApiService.revokeDelegation(d.id);
                            loadDelegations();
                          }}
                        >
                          Révoquer
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <DelegationForm
        open={delegationFormOpen}
        onClose={() => setDelegationFormOpen(false)}
        onSuccess={loadDelegations}
        delegatorId={selectedDelegatorId}
        users={users}
        isAdmin={true}
      />
    </Box>
  )}
  ```

- [ ] **Step 11.4 — Vérifier la compilation frontend**

  ```bash
  cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit
  ```

- [ ] **Step 11.5 — Commit**

  ```bash
  git add src/pages/UserManagementPage.tsx
  git commit -m "feat(delegation): onglet Délégations dans UserManagementPage"
  ```

---

## Task 12 — Section "Ma délégation" dans `ProfilePage`

**Files:**
- Modify: `src/pages/ProfilePage.tsx`

- [ ] **Step 12.1 — Ajouter le state et chargement**

  Dans `ProfilePage`, ajouter :

  ```typescript
  import { PowerDelegation, DelegatableAction, DELEGATION_ACTION_LABELS } from '../types/delegation';
  import DelegationForm from '../components/DelegationForm';

  const [myDelegations,     setMyDelegations]     = useState<PowerDelegation[]>([]);
  const [delegationFormOpen, setDelegationFormOpen] = useState(false);
  const [allUsers,          setAllUsers]           = useState<any[]>([]);
  ```

  Ajouter dans `useEffect` :

  ```typescript
  const loadMyDelegations = async () => {
    try {
      const res = await ApiService.getMyDelegations();
      setMyDelegations(res.data || []);
    } catch (err) { console.error(err); }
  };
  const loadUsers = async () => {
    try {
      const res = await ApiService.getCreditAnalysts(); // ou liste complète si dispo
      setAllUsers(res.analysts || res.data || []);
    } catch (err) { console.error(err); }
  };
  loadMyDelegations();
  loadUsers();
  ```

- [ ] **Step 12.2 — Ajouter la section dans l'UI**

  Ajouter une section `Paper` sous les informations de profil existantes :

  ```tsx
  <Paper sx={{ p: 3, mt: 3 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
      <Typography variant="h6">Mes délégations de pouvoir</Typography>
      <Button variant="outlined" onClick={() => setDelegationFormOpen(true)}>
        Créer une délégation
      </Button>
    </Box>

    {myDelegations.length === 0 ? (
      <Typography color="text.secondary">Aucune délégation.</Typography>
    ) : (
      myDelegations.map(d => {
        const now       = new Date();
        const isActive  = d.isActive && new Date(d.endDate) >= now && new Date(d.startDate) <= now;
        const isGiven   = d.delegatorId === currentUser?.id;
        return (
          <Box key={d.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">
                {isGiven
                  ? `Délégué à : ${d.delegate.name}`
                  : `Reçu de : ${d.delegator.name}`}
              </Typography>
              <Chip
                label={isActive ? 'Active' : !d.isActive ? 'Révoquée' : 'Expirée'}
                color={isActive ? 'success' : 'default'}
                size="small"
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Du {new Date(d.startDate).toLocaleDateString('fr-FR')} au {new Date(d.endDate).toLocaleDateString('fr-FR')}
              {d.reason ? ` — ${d.reason}` : ''}
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {(d.permissions as DelegatableAction[]).map(p => (
                <Chip key={p} label={DELEGATION_ACTION_LABELS[p]} size="small" sx={{ mr: 0.5 }} />
              ))}
            </Box>
            {isActive && isGiven && (
              <Button
                size="small" color="error" sx={{ mt: 1 }}
                onClick={async () => {
                  await ApiService.revokeDelegation(d.id);
                  loadMyDelegations();
                }}
              >
                Révoquer
              </Button>
            )}
          </Box>
        );
      })
    )}

    <DelegationForm
      open={delegationFormOpen}
      onClose={() => setDelegationFormOpen(false)}
      onSuccess={loadMyDelegations}
      delegatorId={currentUser?.id || ''}
      users={allUsers}
    />
  </Paper>
  ```

- [ ] **Step 12.3 — Vérifier la compilation frontend**

  ```bash
  cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit
  ```

- [ ] **Step 12.4 — Commit**

  ```bash
  git add src/pages/ProfilePage.tsx
  git commit -m "feat(delegation): section Ma délégation dans ProfilePage"
  ```

---

## Task 13 — Afficher le badge "En congé" dans les listes

**Files:**
- Modify: `src/pages/UserManagementPage.tsx` (liste utilisateurs)
- (Optionnel) Modifier les pages de dispatching si elles affichent des noms d'analystes

- [ ] **Step 13.1 — Importer et utiliser `DelegationBadge` dans la liste d'utilisateurs**

  Dans `UserManagementPage`, pour chaque ligne utilisateur dans le tableau, ajouter après le nom :

  ```tsx
  import DelegationBadge from '../components/DelegationBadge';

  // Dans la cellule du nom :
  <TableCell>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {user.name}
      <DelegationBadge
        isOnLeave={(user as any).isOnLeave}
        delegateName={
          delegations.find(d => d.isActive && d.delegatorId === user.id)?.delegate?.name
        }
      />
    </Box>
  </TableCell>
  ```

- [ ] **Step 13.2 — Vérifier la compilation et commit**

  ```bash
  cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit
  git add src/pages/UserManagementPage.tsx src/components/DelegationBadge.tsx
  git commit -m "feat(delegation): badge En congé dans liste utilisateurs"
  ```

---

## Task 14 — Indicateur "Vous agissez au nom de" dans le workflow

**Files:**
- Modify: `src/pages/WorkflowPage.tsx` (ou le composant d'approbation)

- [ ] **Step 14.1 — Afficher un bandeau si l'utilisateur a une délégation active reçue**

  Au chargement de la page de workflow, charger les délégations reçues :

  ```typescript
  const [activeDelegationReceived, setActiveDelegationReceived] = useState<PowerDelegation | null>(null);

  useEffect(() => {
    ApiService.getMyDelegations().then(res => {
      const now = new Date();
      const active = (res.data || []).find((d: PowerDelegation) =>
        d.delegateId === currentUser?.id &&
        d.isActive &&
        new Date(d.startDate) <= now &&
        new Date(d.endDate) >= now
      );
      setActiveDelegationReceived(active || null);
    });
  }, []);
  ```

  Afficher un bandeau si délégation active :

  ```tsx
  {activeDelegationReceived && (
    <Alert severity="info" icon={<BeachAccessIcon />} sx={{ mb: 2 }}>
      Vous agissez au nom de <strong>{activeDelegationReceived.delegator.name}</strong>
      {' '}(délégation active jusqu'au{' '}
      {new Date(activeDelegationReceived.endDate).toLocaleDateString('fr-FR')})
    </Alert>
  )}
  ```

- [ ] **Step 14.2 — Vérifier la compilation et commit**

  ```bash
  npx tsc --noEmit
  git add src/pages/WorkflowPage.tsx
  git commit -m "feat(delegation): bandeau délégation active dans WorkflowPage"
  ```

---

## Task 15 — Déploiement et migration en production

- [ ] **Step 15.1 — Push final**

  ```bash
  git push origin release/v1.0
  ```

- [ ] **Step 15.2 — Déployer sur le serveur**

  Sur le serveur Ubuntu :

  ```bash
  sudo ./update.sh
  ```

  Puis appliquer la migration (si `update.sh` ne la lance pas automatiquement) :

  ```bash
  cd /chemin/vers/app/backend && npx prisma migrate deploy
  ```

- [ ] **Step 15.3 — Vérifier le démarrage**

  Vérifier les logs du backend : `[delegation] 0 délégation(s) expirée(s) au démarrage` (ou similaire) doit apparaître sans erreur.

- [ ] **Step 15.4 — Test de bout en bout**

  1. Se connecter en tant qu'Admin → Gestion utilisateurs → onglet Délégations → créer une délégation pour un ANALYST_SUPERVISOR → délégué : un autre utilisateur de la même agence
  2. Vérifier que le délégant affiche le badge "EN CONGÉ"
  3. Se connecter en tant que délégué → aller sur un dossier en attente d'approbation → vérifier que le bandeau "Vous agissez au nom de..." s'affiche
  4. Effectuer une approbation → vérifier dans les logs audit que `actingAs: "delegation"` est enregistré
  5. Révoquer la délégation → vérifier que le badge disparaît et que le délégué ne peut plus approuver

---

*Spec de référence : `docs/superpowers/specs/2026-04-13-delegation-pouvoir-design.md`*
