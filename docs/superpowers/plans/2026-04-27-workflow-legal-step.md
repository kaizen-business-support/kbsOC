# Étape juridique (LEGAL) + génération de contrats — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un type d'étape `LEGAL` au workflow editor, livrer une page de gestion de modèles de contrats (DOCX avec variables de fusion + PDF statiques), et permettre au juridique de générer/signer (manuellement ou via DocuSeal) ces contrats sur les dossiers en cours.

**Architecture:** Backend Express + Prisma (nouveaux modèles `ContractTemplate`, `GeneratedContract`, `ContractSignatory`, `WebhookEventLog` ; nouvelles routes `/api/contract-templates` et `/api/contracts` ; services dédiés pour extraction/fusion/signature). Frontend React + MUI (nouvelle page `ContractTemplatesPage`, nouvelle vue `LegalStepPage`, ajout du type `LEGAL` dans le `WorkflowPolicyBuilder` existant). Couche d'abstraction `SignatureProvider` avec implémentation `DocuSealProvider` (open source, AGPLv3).

**Tech Stack:** Node.js 20 + Express + Prisma 6 + PostgreSQL (existant). Nouvelles deps : `docxtemplater@^3` + `pizzip@^3` (génération .docx, MIT) ; `number-to-words-fr` (montant en lettres). React 18 + TypeScript + MUI (existant).

**Spec source:** `docs/superpowers/specs/2026-04-27-workflow-legal-step-design.md`

**Rollout :** 3 phases (la migration DB est complète dès phase 1, la fonctionnalité est exposée progressivement côté UI).

---

## File Structure (cible finale)

### Backend — créés
```
backend/prisma/migrations/<ts>_add_legal_step_and_contracts/migration.sql
backend/src/utils/encryption.ts
backend/src/constants/contractVariables.ts
backend/src/services/contractTemplateService.ts
backend/src/services/contractGenerationService.ts
backend/src/services/signatureService.ts
backend/src/services/providers/docusealProvider.ts
backend/src/routes/contract-templates.ts
backend/src/routes/contracts.ts
backend/src/__tests__/encryption.test.ts
backend/src/__tests__/contractTemplateService.test.ts
backend/src/__tests__/contractGenerationService.test.ts
backend/src/__tests__/docusealProvider.test.ts
backend/jest.config.js
backend/uploads/contract-templates/.gitkeep
backend/uploads/contracts/.gitkeep
```

### Backend — modifiés
```
backend/prisma/schema.prisma                  # enums + 4 nouveaux modèles + 2 colonnes Company
backend/prisma/seed-bci.js                    # 3 nouvelles permissions sur juridique/admin
backend/package.json                          # 3 deps + script test
backend/src/server.ts                         # mount routes + mkdirSync uploads
backend/src/middleware/auditLogger.ts         # 6 nouveaux types d'événements
```

### Frontend — créés
```
src/pages/ContractTemplatesPage.tsx
src/pages/LegalStepPage.tsx
src/components/contracts/ContractTemplateUploadDialog.tsx
src/components/contracts/ContractTemplateEditDialog.tsx
src/components/contracts/VariableCatalogPanel.tsx
src/components/contracts/GenerateContractDialog.tsx
src/components/contracts/ContractSignatoriesDialog.tsx
src/components/contracts/SendForSignatureDialog.tsx
src/components/contracts/ContractStatusChip.tsx
src/components/contracts/ContractsListOnApplication.tsx
src/types/contracts.ts
```

### Frontend — modifiés
```
src/services/api.ts                                    # contractTemplateApi + contractApi
src/types/creditPolicyBuilder.ts                       # LEGAL dans STEP_TYPE_CONFIG
src/types/index.ts                                     # PageType union
src/contexts/AppContext.tsx                            # routes
src/components/Sidebar.tsx                             # entrée Modèles de contrats
src/components/Header.tsx                              # titres pages
src/components/workflow-builder/StepPalette.tsx        # icône LEGAL
src/components/workflow-builder/StepConfigPanel.tsx    # LEGAL dans Select
src/pages/ApprovalsPage.tsx                            # bouton "Ouvrir étape juridique"
src/App.tsx                                            # routes guards
```

---

# PHASE 1 — Fondations & page Modèles

## Task 1: Schéma Prisma + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<ts>_add_legal_step_and_contracts/migration.sql` (généré)

- [ ] **Step 1: Ajouter `LEGAL` à l'enum `PolicyStepType`**

```prisma
enum PolicyStepType {
  CREATION   @map("creation")
  DISPATCH   @map("dispatch")
  ANALYSIS   @map("analysis")
  APPROVAL   @map("approval")
  COMMITTEE  @map("committee")
  LEGAL      @map("legal")
  @@map("policy_step_type")
}
```

- [ ] **Step 2: Ajouter `CONTRACT` à `DocumentCategory`**

Ajouter `CONTRACT @map("contract")` à l'enum `DocumentCategory`.

- [ ] **Step 3: Ajouter 2 colonnes sur `Company`**

```prisma
signatureProviderConfig Json?   @map("signature_provider_config")
legalRepresentative     String? @map("legal_representative")
```

- [ ] **Step 4: Ajouter les 4 nouveaux modèles + 5 enums associés**

Coller à la fin du fichier (avant le `@@map` final s'il y en a). Voir spec section 3.2 pour la définition complète des modèles `ContractTemplate`, `GeneratedContract`, `ContractSignatory`, `WebhookEventLog` et enums `ContractFileFormat`, `ContractStatus`, `SignatureMode`, `SignatoryParty`, `SignatoryStatus`. Reprendre tel quel les blocs de la spec.

- [ ] **Step 5: Ajouter les relations inverses sur `CreditApplication`, `Document`, `User`**

`CreditApplication` : `generatedContracts GeneratedContract[]`
`Document` : `contractRef GeneratedContract? @relation("ContractDocument")`
`User` : `generatedContracts GeneratedContract[] @relation("UserGeneratedContracts")`

- [ ] **Step 6: Générer la migration**

```bash
cd backend && npx prisma migrate dev --name add_legal_step_and_contracts
```
Expected: `Applied migration(s)` + `Generated Prisma Client`.

- [ ] **Step 7: Vérifier que le client compile**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(db): ajout schéma étape LEGAL + modèles de contrats"
```

---

## Task 2: Setup Jest + utilitaire de chiffrement (TDD)

**Files:**
- Create: `backend/jest.config.js`
- Create: `backend/src/utils/encryption.ts`
- Create: `backend/src/__tests__/encryption.test.ts`

- [ ] **Step 1: `backend/jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  testTimeout: 10000,
};
```

- [ ] **Step 2: Écrire le test d'aller-retour AES-256-GCM**

```ts
// backend/src/__tests__/encryption.test.ts
import { encrypt, decrypt } from '../utils/encryption';

describe('encryption', () => {
  beforeAll(() => { process.env.SIGNATURE_PROVIDER_ENCRYPTION_KEY = '0'.repeat(64); });

  it('chiffre puis déchiffre', () => {
    const plain = '{"apiKey":"sk_test_abc"}';
    const cipher = encrypt(plain);
    expect(cipher).not.toEqual(plain);
    expect(decrypt(cipher)).toEqual(plain);
  });

  it('produit un chiffré différent à chaque appel (IV aléatoire)', () => {
    expect(encrypt('hello')).not.toEqual(encrypt('hello'));
  });

  it('rejette un chiffré altéré', () => {
    const c = encrypt('hello');
    expect(() => decrypt(c.slice(0, -2) + 'XX')).toThrow();
  });
});
```

- [ ] **Step 3: Confirmer FAIL**

```bash
cd backend && npx jest encryption.test.ts
```

- [ ] **Step 4: Implémenter `encryption.ts`**

```ts
import crypto from 'crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;

