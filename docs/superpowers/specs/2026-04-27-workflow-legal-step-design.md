# Design — Étape juridique (LEGAL) + génération de contrats

**Date** : 2026-04-27
**Branche cible** : `release/v1.0`
**Statut** : Design approuvé, prêt pour planification d'implémentation

---

## 1. Objectif

Ajouter une étape **« Juridique » (LEGAL)** comme étape finale du workflow de crédit, permettant à l'équipe juridique :

1. de pré-charger des **modèles de contrats** (.docx avec variables de fusion ou .pdf statiques) dans une page de configuration dédiée ;
2. de **générer des contrats** sur les dossiers en cours d'étape LEGAL, en injectant les données du dossier dans le modèle ;
3. d'**envoyer en signature** (manuelle traçable ou via fournisseur externe **DocuSeal** open source) ;
4. de **clôturer manuellement** l'étape pour permettre au dossier d'atteindre son statut final.

---

## 2. Vue d'ensemble du flux

```
Configuration (one-shot)
  Juridique → "Modèles de contrats" → upload .docx/.pdf
  → système détecte les {{variables}} (catalogue fixe + custom)
  → tag optionnel par creditTypeId

Workflow editor (admin)
  WorkflowPolicyBuilder → palette : ajout type LEGAL
  → assignation rôle DIRECTION_JURIDIQUE en dernière position

Exécution (par dossier)
  Dossier atteint étape LEGAL → visible dans "Approbations"
  → "Ouvrir étape juridique" → LegalStepPage
       ├─ Générer un contrat (depuis un modèle filtré par creditType)
       ├─ Configurer les signataires (banque + client)
       ├─ Envoyer en signature (mode MANUAL ou EXTERNAL)
       ├─ Téléverser le PDF signé (mode MANUAL)
       └─ Terminer l'étape juridique (manuel)
```

---

## 3. Modèle de données

### 3.1 Modifications d'enums

```prisma
enum PolicyStepType {
  CREATION   @map("creation")
  DISPATCH   @map("dispatch")
  ANALYSIS   @map("analysis")
  APPROVAL   @map("approval")
  COMMITTEE  @map("committee")
  LEGAL      @map("legal")     // NOUVEAU
}

enum DocumentCategory {
  // ... valeurs existantes
  CONTRACT   @map("contract")  // NOUVEAU — pour les contrats générés
}
```

### 3.2 Nouveaux modèles

