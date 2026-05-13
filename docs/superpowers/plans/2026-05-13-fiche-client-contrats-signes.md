# Fiche client — contrats signés Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer les `Document category=CONTRACT` d'un client (toutes ses `CreditApplication` confondues, status APPROVED/DISBURSED/UNDER_REVIEW) via un nouvel onglet "Contrats" sur la fiche client, avec download restreint et audit log.

**Architecture:** Approche A du spec. Un nouveau endpoint dédié `GET /api/clients/:id/contracts` renvoie la liste avec un flag `canDownload` calculé serveur-side. La route `/api/documents/download/:id` est augmentée d'un gate de permission spécifique aux contrats + écriture `AuditLog`. Côté front, un onglet supplémentaire dans le drawer client charge un composant `ClientContractsPanel` qui rend une table MUI avec actions aperçu/download.

**Tech Stack:** Node.js / TypeScript / Express / Prisma / Jest (backend), React / TypeScript / MUI / axios (frontend).

**Spec:** `docs/superpowers/specs/2026-05-13-fiche-client-contrats-signes-design.md`

---

## File structure

- **Create**
  - `backend/src/services/contractAccess.ts` — helper pur `canDownloadContract(user, client)` + filtre statuts.
  - `backend/src/__tests__/contractAccess.test.ts` — tests unitaires du helper.
  - `backend/src/__tests__/clientContractsRoute.test.ts` — tests d'intégration de `GET /api/clients/:id/contracts` et du gate sur `/documents/download/:id`.
  - `src/components/client/ClientContractsPanel.tsx` — composant React de l'onglet Contrats.

- **Modify**
  - `backend/src/routes/clients.ts` — ajouter `GET /:id/contracts`.
  - `backend/src/routes/documents.ts` — gate de download + audit log sur `category=CONTRACT`.
  - `src/services/api.ts` — méthode `ApiService.getClientContracts(clientId)`.
  - `src/pages/ClientManagementPage.tsx` — 4ᵉ onglet "Contrats" dans le drawer.

---

## Task 1 — Helper d'autorisation `canDownloadContract`

**Files:**
- Create: `backend/src/services/contractAccess.ts`
- Create: `backend/src/__tests__/contractAccess.test.ts`

Un helper pur, sans dépendance Prisma ni Express, qui prend l'utilisateur et le client (créateur) et retourne un booléen. Permet de tester sans monter une base.

- [ ] **Step 1.1: Écrire le test qui échoue**

Créer `backend/src/__tests__/contractAccess.test.ts` :

```typescript
import { canDownloadContract, CONTRACT_DOWNLOAD_ROLES } from '../services/contractAccess';

describe('canDownloadContract', () => {
  const baseClient = {
    creator: { id: 'creator-1', branch: 'AGENCE_DAKAR', department: null as string | null },
  };

  it('autorise BACK_OFFICE quelle que soit la branche', () => {
    expect(
      canDownloadContract({ id: 'u1', role: 'BACK_OFFICE', branch: 'AGENCE_THIES', department: null }, baseClient)
    ).toBe(true);
  });

  it('autorise DIRECTION_JURIDIQUE', () => {
    expect(
      canDownloadContract({ id: 'u1', role: 'DIRECTION_JURIDIQUE', branch: null, department: 'JURIDIQUE' }, baseClient)
    ).toBe(true);
  });

  it('autorise ADMIN et SUPER_ADMIN', () => {
    expect(canDownloadContract({ id: 'u1', role: 'ADMIN', branch: null, department: null }, baseClient)).toBe(true);
    expect(canDownloadContract({ id: 'u2', role: 'SUPER_ADMIN', branch: null, department: null }, baseClient)).toBe(true);
  });

  it('autorise CHARGE_AFFAIRES de la même branche que le créateur', () => {
    expect(
      canDownloadContract(
        { id: 'u9', role: 'CHARGE_AFFAIRES', branch: 'AGENCE_DAKAR', department: null },
        baseClient
      )
    ).toBe(true);
  });

  it('refuse CHARGE_AFFAIRES d\'une autre branche', () => {
    expect(
      canDownloadContract(
        { id: 'u9', role: 'CHARGE_AFFAIRES', branch: 'AGENCE_THIES', department: null },
        baseClient
      )
    ).toBe(false);
  });

  it('refuse les autres rôles', () => {
    expect(
      canDownloadContract(
        { id: 'u9', role: 'ANALYSTE_RISQUES', branch: 'AGENCE_DAKAR', department: null },
        baseClient
      )
    ).toBe(false);
  });

  it('tolère department en fallback de branch', () => {
    const client = { creator: { id: 'creator-1', branch: null, department: 'AGENCE_DAKAR' } };
    expect(
      canDownloadContract(
        { id: 'u9', role: 'CHARGE_AFFAIRES', branch: null, department: 'AGENCE_DAKAR' },
        client
      )
    ).toBe(true);
  });

  it('refuse CHARGE_AFFAIRES sans branche/département renseigné', () => {
    expect(
      canDownloadContract(
        { id: 'u9', role: 'CHARGE_AFFAIRES', branch: null, department: null },
        baseClient
      )
    ).toBe(false);
  });

  it('expose la liste CONTRACT_DOWNLOAD_ROLES', () => {
    expect(CONTRACT_DOWNLOAD_ROLES).toEqual(
      expect.arrayContaining(['BACK_OFFICE', 'DIRECTION_JURIDIQUE', 'ADMIN', 'SUPER_ADMIN'])
    );
  });
});
```

