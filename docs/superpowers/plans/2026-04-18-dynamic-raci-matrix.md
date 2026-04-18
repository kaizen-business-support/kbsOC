# Matrice RACI Dynamique par Tenant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la matrice RACI configurable par tenant : chaque tenant peut modifier les rôles R/A/C/I par étape de workflow, gérer son mur chinois, et voir quels utilisateurs sont affectés à chaque rôle — tout changement impacte directement les workflows.

**Architecture:** RACI = CreditPolicy active du tenant. Le R (exécutant) reste sur `CreditPolicyStep.assignedRole` (source de vérité workflow). Les rôles A/C/I (et co-R pour étapes à double exécutant) sont stockés dans `CreditPolicyStepRole`. Le mur chinois est stocké dans `TenantChineseWallRule`, remplaçant le dict hardcodé dans `workflowService.ts`.

**Tech Stack:** Node.js + Express + Prisma + PostgreSQL (backend), React + TypeScript + MUI (frontend), Jest (tests backend).

---

## File Structure

**Created:**
- `backend/src/routes/raci-matrix.ts` — 6 routes CRUD RACI + mur chinois
- `src/services/raciMatrixApi.ts` — service frontend RACI

**Modified:**
- `backend/prisma/schema.prisma` — +2 models, +1 enum, +1 champ `phase`, +2 back-relations
- `backend/prisma/seed-bci.js` — step 6 : mur chinois + A/C/I + étapes manquantes
- `backend/src/server.ts` — mount `/api/raci-matrix`
- `backend/src/services/workflowService.ts` — canApproveStep lit mur chinois depuis DB
- `backend/src/constants/stepNames.ts` — supprimer STEP_ROLES
- `src/services/api.ts` — ajouter méthode `put()` générique
- `src/pages/RACIMatrixPage.tsx` — réécriture complète (3 onglets, éditable, données dynamiques)

---

## Task 1: Prisma schema — nouveaux modèles et migration

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Ajouter le champ `phase` sur `CreditPolicyStep`**

Dans `backend/prisma/schema.prisma`, à la fin du bloc champs de `CreditPolicyStep` (après `creditTypeIds`, avant `workflowSteps`), ajouter :

```prisma
  // Phase d'affichage dans la matrice RACI (ex: "Montage dossier", "Analyse risques")
  phase       String?          @map("phase")
```

Le modèle doit ressembler à :
```prisma
  creditTypeIds String[]       @default([]) @map("credit_type_ids")
  phase         String?        @map("phase")

  workflowSteps WorkflowStep[]
  stepRoles     CreditPolicyStepRole[]
```

- [ ] **Step 2: Ajouter la back-relation `stepRoles` sur `CreditPolicyStep`**

Toujours dans `CreditPolicyStep`, après `workflowSteps WorkflowStep[]`, ajouter :
```prisma
  stepRoles     CreditPolicyStepRole[]
```

- [ ] **Step 3: Ajouter la back-relation `chineseWallRules` sur `Company`**

Dans le modèle `Company`, après `branches Branch[]` :
```prisma
  chineseWallRules TenantChineseWallRule[]
```

- [ ] **Step 4: Ajouter l'enum `RaciCode`**

Après l'enum `PolicyStepType` (vers la fin du fichier schema.prisma), ajouter :

> **Note (écart intentionnel vs spec):** La spec prévoyait A/C/I uniquement. R est ajouté ici pour couvrir les étapes à double exécutant (ex: `mise_en_place_sib` → RE et BO exécutent tous les deux). Le R de `CreditPolicyStepRole` = co-exécutant secondaire. Le R primaire reste toujours `assignedRole` sur `CreditPolicyStep`.

```prisma
enum RaciCode {
  R @map("r")   // Co-Responsible (exécutant secondaire — étapes à double exécutant)
  A @map("a")   // Accountable — valide ou signe
  C @map("c")   // Consulted — consulté avant décision
  I @map("i")   // Informed — notifié après décision

  @@map("raci_code")
}
```

- [ ] **Step 5: Ajouter les deux nouveaux modèles**

Après le modèle `CreditPolicyStep`, ajouter :

```prisma
model CreditPolicyStepRole {
  id           String           @id @default(cuid())
  policyStepId String           @map("policy_step_id")
  policyStep   CreditPolicyStep @relation(fields: [policyStepId], references: [id], onDelete: Cascade)
  role         UserRole
  raciCode     RaciCode         @map("raci_code")
  createdAt    DateTime         @default(now()) @map("created_at")

  @@unique([policyStepId, role, raciCode])
  @@index([policyStepId])
  @@map("credit_policy_step_roles")
}

model TenantChineseWallRule {
  id            String   @id @default(cuid())
  companyId     String   @map("company_id")
  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  blockedRole   UserRole @map("blocked_role")
  forbiddenStep String   @map("forbidden_step")
  reason        String?
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")

  @@unique([companyId, blockedRole, forbiddenStep])
  @@index([companyId])
  @@map("tenant_chinese_wall_rules")
}
```

- [ ] **Step 6: Générer et appliquer la migration**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
npx prisma migrate dev --name add_raci_roles_and_chinese_wall
```

Expected: migration créée et appliquée sans erreur, `prisma generate` lancé automatiquement.

- [ ] **Step 7: Vérifier la migration**

```bash
npx prisma studio
```

Vérifier que les tables `credit_policy_step_roles` et `tenant_chinese_wall_rules` apparaissent.

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(raci): schema — CreditPolicyStepRole, TenantChineseWallRule, RaciCode enum"
```

---

## Task 2: Backend — route `raci-matrix.ts`

**Files:**
- Create: `backend/src/routes/raci-matrix.ts`

- [ ] **Step 1: Créer le fichier route**

Créer `backend/src/routes/raci-matrix.ts` avec le contenu complet suivant :