function getKey(): Buffer {
  const hex = process.env.SIGNATURE_PROVIDER_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('SIGNATURE_PROVIDER_ENCRYPTION_KEY manquant ou invalide (32 bytes hex)');
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, encB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !encB64) throw new Error('Format invalide');
  const decipher = crypto.createDecipheriv(ALG, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(encB64, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}
```

- [ ] **Step 5: Tests passent**

```bash
cd backend && npx jest encryption.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add backend/jest.config.js backend/src/utils/encryption.ts backend/src/__tests__/encryption.test.ts
git commit -m "feat(crypto): util AES-256-GCM pour secrets fournisseur signature"
```

---

## Task 3: Catalogue des variables de fusion

**Files:**
- Create: `backend/src/constants/contractVariables.ts`

- [ ] **Step 1: Définir le catalogue fixe**

```ts
export const VARIABLE_CATALOG = {
  client: ['companyName', 'rccm', 'ninea', 'legalForm', 'headquarters', 'contactPerson', 'phone', 'email'],
  application: ['applicationNumber', 'amount', 'amountInWords', 'currency', 'purpose', 'durationMonths',
                'proposedRate', 'collateralType', 'collateralValue', 'repaymentSchedule'],
  bank: ['name', 'headquarters', 'legalRepresentative', 'rccm'],
  meta: ['generatedAt', 'creditType'],
} as const;

export type CatalogGroup = keyof typeof VARIABLE_CATALOG;

export function flattenedCatalog(): string[] {
  return Object.entries(VARIABLE_CATALOG).flatMap(([g, fields]) => fields.map((f) => `${g}.${f}`));
}

export function isCatalogVariable(name: string): boolean {
  return new Set(flattenedCatalog()).has(name);
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/constants/contractVariables.ts
git commit -m "feat(contracts): catalogue de variables de fusion (4 groupes)"
```

---

## Task 4: `contractTemplateService` — extraction + classification + validation (TDD)

**Files:**
- Create: `backend/src/services/contractTemplateService.ts`
- Create: `backend/src/__tests__/contractTemplateService.test.ts`

- [ ] **Step 1: Installer les dépendances**

```bash
cd backend && npm install docxtemplater@^3 pizzip@^3
```

- [ ] **Step 2: Tests**

```ts
// backend/src/__tests__/contractTemplateService.test.ts
import {
  extractVariablesFromText, classifyVariables, validateMagicBytes,
} from '../services/contractTemplateService';

describe('extractVariablesFromText', () => {
  it('extrait les variables simples', () => {
    expect(extractVariablesFromText('Hello {{client.name}}, {{ application.amount }}'))
      .toEqual(['client.name', 'application.amount']);
  });
  it('dédupe les répétitions', () => {
    expect(extractVariablesFromText('{{x}} et {{x}}')).toEqual(['x']);
  });
  it('ignore les chaînes mal formées', () => {
    expect(extractVariablesFromText('{single} {{ } } { {a }')).toEqual([]);
  });
});

describe('classifyVariables', () => {
  it('sépare catalogue fixe vs custom', () => {
    const r = classifyVariables(['client.companyName', 'application.amount', 'echeance', 'foo.bar']);
    expect(r.catalog).toEqual(['client.companyName', 'application.amount']);
    expect(r.custom).toEqual(['echeance', 'foo.bar']);
  });
});

describe('validateMagicBytes', () => {
  it('accepte un en-tête DOCX (PK\\x03\\x04)', () => {
    expect(validateMagicBytes(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0]), 'DOCX')).toBe(true);
  });
  it('accepte un en-tête PDF (%PDF)', () => {
    expect(validateMagicBytes(Buffer.from('%PDF-1.7\n', 'utf8'), 'PDF')).toBe(true);
  });
  it('rejette un fichier déguisé', () => {
    expect(validateMagicBytes(Buffer.from('plain text', 'utf8'), 'DOCX')).toBe(false);
    expect(validateMagicBytes(Buffer.from('plain text', 'utf8'), 'PDF')).toBe(false);
  });
});
```

- [ ] **Step 3: Confirmer FAIL**

```bash
cd backend && npx jest contractTemplateService.test.ts
```

- [ ] **Step 4: Implémenter le service**

```ts
// backend/src/services/contractTemplateService.ts
import fs from 'fs';
import PizZip from 'pizzip';
import { isCatalogVariable } from '../constants/contractVariables';

const VAR_RE = /\{\{\s*([\w][\w.]*)\s*\}\}/g;

export function extractVariablesFromText(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(VAR_RE)) {
    if (!seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); }
  }
  return out;
}

export function extractVariablesFromDocx(filePath: string): string[] {
  const data = fs.readFileSync(filePath);
  const zip = new PizZip(data);
  const xml = zip.file('word/document.xml')?.asText() ?? '';
  // Word fragmente parfois les {{...}} entre runs : strip XML pour reconstruire le texte
  const text = xml.replace(/<[^>]+>/g, '');
  return extractVariablesFromText(text);
}

export function classifyVariables(vars: string[]): { catalog: string[]; custom: string[] } {
  const catalog: string[] = [];
  const custom: string[] = [];
  for (const v of vars) (isCatalogVariable(v) ? catalog : custom).push(v);
  return { catalog, custom };
}

export function validateMagicBytes(buf: Buffer, format: 'DOCX' | 'PDF'): boolean {
  if (format === 'DOCX') {
    return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  }
  if (format === 'PDF') {
    return buf.length >= 4 && buf.slice(0, 4).toString('utf8') === '%PDF';
  }
  return false;
}
```

> Note: on utilise `String.prototype.matchAll` au lieu de `RegExp.prototype.exec` en boucle pour éviter les pièges avec les regex globales.

- [ ] **Step 5: Tests passent**

```bash
cd backend && npx jest contractTemplateService.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/contractTemplateService.ts backend/src/__tests__/contractTemplateService.test.ts backend/package.json backend/package-lock.json
git commit -m "feat(contracts): service extraction/classification/validation modèles"
```

---

## Task 5: `contractGenerationService` — contexte de fusion + génération (TDD partiel)

**Files:**
- Create: `backend/src/services/contractGenerationService.ts`
- Create: `backend/src/__tests__/contractGenerationService.test.ts`

- [ ] **Step 1: Installer `number-to-words-fr`**

```bash
cd backend && npm install number-to-words-fr
```

- [ ] **Step 2: Tests pour `buildMergeContext` et `flattenContext`**

```ts
// backend/src/__tests__/contractGenerationService.test.ts
import { buildMergeContext, flattenContext } from '../services/contractGenerationService';

const fakeApp = {
  id: 'a1', applicationNumber: 'APP-001', amount: 25000000, currency: 'XOF',
  purpose: 'Fonds de roulement', durationMonths: 12, proposedRate: 8.5,
  collateralType: 'Hypothèque', collateralValue: 30000000, repaymentSchedule: 'MONTHLY',
  client: { companyName: 'Ets ABC', rccm: 'SN-DKR-2020', ninea: '1234',
            legalForm: 'SARL', headquarters: 'Dakar', contactPerson: 'M. Diop',
            phone: '+221770000000', email: 'abc@ex.com' },
  creditType: { name: 'Crédit moyen terme' },
  company: { name: 'BCI', headquarters: 'Dakar', legalRepresentative: 'M. Sall', rccm: 'BCI-001' },
};