- [ ] **Step 1.2: Lancer le test pour vérifier qu'il échoue**

Run: `cd backend && npx jest src/__tests__/contractAccess.test.ts`
Expected: FAIL — `Cannot find module '../services/contractAccess'`.

- [ ] **Step 1.3: Implémenter le helper**

Créer `backend/src/services/contractAccess.ts` :

```typescript
/**
 * contractAccess.ts
 *
 * Règles d'accès aux contrats signés (Document.category = CONTRACT)
 * affichés depuis la fiche client.
 *
 * - Listing + preview : tout utilisateur ayant accès à la fiche client.
 *   (Le filtre tenant + le scope client est appliqué côté route.)
 * - Téléchargement : restreint via canDownloadContract().
 *
 * Helper pur (pas de dépendance Prisma) pour testabilité.
 */

export const CONTRACT_DOWNLOAD_ROLES = [
  'BACK_OFFICE',
  'DIRECTION_JURIDIQUE',
  'ADMIN',
  'SUPER_ADMIN',
] as const;

export const CONTRACT_ELIGIBLE_APPLICATION_STATUSES = [
  'APPROVED',
  'DISBURSED',
  'UNDER_REVIEW',
] as const;

interface UserCtx {
  id: string;
  role: string;
  branch: string | null;
  department: string | null;
}

interface ClientCtx {
  creator: { id: string; branch: string | null; department: string | null };
}

/**
 * Retourne true si l'utilisateur a le droit de télécharger un contrat
 * appartenant au client donné.
 */
export function canDownloadContract(user: UserCtx, client: ClientCtx): boolean {
  if ((CONTRACT_DOWNLOAD_ROLES as readonly string[]).includes(user.role)) {
    return true;
  }
  if (user.role !== 'CHARGE_AFFAIRES') {
    return false;
  }
  const userScope    = user.branch    ?? user.department;
  const creatorScope = client.creator.branch ?? client.creator.department;
  if (!userScope || !creatorScope) return false;
  return userScope === creatorScope;
}

export const CONTRACT_DOWNLOAD_DENIED_MESSAGE =
  "Téléchargement réservé aux services Back-office / Juridique ou aux chargés d'affaires de l'agence concernée.";
```

- [ ] **Step 1.4: Relancer le test pour vérifier qu'il passe**

Run: `cd backend && npx jest src/__tests__/contractAccess.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 1.5: Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add backend/src/services/contractAccess.ts backend/src/__tests__/contractAccess.test.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(contracts): helper canDownloadContract avec règles d'accès

Helper pur testable qui code les règles d'accès au téléchargement des
contrats signés (BO/Juridique/Admin + CHARGE_AFFAIRES même agence)."
```

---

## Task 2 — Endpoint `GET /api/clients/:id/contracts`