```typescript
/**
 * raci-matrix.ts — Routes de gestion de la Matrice RACI par tenant
 *
 * La matrice RACI est une vue/édition de la CreditPolicy active du tenant.
 * R  = CreditPolicyStep.assignedRole (source de vérité workflow)
 * A/C/I/co-R = CreditPolicyStepRole (table dédiée)
 * Mur chinois = TenantChineseWallRule (remplace le dict hardcodé dans workflowService)
 *
 * Endpoints :
 *   GET  /api/raci-matrix                         → matrice complète + utilisateurs + mur chinois
 *   PUT  /api/raci-matrix/steps/:stepId           → modifier une étape (label, assignedRole, SLA…)
 *   PUT  /api/raci-matrix/steps/:stepId/roles     → remplacer les rôles A/C/I d'une étape
 *   POST /api/raci-matrix/steps                   → créer une étape dans la politique active
 *   DELETE /api/raci-matrix/steps/:stepId         → soft-delete une étape
 *   PUT  /api/raci-matrix/chinese-wall            → remplacer les règles mur chinois du tenant
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { authenticate, requireCompany } from '../middleware/auth';
import { UserRole, RaciCode, PolicyStepType } from '@prisma/client';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

// ─── GET /api/raci-matrix ──────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;

    const policy = await prisma.creditPolicy.findFirst({
      where: { companyId, isActive: true },
      select: { id: true, name: true, version: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!policy) {
      return res.json({ success: true, data: { policy: null, steps: [], chineseWallRules: [] } });
    }

    const steps = await prisma.creditPolicyStep.findMany({
      where: { policyId: policy.id, isActive: true },
      include: { stepRoles: { orderBy: { createdAt: 'asc' } } },
      orderBy: { order: 'asc' },
    });

    // Pour chaque étape, récupérer les utilisateurs par rôle impliqué
    const stepsWithUsers = await Promise.all(
      steps.map(async (step) => {
        const allRoles = [step.assignedRole, ...step.stepRoles.map((r) => r.role)];
        const uniqueRoles = [...new Set(allRoles)] as UserRole[];

        const usersPerRole: Record<string, { id: string; name: string; email: string }[]> = {};
        await Promise.all(
          uniqueRoles.map(async (role) => {
            const memberships = await prisma.companyMembership.findMany({
              where: { companyId, role, isActive: true },
              include: { user: { select: { id: true, name: true, email: true } } },
            });
            usersPerRole[role] = memberships.map((m) => m.user);
          })
        );

        return {
          id: step.id,
          stepName: step.stepName,
          stepLabel: step.stepLabel,
          phase: step.phase,
          order: step.order,
          stepType: step.stepType,
          assignedRole: step.assignedRole,
          expectedDurationHours: step.expectedDurationHours,
          maxDurationHours: step.maxDurationHours,
          conditionMinAmount: step.conditionMinAmount,
          conditionMaxAmount: step.conditionMaxAmount,
          isRequired: step.isRequired,
          roles: step.stepRoles.map((r) => ({ role: r.role, raciCode: r.raciCode })),
          users: usersPerRole,
        };
      })
    );

    const chineseWallRules = await prisma.tenantChineseWallRule.findMany({
      where: { companyId },
      orderBy: [{ blockedRole: 'asc' }, { forbiddenStep: 'asc' }],
    });

    res.json({ success: true, data: { policy, steps: stepsWithUsers, chineseWallRules } });
  } catch (error) {
    console.error('[raci-matrix] GET /', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── PUT /api/raci-matrix/steps/:stepId ───────────────────────────────────────

router.put('/steps/:stepId', async (req: Request, res: Response) => {
  try {
    const { stepId } = req.params;
    const {
      stepLabel, phase, assignedRole,
      expectedDurationHours, maxDurationHours,
      conditionMinAmount, conditionMaxAmount,
    } = req.body;

    const step = await prisma.creditPolicyStep.update({
      where: { id: stepId },
      data: {
        ...(stepLabel !== undefined && { stepLabel }),
        ...(phase !== undefined && { phase }),
        ...(assignedRole !== undefined && { assignedRole: assignedRole as UserRole }),
        ...(expectedDurationHours !== undefined && { expectedDurationHours: Number(expectedDurationHours) }),
        ...(maxDurationHours !== undefined && { maxDurationHours: Number(maxDurationHours) }),
        ...(conditionMinAmount !== undefined && { conditionMinAmount }),
        ...(conditionMaxAmount !== undefined && { conditionMaxAmount }),
      },
    });

    res.json({ success: true, data: step });
  } catch (error) {
    console.error('[raci-matrix] PUT /steps/:stepId', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── PUT /api/raci-matrix/steps/:stepId/roles ─────────────────────────────────

router.put('/steps/:stepId/roles', async (req: Request, res: Response) => {
  try {
    const { stepId } = req.params;
    const roles: { role: string; raciCode: string }[] = req.body;

    if (!Array.isArray(roles)) {
      return res.status(400).json({ success: false, error: 'body doit être un tableau [{ role, raciCode }]' });
    }

    await prisma.creditPolicyStepRole.deleteMany({ where: { policyStepId: stepId } });

    if (roles.length > 0) {
      await prisma.creditPolicyStepRole.createMany({
        data: roles.map((r) => ({
          policyStepId: stepId,
          role: r.role as UserRole,
          raciCode: r.raciCode as RaciCode,
        })),
      });
    }

    const updated = await prisma.creditPolicyStepRole.findMany({ where: { policyStepId: stepId } });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[raci-matrix] PUT /steps/:stepId/roles', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/raci-matrix/steps ──────────────────────────────────────────────

router.post('/steps', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;
    const { stepName, stepLabel, phase, assignedRole, order, stepType, expectedDurationHours, maxDurationHours } = req.body;

    if (!stepName || !stepLabel || !assignedRole) {
      return res.status(400).json({ success: false, error: 'stepName, stepLabel et assignedRole sont obligatoires' });
    }

    const policy = await prisma.creditPolicy.findFirst({
      where: { companyId, isActive: true },
    });

    if (!policy) {
      return res.status(409).json({
        success: false,
        error: 'Aucune politique de crédit active. Créez une politique avant de modifier la matrice RACI.',
      });
    }

    const step = await prisma.creditPolicyStep.create({
      data: {
        policyId: policy.id,
        stepName,
        stepLabel,
        phase: phase ?? null,
        order: order ?? 99,
        stepType: (stepType as PolicyStepType) ?? 'DISPATCH',
        assignedRole: assignedRole as UserRole,
        expectedDurationHours: expectedDurationHours ? Number(expectedDurationHours) : 24,
        maxDurationHours: maxDurationHours ? Number(maxDurationHours) : 72,
      },
    });

    res.status(201).json({ success: true, data: step });
  } catch (error) {
    console.error('[raci-matrix] POST /steps', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── DELETE /api/raci-matrix/steps/:stepId ────────────────────────────────────

router.delete('/steps/:stepId', async (req: Request, res: Response) => {
  try {
    const { stepId } = req.params;

    await prisma.creditPolicyStep.update({
      where: { id: stepId },
      data: { isActive: false },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[raci-matrix] DELETE /steps/:stepId', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── PUT /api/raci-matrix/chinese-wall ────────────────────────────────────────

router.put('/chinese-wall', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;
    const rules: { blockedRole: string; forbiddenStep: string; reason?: string }[] = req.body;

    if (!Array.isArray(rules)) {
      return res.status(400).json({ success: false, error: 'body doit être un tableau [{ blockedRole, forbiddenStep, reason? }]' });
    }

    await prisma.tenantChineseWallRule.deleteMany({ where: { companyId } });

    if (rules.length > 0) {
      await prisma.tenantChineseWallRule.createMany({
        data: rules.map((r) => ({
          companyId,
          blockedRole: r.blockedRole as UserRole,
          forbiddenStep: r.forbiddenStep,
          reason: r.reason ?? null,
        })),
      });
    }

    const updated = await prisma.tenantChineseWallRule.findMany({
      where: { companyId },
      orderBy: [{ blockedRole: 'asc' }, { forbiddenStep: 'asc' }],
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[raci-matrix] PUT /chinese-wall', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
```

- [ ] **Step 2: Monter la route dans `server.ts`**