```prisma
model ContractTemplate {
  id                String   @id @default(cuid())
  companyId         String   @map("company_id")
  company           Company  @relation(fields: [companyId], references: [id])
  name              String
  documentType      String   @map("document_type")     // libre, ex "CONTRACT_LOAN"
  description       String?
  fileFormat        ContractFileFormat @map("file_format")
  filePath          String   @map("file_path")
  fileSize          Int      @map("file_size")
  originalName      String   @map("original_name")
  creditTypeIds     String[] @default([]) @map("credit_type_ids")
  customFields      Json     @default("[]") @map("custom_fields")
  detectedVariables Json     @default("[]") @map("detected_variables")
  isActive          Boolean  @default(true) @map("is_active")
  createdBy         String   @map("created_by")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  generatedContracts GeneratedContract[]

  @@unique([companyId, name])
  @@index([companyId])
  @@map("contract_templates")
}

enum ContractFileFormat {
  DOCX @map("docx")
  PDF  @map("pdf")
}

model GeneratedContract {
  id                  String   @id @default(cuid())
  applicationId       String   @map("application_id")
  application         CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  templateId          String   @map("template_id")
  template            ContractTemplate @relation(fields: [templateId], references: [id])
  documentId          String?  @unique @map("document_id")
  document            Document? @relation("ContractDocument", fields: [documentId], references: [id])
  status              ContractStatus @default(DRAFT)
  customValues        Json     @default("{}") @map("custom_values")
  signatureMode       SignatureMode? @map("signature_mode")
  externalProviderRef String?  @map("external_provider_ref")
  signedFilePath      String?  @map("signed_file_path")
  signedFileHash      String?  @map("signed_file_hash")
  generatedBy         String   @map("generated_by")
  generator           User     @relation("UserGeneratedContracts", fields: [generatedBy], references: [id])
  generatedAt         DateTime @default(now()) @map("generated_at")
  signedAt            DateTime? @map("signed_at")
  cancelledAt         DateTime? @map("cancelled_at")

  signatories ContractSignatory[]

  @@index([applicationId])
  @@index([templateId])
  @@map("generated_contracts")
}

enum ContractStatus {
  DRAFT              @map("draft")
  PENDING_SIGNATURE  @map("pending_signature")
  SIGNED             @map("signed")
  ARCHIVED           @map("archived")
  CANCELLED          @map("cancelled")
}

enum SignatureMode {
  MANUAL   @map("manual")
  EXTERNAL @map("external")
}

model ContractSignatory {
  id          String  @id @default(cuid())
  contractId  String  @map("contract_id")
  contract    GeneratedContract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  order       Int     @default(1)
  party       SignatoryParty
  fullName    String  @map("full_name")
  email       String?
  role        String?
  status      SignatoryStatus @default(PENDING)
  signedAt    DateTime? @map("signed_at")
  externalRef String? @map("external_ref")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([contractId])
  @@map("contract_signatories")
}

enum SignatoryParty   { BANK @map("bank")    CLIENT @map("client") }
enum SignatoryStatus  { PENDING @map("pending") SIGNED @map("signed") DECLINED @map("declined") }

model WebhookEventLog {
  id         String   @id @default(cuid())
  provider   String                                       // "docuseal"
  eventId    String   @map("event_id")
  payload    Json
  receivedAt DateTime @default(now()) @map("received_at")

  @@unique([provider, eventId])
  @@map("webhook_event_log")
}
```

### 3.3 Extensions sur modèles existants

```prisma
// dans model Company
signatureProviderConfig Json?   @map("signature_provider_config")  // chiffré AES-256-GCM
legalRepresentative     String? @map("legal_representative")       // pour {{bank.legalRepresentative}}
```

`customFields` JSON :
```ts
[{ name: "echeance", label: "Date d'échéance", type: "date" | "text" | "number", required: boolean }]
```

`signatureProviderConfig` JSON déchiffré :
```ts
{ provider: "docuseal", baseUrl: "...", apiKey: "...", webhookSecret: "..." }
```

---

## 4. Catalogue des variables de fusion

Préfixes fixes reconnus côté backend (`classifyVariables`) :

| Groupe | Variables |
|---|---|
| `client.*` | `companyName`, `rccm`, `ninea`, `legalForm`, `headquarters`, `contactPerson`, `phone`, `email` |
| `application.*` | `applicationNumber`, `amount`, `amountInWords`, `currency`, `purpose`, `durationMonths`, `proposedRate`, `collateralType`, `collateralValue`, `repaymentSchedule` |
| `bank.*` | `name`, `headquarters`, `legalRepresentative`, `rccm` |
| `meta.*` | `generatedAt`, `creditType` |

Toute autre variable détectée dans un .docx uploadé devient un **customField** que le juridique configure (label, type, required) et qu'il saisit à chaque génération.

`amountInWords` calculé via `number-to-words-fr` au moment du `buildMergeContext`.

---

## 5. Backend

### 5.1 Dépendances ajoutées

```
docxtemplater       ^3.x   (MIT, génération .docx)
pizzip              ^3.x   (lecture/écriture zip pour docx)
number-to-words-fr  ^x.x   (montant en lettres FR)
```

Pas de SDK DocuSeal — appels REST via `fetch`.

### 5.2 Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `backend/src/services/contractTemplateService.ts` | `extractVariables`, `classifyVariables`, `validateTemplateFile` |
| `backend/src/services/contractGenerationService.ts` | `buildMergeContext`, `generateContract` (DOCX → fusion ; PDF → copie) |
| `backend/src/services/signatureService.ts` | Interface `SignatureProvider` + impl `DocuSealProvider` + factory `getProvider(companyId)` |
| `backend/src/utils/encryption.ts` | AES-256-GCM, clé via `SIGNATURE_PROVIDER_ENCRYPTION_KEY` |
| `backend/src/routes/contract-templates.ts` | CRUD modèles |
| `backend/src/routes/contracts.ts` | Génération + signature + webhook |