**Files:**
- Modify: `backend/src/routes/clients.ts` (avant `export default router;` ligne 255)
- Create: `backend/src/__tests__/clientContractsRoute.test.ts` (test d'intégration)

- [ ] **Step 2.1: Écrire le test d'intégration**

Créer `backend/src/__tests__/clientContractsRoute.test.ts` (structure adaptée du test `scopeFilter.test.ts` existant pour réutiliser le pattern d'app Express + Prisma) :

```typescript
import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import clientsRouter from '../routes/clients';

// Mock du middleware d'auth : injecte req.user et req.companyId
jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = req.headers['x-test-user']
      ? JSON.parse(req.headers['x-test-user'] as string)
      : null;
    req.companyId = req.user?.companyId;
    next();
  },
  requireCompany: (req: any, res: any, next: any) =>
    req.companyId ? next() : res.status(403).end(),
}));

const prisma = new PrismaClient();

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/clients', clientsRouter);
  return app;
}

const COMPANY = 'company-test-contracts';
const BACK_OFFICE_USER = {
  id: 'u-bo', role: 'BACK_OFFICE', branch: null, department: null, companyId: COMPANY, permissions: [],
};
const CA_SAME_BRANCH = {
  id: 'u-ca1', role: 'CHARGE_AFFAIRES', branch: 'AGENCE_DAKAR', department: null, companyId: COMPANY, permissions: [],
};
const CA_OTHER_BRANCH = {
  id: 'u-ca2', role: 'CHARGE_AFFAIRES', branch: 'AGENCE_THIES', department: null, companyId: COMPANY, permissions: [],
};

describe('GET /api/clients/:id/contracts', () => {
  let clientId: string;
  let docContractApprovedId: string;
  let docContractDraftId: string;
  let docFinancialId: string;

  beforeAll(async () => {
    await prisma.company.create({ data: { id: COMPANY, name: 'Test Co', slug: 'test-co' } });
    // Note : creator user is required by Client.createdBy FK.
    await prisma.user.create({
      data: {
        id: 'u-creator', email: 'creator@test.local', password: 'x', name: 'Creator',
        role: 'CHARGE_AFFAIRES', branch: 'AGENCE_DAKAR', companyId: COMPANY,
      },
    });
    await prisma.user.createMany({
      data: [BACK_OFFICE_USER, CA_SAME_BRANCH, CA_OTHER_BRANCH].map(u => ({
        id: u.id, email: `${u.id}@test.local`, password: 'x', name: u.id, role: u.role as any,
        branch: u.branch, department: u.department, companyId: u.companyId,
      })),
    });

    const client = await prisma.client.create({
      data: {
        companyName: 'ACME', accountNumber: 'CLT-TEST-1', createdBy: 'u-creator', companyId: COMPANY,
      },
    });
    clientId = client.id;

    const appApproved = await prisma.creditApplication.create({
      data: {
        applicationNumber: 'DOS-T-1', clientId, amount: 1000, purpose: 'test',
        status: 'APPROVED', createdBy: 'u-creator', companyId: COMPANY,
      },
    });
    const appDraft = await prisma.creditApplication.create({
      data: {
        applicationNumber: 'DOS-T-2', clientId, amount: 1000, purpose: 'test',
        status: 'DRAFT', createdBy: 'u-creator', companyId: COMPANY,
      },
    });

    const docA = await prisma.document.create({
      data: {
        applicationId: appApproved.id, filename: 'contract-signed.pdf',
        filePath: '/tmp/contract-signed.pdf', mimeType: 'application/pdf',
        category: 'CONTRACT', uploadedBy: 'u-creator',
      },
    });
    docContractApprovedId = docA.id;
    const docB = await prisma.document.create({
      data: {
        applicationId: appDraft.id, filename: 'contract-draft.pdf',
        filePath: '/tmp/contract-draft.pdf', mimeType: 'application/pdf',
        category: 'CONTRACT', uploadedBy: 'u-creator',
      },
    });
    docContractDraftId = docB.id;
    const docC = await prisma.document.create({
      data: {
        applicationId: appApproved.id, filename: 'balance.pdf',
        filePath: '/tmp/balance.pdf', mimeType: 'application/pdf',
        category: 'FINANCIAL', uploadedBy: 'u-creator',
      },
    });
    docFinancialId = docC.id;
  });

  afterAll(async () => {
    await prisma.document.deleteMany({ where: { application: { companyId: COMPANY } } });
    await prisma.creditApplication.deleteMany({ where: { companyId: COMPANY } });
    await prisma.client.deleteMany({ where: { companyId: COMPANY } });
    await prisma.user.deleteMany({ where: { companyId: COMPANY } });
    await prisma.user.deleteMany({ where: { id: 'u-creator' } });
    await prisma.company.delete({ where: { id: COMPANY } });
    await prisma.$disconnect();
  });

  it('renvoie uniquement les contrats des dossiers APPROVED/DISBURSED/UNDER_REVIEW', async () => {
    const res = await request(makeApp())
      .get(`/api/clients/${clientId}/contracts`)
      .set('x-test-user', JSON.stringify(BACK_OFFICE_USER));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = res.body.contracts.map((c: any) => c.id);
    expect(ids).toContain(docContractApprovedId);
    expect(ids).not.toContain(docContractDraftId);  // dossier DRAFT exclu
    expect(ids).not.toContain(docFinancialId);      // category != CONTRACT exclu
  });

  it('expose canDownload=true pour BACK_OFFICE', async () => {
    const res = await request(makeApp())
      .get(`/api/clients/${clientId}/contracts`)
      .set('x-test-user', JSON.stringify(BACK_OFFICE_USER));
    expect(res.body.contracts[0].canDownload).toBe(true);
  });

  it('expose canDownload=true pour CHARGE_AFFAIRES de la même branche', async () => {
    const res = await request(makeApp())
      .get(`/api/clients/${clientId}/contracts`)
      .set('x-test-user', JSON.stringify(CA_SAME_BRANCH));
    expect(res.status).toBe(200);
    expect(res.body.contracts[0].canDownload).toBe(true);
  });

  it('expose canDownload=false pour CHARGE_AFFAIRES d\'une autre branche (s\'il voit le client)', async () => {
    // CA_OTHER_BRANCH ne verra pas le client (scope CREATOR_ONLY) : 404 attendu.
    const res = await request(makeApp())
      .get(`/api/clients/${clientId}/contracts`)
      .set('x-test-user', JSON.stringify(CA_OTHER_BRANCH));
    expect(res.status).toBe(404);
  });

  it('renvoie 404 si le client appartient à un autre tenant', async () => {
    const res = await request(makeApp())
      .get(`/api/clients/${clientId}/contracts`)
      .set('x-test-user', JSON.stringify({ ...BACK_OFFICE_USER, companyId: 'other-company' }));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2.2: Lancer le test pour vérifier qu'il échoue**

Run: `cd backend && npx jest src/__tests__/clientContractsRoute.test.ts`
Expected: FAIL — route 404 sur tous les cas (l'endpoint n'existe pas encore).

- [ ] **Step 2.3: Implémenter le endpoint**

Modifier `backend/src/routes/clients.ts` — **avant** `export default router;` (ligne 255), insérer :

```typescript
import {
  canDownloadContract,
  CONTRACT_ELIGIBLE_APPLICATION_STATUSES,
} from '../services/contractAccess';

// ... existing routes ...

// GET /api/clients/:id/contracts — contrats signés (Document category=CONTRACT)
// de toutes les applications éligibles du client.
router.get('/:id/contracts', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const baseWhere = buildClientWhereFilter(req);

    const client = await prisma.client.findFirst({
      where: { id, ...baseWhere },
      include: {
        creator: { select: { id: true, branch: true, department: true } },
        applications: {
          where: { status: { in: [...CONTRACT_ELIGIBLE_APPLICATION_STATUSES] } },
          include: {
            creditType: { select: { name: true } },
            documents: {
              where: { category: 'CONTRACT' },
              include: { uploader: { select: { id: true, name: true } } },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ success: false, error: 'Client non trouvé' });
    }

    const userCtx = {
      id:         req.user!.id,
      role:       req.user!.role as string,
      branch:     (req.user as any).branch ?? null,
      department: (req.user as any).department ?? null,
    };
    const clientCtx = {
      creator: {
        id:         client.creator.id,
        branch:     client.creator.branch ?? null,
        department: client.creator.department ?? null,
      },
    };
    const canDl = canDownloadContract(userCtx, clientCtx);

    const contracts = client.applications.flatMap(app =>
      app.documents.map(doc => ({
        id:        doc.id,
        filename:  doc.filename,
        mimeType:  doc.mimeType,
        fileSize:  doc.fileSize,
        createdAt: doc.createdAt,
        uploadedBy: { id: doc.uploader.id, name: doc.uploader.name },
        application: {
          id:                app.id,
          applicationNumber: app.applicationNumber,
          status:            app.status,
          amount:            Number(app.amount),
          creditTypeName:    app.creditType?.name ?? null,
        },
        previewUrl:  `/api/documents/preview/${doc.id}`,
        downloadUrl: `/api/documents/download/${doc.id}`,
        canDownload: canDl,
      }))
    );

    res.json({ success: true, contracts });
  } catch (error) {
    console.error('Error fetching client contracts:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des contrats' });
  }
});
```

Note : `req.user` ne contient pas nativement `branch`/`department` dans le type Express déclaré (`backend/src/middleware/auth.ts`). On lit via cast `(req.user as any)` ; pour une lecture stricte, il faut élargir le type — voir Task 2.4 optionnelle.

- [ ] **Step 2.4: Élargir le type Request.user pour exposer branch et department**

Modifier `backend/src/middleware/auth.ts`, lignes 11-18 :

```typescript
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
        companyId?: string;
        branch?: string | null;
        department?: string | null;
        readOnly?: boolean;
      };
      companyId?: string;  // shortcut for req.user.companyId
    }