Dans `backend/src/server.ts`, après la ligne `import creditPolicyRoutes from './routes/credit-policy';` (ligne 35) :
```typescript
import raciMatrixRoutes from './routes/raci-matrix';
```

Après `app.use('/api/credit-policies', authenticate, creditPolicyRoutes);` (ligne 207) :
```typescript
app.use('/api/raci-matrix', authenticate, raciMatrixRoutes);
```

- [ ] **Step 3: Vérifier que le serveur compile**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
npx tsc --noEmit
```

Expected: aucune erreur TypeScript.

- [ ] **Step 4: Tester les routes manuellement**

```bash
# Démarrer le serveur en dev
npm run dev

# Dans un autre terminal — obtenir un token (utiliser admin@bci.sn / Demo2024!)
# Puis tester GET
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3001/api/raci-matrix
```

Expected: `{ success: true, data: { policy: null | {...}, steps: [], chineseWallRules: [] } }`

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/raci-matrix.ts backend/src/server.ts
git commit -m "feat(raci): route /api/raci-matrix — 6 endpoints CRUD + mur chinois"
```

---

## Task 3: Modifier `workflowService.ts` — mur chinois depuis DB

**Files:**
- Modify: `backend/src/services/workflowService.ts:22-35` (supprimer CHINESE_WALL_RULES)
- Modify: `backend/src/services/workflowService.ts:541-567` (canApproveStep)

- [ ] **Step 1: Supprimer le dict hardcodé `CHINESE_WALL_RULES`**

Supprimer les lignes 22–35 (le bloc `const CHINESE_WALL_RULES: Record<...> = { ... };`).

Le fichier doit passer directement de `import { resolveDelegation }` aux types exportés.

- [ ] **Step 2: Ajouter `companyId` au select de l'application dans `canApproveStep`**

À la ligne ~546, modifier le select de `prisma.creditApplication.findUnique` :

```typescript
// Avant :
prisma.creditApplication.findUnique({
  where: { id: applicationId },
  select: {
    amount: true,
    policyId: true,
    creator: { select: { branch: true, department: true, name: true } },
  },
}),

// Après :
prisma.creditApplication.findUnique({
  where: { id: applicationId },
  select: {
    companyId: true,        // ← ajout
    amount: true,
    policyId: true,
    creator: { select: { branch: true, department: true, name: true } },
  },
}),
```

- [ ] **Step 3: Remplacer le bloc Chinese Wall hardcodé**

Trouver le commentaire `// ── 0. Chinese Wall check` (ligne ~563). Remplacer le bloc entier (2 lignes) :

```typescript
// Avant :
const chineseWallRule = CHINESE_WALL_RULES[user.role as string];
if (chineseWallRule && chineseWallRule.forbiddenStepNames.includes(stepName)) {
  return { allowed: false, reason: chineseWallRule.reason };
}

// Après :
if (application.companyId) {
  const wallRules = await prisma.tenantChineseWallRule.findMany({
    where: {
      companyId: application.companyId,
      blockedRole: user.role as UserRole,
      isActive: true,
    },
    select: { forbiddenStep: true, reason: true },
  });
  const blocked = wallRules.find((r) => r.forbiddenStep === stepName);
  if (blocked) {
    return { allowed: false, reason: blocked.reason ?? 'Mur chinois : opération non autorisée pour ce rôle' };
  }
}
```

- [ ] **Step 4: Vérifier la compilation**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/workflowService.ts
git commit -m "feat(raci): canApproveStep lit le mur chinois depuis DB (TenantChineseWallRule)"
```

---

## Task 4: `stepNames.ts` + seed BCI (step 6)

**Files:**
- Modify: `backend/src/constants/stepNames.ts`
- Modify: `backend/prisma/seed-bci.js`

- [ ] **Step 1: Supprimer `STEP_ROLES` de `stepNames.ts`**

Dans `backend/src/constants/stepNames.ts`, supprimer l'export `STEP_ROLES` entier (lignes 33–47). Garder uniquement `STEP_NAME_FR`.

Vérifier qu'aucun fichier n'importe `STEP_ROLES` :
```bash
grep -r "STEP_ROLES" /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend/src/
```
Expected: aucun résultat.

- [ ] **Step 2: Ajouter `application_created` et `back_office_setup` à `STEP_NAME_FR`**

Ces entrées existent déjà, vérifier :
```
application_created: 'Création du dossier',
back_office_setup:   'Configuration Back Office',
```
Si manquantes, les ajouter.

- [ ] **Step 3: Ajouter le step 6 dans `seed-bci.js`**

Dans `backend/prisma/seed-bci.js`, après le bloc `── 5. Types de crédit BCI ──`, ajouter :

```javascript
// ── 6. Mur Chinois + RACI (A/C/I) pour la politique active BCI ─────────────

// 6a. Mur chinois
const chineseWallRules = [
  // ANALYSTE_RISQUES ne peut pas exécuter d'étapes Engagements ou Front Office
  { blockedRole: 'ANALYSTE_RISQUES', forbiddenStep: 'mise_en_place_sib',          reason: 'Mur chinois BCEAO — Direction Risques interdite sur opérations SIB' },
  { blockedRole: 'ANALYSTE_RISQUES', forbiddenStep: 'saisie_garanties',           reason: 'Mur chinois BCEAO — Direction Risques interdite sur opérations SIB' },
  { blockedRole: 'ANALYSTE_RISQUES', forbiddenStep: 'tirage_fonds',               reason: 'Mur chinois BCEAO — Direction Risques interdite sur décaissement' },
  { blockedRole: 'ANALYSTE_RISQUES', forbiddenStep: 'back_office_setup',          reason: 'Mur chinois BCEAO — Direction Risques interdite sur opérations BO' },
  { blockedRole: 'ANALYSTE_RISQUES', forbiddenStep: 'charge_affaires_dispatch',   reason: 'Mur chinois BCEAO — Direction Risques interdite sur Front Office' },
  { blockedRole: 'ANALYSTE_RISQUES', forbiddenStep: 'verification_completude',    reason: 'Mur chinois BCEAO — Direction Risques interdite sur Engagements' },
  // RESPONSABLE_RISQUES : mêmes restrictions
  { blockedRole: 'RESPONSABLE_RISQUES', forbiddenStep: 'mise_en_place_sib',       reason: 'Mur chinois BCEAO — Direction Risques interdite sur opérations SIB' },
  { blockedRole: 'RESPONSABLE_RISQUES', forbiddenStep: 'saisie_garanties',        reason: 'Mur chinois BCEAO — Direction Risques interdite sur opérations SIB' },
  { blockedRole: 'RESPONSABLE_RISQUES', forbiddenStep: 'tirage_fonds',            reason: 'Mur chinois BCEAO — Direction Risques interdite sur décaissement' },
  { blockedRole: 'RESPONSABLE_RISQUES', forbiddenStep: 'back_office_setup',       reason: 'Mur chinois BCEAO — Direction Risques interdite sur opérations BO' },
  { blockedRole: 'RESPONSABLE_RISQUES', forbiddenStep: 'charge_affaires_dispatch',reason: 'Mur chinois BCEAO — Direction Risques interdite sur Front Office' },
  { blockedRole: 'RESPONSABLE_RISQUES', forbiddenStep: 'verification_completude', reason: 'Mur chinois BCEAO — Direction Risques interdite sur Engagements' },
  // RESPONSABLE_ENGAGEMENTS ne peut pas intervenir sur l'analyse risques
  { blockedRole: 'RESPONSABLE_ENGAGEMENTS', forbiddenStep: 'contre_analyse',          reason: 'Mur chinois BCEAO — Engagements interdit sur analyse risques' },
  { blockedRole: 'RESPONSABLE_ENGAGEMENTS', forbiddenStep: 'calcul_ratios_prudentiels',reason: 'Mur chinois BCEAO — Engagements interdit sur analyse risques' },
  { blockedRole: 'RESPONSABLE_ENGAGEMENTS', forbiddenStep: 'notation_interne',         reason: 'Mur chinois BCEAO — Engagements interdit sur notation interne' },
  { blockedRole: 'RESPONSABLE_ENGAGEMENTS', forbiddenStep: 'avis_risques',             reason: 'Mur chinois BCEAO — Engagements interdit sur avis risques' },
];