describe('buildMergeContext', () => {
  it('produit les 4 groupes', () => {
    const ctx = buildMergeContext(fakeApp as any, {});
    expect(ctx.client.companyName).toBe('Ets ABC');
    expect(ctx.application.applicationNumber).toBe('APP-001');
    expect(ctx.bank.name).toBe('BCI');
    expect(ctx.meta.creditType).toBe('Crédit moyen terme');
    expect(ctx.meta.generatedAt).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
  it('calcule amountInWords', () => {
    const ctx = buildMergeContext(fakeApp as any, {});
    expect(typeof ctx.application.amountInWords).toBe('string');
    expect(ctx.application.amountInWords.length).toBeGreaterThan(0);
  });
  it('mappe les valeurs nulles → chaîne vide', () => {
    const app = { ...fakeApp, durationMonths: null, client: { ...fakeApp.client, ninea: null } };
    const ctx = buildMergeContext(app as any, {});
    expect(ctx.application.durationMonths).toBe('');
    expect(ctx.client.ninea).toBe('');
  });
  it('fusionne customValues à plat', () => {
    const ctx = buildMergeContext(fakeApp as any, { echeance: '2026-12-31' });
    expect((ctx as any).echeance).toBe('2026-12-31');
  });
});

describe('flattenContext', () => {
  it('aplatit pour docxtemplater', () => {
    const flat = flattenContext({ client: { companyName: 'X' }, foo: 'bar' });
    expect(flat).toMatchObject({ 'client.companyName': 'X', foo: 'bar' });
  });
});
```

- [ ] **Step 3: Confirmer FAIL**

```bash
cd backend && npx jest contractGenerationService.test.ts
```

- [ ] **Step 4: Implémenter le service**

Créer `backend/src/services/contractGenerationService.ts` avec :
- `loadApplication(applicationId)` qui charge `creditApplication` avec `client`, `creditType`, `company`.
- `buildMergeContext(app, customValues)` retournant un objet avec les 4 groupes + customValues à plat (helpers `nullToEmpty` pour mapper null → "").
- `flattenContext(obj, prefix='')` qui aplatit récursivement (`client.companyName`).
- `generateContract({ templateId, applicationId, customValues, userId })` :
  1. charge `ContractTemplate`, vérifie `template.companyId === app.companyId`.
  2. crée le dossier `uploads/contracts/<applicationId>/`.
  3. si DOCX : ouvre avec PizZip + Docxtemplater (`paragraphLoop: true`, `linebreaks: true`, `nullGetter: () => ''`), `doc.render(flattenContext(buildMergeContext(...)))`, écrit le buffer.
  4. si PDF : `fs.copyFileSync(template.filePath, outPath)`.
  5. crée un `Document(category='CONTRACT')` lié au dossier.
  6. crée un `GeneratedContract(status='DRAFT', documentId, customValues, generatedBy)`.
  7. retourne le contrat avec `include: { document, template, signatories }`.

Dépendances importées : `fs`, `path`, `PizZip from 'pizzip'`, `Docxtemplater from 'docxtemplater'`, `ntw from 'number-to-words-fr'`, `prisma from '../prismaClient'`.

Génération de l'ID contrat via `crypto.randomBytes(8).toString('hex')`.

- [ ] **Step 5: Tests passent**

```bash
cd backend && npx jest contractGenerationService.test.ts
```
Expected: PASS sur les 5 tests de `buildMergeContext`/`flattenContext`. La fonction `generateContract` elle-même n'est pas testée en unitaire (dépend de DB + filesystem) — couverte en smoke test phase 2.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/contractGenerationService.ts backend/src/__tests__/contractGenerationService.test.ts backend/package.json backend/package-lock.json
git commit -m "feat(contracts): service génération avec fusion docxtemplater + montant en lettres"
```

---

## Task 6: Routes `/api/contract-templates`

**Files:**
- Create: `backend/src/routes/contract-templates.ts`
- Modify: `backend/src/server.ts`
- Create: `backend/uploads/contract-templates/.gitkeep`, `backend/uploads/contracts/.gitkeep`

- [ ] **Step 1: Créer les dossiers**

```bash
mkdir -p backend/uploads/contract-templates backend/uploads/contracts
touch backend/uploads/contract-templates/.gitkeep backend/uploads/contracts/.gitkeep
```

- [ ] **Step 2: Créer `routes/contract-templates.ts`**

Imports : `Router`, `Request`, `Response`, `multer`, `path`, `fs`, `crypto`, `prisma`, `authenticate`, `authorize`, `requireCompany`, `extractVariablesFromDocx`, `classifyVariables`, `validateMagicBytes`, `VARIABLE_CATALOG`, `flattenedCatalog`.

Multer en `memoryStorage` avec `limits.fileSize = 5 * 1024 * 1024`.

Routes (toutes auth + companyId) :

| Verbe | Path | Permission | Comportement |
|---|---|---|---|
| GET | `/catalog/variables` | (auth seulement) | retourne `{ groups, flattened }` |
| GET | `/` | (auth) | liste modèles tenant ; filtre `?creditTypeId=` ne garde que `creditTypeIds` vide ou contenant la valeur |
| GET | `/:id` | (auth) | détail (404 si autre tenant) |
| POST | `/` | `manage_contract_templates` | upload : valide ext (.docx ou .pdf) + magic bytes, écrit dans `uploads/contract-templates/<id>.<ext>`, scanne `detectedVariables` (DOCX uniquement), génère `customFields` initiaux (label = name, type 'text', required false) |
| PUT | `/:id` | `manage_contract_templates` | met à jour name/description/creditTypeIds/customFields/isActive |
| DELETE | `/:id` | `manage_contract_templates` | soft delete ; bloque (409) si `generatedContracts` non ARCHIVED/CANCELLED existent |
| GET | `/:id/download` | (auth) | `res.download(filePath, originalName)` après vérif tenant |

Erreurs : `409` sur P2002 (nom dupliqué).

- [ ] **Step 3: Brancher dans `server.ts`**

Imports en tête : `import contractTemplateRoutes from './routes/contract-templates';` + `import fs from 'fs';` (si absent).

À côté des `app.use('/api/...')` :
```ts
app.use('/api/contract-templates', contractTemplateRoutes);
```

Au démarrage (proche du listen ou juste après) :
```ts
const uploadsRoot = path.join(__dirname, '../uploads');
['contract-templates', 'contracts'].forEach((d) => fs.mkdirSync(path.join(uploadsRoot, d), { recursive: true }));
```

- [ ] **Step 4: Compile check**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 5: Smoke test backend**

Démarrer `npm run dev`, faire un upload curl avec un .docx contenant `{{client.companyName}}` et `{{echeance}}` :
```bash
curl -X POST http://localhost:5007/api/contract-templates \
  -H "Authorization: Bearer <TOKEN>" \
  -F "name=Test" -F "documentType=CONTRACT_LOAN" \
  -F 'creditTypeIds=[]' \
  -F "file=@sample.docx"
```
Expected: 201, JSON avec `detectedVariables: ["client.companyName","echeance"]`, `customFields: [{ name:"echeance", ... }]`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/contract-templates.ts backend/src/server.ts backend/uploads/
git commit -m "feat(contracts): routes CRUD modèles + upload .docx/.pdf"
```

---

## Task 7: Permissions seed

**Files:**
- Modify: `backend/prisma/seed-bci.js`

- [ ] **Step 1: Étendre les `permissions[]` des users concernés**

Repérer chaque user et compléter son tableau :
- `juridique@bci.sn` (DIRECTION_JURIDIQUE) : ajouter `'manage_contract_templates'`, `'generate_contracts'`, `'view_contracts'`.
- `admin@bci.sn` (ADMIN) : ajouter `'manage_contract_templates'`, `'view_contracts'` si pas déjà présents (vérifier la liste existante).
- `responsable_engagements@bci.sn` (RESPONSABLE_ENGAGEMENTS) : ajouter `'view_contracts'`.
- `backoffice@bci.sn` (BACK_OFFICE) : ajouter `'view_contracts'`.

- [ ] **Step 2: Re-seeder**

```bash
cd backend && node prisma/seed-bci.js
```
Expected: idempotent — met à jour les permissions des users existants.

- [ ] **Step 3: Vérifier**

```bash
cd backend && npx prisma studio
```
Filtrer `User` par email `juridique@bci.sn` → confirmer les 3 permissions.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed-bci.js
git commit -m "feat(seed): permissions contrats sur juridique/admin/RE/BO"
```

---

## Task 8: Frontend — types + client API contrats

**Files:**
- Create: `src/types/contracts.ts`
- Modify: `src/services/api.ts`

- [ ] **Step 1: Créer `src/types/contracts.ts`**

Définir : `ContractFileFormat`, `ContractStatus`, `SignatureMode`, `SignatoryParty`, `SignatoryStatus`, `CustomFieldType`, `ContractCustomField`, `ContractTemplate`, `ContractSignatory`, `GeneratedContract`, `VariableCatalog`. Voir spec section 6 pour les champs.

- [ ] **Step 2: Ajouter `contractTemplateApi` dans `src/services/api.ts`**

À la fin du fichier, juste avant `handleApiError`. Méthodes :
- `list(creditTypeId?)` → `GET /contract-templates[?creditTypeId=]`
- `get(id)` → `GET /contract-templates/:id`
- `create(form: FormData)` → `POST /contract-templates` (multipart)
- `update(id, data)` → `PUT /contract-templates/:id`
- `deactivate(id)` → `DELETE /contract-templates/:id`
- `downloadUrl(id)` → string `${API_BASE_URL}/contract-templates/${id}/download`
- `getCatalog()` → `GET /contract-templates/catalog/variables`

Suivre exactement le pattern de `creditPolicyApi` (try/catch + `{ success, data, error }`).

- [ ] **Step 3: Compile check**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/types/contracts.ts src/services/api.ts
git commit -m "feat(api): types + client contractTemplateApi"
```

---

## Task 9: Page `ContractTemplatesPage` + composants

**Files:**
- Create: `src/pages/ContractTemplatesPage.tsx`
- Create: `src/components/contracts/ContractTemplateUploadDialog.tsx`
- Create: `src/components/contracts/ContractTemplateEditDialog.tsx`
- Create: `src/components/contracts/VariableCatalogPanel.tsx`

- [ ] **Step 1: `VariableCatalogPanel.tsx`**

Composant qui :
- charge `/contract-templates/catalog/variables` une fois,
- affiche les 4 groupes en `Accordion` (label FR : Client / Dossier / Banque / Méta),
- chaque variable est un `Chip` cliquable qui copie `{{group.name}}` dans le presse-papier,
- snackbar de confirmation.

- [ ] **Step 2: `ContractTemplateUploadDialog.tsx` (wizard 2 étapes)**

Étape 1 (formulaire) :
- input file (`accept=".docx,.pdf"`)
- TextField `name` (required)
- Select `documentType` (Contrat de prêt / Avenant / Convention de garantie / Autre + free text)
- Multi-select `creditTypeIds` (charger via API existante `creditTypesApi`)
- TextField `description` (multiline)
- Bouton "Suivant" → `contractTemplateApi.create(formData)` → récupère `ContractTemplate` + passage à l'étape 2.

Étape 2 (révision variables) :
- Affiche les variables catalogue détectées (chips verts, lecture seule)
- Pour chaque variable custom détectée, ligne éditable : `name` (lecture seule), `label` (TextField), `type` (Select : text/number/date), `required` (Checkbox)
- Bouton "Terminer" → `contractTemplateApi.update(id, { customFields })` → ferme + `onCreated()`.

- [ ] **Step 3: `ContractTemplateEditDialog.tsx`**

Dialog plus simple, sans étape de fichier : modifie `name`, `description`, `creditTypeIds`, `customFields[].label/type/required`, `isActive`. Appelle `update`.

- [ ] **Step 4: `ContractTemplatesPage.tsx`**

Layout : Header + Grid `xs={12} md={9}` table modèles + `xs={12} md={3}` `<VariableCatalogPanel />`.

Table : colonnes Nom (avec description), Type document, Format (Chip), Variables (Chip count), Actif, Actions (Télécharger / Modifier / Désactiver).

Bouton "+ Nouveau modèle" → `ContractTemplateUploadDialog`.

- [ ] **Step 5: Compile check**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/ContractTemplatesPage.tsx src/components/contracts/
git commit -m "feat(page): ContractTemplatesPage + dialogs upload/édition"
```

---

## Task 10: Wiring frontend (route, sidebar, header)

**Files:**
- Modify: `src/types/index.ts`, `src/contexts/AppContext.tsx`, `src/components/Sidebar.tsx`, `src/components/Header.tsx`, `src/App.tsx`

- [ ] **Step 1: Ajouter `'contract-templates'` au type `PageType`**

`src/types/index.ts` : ajouter `| 'contract-templates'` à l'union `PageType`.

- [ ] **Step 2: Mapping route**

`src/contexts/AppContext.tsx` : ajouter `'contract-templates': '/contract-templates'`.

- [ ] **Step 3: Sidebar**

`src/components/Sidebar.tsx` : ajouter une entrée sous Configuration :
```tsx
{ id: 'contract-templates', label: 'Modèles de contrats',
  icon: <DescriptionIcon />, permission: 'manage_contract_templates' }
```
Importer `DescriptionIcon` de `@mui/icons-material/Description`.

- [ ] **Step 4: Header**

`src/components/Header.tsx` : ajouter `'contract-templates': 'Modèles de contrats'` au mapping titres.

- [ ] **Step 5: Lazy import + guard dans `App.tsx`**

```tsx
const ContractTemplatesPage = lazy(() => import('./pages/ContractTemplatesPage').then((m) => ({ default: m.ContractTemplatesPage })));
// ...
{currentPage === 'contract-templates' && hasPermission('manage_contract_templates') && <ContractTemplatesPage />}
```

- [ ] **Step 6: Smoke test manuel**

1. Login `juridique@bci.sn` → entrée "Modèles de contrats" visible.
2. Cliquer ouvre la page (table vide).
3. Uploader un .docx avec `{{client.companyName}}` et `{{echeance}}` → table affiche le modèle, 2 variables détectées.
4. Login `chargeaffaires@bci.sn` → entrée NON visible.

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/contexts/AppContext.tsx src/components/Sidebar.tsx src/components/Header.tsx src/App.tsx
git commit -m "feat(nav): route + sidebar + guard pour Modèles de contrats"
```

---

# PHASE 2 — Étape LEGAL + LegalStepPage (mode MANUAL)

## Task 11: Ajouter `LEGAL` au workflow builder (frontend)

**Files:**
- Modify: `src/types/creditPolicyBuilder.ts`
- Modify: `src/components/workflow-builder/StepPalette.tsx`
- Modify: `src/components/workflow-builder/StepConfigPanel.tsx`

- [ ] **Step 1: Étendre le type**

```ts
// src/types/creditPolicyBuilder.ts
export type PolicyStepType = 'CREATION' | 'DISPATCH' | 'ANALYSIS' | 'APPROVAL' | 'COMMITTEE' | 'LEGAL';
```

Dans `STEP_TYPE_CONFIG`, ajouter :
```ts
LEGAL: { label: 'Juridique', color: '#7e22ce', bgColor: '#faf5ff' },
```

- [ ] **Step 2: Étendre `StepPalette.tsx`**

Importer `import GavelIcon from '@mui/icons-material/Gavel';`.
Dans `TYPE_ICONS` ajouter `LEGAL: <GavelIcon sx={{ fontSize: 15 }} />`.
Dans `STEP_TYPES` ajouter `'LEGAL'` à la fin.

- [ ] **Step 3: Étendre `StepConfigPanel.tsx`**

Repérer la liste literal `(['DISPATCH', 'ANALYSIS', 'APPROVAL', 'COMMITTEE'] as const)` (ligne ~120), ajouter `'LEGAL'`.

- [ ] **Step 4: Compile check + smoke test**

```bash
npx tsc --noEmit
```

Démarrer le frontend, login admin, ouvrir CreditPolicyPage → builder, vérifier que **Juridique** apparaît dans la palette. Créer un brouillon, ajouter étape Juridique en dernière position, assignée à `DIRECTION_JURIDIQUE`. Activer la politique.

- [ ] **Step 5: Commit**

```bash
git add src/types/creditPolicyBuilder.ts src/components/workflow-builder/StepPalette.tsx src/components/workflow-builder/StepConfigPanel.tsx
git commit -m "feat(workflow): type d'étape LEGAL dans le builder"
```

---

## Task 12: `signatureService` + stub DocuSeal (interface uniquement)

**Files:**
- Create: `backend/src/services/signatureService.ts`
- Create: `backend/src/services/providers/docusealProvider.ts`

- [ ] **Step 1: Définir l'interface + factory dans `signatureService.ts`**

```ts
import { GeneratedContract, ContractSignatory } from '@prisma/client';
import { prisma } from '../prismaClient';
import { decrypt } from '../utils/encryption';
import { DocuSealProvider } from './providers/docusealProvider';

export interface ProviderStatus {
  status: 'pending' | 'signed' | 'declined';
  signedFileUrl?: string;
  signatories: { externalRef: string; status: 'pending' | 'signed' | 'declined'; signedAt?: string }[];
}

export interface SignatureProvider {
  sendForSignature(contract: GeneratedContract & { document: any }, signatories: ContractSignatory[]): Promise<{ providerRef: string }>;
  getStatus(providerRef: string): Promise<ProviderStatus>;
  verifyWebhook(rawBody: string, signature: string): boolean;
  parseWebhook(payload: any): { providerRef: string; event: string; signedFileUrl?: string };
}

export async function getProvider(companyId: string): Promise<SignatureProvider> {
  const c = await prisma.company.findUnique({ where: { id: companyId } });
  const cfg = c?.signatureProviderConfig as any;
  if (!cfg?.ciphertext) throw new Error('Aucun fournisseur de signature configuré');
  const decoded = JSON.parse(decrypt(cfg.ciphertext)) as
    { provider: 'docuseal'; baseUrl: string; apiKey: string; webhookSecret: string };
  if (decoded.provider === 'docuseal') return new DocuSealProvider(decoded);
  throw new Error(`Provider ${decoded.provider} non supporté`);
}
```

- [ ] **Step 2: Stub `DocuSealProvider`**

```ts
// backend/src/services/providers/docusealProvider.ts
import { SignatureProvider, ProviderStatus } from '../signatureService';

export interface DocuSealConfig { baseUrl: string; apiKey: string; webhookSecret: string; }

export class DocuSealProvider implements SignatureProvider {
  constructor(private cfg: DocuSealConfig) {}
  async sendForSignature(): Promise<{ providerRef: string }> { throw new Error('Phase 3'); }
  async getStatus(): Promise<ProviderStatus> { throw new Error('Phase 3'); }
  verifyWebhook(): boolean { throw new Error('Phase 3'); }
  parseWebhook(): { providerRef: string; event: string; signedFileUrl?: string } { throw new Error('Phase 3'); }
}
```

- [ ] **Step 3: Compile check**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/signatureService.ts backend/src/services/providers/
git commit -m "feat(signature): interface SignatureProvider + stub DocuSeal"
```

---

## Task 13: Routes `/api/contracts` (mode MANUAL uniquement)

**Files:**
- Create: `backend/src/routes/contracts.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/src/middleware/auditLogger.ts`

- [ ] **Step 1: Étendre `auditLogger.ts`**

Ouvrir le fichier, repérer la liste/enum des `eventType`. Ajouter les 8 nouveaux types :
`CONTRACT_TEMPLATE_CREATED`, `CONTRACT_TEMPLATE_UPDATED`, `CONTRACT_TEMPLATE_DELETED`, `CONTRACT_GENERATED`, `CONTRACT_SENT_FOR_SIGNATURE`, `CONTRACT_SIGNED`, `CONTRACT_CANCELLED`, `LEGAL_STEP_COMPLETED`.

(Adapter selon la forme exacte de l'enum dans le fichier.)

- [ ] **Step 2: Créer `routes/contracts.ts`**

Routes (toutes auth + companyId, sauf webhook ajouté en Task 17) :

| Verbe | Path | Permission | Comportement |
|---|---|---|---|
| GET | `/application/:applicationId` | `view_contracts` | liste contrats du dossier (avec template, signatories ordonnés) |
| POST | `/generate` | `generate_contracts` | body `{ templateId, applicationId, customValues }` → appelle `generateContract` |
| GET | `/:id/download` | `view_contracts` | `?signed=1` → PDF signé si dispo, sinon document original |
| POST | `/:id/signatories` | `generate_contracts` | remplace la liste, refuse si statut ≠ DRAFT |
| POST | `/:id/send-for-signature` | `generate_contracts` | body `{ mode }`. Si DRAFT + signataires définis : MANUAL → `status=PENDING_SIGNATURE`, `signatureMode=MANUAL` ; EXTERNAL → 503 (Phase 3) |
| POST | `/:id/upload-signed` | `generate_contracts` | multer file, valide PDF magic bytes, écrit `<id>.signed.pdf` + SHA-256, `status=SIGNED` |
| POST | `/:id/cancel` | `generate_contracts` | refuse si SIGNED ou CANCELLED, sinon `status=CANCELLED` + `cancelledAt` |

Tous les checks tenant via `application: { companyId: req.companyId }` dans les `where`.

Multer : `memoryStorage`, `limits.fileSize = 10 * 1024 * 1024`.

- [ ] **Step 3: Brancher dans `server.ts`**

```ts
import contractRoutes from './routes/contracts';
// ...
app.use('/api/contracts', contractRoutes);
```

- [ ] **Step 4: Compile check**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 5: Smoke test rapide**

Avec un dossier existant en BCI et un modèle déjà uploadé :
```bash
# génération
curl -X POST http://localhost:5007/api/contracts/generate \
  -H "Authorization: Bearer <TOKEN_JURIDIQUE>" \
  -H "Content-Type: application/json" \
  -d '{"templateId":"<id>","applicationId":"<id>","customValues":{"echeance":"2026-12-31"}}'
```
Expected: 201, retourne le contrat + document attaché. Le fichier `.docx` doit exister sur disque sous `uploads/contracts/<applicationId>/`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/contracts.ts backend/src/server.ts backend/src/middleware/auditLogger.ts
git commit -m "feat(contracts): routes génération + signataires + cycle de vie (mode MANUAL)"
```

---

## Task 14: Client API frontend `contractApi`

**Files:**
- Modify: `src/services/api.ts`

- [ ] **Step 1: Ajouter `contractApi`**

À côté de `contractTemplateApi`. Méthodes :
- `listForApplication(applicationId)` → `GET /contracts/application/:id`
- `generate(payload)` → `POST /contracts/generate`
- `setSignatories(id, signatories)` → `POST /contracts/:id/signatories`
- `sendForSignature(id, mode)` → `POST /contracts/:id/send-for-signature`
- `uploadSigned(id, file)` → `POST /contracts/:id/upload-signed` (multipart)
- `cancel(id)` → `POST /contracts/:id/cancel`
- `downloadUrl(id, signed=false)` → URL avec `?signed=1` si `signed`

Suivre le pattern existant.

- [ ] **Step 2: Commit**

```bash
git add src/services/api.ts
git commit -m "feat(api): client contractApi (génération, signataires, signature)"
```

---

## Task 15: `LegalStepPage` + composants enfants

**Files:**
- Create: `src/pages/LegalStepPage.tsx`
- Create: `src/components/contracts/ContractStatusChip.tsx`, `GenerateContractDialog.tsx`, `ContractSignatoriesDialog.tsx`, `SendForSignatureDialog.tsx`, `ContractsListOnApplication.tsx`

- [ ] **Step 1: `ContractStatusChip.tsx`**

Mapping statut → label/couleur MUI :
- DRAFT → Brouillon, default
- PENDING_SIGNATURE → En signature, warning
- SIGNED → Signé, success
- ARCHIVED → Archivé, info
- CANCELLED → Annulé, error

- [ ] **Step 2: `GenerateContractDialog.tsx`**

Dialog avec :
- en-tête : nom du modèle.
- Si `template.customFields.length > 0` : affiche un formulaire dynamique (un champ par customField selon `type` et `required`).
- Bouton "Générer" → `contractApi.generate({ templateId, applicationId, customValues })` → ferme.

Validation côté front : tous les `required` doivent être remplis.

- [ ] **Step 3: `ContractSignatoriesDialog.tsx`**

- Liste éditable de signataires (party, ordre, fullName, email, role).
- Bouton "Ajouter un signataire" (party par défaut alterne BANK/CLIENT).
- Pré-remplissage initial : 1 signataire BANK (utilisateur courant via `UserContext`) + 1 signataire CLIENT (depuis `application.client.contactPerson` + `application.client.email` via prop).
- Bouton "Enregistrer" → `contractApi.setSignatories(id, list)`.

- [ ] **Step 4: `SendForSignatureDialog.tsx`**

- Radio MANUAL / EXTERNAL.
- EXTERNAL `disabled` tant que phase 3 pas livrée — tooltip "Disponible après configuration du provider".
- En MANUAL : explication "Imprimez le contrat, faites signer, puis téléversez le PDF signé."
- En EXTERNAL : explication "Envoi automatique aux signataires par email via DocuSeal."
- Validation : si `signatories.length === 0`, affichage d'une alerte rouge "Aucun signataire défini" + bouton confirmer disabled.
- Bouton "Envoyer" → `contractApi.sendForSignature(id, mode)`.

- [ ] **Step 5: `ContractsListOnApplication.tsx`**

Composant qui prend `applicationId` en prop, charge `contractApi.listForApplication(id)`, affiche une liste de cartes :
- Header carte : nom du template + `ContractStatusChip` + date génération
- Body : signataires (liste avec Avatar + statut)
- Actions selon statut :
  - DRAFT : "Configurer signataires", "Envoyer en signature", "Annuler"
  - PENDING_SIGNATURE + MANUAL : "Téléverser le document signé" (file input → `uploadSigned`)
  - PENDING_SIGNATURE + EXTERNAL : (Phase 3) bouton "Rafraîchir statut"
  - SIGNED/ARCHIVED : "Télécharger DOCX original", "Télécharger PDF signé"
  - CANCELLED : "Télécharger DOCX original" (read-only)

Le composant expose un callback `onChanged()` pour permettre au parent de rafraîchir.

- [ ] **Step 6: `LegalStepPage.tsx`**

Layout :
```
Header (titre dossier + bouton Retour)
Grid container :
  Grid xs={12} md={5} : "Modèles disponibles"
    Liste de cards (templates filtrés par creditTypeId du dossier)
    Chaque card = nom + bouton "Générer" → GenerateContractDialog
    Si liste vide : Alert info "Aucun modèle pour ce type de crédit"
  Grid xs={12} md={7} : "Contrats du dossier"
    <ContractsListOnApplication applicationId={...} />
Bandeau bas :
  Bouton "Terminer l'étape juridique"
    → confirmation bloquante si contrats PENDING_SIGNATURE
    → appelle l'API existante de complétion d'étape (vérifier dans backend/src/routes/workflows.ts)
```

> Note : repérer la route existante qui marque un `WorkflowStep` comme COMPLETED dans `backend/src/routes/workflows.ts`. La réutiliser. Si elle n'existe pas pour LEGAL, créer une route dédiée `POST /api/workflows/applications/:id/legal-step/complete`.

- [ ] **Step 7: Compile check**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/pages/LegalStepPage.tsx src/components/contracts/
git commit -m "feat(page): LegalStepPage — vue dédiée étape juridique"
```

---

## Task 16: Intégration dans `ApprovalsPage` + routing

**Files:**
- Modify: `src/pages/ApprovalsPage.tsx`, `src/types/index.ts`, `src/contexts/AppContext.tsx`, `src/components/Header.tsx`, `src/App.tsx`

- [ ] **Step 1: Ajouter `'legal-step'` au type + routing**

`src/types/index.ts` : `| 'legal-step'`.
`src/contexts/AppContext.tsx` : `'legal-step': '/legal-step/:applicationId'`.
`src/components/Header.tsx` : `'legal-step': 'Étape juridique'`.

- [ ] **Step 2: Lazy import dans `App.tsx`**

```tsx
const LegalStepPage = lazy(() => import('./pages/LegalStepPage').then((m) => ({ default: m.LegalStepPage })));
// ...
{currentPage === 'legal-step' && hasPermission('view_contracts') && <LegalStepPage applicationId={paramApplicationId} />}
```

- [ ] **Step 3: Adapter `ApprovalsPage.tsx`**

Repérer le rendu d'action sur chaque ligne de la table d'approbations. La donnée actuelle inclut probablement `currentStepName` ou similaire — vérifier ce qui est exposé. Si nécessaire, enrichir la réponse de l'API approbations (`backend/src/routes/workflows.ts` ou équivalent) pour exposer le `stepType` de la `policyStep` courante.

Conditionner le bouton :
```tsx
{row.currentStepType === 'LEGAL' ? (
  <Button size="small" variant="contained" onClick={() => navigate('legal-step', { applicationId: row.applicationId })}>
    Ouvrir étape juridique
  </Button>
) : (
  // ApprovalActionDialog standard existant
)}
```

> Les dossiers en LEGAL apparaissent dans les **mêmes onglets/badges** que les autres approbations (cf. spec section 6.3) — pas de filtre séparé.

- [ ] **Step 4: Smoke test E2E (mode MANUAL)**

1. Créer ou modifier la politique active de BCI pour inclure une étape LEGAL en dernière position assignée à `DIRECTION_JURIDIQUE`.
2. Créer un dossier client + montant qui déclenche la politique.
3. Faire passer le dossier toutes les étapes amont avec les rôles appropriés jusqu'à atteindre LEGAL.
4. Login `juridique@bci.sn` → Approbations → la ligne du dossier affiche "Ouvrir étape juridique".
5. Cliquer → `LegalStepPage` charge.
6. Cliquer "Générer" sur un modèle → saisir customFields → contrat apparaît à droite, statut DRAFT.
7. Configurer signataires (banque + client).
8. Envoyer en MANUAL → statut PENDING_SIGNATURE.
9. Téléverser un PDF signé → statut SIGNED.
10. "Terminer l'étape juridique" → dossier passe au statut final (APPROVED ou similaire).

- [ ] **Step 5: Commit**

```bash
git add src/pages/ApprovalsPage.tsx src/types/index.ts src/contexts/AppContext.tsx src/components/Header.tsx src/App.tsx
git commit -m "feat(approvals): bouton Ouvrir étape juridique pour étape LEGAL"
```

---

# PHASE 3 — Intégration DocuSeal (signature externe)

## Task 17: `DocuSealProvider` — implémentation réelle

**Files:**
- Modify: `backend/src/services/providers/docusealProvider.ts`
- Create: `backend/src/__tests__/docusealProvider.test.ts`
- Modify: `backend/src/routes/contracts.ts`
- Modify: `backend/src/server.ts`

- [ ] **Step 1: Tests pour `verifyWebhook` (HMAC)**

```ts
// backend/src/__tests__/docusealProvider.test.ts
import { DocuSealProvider } from '../services/providers/docusealProvider';
import crypto from 'crypto';

const cfg = { baseUrl: 'http://docuseal.local', apiKey: 'test', webhookSecret: 'shh' };

describe('DocuSealProvider.verifyWebhook', () => {
  const p = new DocuSealProvider(cfg);
  it('accepte une signature HMAC-SHA256 valide', () => {
    const body = '{"event_type":"submission.completed"}';
    const sig = crypto.createHmac('sha256', cfg.webhookSecret).update(body).digest('hex');
    expect(p.verifyWebhook(body, sig)).toBe(true);
  });
  it('rejette une signature falsifiée', () => {
    expect(p.verifyWebhook('{"x":1}', 'a'.repeat(64))).toBe(false);
  });
});
```

- [ ] **Step 2: Implémenter le provider**

Remplacer le stub par une implémentation complète :

```ts
import crypto from 'crypto';
import fs from 'fs';
import { SignatureProvider, ProviderStatus } from '../signatureService';
import { GeneratedContract, ContractSignatory } from '@prisma/client';

export interface DocuSealConfig { baseUrl: string; apiKey: string; webhookSecret: string; }

export class DocuSealProvider implements SignatureProvider {
  constructor(private cfg: DocuSealConfig) {}

  async sendForSignature(contract: GeneratedContract & { document: any }, signatories: ContractSignatory[]) {
    const fileBuf = fs.readFileSync(contract.document.filePath);
    const uploadRes = await fetch(`${this.cfg.baseUrl}/api/templates/document`, {
      method: 'POST',
      headers: { 'X-Auth-Token': this.cfg.apiKey, 'Content-Type': 'application/octet-stream' },
      body: fileBuf,
    });
    if (!uploadRes.ok) throw new Error(`DocuSeal upload échoué (${uploadRes.status})`);
    const { id: templateId } = await uploadRes.json() as { id: string };

    const submissionRes = await fetch(`${this.cfg.baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'X-Auth-Token': this.cfg.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: templateId,
        send_email: true,
        submitters: signatories.map((s) => ({ name: s.fullName, email: s.email, role: s.role || s.party })),
      }),
    });
    if (!submissionRes.ok) throw new Error(`DocuSeal submission échouée (${submissionRes.status})`);
    const data = await submissionRes.json() as any;
    return { providerRef: String(data.id) };
  }

  async getStatus(providerRef: string): Promise<ProviderStatus> {
    const r = await fetch(`${this.cfg.baseUrl}/api/submissions/${providerRef}`, {
      headers: { 'X-Auth-Token': this.cfg.apiKey },
    });
    if (!r.ok) throw new Error(`DocuSeal getStatus échoué (${r.status})`);
    const j = await r.json() as any;
    return {
      status: j.status === 'completed' ? 'signed' : (j.status === 'declined' ? 'declined' : 'pending'),
      signedFileUrl: j.audit_log_url || j.documents?.[0]?.url,
      signatories: (j.submitters || []).map((s: any) => ({
        externalRef: String(s.id),
        status: s.status === 'completed' ? 'signed' : 'pending',
        signedAt: s.completed_at,
      })),
    };
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    const expected = crypto.createHmac('sha256', this.cfg.webhookSecret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  }

  parseWebhook(payload: any) {
    return {
      providerRef: String(payload.data?.submission_id || payload.submission_id),
      event: payload.event_type,
      signedFileUrl: payload.data?.documents?.[0]?.url,
    };
  }
}
```

- [ ] **Step 3: Tests passent**

```bash
cd backend && npx jest docusealProvider.test.ts
```

- [ ] **Step 4: Activer le mode EXTERNAL dans `routes/contracts.ts`**

Modifier le handler `POST /:id/send-for-signature` : remplacer le `503` par :
```ts
if (mode === 'EXTERNAL') {
  const provider = await getProvider(req.companyId!);
  const fullContract = await prisma.generatedContract.findUnique({
    where: { id: c.id }, include: { signatories: true, document: true },
  });
  const { providerRef } = await provider.sendForSignature(fullContract!, fullContract!.signatories);
  const updated = await prisma.generatedContract.update({
    where: { id: c.id },
    data: { status: 'PENDING_SIGNATURE', signatureMode: 'EXTERNAL', externalProviderRef: providerRef },
    include: { signatories: true, template: true },
  });
  return res.json({ success: true, data: updated });
}
```

Importer `getProvider` depuis `signatureService`.

- [ ] **Step 5: Ajouter le webhook handler**

Créer une fonction exportée `handleDocusealWebhook(req, res)` dans `routes/contracts.ts` :

```ts
export async function handleDocusealWebhook(req: Request, res: Response) {
  const signature = req.headers['x-docuseal-signature'] as string;
  const rawBody = req.body.toString('utf8');
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return res.status(400).json({ error: 'JSON invalide' }); }

  const eventId = String(payload.event_id || payload.id);
  const existing = await prisma.webhookEventLog.findUnique({
    where: { provider_eventId: { provider: 'docuseal', eventId } },
  });
  if (existing) return res.json({ ok: true, idempotent: true });

  const providerRef = String(payload.data?.submission_id);
  const contract = await prisma.generatedContract.findFirst({
    where: { externalProviderRef: providerRef },
    include: { application: true },
  });
  if (!contract) return res.status(404).json({ error: 'contrat introuvable' });

  const provider = await getProvider(contract.application.companyId!);
  if (!provider.verifyWebhook(rawBody, signature)) {
    return res.status(401).json({ error: 'Signature invalide' });
  }

  await prisma.webhookEventLog.create({ data: { provider: 'docuseal', eventId, payload } });

  const parsed = provider.parseWebhook(payload);
  if (parsed.event === 'submission.completed') {
    if (parsed.signedFileUrl) {
      const r = await fetch(parsed.signedFileUrl);
      const buf = Buffer.from(await r.arrayBuffer());
      const dir = path.join(__dirname, '../../uploads/contracts', contract.applicationId);
      fs.mkdirSync(dir, { recursive: true });
      const signedPath = path.join(dir, `${contract.id}.signed.pdf`);
      fs.writeFileSync(signedPath, buf);
      const hash = crypto.createHash('sha256').update(buf).digest('hex');
      await prisma.generatedContract.update({
        where: { id: contract.id },
        data: { status: 'SIGNED', signedFilePath: signedPath, signedFileHash: hash, signedAt: new Date() },
      });
    } else {
      await prisma.generatedContract.update({ where: { id: contract.id }, data: { status: 'SIGNED', signedAt: new Date() } });
    }
  }
  res.json({ ok: true });
}
```

- [ ] **Step 6: Brancher le webhook dans `server.ts` (hors auth JWT)**

AVANT `app.use('/api/contracts', contractRoutes)`, ajouter :
```ts
import express from 'express';
import { handleDocusealWebhook } from './routes/contracts';
app.post('/api/contracts/webhooks/docuseal',
  express.raw({ type: 'application/json' }),
  handleDocusealWebhook);