```

Puis dans la fonction `authenticate` (vers ligne 110), enrichir l'objet `req.user`. Trouver le bloc :

```typescript
    req.user = {
      id: user.id,
      ...
    };
```

et ajouter `branch: user.branch, department: user.department` au payload (le `User` chargé depuis Prisma doit déjà avoir ces colonnes — sinon ajuster le `select`). Si la lecture user actuelle utilise `prisma.user.findUnique({ where, select: {...} })`, ajouter `branch: true, department: true` au `select`.

Une fois élargi, remplacer dans la nouvelle route :

```typescript
      branch:     (req.user as any).branch ?? null,
      department: (req.user as any).department ?? null,
```

par :

```typescript
      branch:     req.user!.branch ?? null,
      department: req.user!.department ?? null,
```

- [ ] **Step 2.5: Lancer les tests**

Run: `cd backend && npx jest src/__tests__/clientContractsRoute.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 2.6: Lancer tsc pour vérifier la compilation globale**

Run: `cd backend && npx tsc --noEmit`
Expected: aucun output (exit 0).

- [ ] **Step 2.7: Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add backend/src/routes/clients.ts backend/src/middleware/auth.ts backend/src/__tests__/clientContractsRoute.test.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(clients): endpoint GET /clients/:id/contracts

Liste les Document category=CONTRACT des applications APPROVED/DISBURSED/
UNDER_REVIEW du client. canDownload calculé serveur-side via le helper
contractAccess. Élargit req.user pour exposer branch et department."
```

---

## Task 3 — Gate de download + audit log sur `/documents/download/:id`

**Files:**
- Modify: `backend/src/routes/documents.ts` lignes 143-165
- Modify: `backend/src/__tests__/clientContractsRoute.test.ts` (ajouter cas de download)

- [ ] **Step 3.1: Ajouter les tests de download au fichier d'intégration existant**

Compléter `backend/src/__tests__/clientContractsRoute.test.ts` avec un nouveau `describe` :

```typescript
import documentsRouter from '../routes/documents';
import fs from 'fs';
import path from 'path';