for (const rule of chineseWallRules) {
  const existing = await prisma.tenantChineseWallRule.findFirst({
    where: { companyId: bci.id, blockedRole: rule.blockedRole, forbiddenStep: rule.forbiddenStep },
  });
  if (!existing) {
    await prisma.tenantChineseWallRule.create({ data: { ...rule, companyId: bci.id } });
  }
}
console.log(`  ✓ Mur chinois : ${chineseWallRules.length} règles`);

// 6b. Récupérer la politique active BCI
const activePolicy = await prisma.creditPolicy.findFirst({
  where: { companyId: bci.id, isActive: true },
  include: { steps: { orderBy: { order: 'asc' } } },
});

if (activePolicy) {
  // 6c. Ajouter les phases aux étapes existantes
  const phaseMap = {
    'charge_affaires_dispatch': 'Montage dossier',
    'verification_completude':  'Montage dossier',
    'application_created':      'Montage dossier',
    'contre_analyse':           'Analyse risques',
    'calcul_ratios_prudentiels':'Analyse risques',
    'notation_interne':         'Analyse risques',
    'avis_risques':             'Analyse risques',
    'validation_comite':        'Approbation',
    'decision_direction':       'Approbation',
    'mise_en_place_sib':        'Mise en place',
    'formalisation_garanties':  'Mise en place',
    'saisie_garanties':         'Mise en place',
    'tirage_fonds':             'Mise en place',
    'back_office_setup':        'Mise en place',
  };

  for (const step of activePolicy.steps) {
    if (phaseMap[step.stepName] && !step.phase) {
      await prisma.creditPolicyStep.update({
        where: { id: step.id },
        data: { phase: phaseMap[step.stepName] },
      });
    }
  }

  // 6d. Ajouter les étapes manquantes si absentes
  const stepNames = activePolicy.steps.map(s => s.stepName);
  const maxOrder = Math.max(...activePolicy.steps.map(s => s.order), 0);

  if (!stepNames.includes('application_created')) {
    await prisma.creditPolicyStep.create({
      data: {
        policyId: activePolicy.id,
        stepName: 'application_created',
        stepLabel: 'Création du dossier',
        phase: 'Montage dossier',
        order: 0,
        stepType: 'DISPATCH',
        assignedRole: 'CHARGE_AFFAIRES',
        expectedDurationHours: 1,
        maxDurationHours: 4,
        isRequired: true,
      },
    });
    console.log('  Créé : étape application_created');
  }

  if (!stepNames.includes('back_office_setup')) {
    await prisma.creditPolicyStep.create({
      data: {
        policyId: activePolicy.id,
        stepName: 'back_office_setup',
        stepLabel: 'Configuration Back Office',
        phase: 'Mise en place',
        order: maxOrder + 1,
        stepType: 'DISPATCH',
        assignedRole: 'BACK_OFFICE',
        expectedDurationHours: 4,
        maxDurationHours: 24,
        isRequired: true,
      },
    });
    console.log('  Créé : étape back_office_setup');
  }

  // 6e. Recharger les étapes avec les nouvelles
  const allSteps = await prisma.creditPolicyStep.findMany({
    where: { policyId: activePolicy.id, isActive: true },
  });
  const stepByName = Object.fromEntries(allSteps.map(s => [s.stepName, s]));

  // 6f. Insérer les rôles A/C/I par étape
  const raciAssignments = [
    // Montage dossier
    { step: 'application_created',      role: 'RESPONSABLE_ENGAGEMENTS', code: 'I' },
    { step: 'application_created',      role: 'RESPONSABLE_RISQUES',     code: 'I' },
    { step: 'charge_affaires_dispatch', role: 'RESPONSABLE_ENGAGEMENTS', code: 'I' },
    { step: 'charge_affaires_dispatch', role: 'RESPONSABLE_RISQUES',     code: 'I' },
    { step: 'verification_completude',  role: 'CHARGE_AFFAIRES',         code: 'C' },
    { step: 'verification_completude',  role: 'RESPONSABLE_RISQUES',     code: 'I' },
    // Analyse risques
    { step: 'contre_analyse',           role: 'RESPONSABLE_RISQUES',     code: 'A' },
    { step: 'contre_analyse',           role: 'RESPONSABLE_ENGAGEMENTS', code: 'I' },
    { step: 'contre_analyse',           role: 'CHARGE_AFFAIRES',         code: 'I' },
    { step: 'calcul_ratios_prudentiels',role: 'RESPONSABLE_RISQUES',     code: 'A' },
    { step: 'notation_interne',         role: 'RESPONSABLE_RISQUES',     code: 'A' },
    { step: 'avis_risques',             role: 'ANALYSTE_RISQUES',        code: 'C' },
    { step: 'avis_risques',             role: 'RESPONSABLE_ENGAGEMENTS', code: 'I' },
    { step: 'avis_risques',             role: 'COMITE_CREDIT',           code: 'I' },
    // Approbation
    { step: 'validation_comite',        role: 'RESPONSABLE_RISQUES',     code: 'C' },
    { step: 'validation_comite',        role: 'RESPONSABLE_ENGAGEMENTS', code: 'C' },
    { step: 'validation_comite',        role: 'DIRECTION_GENERALE',      code: 'I' },
    { step: 'decision_direction',       role: 'COMITE_CREDIT',           code: 'C' },
    { step: 'decision_direction',       role: 'RESPONSABLE_RISQUES',     code: 'I' },
    { step: 'decision_direction',       role: 'RESPONSABLE_ENGAGEMENTS', code: 'I' },
    // Mise en place
    { step: 'mise_en_place_sib',        role: 'BACK_OFFICE',             code: 'R' }, // co-exécutant
    { step: 'mise_en_place_sib',        role: 'RESPONSABLE_RISQUES',     code: 'I' },
    { step: 'mise_en_place_sib',        role: 'CHARGE_AFFAIRES',         code: 'I' },
    { step: 'formalisation_garanties',  role: 'RESPONSABLE_ENGAGEMENTS', code: 'C' },
    { step: 'formalisation_garanties',  role: 'CHARGE_AFFAIRES',         code: 'I' },
    { step: 'saisie_garanties',         role: 'RESPONSABLE_ENGAGEMENTS', code: 'A' },
    { step: 'saisie_garanties',         role: 'DIRECTION_JURIDIQUE',     code: 'C' },
    { step: 'tirage_fonds',             role: 'RESPONSABLE_ENGAGEMENTS', code: 'A' },
    { step: 'tirage_fonds',             role: 'CHARGE_AFFAIRES',         code: 'C' },
    { step: 'tirage_fonds',             role: 'DIRECTION_GENERALE',      code: 'I' },
    { step: 'back_office_setup',        role: 'RESPONSABLE_ENGAGEMENTS', code: 'I' },
  ];

  for (const a of raciAssignments) {
    const step = stepByName[a.step];
    if (!step) continue;
    const existing = await prisma.creditPolicyStepRole.findFirst({
      where: { policyStepId: step.id, role: a.role, raciCode: a.code },
    });
    if (!existing) {
      await prisma.creditPolicyStepRole.create({
        data: { policyStepId: step.id, role: a.role, raciCode: a.code },
      });
    }
  }
  console.log(`  ✓ RACI A/C/I : ${raciAssignments.length} entrées`);
} else {
  console.log('  ⚠ Aucune politique active BCI — RACI A/C/I non peuplé');
}
```

- [ ] **Step 4: Ajouter les lignes de log pour step 6 dans le résumé final**

Dans le bloc `console.log` de fin du seed, ajouter :
```javascript
console.log('✓ Mur chinois BCI + RACI A/C/I');
```

- [ ] **Step 5: Exécuter le seed**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
node prisma/seed-bci.js
```