### 5.3 Routes

**`/api/contract-templates`** (auth + companyId)
- `GET /` *(filtre `?creditTypeId=`)*
- `GET /:id`
- `POST /` *(multer, max 5MB, .docx ou .pdf)*
- `PUT /:id`
- `DELETE /:id` *(soft delete ; bloqué si contrats actifs)*
- `GET /:id/download`
- `GET /catalog/variables`

**`/api/contracts`** (auth + companyId)
- `GET /application/:applicationId`
- `POST /generate` *(body : `{ templateId, applicationId, customValues }`)*
- `GET /:id/download`
- `POST /:id/signatories` *(body : `{ signatories: Array<{ order: number, party: 'BANK'|'CLIENT', fullName: string, email?: string, role?: string }> }` ; remplace la liste complète)*
- `POST /:id/send-for-signature` *(body : `{ mode: 'MANUAL'|'EXTERNAL' }`. **MANUAL** : transition `DRAFT → PENDING_SIGNATURE` sans appel externe ; le juridique imprime/fait signer hors-ligne puis utilise `/upload-signed`. **EXTERNAL** : appel DocuSeal puis `DRAFT → PENDING_SIGNATURE`. Validation : signataires définis dans les deux modes.)*
- `POST /:id/upload-signed` *(multer PDF, mode MANUAL uniquement)*
- `POST /:id/cancel`
- `POST /webhooks/docuseal` *(HMAC, hors auth JWT)*

### 5.4 Modifications routes existantes

- `routes/credit-policy.ts` : aucune si validation générique ; sinon, ajouter `LEGAL` à toute whitelist.
- `services/workflowService.ts` : `LEGAL` traité comme étape standard, assignation à `DIRECTION_JURIDIQUE`. Pas de logique métier auto (génération à la demande).
- `server.ts` : montage des deux nouvelles routes ; création des dossiers `uploads/contract-templates/` et `uploads/contracts/` au démarrage.

### 5.5 Permissions

| Permission | Rôles par défaut |
|---|---|
| `manage_contract_templates` | `DIRECTION_JURIDIQUE`, `ADMIN` |
| `generate_contracts` | `DIRECTION_JURIDIQUE` |
| `view_contracts` | `DIRECTION_JURIDIQUE`, `ADMIN`, `RESPONSABLE_ENGAGEMENTS`, `BACK_OFFICE` |

Ajouts dans `seed-bci.js` + table `RolePermission`.

### 5.6 Stockage fichiers

```
backend/uploads/
  contract-templates/<templateId>.<ext>           # ext = "docx" ou "pdf" selon ContractTemplate.fileFormat
  contracts/<applicationId>/<contractId>.<ext>    # ext = "docx" pour DOCX généré, "pdf" pour PDF copié tel quel
  contracts/<applicationId>/<contractId>.signed.pdf  # toujours .pdf (signature MANUAL ou retour DocuSeal)
```

Servis **uniquement** par routes authentifiées + check tenant — pas via `/uploads` static.

---

## 6. Frontend

### 6.1 Nouvelles pages

- `src/pages/ContractTemplatesPage.tsx` — table + dialog upload/édition.
- `src/pages/LegalStepPage.tsx` — vue 2 colonnes (modèles dispo / contrats du dossier) + bouton « Terminer l'étape ».

### 6.2 Nouveaux composants (`src/components/contracts/`)

- `ContractTemplateUploadDialog.tsx` *(wizard 2 étapes)*
- `ContractTemplateEditDialog.tsx`
- `VariableCatalogPanel.tsx`
- `GenerateContractDialog.tsx`
- `ContractSignatoriesDialog.tsx`
- `SendForSignatureDialog.tsx`
- `ContractStatusChip.tsx`
- `ContractsListOnApplication.tsx`

### 6.3 Modifications fichiers existants

