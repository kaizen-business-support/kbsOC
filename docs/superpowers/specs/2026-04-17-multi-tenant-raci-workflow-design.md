# Design Spec — Multi-Tenant SaaS + Workflow RACI dynamique
**Date :** 2026-04-17  
**Projet :** kbsOC — OptimusCredit  
**Statut :** Approuvé par l'utilisateur

---

## 1. Contexte et objectifs

### 1.1 Situation actuelle
OptimusCredit est un système de gestion du processus crédit bancaire. Il est actuellement **mono-tenant** : une seule compagnie, une seule base de données, des rôles génériques qui ne reflètent pas la structure organisationnelle réelle de BCI.

Deux documents de référence ont été fournis :
- **Matrice RACI BCI** (`rc/Matrice_RACI_V0-23022026.xlsx`) — définit qui fait quoi dans le processus crédit
- **Mesures transitoires BCI** (`rc/Mesures transitoires de sécurisation du processus crédit.pptx`) — définit la séparation fonctionnelle Risques/Engagements (Chinese Wall)

### 1.2 Objectifs
1. **Multi-tenant SaaS** : une installation, plusieurs compagnies isolées par `companyId`
2. **Workflow dynamique par compagnie** : chaque compagnie configure ses propres étapes, rôles et limites
3. **Rôles conformes à la RACI BCI** : refléter la structure Direction Risques / Direction Engagements / Back-office / Commercial / Juridique
4. **Chinese Wall** : enforcement technique de la séparation fonctionnelle
5. **Utilisateur multi-compagnie** : un utilisateur peut appartenir à plusieurs compagnies avec des rôles différents
6. **Migration automatique** : les données BCI existantes sont migrées vers une compagnie "BCI" sans perte

---

## 2. Architecture multi-tenant

### 2.1 Modèle de tenancy
**Row-level tenancy** : `companyId` ajouté sur tous les modèles. Un middleware injecte et vérifie `companyId` sur chaque requête.

### 2.2 Nouveaux modèles Prisma

```prisma
model Company {
  id          String   @id @default(cuid())
  name        String
  code        String   @unique
  logoUrl     String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  memberships       CompanyMembership[]
  clients           Client[]
  applications      CreditApplication[]
  creditPolicies    CreditPolicy[]
  creditTypes       CreditType[]
  approvalLimits    ApprovalLimit[]
  branches          Branch[]
  departments       Department[]
  delegations       PowerDelegation[]
  notifications     Notification[]
  announcements     Announcement[]
}

model CompanyMembership {
  id        String    @id @default(cuid())
  userId    String
  companyId String
  role      UserRole  // Un seul rôle actif par compagnie (intentionnel — séparation des fonctions)
  isActive  Boolean   @default(true)
  joinedAt  DateTime  @default(now())

  user      User      @relation(fields: [userId], references: [id])
  company   Company   @relation(fields: [companyId], references: [id])

  @@unique([userId, companyId])  // Contrainte intentionnelle : un rôle unique par (user, company)
  @@index([companyId])
  @@index([userId])
}
// NOTE: Un rôle unique par compagnie est une décision délibérée conforme au principe
// de séparation des fonctions (Chinese Wall). Pour changer de rôle : UPDATE membership.role.
// Un utilisateur ayant besoin de deux fonctions dans la même compagnie doit avoir deux comptes
// distincts — exigence réglementaire BCEAO (principe de non-cumul de fonctions incompatibles).
```

### 2.3 Champs `companyId` ajoutés sur
- `Client`
- `CreditApplication`
- `CreditPolicy` + `CreditPolicyStep`
- `CreditType`
- `ApprovalLimit`
- `PowerDelegation`
- `Notification`
- `Announcement`
- `AuditLog`

Tous avec `@@index([companyId])` pour les performances.

### 2.4 Middleware `requireCompany`
```typescript
// Injecté sur toutes les routes protégées POST-sélection
export function requireCompany(req, res, next) {
  const { companyId } = req.user; // extrait du JWT
  if (!companyId) return res.status(403).json({ error: 'Compagnie non sélectionnée' });
  req.companyId = companyId;
  next();
}
```