Expected: lignes `✓ Mur chinois : 16 règles` et `✓ RACI A/C/I : 31 entrées` (ou variations si certaines existent déjà).

- [ ] **Step 6: Vérifier en DB**

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.tenantChineseWallRule.count().then(n => console.log('Wall rules:', n));
p.creditPolicyStepRole.count().then(n => console.log('Step roles:', n));
"
```

Expected: Wall rules ≥ 16, Step roles ≥ 31.

- [ ] **Step 7: Commit**

```bash
git add backend/src/constants/stepNames.ts backend/prisma/seed-bci.js
git commit -m "feat(raci): seed mur chinois BCI + rôles A/C/I + étapes manquantes"
```

---

## Task 5: Frontend — types et service API

**Files:**
- Modify: `src/services/api.ts:1195` (ajouter méthode `put`)
- Create: `src/services/raciMatrixApi.ts`

- [ ] **Step 1: Ajouter `static async put()` dans `api.ts`**

Dans `src/services/api.ts`, après `static async post()` (ligne ~1189), ajouter :

```typescript
  static async put(path: string, body?: any): Promise<any> {
    const response = await api.put(path, body);
    return response.data;
  }
```

- [ ] **Step 2: Créer `src/services/raciMatrixApi.ts`**

```typescript
import { ApiService } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RaciCode = 'R' | 'A' | 'C' | 'I';

export interface RaciStepRole {
  role: string;
  raciCode: RaciCode;
}

export interface RaciUser {
  id: string;
  name: string;
  email: string;
}

export interface RaciStep {
  id: string;
  stepName: string;
  stepLabel: string;
  phase: string | null;
  order: number;
  stepType: string;
  assignedRole: string;
  expectedDurationHours: number;
  maxDurationHours: number;
  conditionMinAmount: number | null;
  conditionMaxAmount: number | null;
  isRequired: boolean;
  roles: RaciStepRole[];
  users: Record<string, RaciUser[]>;
}

export interface ChineseWallRule {
  id?: string;
  blockedRole: string;
  forbiddenStep: string;
  reason?: string;
  isActive?: boolean;
}

export interface RaciMatrix {
  policy: { id: string; name: string; version: number } | null;
  steps: RaciStep[];
  chineseWallRules: ChineseWallRule[];
}