- `Sidebar.tsx` — entrée « Modèles de contrats » (gardée par `manage_contract_templates`).
- `workflow-builder/StepPalette.tsx` + `StepConfigPanel.tsx` — ajout type `LEGAL` (icône `GavelIcon`, couleur `#7e22ce`).
- `types/creditPolicyBuilder.ts` — `LEGAL` dans `STEP_TYPE_CONFIG`.
- `pages/ApprovalsPage.tsx` — les dossiers en étape LEGAL apparaissent dans les **mêmes onglets/badges** que les autres approbations (pas de filtre séparé). Seul le bouton d'action change : « Ouvrir étape juridique » → `LegalStepPage` au lieu du `ApprovalActionDialog` standard.
- `Header.tsx`, `contexts/AppContext.tsx`, `types/index.ts`, `App.tsx`, `services/api.ts` — routes/types/clients API.

---

## 7. Sécurité

1. **Clés API DocuSeal** chiffrées AES-256-GCM (`SIGNATURE_PROVIDER_ENCRYPTION_KEY`). Jamais renvoyées au frontend (mask `***`).
2. **Téléchargements** via routes auth + check `companyId` ; pas via static. Pas de path traversal (filename = cuid en DB).
3. **Validation upload** : taille ≤ 5MB, mimetype whitelist, magic bytes vérifiés (`PK\x03\x04` DOCX, `%PDF` PDF).
4. **Webhook DocuSeal** : HMAC-SHA256 obligatoire, idempotency via `WebhookEventLog`, rate-limited.
5. **Génération** : `docxtemplater` en mode escape par défaut, valeurs custom typées.
6. **Mur chinois** : tous nouveaux modèles indexés `companyId`, queries filtrées.

---

## 8. Audit

Étendre `auditLogger.ts` :
- `CONTRACT_TEMPLATE_CREATED|UPDATED|DELETED`
- `CONTRACT_GENERATED`
- `CONTRACT_SENT_FOR_SIGNATURE`
- `CONTRACT_SIGNED`
- `CONTRACT_CANCELLED`
- `LEGAL_STEP_COMPLETED`

Tous reliés à `applicationId` quand pertinent.

---

## 9. Edge cases & règles métier

| Cas | Comportement |
|---|---|
| Variable hors catalogue dans .docx | Classée comme `customField`, configurée par juridique. |
| Variable null/vide en fusion | Chaîne vide via `nullGetter` docxtemplater. |
| Désactiver modèle utilisé par contrats actifs | 409 Conflict. |
| Supprimer dossier avec contrats SIGNED | Bloqué (refus 409). |
| Étape LEGAL sans modèle dispo pour le creditType | Warning + bouton "Terminer" toujours actif. |
| Terminer l'étape avec contrats PENDING_SIGNATURE | Confirmation bloquante mais autorisée. |
| EXTERNAL sans config provider | Bouton disabled + tooltip. |
| Webhook après clôture étape | Statut contrat mis à jour, étape inchangée, audit log. |
| Upload mode MANUAL non-PDF | Refus 400 (magic bytes). |
| `{{application.amountInWords}}` | Calculé à la volée. |
| Re-génération même template/dossier | Autorisée, nouveau contrat. Si l'ancien est en `PENDING_SIGNATURE`, **dialog de confirmation bloquant** : "Un contrat de ce modèle est déjà en signature. Continuer ?" ; choix juridique : annuler l'ancien manuellement après. |
| `{{bank.legalRepresentative}}` non renseigné | Chaîne vide (champ optionnel sur Company). |
| Politique modifiée rétroactivement (LEGAL ajoutée) | Versioning existant : dossiers en cours gardent leur plan. |

---

## 10. Tests

### Backend (Jest)

- `contractTemplateService.test.ts` — extraction variables, classification, validation magic bytes.
- `contractGenerationService.test.ts` — buildMergeContext, génération .docx ouvrable, valeurs nulles, montant en lettres.
- `signatureService.test.ts` — DocuSealProvider mock fetch, vérification HMAC, idempotency.
- `routes/contract-templates.test.ts` — tenant isolation, permissions, blocages métier.
- `routes/contracts.test.ts` — génération end-to-end, MANUAL upload, webhook, blocage suppression SIGNED.