// Réutiliser makeApp() en montant aussi /api/documents
function makeFullApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/clients', clientsRouter);
  app.use('/api/documents', documentsRouter);
  return app;
}

describe('GET /api/documents/download/:id — gate contrat', () => {
  // S'appuie sur les fixtures du describe précédent (companyId/docContractApprovedId).
  // Si Jest isole les beforeAll/afterAll par describe, déplacer le setup dans un beforeAll global.

  beforeAll(() => {
    // S'assurer que le fichier existe sur disque
    fs.mkdirSync('/tmp', { recursive: true });
    fs.writeFileSync('/tmp/contract-signed.pdf', '%PDF-1.4\nfake');
  });

  it('autorise BACK_OFFICE et écrit un AuditLog', async () => {
    const before = await prisma.auditLog.count({ where: { action: 'CONTRACT_DOWNLOAD' } });
    const res = await request(makeFullApp())
      .get(`/api/documents/download/${docContractApprovedId}`)
      .set('x-test-user', JSON.stringify(BACK_OFFICE_USER));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');

    const after = await prisma.auditLog.count({ where: { action: 'CONTRACT_DOWNLOAD' } });
    expect(after).toBe(before + 1);
  });

  it('autorise CHARGE_AFFAIRES de la même branche', async () => {
    const res = await request(makeFullApp())
      .get(`/api/documents/download/${docContractApprovedId}`)
      .set('x-test-user', JSON.stringify(CA_SAME_BRANCH));
    expect(res.status).toBe(200);
  });

  it('refuse CHARGE_AFFAIRES d\'une autre branche', async () => {
    const res = await request(makeFullApp())
      .get(`/api/documents/download/${docContractApprovedId}`)
      .set('x-test-user', JSON.stringify(CA_OTHER_BRANCH));
    expect(res.status).toBe(403);
  });

  it('comportement inchangé pour les non-contrats', async () => {
    fs.writeFileSync('/tmp/balance.pdf', 'fake');
    const res = await request(makeFullApp())
      .get(`/api/documents/download/${docFinancialId}`)
      .set('x-test-user', JSON.stringify(CA_OTHER_BRANCH));
    expect(res.status).toBe(200);
  });
});
```

(Si les fixtures du premier describe ne sont pas accessibles, factoriser en `beforeAll` au niveau du fichier.)

- [ ] **Step 3.2: Lancer le test pour vérifier qu'il échoue**

Run: `cd backend && npx jest src/__tests__/clientContractsRoute.test.ts -t "gate contrat"`
Expected: FAIL — actuellement la route /download/:id n'a aucun gate, le CHARGE_AFFAIRES d'une autre branche obtient un 200 au lieu du 403 attendu, et aucun audit log n'est créé.

- [ ] **Step 3.3: Implémenter le gate**

Remplacer dans `backend/src/routes/documents.ts` le bloc lignes 142-165 par :

```typescript
import { Prisma } from '@prisma/client';
import {
  canDownloadContract,
  CONTRACT_DOWNLOAD_DENIED_MESSAGE,
} from '../services/contractAccess';