```

L'ordre est important : `express.raw` doit s'appliquer avant le `express.json()` global pour avoir le rawBody pour HMAC.

- [ ] **Step 7: Compile check**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/providers/docusealProvider.ts backend/src/__tests__/docusealProvider.test.ts backend/src/routes/contracts.ts backend/src/server.ts
git commit -m "feat(signature): intégration DocuSeal (envoi + statut + webhook HMAC)"
```

---

## Task 18: Configuration provider (admin) + activation EXTERNAL côté UI

**Files:**
- Modify: `backend/src/routes/companies.ts` (ajout route signature-config)
- Modify: `src/pages/CompanySettingsPage.tsx` (nouvel onglet)
- Modify: `src/components/contracts/SendForSignatureDialog.tsx` (activer EXTERNAL)

- [ ] **Step 1: Backend — routes config provider**

Dans `backend/src/routes/companies.ts`, ajouter (après imports existants `import { encrypt, decrypt } from '../utils/encryption'`) :

```ts
router.put('/:id/signature-provider-config', authorize([], ['ADMIN']), async (req, res) => {
  if (req.params.id !== req.companyId) return res.status(403).json({ success: false });
  const { provider, baseUrl, apiKey, webhookSecret } = req.body;
  if (provider !== 'docuseal' || !baseUrl || !apiKey || !webhookSecret) {
    return res.status(400).json({ success: false, error: 'Champs requis manquants' });
  }
  const ciphertext = encrypt(JSON.stringify({ provider, baseUrl, apiKey, webhookSecret }));
  await prisma.company.update({
    where: { id: req.companyId },
    data: { signatureProviderConfig: { ciphertext } as any },
  });
  res.json({ success: true });
});

router.get('/:id/signature-provider-config', authorize([], ['ADMIN']), async (req, res) => {
  if (req.params.id !== req.companyId) return res.status(403).json({ success: false });
  const c = await prisma.company.findUnique({ where: { id: req.companyId } });
  const cfg = c?.signatureProviderConfig as any;
  if (!cfg?.ciphertext) return res.json({ success: true, data: null });
  const decoded = JSON.parse(decrypt(cfg.ciphertext));
  res.json({ success: true, data: { provider: decoded.provider, baseUrl: decoded.baseUrl, apiKey: '***', hasWebhookSecret: !!decoded.webhookSecret } });
});
```