### Frontend (smoke manuel)

1. Upload .docx 5 variables → détection.
2. Génération → ouverture .docx → vérif fusion.
3. MANUAL : envoi → upload PDF signé → SIGNED.
4. EXTERNAL : DocuSeal en docker, signature → webhook → SIGNED.
5. Multi-tenant : modèle BCI invisible depuis autre tenant.
6. Étape LEGAL ajoutée → dossier traverse → juridique génère + clôt.

---

## 11. Migration & déploiement

### Migration Prisma unique : `add_legal_step_and_contracts`

1. Ajout `LEGAL` dans `policy_step_type`.
2. Ajout `CONTRACT` dans `document_category`.
3. Création `contract_templates`, `generated_contracts`, `contract_signatories`, `webhook_event_log`.
4. Création enums `contract_file_format`, `contract_status`, `signature_mode`, `signatory_party`, `signatory_status`.
5. Colonnes `signature_provider_config` (JSONB) et `legal_representative` (TEXT) sur `companies`.

**Backfill** : aucun.

### Seed

- 3 nouvelles permissions + assignations rôles.
- Optionnel : modèle d'exemple « Contrat de prêt PME » dans `backend/seeds/contract-templates/`.

### Variables d'env

```
SIGNATURE_PROVIDER_ENCRYPTION_KEY=<32 bytes hex>
DOCUSEAL_BASE_URL=                                  # optionnel global, sinon par tenant
```

### Création dossiers uploads

Au boot dans `server.ts` : `mkdirSync` de `uploads/contract-templates/` et `uploads/contracts/`.

### Backup

`backupService.ts` : confirmer que les nouvelles tables sont incluses (pg_dump global) et que les nouveaux dossiers `uploads/` sont archivés.

### Rollout phasé

**Migration unique** : la migration Prisma est livrée intégralement en Phase 1 (incluant la valeur `LEGAL` dans `policy_step_type` et toutes les tables/enums signature). Les phases jouent uniquement sur l'**exposition UI/fonctionnelle**, pas sur le schéma.

1. **Phase 1** — schéma + page Modèles (configuration). `LEGAL` présent dans l'enum mais **caché de la palette du `WorkflowPolicyBuilder`** côté frontend.
2. **Phase 2** — `LEGAL` exposé dans la palette + `LegalStepPage` opérationnelle en mode MANUAL uniquement (bouton « Envoyer en signature externe » disabled).
3. **Phase 3** — activation du mode EXTERNAL + intégration DocuSeal complète (provider config, webhook).

---

## 12. Risques résiduels

- `docxtemplater` v3 (MIT) suffit pour notre usage simple ; rester en v3.
- DocuSeal self-host = conteneur Docker en plus à provisionner ; différer à phase 3.
- Génération CPU-bound synchrone : OK tant que le juridique génère un contrat à la fois (UI naturelle). Worker queue à envisager si volume.

---

## 13. Décisions clés actées

| # | Sujet | Choix |
|---|---|---|
| 1 | Type d'étape | Nouveau `PolicyStepType.LEGAL` (extensible au-delà de la seule génération de contrats) |
| 2 | Portée des modèles | Globaux par tenant + tag optionnel `creditTypeIds[]` |
| 3 | Format des modèles | DOCX (avec fusion `docxtemplater`) **et** PDF (statique, sans fusion) |
| 4 | Catalogue variables | Catalogue fixe (4 groupes) + customFields déclarés par modèle, saisis à la génération |
| 5 | Cycle de vie contrat | Stockage + attachement dossier + workflow de signature complet (signataires, statuts) |
| 6 | Mode signature | MANUAL **et** EXTERNAL sélectionnables par contrat |
| 7 | Provider externe | **DocuSeal** (open source AGPLv3, self-hostable) |
| 8 | Clôture étape LEGAL | Manuelle par le juridique (bouton « Terminer ») |