// ... existing code ...

// Download document (forces download)
router.get('/download/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            client: {
              include: {
                creator: { select: { id: true, branch: true, department: true } },
              },
            },
          },
        },
      },
    });

    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Gate spécifique aux contrats signés
    if (document.category === 'CONTRACT') {
      const client = document.application.client;
      if (client.companyId !== req.user!.companyId) {
        throw new AppError('Forbidden', 403, 'CROSS_TENANT');
      }
      const allowed = canDownloadContract(
        {
          id:         req.user!.id,
          role:       req.user!.role as string,
          branch:     req.user!.branch ?? null,
          department: req.user!.department ?? null,
        },
        {
          creator: {
            id:         client.creator.id,
            branch:     client.creator.branch ?? null,
            department: client.creator.department ?? null,
          },
        }
      );
      if (!allowed) {
        throw new AppError(CONTRACT_DOWNLOAD_DENIED_MESSAGE, 403, 'CONTRACT_DOWNLOAD_FORBIDDEN');
      }

      // Audit log — best effort, ne doit pas bloquer la livraison du fichier.
      try {
        await prisma.auditLog.create({
          data: {
            userId:        req.user!.id,
            applicationId: document.applicationId,
            action:        'CONTRACT_DOWNLOAD',
            entityType:    'document',
            entityId:      document.id,
            oldValues:     Prisma.JsonNull,
            newValues:     { filename: document.filename, clientId: client.id },
            ipAddress:     req.ip ?? null,
            userAgent:     req.get('user-agent') ?? null,
          },
        });
      } catch (auditErr) {
        logger.warn('AuditLog CONTRACT_DOWNLOAD a échoué (download poursuivi)', { err: String(auditErr), documentId: id });
      }
    }

    if (!fs.existsSync(document.filePath)) {
      throw new AppError('File not found on disk', 404, 'FILE_NOT_FOUND');
    }

    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');

    const fileStream = fs.createReadStream(document.filePath);
    fileStream.pipe(res);

    logger.info('Document downloaded', { documentId: id, filename: document.filename, downloadedBy: req.user!.id });
  })
);
```

- [ ] **Step 3.4: Lancer les tests**

Run: `cd backend && npx jest src/__tests__/clientContractsRoute.test.ts`
Expected: PASS (tous, listing + gate).

- [ ] **Step 3.5: Vérification TypeScript globale**

Run: `cd backend && npx tsc --noEmit`
Expected: aucun output.

- [ ] **Step 3.6: Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add backend/src/routes/documents.ts backend/src/__tests__/clientContractsRoute.test.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(documents): gate download + audit log pour contrats signés

Pour Document.category=CONTRACT, le téléchargement est restreint à
BO/Juridique/Admin/SUPER_ADMIN et aux CHARGE_AFFAIRES de la même agence
que le créateur du client. Chaque download autorisé écrit un AuditLog
(action CONTRACT_DOWNLOAD)."
```

---

## Task 4 — Méthode `ApiService.getClientContracts`

**Files:**
- Modify: `src/services/api.ts` (autour de `getClientById` ligne 1657)

- [ ] **Step 4.1: Ajouter la méthode**

Dans `src/services/api.ts`, juste après `getClientById`, ajouter :