**Routes PRÉ-sélection** (token sans `companyId`, pas de `requireCompany`) :
- `POST /api/auth/login`
- `GET  /api/auth/companies`
- `POST /api/auth/select-company`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

**Routes POST-sélection** (token avec `companyId`, `requireCompany` obligatoire) :
- Toutes les autres routes `/api/*`

**Routes SUPER_ADMIN** (`/api/platform/*`) :
- `requireAuth` uniquement (pas `requireCompany`) — accès cross-compagnie contrôlé

Toutes les requêtes Prisma filtrent sur `{ companyId: req.companyId }`.

---

## 3. Authentification multi-compagnie

### 3.1 Flux de connexion
```
POST /api/auth/login { email, password }
→ { user, companies: [{ id, name, code, role, logoUrl }], partialToken }
  partialToken : JWT sans companyId, signé, valide 5 min, uniquement pour /select-company

Si 1 compagnie  → auto-sélection (POST /select-company automatique)
Si N compagnies → afficher sélecteur (timeout UI : 4 min 30, compte à rebours visible)

POST /api/auth/select-company { companyId, partialToken }
→ JWT final { userId, companyId, role, permissions, jti, exp }
  L'ancien partialToken est révoqué (blacklist Redis sur jti)

GET /api/auth/companies → liste des compagnies de l'utilisateur connecté

POST /api/auth/switch-company { companyId }
→ nouveau JWT final (nouveau jti)
  L'ancien JWT est ajouté à la blacklist Redis (jti → exp)
  Stratégie : blacklist légère sur jti, nettoyée à l'expiration du token
```

**Invalidation JWT au switch-company** : blacklist Redis par `jti`. L'ancien token est invalide immédiatement. TTL Redis = durée restante du token invalide.

### 3.2 JWT payload
```typescript
interface JWTPayload {
  userId: string;
  companyId: string;
  role: UserRole;
  permissions: string[];
  exp: number;
}
```

### 3.3 Frontend — CompanyContext
```typescript
interface CompanyContextValue {
  currentCompany: Company | null;
  companies: CompanyMembership[];
  switchCompany: (companyId: string) => Promise<void>;
  isLoading: boolean;
}
```