- [ ] **Step 2: Frontend — onglet "Signature électronique" dans `CompanySettingsPage`**

Ajouter un nouvel onglet (Tabs MUI). Formulaire :
- Provider : Select (`DocuSeal` seul choix)
- Base URL : TextField
- API key : TextField (`type="password"`)
- Webhook secret : TextField (`type="password"`)
- Bouton "Enregistrer" → `PUT /api/companies/<id>/signature-provider-config`

Affiche la config existante (avec apiKey masquée) en chargement initial.

- [ ] **Step 3: Activer EXTERNAL dans `SendForSignatureDialog.tsx`**

Charger une fois `companyApi.getSignatureProviderConfig(companyId)` (à ajouter dans `api.ts`). Si `data !== null`, le radio EXTERNAL est `enabled` ; sinon disabled avec tooltip "Provider non configuré".

- [ ] **Step 4: Smoke test E2E mode EXTERNAL**

1. Lancer DocuSeal en local : `docker run -p 3000:3000 docuseal/docuseal`. Créer une API key dans son admin.
2. Créer une route exposable pour le webhook (utiliser ngrok ou similaire si DocuSeal est externe ; sinon configurer DocuSeal pour pointer sur `http://host.docker.internal:5007/api/contracts/webhooks/docuseal`).
3. Login admin BCI → Settings → onglet Signature → enregistrer config.
4. Sur un dossier en LEGAL : générer un contrat, configurer signataires (avec email valide pour le test), envoyer en EXTERNAL.
5. Vérifier que DocuSeal reçoit le doc + envoie l'email.
6. Signer dans DocuSeal → webhook reçu → contrat passe en SIGNED → PDF signé téléchargeable.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/companies.ts src/pages/CompanySettingsPage.tsx src/components/contracts/SendForSignatureDialog.tsx src/services/api.ts
git commit -m "feat(settings): config provider DocuSeal par tenant + activation EXTERNAL"
```

---

## Task 19: Documentation env + sauvegarde

**Files:**
- Modify: `backend/.env.example`
- Modify: `backend/src/services/backupService.ts`

- [ ] **Step 1: Documenter les variables d'env**

Dans `backend/.env.example` ajouter :
```
# Chiffrement des configs fournisseurs de signature (32 bytes en hex)
SIGNATURE_PROVIDER_ENCRYPTION_KEY=
```

- [ ] **Step 2: Vérifier la couverture backup**

Lire `backend/src/services/backupService.ts`. Confirmer :
- Le `pg_dump` couvre toutes les nouvelles tables (oui si dump global).
- Les dossiers `uploads/contract-templates/` et `uploads/contracts/` sont inclus dans le tar des uploads. Si pas explicite, ajouter à la liste des paths archivés.

- [ ] **Step 3: Commit**

```bash
git add backend/.env.example backend/src/services/backupService.ts
git commit -m "chore(ops): doc SIGNATURE_PROVIDER_ENCRYPTION_KEY + backup contrats"
```

---

# Validation finale

- [ ] **Test bout-en-bout MANUAL**

1. Admin BCI ajoute étape LEGAL en fin de politique active.
2. Juridique uploade modèle "Contrat de prêt PME.docx" avec `{{client.companyName}}`, `{{application.amount}}`, `{{application.amountInWords}}`, `{{echeance}}`.
3. Wizard étape 2 : `echeance` configuré comme date required.
4. Un dossier traverse tout le workflow jusqu'à LEGAL.
5. Juridique génère contrat → saisit echeance → télécharge .docx → ouvre dans Word → vérifie fusion correcte (montant en lettres présent).
6. Configure 2 signataires (banque + client), envoie en MANUAL.
7. Téléverse PDF signé → statut SIGNED.
8. Clique "Terminer l'étape juridique" → dossier passé au statut final.

- [ ] **Test mode EXTERNAL avec DocuSeal local**

1. Configurer provider via Settings.
2. Sur un contrat : envoyer EXTERNAL → email signataire reçu via DocuSeal.
3. Signer dans DocuSeal → webhook → contrat SIGNED + PDF signé téléchargeable.

- [ ] **Test multi-tenant**

1. Login un autre tenant (en créer un au besoin via PlatformAdminPage).
2. Modèles BCI ne sont pas visibles.
3. Tentative `GET /api/contract-templates/<id-BCI>` directe → 404.
4. Tentative `GET /api/contracts/application/<app-BCI>` directe → 404.

- [ ] **Tag de version**

```bash
git tag v1.1.0-legal-step
```