```typescript
  static async getClientContracts(clientId: string): Promise<{
    success: boolean;
    contracts: Array<{
      id: string;
      filename: string;
      mimeType: string | null;
      fileSize: number | null;
      createdAt: string;
      uploadedBy: { id: string; name: string };
      application: {
        id: string;
        applicationNumber: string;
        status: string;
        amount: number;
        creditTypeName: string | null;
      };
      previewUrl: string;
      downloadUrl: string;
      canDownload: boolean;
    }>;
  }> {
    try {
      const response = await api.get(`/clients/${clientId}/contracts`);
      return response.data;
    } catch (error) {
      console.error('getClientContracts error:', error);
      throw error;
    }
  }
```

- [ ] **Step 4.2: Vérifier la compilation côté front**

Run: `npx tsc --noEmit -p .` (depuis la racine du projet)
Expected: aucun output.

- [ ] **Step 4.3: Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/services/api.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(api): ApiService.getClientContracts(clientId)

Wrapper TypeScript pour GET /api/clients/:id/contracts."
```

---

## Task 5 — Composant `ClientContractsPanel`

**Files:**
- Create: `src/components/client/ClientContractsPanel.tsx`

- [ ] **Step 5.1: Créer le composant**

```tsx
import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Chip, CircularProgress, IconButton, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import { ApiService } from '../../services/api';

interface ContractRow {
  id: string;
  filename: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
  uploadedBy: { id: string; name: string };
  application: {
    id: string;
    applicationNumber: string;
    status: string;
    amount: number;
    creditTypeName: string | null;
  };
  previewUrl: string;
  downloadUrl: string;
  canDownload: boolean;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED:     { label: 'Approuvé',     color: '#065f46', bg: '#d1fae5' },
  DISBURSED:    { label: 'Décaissé',     color: '#1e3a8a', bg: '#dbeafe' },
  UNDER_REVIEW: { label: 'En instruction', color: '#92400e', bg: '#fef3c7' },
};

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

const DOWNLOAD_RESERVED_TOOLTIP =
  "Téléchargement réservé aux services Back-office / Juridique ou aux chargés d'affaires de l'agence concernée.";