export interface NewStep {
  stepName: string;
  stepLabel: string;
  phase?: string;
  assignedRole: string;
  order?: number;
  stepType?: string;
  expectedDurationHours?: number;
  maxDurationHours?: number;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const raciMatrixApi = {
  getMatrix: (): Promise<{ success: boolean; data: RaciMatrix }> =>
    ApiService.get('/raci-matrix'),

  updateStep: (stepId: string, data: Partial<RaciStep>): Promise<{ success: boolean; data: RaciStep }> =>
    ApiService.put(`/raci-matrix/steps/${stepId}`, data),

  updateStepRoles: (stepId: string, roles: RaciStepRole[]): Promise<{ success: boolean; data: RaciStepRole[] }> =>
    ApiService.put(`/raci-matrix/steps/${stepId}/roles`, roles),

  createStep: (data: NewStep): Promise<{ success: boolean; data: RaciStep }> =>
    ApiService.post('/raci-matrix/steps', data),

  deleteStep: (stepId: string): Promise<{ success: boolean }> =>
    ApiService.delete(`/raci-matrix/steps/${stepId}`),

  updateChineseWall: (rules: Omit<ChineseWallRule, 'id' | 'isActive'>[]): Promise<{ success: boolean; data: ChineseWallRule[] }> =>
    ApiService.put('/raci-matrix/chinese-wall', rules),
};
```

- [ ] **Step 3: Vérifier la compilation TypeScript frontend**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/services/api.ts src/services/raciMatrixApi.ts
git commit -m "feat(raci): service API frontend raciMatrixApi + méthode put générique"
```

---

## Task 6: Frontend — `RACIMatrixPage.tsx` réécriture complète

**Files:**
- Modify: `src/pages/RACIMatrixPage.tsx` (réécriture totale)

La page actuelle est statique (289 lignes, données hardcodées). Réécrire entièrement avec :
- Données chargées depuis l'API
- 3 onglets MUI : Matrice / Mur Chinois / Étapes
- Mode lecture + mode édition

- [ ] **Step 1: Réécrire `RACIMatrixPage.tsx`**

Remplacer tout le contenu du fichier par :

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Tooltip, Divider, ToggleButton, ToggleButtonGroup, Tab, Tabs,
  CircularProgress, Alert, Button, Avatar, AvatarGroup, Menu, MenuItem,
  ListItemText, Switch, FormControlLabel, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, FormControl, InputLabel, IconButton,
  SelectChangeEvent,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { raciMatrixApi, RaciMatrix, RaciStep, RaciStepRole, ChineseWallRule, RaciCode, NewStep } from '../services/raciMatrixApi';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ALL_ROLES = [
  { key: 'CHARGE_AFFAIRES',         short: 'CA',    label: "Chargé d'Affaires",     color: '#2563EB' },
  { key: 'ANALYSTE_RISQUES',        short: 'ANA',   label: 'Analyste Risques',       color: '#7C3AED' },
  { key: 'RESPONSABLE_RISQUES',     short: 'R.Ris', label: 'Resp. Risques',          color: '#6D28D9' },
  { key: 'RESPONSABLE_ENGAGEMENTS', short: 'R.Eng', label: 'Resp. Engagements',      color: '#0891B2' },
  { key: 'COMITE_CREDIT',           short: 'CC',    label: 'Comité de Crédit',       color: '#D97706' },
  { key: 'DIRECTION_GENERALE',      short: 'DG',    label: 'Direction Générale',     color: '#DC2626' },
  { key: 'DIRECTION_JURIDIQUE',     short: 'Jur',   label: 'Direction Juridique',    color: '#059669' },
  { key: 'BACK_OFFICE',             short: 'BO',    label: 'Back Office',            color: '#6B7280' },
] as const;

type RoleKey = typeof ALL_ROLES[number]['key'];

const RACI_CONFIG: Record<RaciCode, { label: string; color: string; bg: string }> = {
  R: { label: 'Responsible',  color: '#1D4ED8', bg: '#EFF6FF' },
  A: { label: 'Accountable',  color: '#B45309', bg: '#FFFBEB' },
  C: { label: 'Consulted',    color: '#6D28D9', bg: '#F5F3FF' },
  I: { label: 'Informed',     color: '#6B7280', bg: '#F9FAFB' },
};

const PHASE_COLORS: Record<string, string> = {
  'Montage dossier': '#2563EB',
  'Analyse risques': '#7C3AED',
  'Approbation':     '#D97706',
  'Mise en place':   '#059669',
};

const POLICY_STEP_TYPES = ['DISPATCH', 'ANALYSIS', 'APPROVAL', 'COMMITTEE'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRaciForRole(step: RaciStep, roleKey: string): RaciCode | '' {
  if (step.assignedRole === roleKey) return 'R';
  const entry = step.roles.find(r => r.role === roleKey);
  return (entry?.raciCode as RaciCode) ?? '';
}

function getUserInitials(name: string): string {
  return name.split(' ').map(p => p.charAt(0).toUpperCase()).slice(0, 2).join('');
}

// ─── Sous-composant : cellule RACI ───────────────────────────────────────────

interface RaciCellProps {
  code: RaciCode | '';
  editable: boolean;
  onSet: (code: RaciCode | '') => void;
}

const RaciCell: React.FC<RaciCellProps> = ({ code, editable, onSet }) => {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const cfg = code ? RACI_CONFIG[code] : null;

  const content = cfg ? (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: '6px',
      bgcolor: cfg.bg, border: `1px solid ${cfg.color}22`,
      cursor: editable ? 'pointer' : 'default',
    }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: cfg.color, fontFamily: 'monospace' }}>
        {code}
      </Typography>
    </Box>
  ) : (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: '6px',
      border: editable ? '1px dashed #E5E7EB' : 'none',
      cursor: editable ? 'pointer' : 'default',
    }}>
      <Typography sx={{ fontSize: 14, color: '#D1D5DB' }}>–</Typography>
    </Box>
  );

  if (!editable) {
    return (
      <TableCell align="center" sx={{ px: 1 }}>
        <Tooltip title={cfg?.label ?? '—'} arrow>{content}</Tooltip>
      </TableCell>
    );
  }

  return (
    <TableCell align="center" sx={{ px: 1 }}>
      <Tooltip title={cfg?.label ?? 'Cliquer pour assigner'} arrow>
        <Box onClick={(e) => setAnchor(e.currentTarget)}>{content}</Box>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {(['R', 'A', 'C', 'I'] as RaciCode[]).map(c => (
          <MenuItem key={c} onClick={() => { onSet(c); setAnchor(null); }}
            selected={code === c}
            sx={{ gap: 1 }}>
            <Box sx={{ width: 20, height: 20, borderRadius: '4px', bgcolor: RACI_CONFIG[c].bg, border: `1px solid ${RACI_CONFIG[c].color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: RACI_CONFIG[c].color }}>{c}</Typography>
            </Box>
            <ListItemText primary={RACI_CONFIG[c].label} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => { onSet(''); setAnchor(null); }}>
          <ListItemText primary="Effacer" sx={{ color: 'text.secondary' }} />
        </MenuItem>
      </Menu>
    </TableCell>
  );
};

// ─── Onglet 1 : Matrice RACI ──────────────────────────────────────────────────

interface MatrixTabProps {
  steps: RaciStep[];
  editing: boolean;
  onCellChange: (stepId: string, role: string, code: RaciCode | '') => void;
}

const MatrixTab: React.FC<MatrixTabProps> = ({ steps, editing, onCellChange }) => {
  const [activePhase, setActivePhase] = useState<string>('all');

  const phases = steps
    .map(s => s.phase ?? 'Sans phase')
    .filter((p, i, arr) => arr.indexOf(p) === i);

  const filtered = activePhase === 'all' ? steps : steps.filter(s => (s.phase ?? 'Sans phase') === activePhase);

  // Détecter les rôles présents dans au moins une étape
  const presentRoles = ALL_ROLES.filter(r =>
    steps.some(s => s.assignedRole === r.key || s.roles.some(sr => sr.role === r.key))
  );

  return (
    <Box>
      {/* Légende */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }} elevation={0} variant="outlined">
        {(Object.entries(RACI_CONFIG) as [RaciCode, typeof RACI_CONFIG[RaciCode]][]).map(([code, cfg]) => (
          <Box key={code} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 22, height: 22, borderRadius: '4px', bgcolor: cfg.bg, border: `1px solid ${cfg.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: cfg.color, fontFamily: 'monospace' }}>{code}</Typography>
            </Box>
            <Typography variant="caption" fontWeight={600} color="text.secondary">{code} — {cfg.label}</Typography>
          </Box>
        ))}
      </Paper>

      {/* Filtre phases */}
      <ToggleButtonGroup value={activePhase} exclusive onChange={(_, v) => v && setActivePhase(v)} size="small" sx={{ mb: 2 }}>
        <ToggleButton value="all">Toutes</ToggleButton>
        {phases.map(p => (
          <ToggleButton key={p} value={p} sx={{ color: PHASE_COLORS[p] ?? 'text.primary' }}>{p}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* Tableau */}
      <Paper sx={{ overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 200, bgcolor: '#F8FAFC', fontWeight: 700 }}>Étape</TableCell>
              {presentRoles.map(r => (
                <TableCell key={r.key} align="center" sx={{ bgcolor: '#F8FAFC', minWidth: 70, px: 1 }}>
                  <Tooltip title={r.label} arrow>
                    <Box>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: r.color }}>{r.short}</Typography>
                    </Box>
                  </Tooltip>
                  {/* Avatars utilisateurs */}
                  {steps.flatMap(s => s.users[r.key] ?? []).length > 0 && (
                    <AvatarGroup max={3} sx={{ justifyContent: 'center', mt: 0.5, '& .MuiAvatar-root': { width: 20, height: 20, fontSize: 9, border: `1px solid ${r.color}40` } }}>
                      {[...new Map(steps.flatMap(s => s.users[r.key] ?? []).map(u => [u.id, u])).values()].map(u => (
                        <Tooltip key={u.id} title={`${u.name} — ${u.email}`} arrow>
                          <Avatar sx={{ bgcolor: `${r.color}18`, color: r.color, fontWeight: 700 }}>
                            {getUserInitials(u.name)}
                          </Avatar>
                        </Tooltip>
                      ))}
                    </AvatarGroup>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((step, idx) => {
              const prevPhase = idx > 0 ? (filtered[idx - 1].phase ?? 'Sans phase') : null;
              const currentPhase = step.phase ?? 'Sans phase';
              const showPhase = currentPhase !== prevPhase;
              const phaseColor = PHASE_COLORS[currentPhase] ?? '#6B7280';

              return (
                <React.Fragment key={step.id}>
                  {showPhase && (
                    <TableRow>
                      <TableCell colSpan={presentRoles.length + 1}
                        sx={{ bgcolor: `${phaseColor}12`, borderLeft: `3px solid ${phaseColor}`, py: 0.5, px: 2 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: phaseColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {currentPhase}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow hover>
                    <TableCell sx={{ py: 1 }}>
                      <Typography fontSize={13} fontWeight={600}>{step.stepLabel}</Typography>
                      <Typography fontSize={11} color="text.secondary" fontFamily="monospace">{step.stepName}</Typography>
                    </TableCell>
                    {presentRoles.map(r => (
                      <RaciCell
                        key={r.key}
                        code={getRaciForRole(step, r.key)}
                        editable={editing}
                        onSet={(code) => onCellChange(step.id, r.key, code)}
                      />
                    ))}
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

// ─── Onglet 2 : Mur Chinois ───────────────────────────────────────────────────

interface ChineseWallTabProps {
  rules: ChineseWallRule[];
  steps: RaciStep[];
  editing: boolean;
  onChange: (rules: ChineseWallRule[]) => void;
}

const ChineseWallTab: React.FC<ChineseWallTabProps> = ({ rules, steps, editing, onChange }) => {
  const toggleRule = (role: string, stepName: string) => {
    const exists = rules.find(r => r.blockedRole === role && r.forbiddenStep === stepName);
    if (exists) {
      onChange(rules.filter(r => !(r.blockedRole === role && r.forbiddenStep === stepName)));
    } else {
      onChange([...rules, { blockedRole: role, forbiddenStep: stepName, reason: 'Mur chinois' }]);
    }
  };

  const concernedRoles = ALL_ROLES.filter(r =>
    ['ANALYSTE_RISQUES', 'RESPONSABLE_RISQUES', 'RESPONSABLE_ENGAGEMENTS'].includes(r.key)
  );

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Les rôles cochés sont <strong>interdits</strong> d'intervenir sur les étapes marquées. Principe BCEAO de non-cumul des fonctions.
      </Typography>
      <Paper sx={{ overflow: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, bgcolor: '#F8FAFC', minWidth: 180 }}>Rôle bloqué ↓ / Étape →</TableCell>
              {steps.map(s => (
                <TableCell key={s.id} align="center" sx={{ bgcolor: '#F8FAFC', minWidth: 90, fontSize: 11, px: 1 }}>
                  <Tooltip title={s.stepLabel} arrow>
                    <Typography sx={{ fontSize: 10, fontFamily: 'monospace', color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>
                      {s.stepName}
                    </Typography>
                  </Tooltip>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {concernedRoles.map(role => (
              <TableRow key={role.key} hover>
                <TableCell>
                  <Chip label={role.short} size="small" sx={{ bgcolor: `${role.color}18`, color: role.color, fontWeight: 700 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>{role.label}</Typography>
                </TableCell>
                {steps.map(s => {
                  const blocked = rules.some(r => r.blockedRole === role.key && r.forbiddenStep === s.stepName);
                  return (
                    <TableCell key={s.id} align="center" sx={{ px: 0 }}>
                      <Tooltip title={blocked ? 'Interdit — cliquer pour autoriser' : 'Autorisé — cliquer pour bloquer'} arrow>
                        <Switch
                          checked={blocked}
                          onChange={() => editing && toggleRule(role.key, s.stepName)}
                          size="small"
                          color="error"
                          disabled={!editing}
                          sx={{ '& .MuiSwitch-thumb': { width: 12, height: 12 } }}
                        />
                      </Tooltip>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

// ─── Onglet 3 : Étapes ────────────────────────────────────────────────────────

interface StepsTabProps {
  steps: RaciStep[];
  onDelete: (stepId: string) => void;
  onAdd: (step: NewStep) => void;
}

const StepsTab: React.FC<StepsTabProps> = ({ steps, onDelete, onAdd }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NewStep>({
    stepName: '', stepLabel: '', phase: '', assignedRole: 'CHARGE_AFFAIRES',
    stepType: 'DISPATCH', expectedDurationHours: 24, maxDurationHours: 72,
  });

  const handleAdd = () => {
    if (!form.stepName || !form.stepLabel) return;
    onAdd(form);
    setDialogOpen(false);
    setForm({ stepName: '', stepLabel: '', phase: '', assignedRole: 'CHARGE_AFFAIRES', stepType: 'DISPATCH', expectedDurationHours: 24, maxDurationHours: 72 });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Ajouter une étape
        </Button>
      </Box>
      <Paper variant="outlined">
        {steps.map((step, idx) => (
          <Box key={step.id} sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: idx < steps.length - 1 ? '1px solid #F1F5F9' : 'none', gap: 2 }}>
            <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: `${PHASE_COLORS[step.phase ?? ''] ?? '#6B7280'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: PHASE_COLORS[step.phase ?? ''] ?? '#6B7280' }}>{step.order}</Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography fontSize={13} fontWeight={600}>{step.stepLabel}</Typography>
              <Typography fontSize={11} color="text.secondary" fontFamily="monospace">{step.stepName} • {step.phase ?? '—'} • {step.assignedRole}</Typography>
            </Box>
            <Chip label={step.stepType} size="small" variant="outlined" sx={{ fontSize: 10 }} />
            <Tooltip title="Supprimer l'étape (désactivation)">
              <IconButton size="small" color="error" onClick={() => onDelete(step.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ))}
      </Paper>

      {/* Dialog ajout */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle étape</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Slug (stepName)" value={form.stepName} onChange={e => setForm(f => ({ ...f, stepName: e.target.value }))} size="small" fullWidth required helperText="ex: ma_nouvelle_etape (sans espaces)" />
          <TextField label="Libellé affiché" value={form.stepLabel} onChange={e => setForm(f => ({ ...f, stepLabel: e.target.value }))} size="small" fullWidth required />
          <TextField label="Phase" value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))} size="small" fullWidth helperText="ex: Montage dossier" />
          <FormControl size="small" fullWidth>
            <InputLabel>Rôle Responsible (R)</InputLabel>
            <Select value={form.assignedRole} label="Rôle Responsible (R)" onChange={(e: SelectChangeEvent) => setForm(f => ({ ...f, assignedRole: e.target.value }))}>
              {ALL_ROLES.map(r => <MenuItem key={r.key} value={r.key}>{r.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Type d'étape</InputLabel>
            <Select value={form.stepType ?? 'DISPATCH'} label="Type d'étape" onChange={(e: SelectChangeEvent) => setForm(f => ({ ...f, stepType: e.target.value }))}>
              {POLICY_STEP_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="SLA attendu (h)" type="number" value={form.expectedDurationHours} onChange={e => setForm(f => ({ ...f, expectedDurationHours: Number(e.target.value) }))} size="small" />
            <TextField label="SLA max (h)" type="number" value={form.maxDurationHours} onChange={e => setForm(f => ({ ...f, maxDurationHours: Number(e.target.value) }))} size="small" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!form.stepName || !form.stepLabel}>Créer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─── Page principale ──────────────────────────────────────────────────────────

const RACIMatrixPage: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<RaciMatrix | null>(null);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Copies locales pour l'édition
  const [editSteps, setEditSteps] = useState<RaciStep[]>([]);
  const [editWallRules, setEditWallRules] = useState<ChineseWallRule[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await raciMatrixApi.getMatrix();
      setMatrix(res.data);
      setEditSteps(res.data.steps);
      setEditWallRules(res.data.chineseWallRules);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEditing = () => { setEditing(true); setDirty(false); };

  const cancelEditing = () => {
    setEditing(false);
    setDirty(false);
    if (matrix) {
      setEditSteps(matrix.steps);
      setEditWallRules(matrix.chineseWallRules);
    }
  };

  const handleCellChange = (stepId: string, role: string, code: RaciCode | '') => {
    setEditSteps(prev => prev.map(step => {
      if (step.id !== stepId) return step;

      // Si R : mettre à jour assignedRole + retirer R des autres rôles si présent
      if (code === 'R') {
        const rolesWithoutR = step.roles.filter(r => r.raciCode !== 'R');
        return { ...step, assignedRole: role, roles: rolesWithoutR };
      }

      // Retirer l'entrée existante pour ce rôle (quel que soit le code)
      const filtered = step.roles.filter(r => r.role !== role);

      // Si vide : c'est aussi le cas où assignedRole = role → retirer le R
      if (!code) {
        if (step.assignedRole === role) return step; // ne pas effacer le seul R
        return { ...step, roles: filtered };
      }

      return { ...step, roles: [...filtered, { role, raciCode: code }] };
    }));
    setDirty(true);
  };

  const handleWallRulesChange = (rules: ChineseWallRule[]) => {
    setEditWallRules(rules);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!matrix) return;
    try {
      // Calculer les diffs par rapport à l'état original
      const original = matrix.steps;
      for (const step of editSteps) {
        const orig = original.find(s => s.id === step.id);
        if (!orig) continue;

        // Diff assignedRole ou label
        if (orig.assignedRole !== step.assignedRole) {
          await raciMatrixApi.updateStep(step.id, { assignedRole: step.assignedRole });
        }

        // Diff roles A/C/I
        const origRolesStr = JSON.stringify([...orig.roles].sort((a, b) => a.role.localeCompare(b.role)));
        const newRolesStr  = JSON.stringify([...step.roles].sort((a, b) => a.role.localeCompare(b.role)));
        if (origRolesStr !== newRolesStr) {
          await raciMatrixApi.updateStepRoles(step.id, step.roles);
        }
      }

      // Sauvegarder le mur chinois (toujours full replace)
      await raciMatrixApi.updateChineseWall(
        editWallRules.map(({ blockedRole, forbiddenStep, reason }) => ({ blockedRole, forbiddenStep, reason }))
      );

      setEditing(false);
      setDirty(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!window.confirm('Désactiver cette étape ?')) return;
    try {
      await raciMatrixApi.deleteStep(stepId);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la suppression');
    }
  };

  const handleAddStep = async (step: NewStep) => {
    try {
      await raciMatrixApi.createStep(step);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la création');
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Matrice RACI — Processus Crédit</Typography>
          <Typography variant="body2" color="text.secondary">
            {matrix?.policy
              ? `Politique active : ${matrix.policy.name} (v${matrix.policy.version})`
              : 'Aucune politique active — créez une CreditPolicy pour commencer.'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {editing ? (
            <>
              <Button variant="outlined" size="small" startIcon={<CancelIcon />} onClick={cancelEditing}>Annuler</Button>
              <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={handleSave} disabled={!dirty}>
                Enregistrer
              </Button>
            </>
          ) : (
            <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={startEditing} disabled={!matrix?.policy}>
              Modifier
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {!matrix?.policy ? (
        <Alert severity="info">Aucune politique de crédit active. Rendez-vous dans <strong>Politique de Crédit</strong> pour en créer une.</Alert>
      ) : (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #E5E7EB' }}>
            <Tab label="Matrice RACI" />
            <Tab label="Mur Chinois" />
            <Tab label={`Étapes (${editSteps.length})`} />
          </Tabs>

          {tab === 0 && (
            <MatrixTab
              steps={editSteps}
              editing={editing}
              onCellChange={handleCellChange}
            />
          )}

          {tab === 1 && (
            <ChineseWallTab
              rules={editWallRules}
              steps={editSteps}
              editing={editing}
              onChange={handleWallRulesChange}
            />
          )}

          {tab === 2 && (
            <StepsTab
              steps={editSteps}
              onDelete={handleDeleteStep}
              onAdd={handleAddStep}
            />
          )}
        </>
      )}
    </Box>
  );
};

export default RACIMatrixPage;
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 3: Tester manuellement dans le navigateur**

Démarrer frontend + backend :
```bash
# Terminal 1
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npm run dev

# Terminal 2
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npm start
```

Scénarios à tester :
1. Se connecter avec `admin@bci.sn / Demo2024!` → naviguer vers Matrice RACI
2. Vérifier que les 3 onglets s'affichent et que les données BCI sont chargées
3. Cliquer "Modifier" → cliquer une cellule → assigner un code RACI → vérifier le changement visuel
4. Cliquer "Enregistrer" → vérifier que le changement est persisté après rechargement
5. Onglet Mur Chinois → activer un interdit → sauvegarder → vérifier en DB
6. Onglet Étapes → ajouter une étape → vérifier qu'elle apparaît dans la matrice

- [ ] **Step 4: Commit final**

```bash
git add src/pages/RACIMatrixPage.tsx
git commit -m "feat(raci): RACIMatrixPage dynamique — 3 onglets, éditable, données DB par tenant"
```

---

## Récapitulatif des commits attendus

1. `feat(raci): schema — CreditPolicyStepRole, TenantChineseWallRule, RaciCode enum`
2. `feat(raci): route /api/raci-matrix — 6 endpoints CRUD + mur chinois`
3. `feat(raci): canApproveStep lit le mur chinois depuis DB (TenantChineseWallRule)`
4. `feat(raci): seed mur chinois BCI + rôles A/C/I + étapes manquantes`
5. `feat(raci): service API frontend raciMatrixApi + méthode put générique`
6. `feat(raci): RACIMatrixPage dynamique — 3 onglets, éditable, données DB par tenant`