Sélecteur de compagnie dans la barre de navigation (visible si l'utilisateur appartient à > 1 compagnie).

---

## 4. Rôles organisationnels (basés sur la RACI BCI)

### 4.1 Nouveaux rôles UserRole

```prisma
enum UserRole {
  // Rôles opérationnels (basés sur RACI)
  CHARGE_AFFAIRES           // Ex ACCOUNT_MANAGER — Dir. Commerciale
  ANALYSTE_RISQUES          // Ex CREDIT_ANALYST — Dir. Risques
  RESPONSABLE_RISQUES       // Ex ANALYST_SUPERVISOR — Dir. Risques (superviseur)
  RESPONSABLE_ENGAGEMENTS   // Ex BRANCH_MANAGER — Dir. Engagements
  BACK_OFFICE               // Nouveau — saisie SIB, garanties, tirages
  DIRECTION_JURIDIQUE       // Nouveau — formalisation garanties, informé
  COMITE_CREDIT             // Ex CREDIT_COMMITTEE — transversal
  DIRECTION_GENERALE        // Ex MANAGEMENT — validation finale
  // Rôles système
  ADMIN                     // Admin compagnie
  SUPER_ADMIN               // Admin plateforme (cross-compagnie)
}
```

### 4.2 Correspondance RACI → Rôles système

| Activité RACI | Rôle Responsable | Rôle Consulté |
|---|---|---|
| Vérification complétude dossiers | RESPONSABLE_ENGAGEMENTS | ANALYSTE_RISQUES |
| Contre-analyse dossiers crédit | ANALYSTE_RISQUES | RESPONSABLE_ENGAGEMENTS |
| Calcul ratios prudentiels | ANALYSTE_RISQUES | RESPONSABLE_RISQUES |
| Organisation comités crédit | RESPONSABLE_ENGAGEMENTS | ANALYSTE_RISQUES |
| Notifications de crédit | RESPONSABLE_ENGAGEMENTS | CHARGE_AFFAIRES |
| Mise en place crédits SIB | BACK_OFFICE | RESPONSABLE_ENGAGEMENTS |
| Saisie garanties | BACK_OFFICE | RESPONSABLE_ENGAGEMENTS |
| Visite garanties hypothécaires | CHARGE_AFFAIRES | RESPONSABLE_ENGAGEMENTS |
| Reporting BCEAO prudentiel | ANALYSTE_RISQUES | RESPONSABLE_RISQUES |
| Suivi impayés | ANALYSTE_RISQUES | RESPONSABLE_ENGAGEMENTS |

### 4.3 Chinese Wall — Règles d'enforcement

Mapping explicite entre rôles et `stepType`/`stepName` interdits :

```typescript
// Mapping role → stepNames interdits (via CreditPolicyStep.stepName)
const CHINESE_WALL_RULES: Record<UserRole, { forbiddenStepNames: string[]; reason: string }> = {
  ANALYSTE_RISQUES: {
    forbiddenStepNames: ['mise_en_place_sib', 'saisie_garanties', 'tirage_fonds', 'back_office_setup'],
    reason: 'Direction Risques ne peut pas exécuter des opérations SIB (principe de séparation)'
  },
  RESPONSABLE_ENGAGEMENTS: {
    forbiddenStepNames: ['contre_analyse', 'calcul_ratios_prudentiels', 'notation_interne', 'avis_risques'],
    reason: 'Direction Engagements ne peut pas émettre un avis Risques'
  }
}

// Dans canApproveStep() :
const rule = CHINESE_WALL_RULES[user.role];
if (rule && rule.forbiddenStepNames.includes(step.stepName)) {
  await auditLog({ type: 'CHINESE_WALL_VIOLATION', userId, stepName: step.stepName });
  return { allowed: false, reason: rule.reason };
}
```

Enforcement dans `canApproveStep()` du `workflowService.ts`.
Toute tentative de violation génère un audit log de type `CHINESE_WALL_VIOLATION`.

---

## 5. Workflow dynamique par compagnie

### 5.1 Étapes du workflow BCI (basées sur RACI)

```
1. CHARGE_AFFAIRES        → Dépôt et complétude du dossier (DISPATCH)
2. RESPONSABLE_ENGAGEMENTS → Vérification complétude (ANALYSIS)
3. ANALYSTE_RISQUES       → Contre-analyse et notation (ANALYSIS)
4. RESPONSABLE_RISQUES    → Validation analyse (APPROVAL — si montant > seuil)
5. COMITE_CREDIT          → Passage en comité (COMMITTEE — si montant > seuil)
6. DIRECTION_GENERALE     → Validation finale (APPROVAL — grands montants)
7. BACK_OFFICE            → Mise en place SIB + saisie garanties (ANALYSIS)
8. DIRECTION_JURIDIQUE    → Formalisation garanties (ANALYSIS — si hypothèque)
```

### 5.2 Configuration par compagnie
Chaque `CreditPolicy` appartient à une compagnie. Les `CreditPolicyStep` sont entièrement configurables par le ADMIN de la compagnie via l'API et l'interface.

### 5.3 Preview workflow
`GET /api/credit-policies/preview?creditTypeId=X&amount=Y&companyId=Z` — simule les étapes applicables pour un montant donné dans une compagnie donnée.

---

## 6. Interface utilisateur

### 6.1 Sélecteur de compagnie (LoginPage)
Après authentification réussie, si l'utilisateur appartient à > 1 compagnie : modal de sélection avec logo, nom, rôle de l'utilisateur dans cette compagnie.

### 6.2 Barre de navigation
Badge compagnie active avec possibilité de switcher (si multi-compagnie).

### 6.3 CompanySettingsPage (ADMIN)
Onglets :
- **Général** : nom, logo, devise, fuseau horaire
- **Utilisateurs** : inviter, changer rôle, désactiver
- **Agences/Départements** : CRUD
- **Workflow** : éditeur visuel des étapes CreditPolicy
- **Limites d'approbation** : montants min/max par rôle
- **Types de crédit** : CRUD

### 6.4 PlatformAdminPage (SUPER_ADMIN)
- Liste des compagnies avec stats d'usage
- Création d'une nouvelle compagnie
- Activation/désactivation
- Impersonation (accès en lecture seule à une compagnie) :
  - `POST /api/platform/impersonate { companyId }` → token temporaire `{ impersonatedCompanyId, readOnly: true, jti, exp: 30min }`
  - **Audit log obligatoire** : `IMPERSONATION_STARTED` + `IMPERSONATION_ENDED` (ou expiration)
  - Token impersonation distinct du token normal (claim `readOnly: true`)
  - Toutes les mutations bloquées si `readOnly: true` dans le middleware

### 6.5 Workflow existant
`WorkflowPage.tsx` et `WorkflowDetailsDialog.tsx` : adaptation pour afficher les nouveaux rôles RACI, filtrage par `companyId` injecté depuis le contexte.

---

## 7. Migration automatique

### 7.1 Script `backend/prisma/migrate-tenant.js`
```
1. Renommer valeurs enum UserRole PostgreSQL (ALTER TYPE ... RENAME VALUE)
   - 'ACCOUNT_MANAGER'    → 'CHARGE_AFFAIRES'
   - 'CREDIT_ANALYST'     → 'ANALYSTE_RISQUES'
   - 'ANALYST_SUPERVISOR' → 'RESPONSABLE_RISQUES'
   - 'BRANCH_MANAGER'     → 'RESPONSABLE_ENGAGEMENTS'
   - 'CREDIT_COMMITTEE'   → 'COMITE_CREDIT'
   - 'MANAGEMENT'         → 'DIRECTION_GENERALE'
   Commandes SQL : ALTER TYPE "UserRole" RENAME VALUE 'OLD' TO 'NEW';
   Guard idempotent : vérifier pg_enum avant chaque renommage.

2. Créer Company { name: "BCI", code: "BCI", isActive: true }
   Guard idempotent : upsert sur code = 'BCI'

3. UPDATE tous les modèles SET companyId = bci.id WHERE companyId IS NULL

4. Créer CompanyMembership pour chaque User existant (role = User.role actuel)
   Guard idempotent : upsert sur [userId, companyId]

5. Promouvoir SUPER_ADMIN :
   - Sélectionner le User avec role = 'ADMIN' et isActive = true ORDER BY createdAt ASC LIMIT 1
   - Guard idempotent : si un SUPER_ADMIN existe déjà → skip
   - UPDATE user SET role = 'SUPER_ADMIN'

6. Vérifier intégrité : COUNT(*) WHERE companyId IS NULL = 0 sur tous les modèles
```

Script 100% idempotent : peut être relancé plusieurs fois sans effet de bord.

### 7.2 Intégration dans bci-update.sh
```bash
npx prisma migrate deploy         # nouvelles colonnes avec DEFAULT NULL
node prisma/migrate-tenant.js     # rattacher données à BCI
npx prisma generate               # régénérer client
```

---

## 8. Gestion des erreurs et sécurité

### 8.1 Isolation stricte
- Jamais de `companyId` passé en paramètre client — toujours extrait du JWT
- Chaque lecture/écriture vérifie `resource.companyId === req.companyId`
- Erreur 403 si tentative d'accès cross-compagnie

### 8.2 SUPER_ADMIN
- Peut accéder à toutes les compagnies mais uniquement via endpoints dédiés `/api/platform/*`
- Les endpoints normaux `/api/*` restent filtrés par companyId

### 8.3 Chinese Wall
- Vérification dans `canApproveStep()` avant toute décision
- Audit log de toute tentative de violation Chinese Wall

---

## 9. Stratégie de tests

### 9.1 Tests d'isolation
- Créer 2 compagnies (BCI + TEST_CO) avec données distinctes
- Vérifier qu'un token BCI ne peut pas lire les données TEST_CO
- Vérifier le switch de compagnie

### 9.2 Tests workflow RACI
- Créer une application et vérifier que les étapes respectent la RACI
- Vérifier le Chinese Wall : ANALYSTE_RISQUES ne peut pas faire une action BACK_OFFICE
- Vérifier les conditions par montant

### 9.3 Tests migration
- Vérifier zéro ligne sans companyId après migration
- Vérifier que les memberships ont été créés pour tous les users

---

## 10. Fichiers à créer ou modifier

### Backend
| Fichier | Action |
|---|---|
| `backend/prisma/schema.prisma` | Ajouter Company, CompanyMembership, companyId partout, nouveaux UserRole |
| `backend/prisma/migrations/` | Nouvelle migration Prisma |
| `backend/prisma/migrate-tenant.js` | Script migration BCI |
| `backend/src/middleware/auth.ts` | Extraire companyId du JWT, requireCompany |
| `backend/src/routes/auth.ts` | /login retourne companies, /select-company, /switch-company |
| `backend/src/routes/companies.ts` | CRUD compagnies (ADMIN + SUPER_ADMIN) |
| `backend/src/routes/platform.ts` | PlatformAdmin endpoints (SUPER_ADMIN) |
| `backend/src/routes/workflows.ts` | Filtrage companyId |
| `backend/src/routes/applications.ts` | Filtrage companyId |
| `backend/src/routes/credit-policy.ts` | Filtrage companyId |
| `backend/src/routes/users.ts` | Filtrage companyId, memberships |
| `backend/src/routes/*.ts` | Filtrage companyId sur toutes les routes |
| `backend/src/services/workflowService.ts` | Chinese Wall dans canApproveStep |
| `backend/src/server.ts` | Monter routes companies et platform |
| `backend/src/constants/stepNames.ts` | Nouveaux noms d'étapes RACI |

### Frontend
| Fichier | Action |
|---|---|
| `src/types/index.ts` | Nouveaux UserRole, Company, CompanyMembership |
| `src/contexts/UserContext.tsx` | Ajouter CompanyContext, switchCompany |
| `src/pages/LoginPage.tsx` | Sélecteur de compagnie post-login |
| `src/pages/CompanySettingsPage.tsx` | Nouveau — settings compagnie |
| `src/pages/PlatformAdminPage.tsx` | Nouveau — admin plateforme |
| `src/components/CompanySelector.tsx` | Nouveau — modal sélecteur |
| `src/components/CompanySwitcher.tsx` | Nouveau — switcher navbar |
| `src/pages/WorkflowPage.tsx` | Adapter nouveaux rôles RACI |
| `src/pages/UserManagementPage.tsx` | Gestion memberships |
| `src/services/api.ts` | Endpoints compagnie |
| `src/App.tsx` | Routes CompanySettings, PlatformAdmin |
| `src/utils/workflowConfig.ts` | Config dynamique par compagnie |

---

## 11. Ordre d'implémentation

1. Schema Prisma + migration + script migrate-tenant
2. Middleware auth (companyId dans JWT, requireCompany)
3. Routes auth (login multi-compagnie, select-company, switch)
4. Routes companies + platform (CRUD)
5. Filtrage companyId sur toutes les routes existantes
6. Nouveaux rôles RACI + Chinese Wall dans workflowService
7. Frontend types + CompanyContext
8. Frontend LoginPage (sélecteur compagnie)
9. Frontend CompanySettingsPage + PlatformAdminPage
10. Frontend WorkflowPage adaptation rôles
11. Tests + vérification
12. Mise à jour bci-update.sh