export function ClientContractsPanel({ clientId }: { clientId: string }) {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    ApiService.getClientContracts(clientId)
      .then((res) => {
        if (cancelled) return;
        setContracts(res.contracts);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.error ?? 'Erreur lors du chargement des contrats');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>;
  }

  if (contracts.length === 0) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        Aucun contrat signé pour ce client.
      </Alert>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none' }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: '#f8fafc' }}>
            <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Dossier</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Fichier</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Type</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Date</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 12 }} align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {contracts.map((c) => {
            const status = STATUS_LABELS[c.application.status] ?? { label: c.application.status, color: '#374151', bg: '#f3f4f6' };
            return (
              <TableRow key={c.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#1f4e79' }}>
                      {c.application.applicationNumber}
                    </Typography>
                    <Chip
                      label={status.label}
                      size="small"
                      sx={{ fontSize: 10, height: 20, fontWeight: 600, bgcolor: status.bg, color: status.color, border: 'none' }}
                    />
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 12.5 }}>{c.filename}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatSize(c.fileSize)}</Typography>
                </TableCell>
                <TableCell sx={{ fontSize: 12 }}>{c.application.creditTypeName ?? '—'}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{formatDate(c.createdAt)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Aperçu">
                    <IconButton size="small" onClick={() => window.open(c.previewUrl, '_blank', 'noopener')}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={c.canDownload ? 'Télécharger' : DOWNLOAD_RESERVED_TOOLTIP}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={!c.canDownload}
                        onClick={() => { window.location.href = c.downloadUrl; }}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
```

- [ ] **Step 5.2: Compilation TypeScript**

Run: `npx tsc --noEmit -p .`
Expected: aucun output.

- [ ] **Step 5.3: Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/components/client/ClientContractsPanel.tsx
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(client): composant ClientContractsPanel

Table MUI listant les contrats signés d'un client avec actions aperçu
(libre) et téléchargement (désactivé si canDownload=false côté API)."
```

---

## Task 6 — Brancher l'onglet "Contrats" dans le drawer client

**Files:**
- Modify: `src/pages/ClientManagementPage.tsx` (lignes ~955-960 pour Tabs, après la zone `{drawerTab === 2 && ...}` pour le panneau)

- [ ] **Step 6.1: Importer le composant**

En haut de `src/pages/ClientManagementPage.tsx`, dans la zone d'imports relatifs :

```typescript
import { ClientContractsPanel } from '../components/client/ClientContractsPanel';
```

- [ ] **Step 6.2: Ajouter le 4ᵉ onglet**

Remplacer lignes 955-959 :

```typescript
            <Tabs value={drawerTab} onChange={(_, v) => setDrawerTab(v)} variant="fullWidth">
              <Tab label="Identité" sx={{ fontSize: '13px' }} />
              <Tab label="Dossiers" sx={{ fontSize: '13px' }} />
              <Tab label="Échéancier" sx={{ fontSize: '13px' }} />
            </Tabs>
```

par :

```typescript
            <Tabs value={drawerTab} onChange={(_, v) => setDrawerTab(v)} variant="fullWidth">
              <Tab label="Identité" sx={{ fontSize: '13px' }} />
              <Tab label="Dossiers" sx={{ fontSize: '13px' }} />
              <Tab label="Échéancier" sx={{ fontSize: '13px' }} />
              <Tab label="Contrats" sx={{ fontSize: '13px' }} />
            </Tabs>
```

- [ ] **Step 6.3: Ajouter le rendu du panneau**

Repérer la fin du bloc `{drawerTab === 2 && (...)}` (vers ligne 1105+, panneau Échéancier — terminer par sa balise fermante `)}`). Juste **après**, insérer :

```typescript
              {/* Onglet Contrats */}
              {drawerTab === 3 && drawerClient && (
                <ClientContractsPanel clientId={drawerClient.id} />
              )}
```

- [ ] **Step 6.4: Compilation TypeScript**

Run: `npx tsc --noEmit -p .`
Expected: aucun output.

- [ ] **Step 6.5: Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/pages/ClientManagementPage.tsx
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(client): onglet \"Contrats\" dans le drawer fiche client

Quatrième onglet du drawer client qui rend ClientContractsPanel."
```

---

## Task 7 — Smoke test manuel + push

**Files:** aucun.

- [ ] **Step 7.1: Lancer le backend et le frontend en dev**

```bash
# Terminal 1
cd backend && npm run dev
# Terminal 2
npm run dev
```

- [ ] **Step 7.2: Vérifier le flow utilisateur**

Sur l'UI :
1. Se connecter en tant que **BACK_OFFICE** → ouvrir une fiche client qui possède un dossier APPROVED ou DISBURSED avec un Document `CONTRACT`. Aller sur l'onglet "Contrats". Vérifier l'apparition de la ligne, du chip statut, des actions aperçu (ouvre le PDF inline) et download (déclenche le download).
2. Se connecter en tant que **CHARGE_AFFAIRES** de la même agence → onglet "Contrats" → vérifier que download fonctionne.
3. Se connecter en tant que **CHARGE_AFFAIRES** d'une autre agence → vérifier que le scope client masque déjà la fiche (le client n'apparaît pas dans la liste). Si jamais il y accède, l'onglet "Contrats" doit présenter le bouton download grisé avec tooltip.
4. Côté DB, vérifier qu'un `AuditLog` (`action='CONTRACT_DOWNLOAD'`) a été créé pour chaque download réussi :
   ```sql
   SELECT user_id, action, entity_id, new_values, created_at
   FROM audit_logs
   WHERE action='CONTRACT_DOWNLOAD'
   ORDER BY created_at DESC LIMIT 5;
   ```

- [ ] **Step 7.3: Lancer toute la suite de tests backend**

Run: `cd backend && npx jest`
Expected: pas de régression sur la suite existante ; nouveaux tests verts.

- [ ] **Step 7.4: Push**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC push origin release/v1.0
```

---

## Self-Review checklist

- **Spec section 2 (source de vérité)** → couvert par Task 2 (filtre `category=CONTRACT` + statuts).
- **Spec section 3.1 (endpoint)** → Task 2.
- **Spec section 3.2 (gate download)** → Task 3.
- **Spec section 3.3 (audit log)** → Task 3.3 (bloc `try/catch` audit).
- **Spec section 3.4 (matrice perms)** → couvert par helper Task 1 + tests.
- **Spec section 4 (frontend)** → Tasks 5 et 6.
- **Spec section 6 (limites preview)** → comportement par défaut (preview ouvert) implémenté tel quel.
- **Spec section 7 (tests)** → couvert par Tasks 1, 2 et 3.
- **Spec section 8 (migration)** → aucune (pas de schéma touché).

Pas de placeholder, pas de step "TBD", chaque step contient soit du code complet soit une commande exacte. Les noms (`canDownloadContract`, `CONTRACT_ELIGIBLE_APPLICATION_STATUSES`, `CONTRACT_DOWNLOAD_DENIED_MESSAGE`) sont cohérents entre Task 1, Task 2 et Task 3.
