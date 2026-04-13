# Délégation de Pouvoir Temporaire — Design Spec

**Date :** 2026-04-13  
**Projet :** OptimusCredit  
**Statut :** Approuvé

---

## Contexte et problème

Les utilisateurs qui doivent valider certaines actions (approbation de dossiers, dispatching, démarrage d'étapes) peuvent partir en congé, bloquant le circuit de traitement des demandes de crédit. Il faut un mécanisme sécurisé permettant de déléguer temporairement des droits d'approbation à un autre utilisateur pour garantir la continuité des activités.

---

## Décisions de conception

| Question | Décision |
|---|---|
| Qui crée une délégation ? | L'utilisateur lui-même OU un Admin |
| Portée de la délégation | Partielle — liste d'actions spécifiques choisies |
| Périmètre du délégué | Même agence par défaut ; Admin peut outrepasser |
| Statut "En congé" | Automatique dès qu'une délégation est active |
| Durée maximale | Configurable par l'Admin (pas de limite fixe dans le code) |
| Architecture | Table `PowerDelegation` + helper `resolveDelegation` |

---

## 1. Modèle de données

### 1.1 Nouveau modèle `PowerDelegation`

```prisma
model PowerDelegation {
  id          String    @id @default(cuid())
  delegatorId String    @map("delegator_id")
  delegateId  String    @map("delegate_id")
  startDate   DateTime  @map("start_date")
  endDate     DateTime  @map("end_date")
  reason      String?
  permissions Json      // string[] — liste des actions déléguées
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
  @@map("power_delegations")
}
```

### 1.2 Champ `isOnLeave` sur `User`

```prisma
isOnLeave  Boolean  @default(false)  @map("is_on_leave")
```

Géré automatiquement :
- `true` dès que `startDate <= now` lors de la création d'une délégation active
- `false` à la révocation ou à l'expiration (`endDate < now`)

### 1.3 Actions déléguables

```typescript
const DELEGATABLE_ACTIONS = [
  'APPROVE_WORKFLOW',     // approuver une étape
  'REJECT_WORKFLOW',      // rejeter une étape
  'DISPATCH_APPLICATION', // dispatcher un dossier à un analyste
  'START_STEP',           // démarrer une étape d'analyse
] as const;
```

---

## 2. Logique métier

### 2.1 Helper central `resolveDelegation`

Ajouté dans `workflowService.ts` :

```typescript
async function resolveDelegation(
  userId: string,
  action: string
): Promise<{ delegatorId: string; delegatorRole: UserRole; delegatorBranch: string | null; delegatorDepartment: string | null; delegatorName: string } | null>
```

Recherche une délégation active :
- `delegateId = userId`
- `isActive = true`
- `startDate <= now <= endDate`
- `permissions` contient `action`

Retourne les informations du délégant, ou `null` si aucune délégation trouvée.

### 2.2 Points d'intégration

| Fichier | Fonction/Route | Modification |
|---|---|---|
| `workflowService.ts` | `canApproveStep` | Appel `resolveDelegation` si rôle direct non autorisé ; utilise branche du délégant pour l'isolation agence |
| `workflows.ts` | `POST start-step` | Idem — vérifie délégation si l'utilisateur n'a pas le rôle direct |
| `dispatching.ts` | `POST assign` | Vérifie si l'utilisateur est délégué d'un superviseur de la bonne agence |

### 2.3 Règles de sécurité

1. **Pas de re-délégation** — un délégué ne peut pas créer de sous-délégation
2. **Portée limitée** — seules les actions listées dans `permissions` sont autorisées
3. **Isolation agence** — s'applique avec la branche du **délégant** (pas du délégué)
4. **Unicité** — une seule délégation active à la fois par délégant (la précédente est révoquée automatiquement)
5. **Pas de sur-délégation** — impossible de déléguer des droits que l'on ne possède pas soi-même
6. **Durée max** — vérifiée au moment de la création (configurable par Admin)

### 2.4 Audit trail

Chaque action effectuée sous délégation est loguée avec :
```json
{
  "actingAs": "delegation",
  "delegatorId": "...",
  "delegatorName": "Jean Dupont",
  "delegationId": "..."
}
```

---

## 3. API REST

Base : `/api/delegations`  
Middleware d'authentification JWT appliqué sur toutes les routes.

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET /` | `/api/delegations` | Admin | Toutes les délégations, avec filtres (statut, délégant, délégué, période) |
| `GET /my` | `/api/delegations/my` | Tout utilisateur authentifié | Délégations de l'utilisateur (données et reçues) |
| `GET /delegatable-actions` | `/api/delegations/delegatable-actions` | Authentifié | Actions déléguables selon le rôle de l'utilisateur |
| `POST /` | `/api/delegations` | Admin ou soi-même | Créer une délégation |
| `PATCH /:id/revoke` | `/api/delegations/:id/revoke` | Admin ou délégant | Révoquer avant expiration |

### Validation à la création (POST)

- `delegateId` : utilisateur actif, même agence (sauf si Admin)
- `endDate > startDate`
- `endDate - startDate` ≤ durée max configurée
- Les permissions demandées ⊆ permissions que le délégant possède réellement
- Aucune autre délégation active pour ce délégant → révocation automatique si existante

### Effets de bord à la création

- Si `startDate <= today` → `User.isOnLeave = true` sur le délégant
- Notification in-app envoyée au délégué : "Vous avez reçu une délégation de pouvoir de [Nom] du [date] au [date]"

### Effets de bord à la révocation/expiration

- `User.isOnLeave = false` sur le délégant
- Notification au délégant et au délégué

---

## 4. Interface utilisateur

### 4.1 Badge "En congé"

Affiché partout où un utilisateur apparaît (liste dispatching, assignation analyste, gestion utilisateurs) :
- Badge orange `EN CONGÉ` si `isOnLeave = true`
- Sous-titre : *"Délégué à : [Nom du délégué]"*

### 4.2 Onglet "Délégations" (Admin — Gestion des utilisateurs)

- Tableau : délégant, délégué, dates, actions déléguées, statut, motif
- Filtres : statut (active/expirée/révoquée), délégant, délégué
- Actions : créer une délégation pour n'importe quel utilisateur, révoquer

### 4.3 Section "Ma délégation" (profil utilisateur)

- Délégations actives données et reçues
- Formulaire de création : délégué (liste filtrée agence), dates, motif, cases à cocher par action
- Bouton "Révoquer" sur les délégations actives

### 4.4 Indicateur lors d'une action déléguée

Bandeau affiché dans l'interface quand l'utilisateur agit en tant que délégué :
> *"Vous agissez au nom de Jean Dupont (délégation active jusqu'au 30/04/2026)"*

---

## 5. Migration base de données

Fichier : `backend/prisma/migrations/20260413000000_add_power_delegation/migration.sql`

```sql
ALTER TABLE "users" ADD COLUMN "is_on_leave" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "power_delegations" (
  "id"           TEXT NOT NULL,
  "delegator_id" TEXT NOT NULL,
  "delegate_id"  TEXT NOT NULL,
  "start_date"   TIMESTAMP(3) NOT NULL,
  "end_date"     TIMESTAMP(3) NOT NULL,
  "reason"       TEXT,
  "permissions"  JSONB NOT NULL,
  "is_active"    BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" TEXT NOT NULL,
  "revoked_at"   TIMESTAMP(3),
  "revoked_by_id" TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "power_delegations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "power_delegations_delegator_id_idx" ON "power_delegations"("delegator_id");
CREATE INDEX "power_delegations_delegate_id_idx" ON "power_delegations"("delegate_id");

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

---

## 6. Fichiers à créer / modifier

| Fichier | Action |
|---|---|
| `backend/prisma/schema.prisma` | Ajouter `PowerDelegation` + `isOnLeave` sur `User` + relations |
| `backend/prisma/migrations/20260413000000_add_power_delegation/migration.sql` | Créer |
| `backend/src/routes/delegations.ts` | Créer (5 endpoints) |
| `backend/src/server.ts` | Monter `/api/delegations` |
| `backend/src/services/workflowService.ts` | Ajouter `resolveDelegation`, modifier `canApproveStep` |
| `backend/src/routes/workflows.ts` | Modifier `start-step` |
| `backend/src/routes/dispatching.ts` | Modifier `assign` |
| `src/pages/UserManagementPage.tsx` | Ajouter onglet Délégations |
| `src/components/DelegationForm.tsx` | Créer (formulaire création) |
| `src/components/DelegationBadge.tsx` | Créer (badge En congé) |
| `src/pages/ProfilePage.tsx` (ou équivalent) | Ajouter section Ma délégation |
