# Contrats signés sur la fiche client

**Date :** 2026-05-13
**Statut :** design validé, prêt pour plan d'implémentation

## 1. Contexte & objectif

Aujourd'hui les contrats signés liés à un client sont stockés comme `Document` (`category = CONTRACT`) attaché à une `CreditApplication`. Ils sont accessibles uniquement depuis la page du dossier de crédit. L'utilisateur veut, depuis la **fiche client**, retrouver tous les contrats signés du client (tous dossiers confondus) sans avoir à naviguer dossier par dossier.

L'accès doit rester restreint :
- Lecture (liste + aperçu inline) : tout utilisateur ayant accès à la fiche client.
- Téléchargement : uniquement Back-office, Juridique, Admin/SuperAdmin et chargés d'affaires de la même agence que le créateur du client.

## 2. Source de vérité

`Document` avec `category = CONTRACT`, rattaché à une `CreditApplication` du client.
**Hors-périmètre** : `GeneratedContract` et le module contrat (`contractGenerationService`, `signatureService`).

Filtre statut dossier : `application.status ∈ { APPROVED, DISBURSED, UNDER_REVIEW }` (un contrat signé peut exister en cours d'instruction si un PV/avenant a déjà été signé).

## 3. Backend

### 3.1 Nouveau endpoint — `GET /api/clients/:id/contracts`

Fichier : `backend/src/routes/clients.ts`.

- Middlewares hérités : `authenticate`, `requireCompany`, filtre tenant via `buildClientWhereFilter(req)`.
- 404 si le client n'existe pas ou n'appartient pas au tenant.
- Charge :
  ```ts
  client.applications (status ∈ { APPROVED, DISBURSED, UNDER_REVIEW })
        .documents (category = CONTRACT)
  ```
  avec `creditType { name }`, `uploader { id, name }`, `client.creator { id, branch, department }`.

- Réponse :
  ```json
  {
    "success": true,
    "contracts": [
      {
        "id": "<documentId>",
        "filename": "...",
        "mimeType": "application/pdf",
        "fileSize": 123456,
        "createdAt": "2026-04-12T...",
        "uploadedBy": { "id": "...", "name": "..." },
        "application": {
          "id": "...",
          "applicationNumber": "DOS-2026-0042",
          "status": "DISBURSED",
          "amount": 50000000,
          "creditTypeName": "Crédit Investissement"
        },
        "previewUrl": "/api/documents/preview/<documentId>",
        "downloadUrl": "/api/documents/download/<documentId>",
        "canDownload": true
      }
    ]
  }
  ```
- `canDownload` est calculé côté serveur selon la même règle que celle appliquée par la route download (cf. 3.2). Le front s'en sert uniquement pour l'affichage ; le serveur ne fait pas confiance au front.

### 3.2 Lift de permission sur `GET /api/documents/download/:id`

Fichier : `backend/src/routes/documents.ts`.

- Charger `document` avec `application.client.creator { id, branch, department, companyId }`.
- Si `document.category === 'CONTRACT'` :
  1. Vérifier `application.client.companyId === req.companyId` → sinon 403.
  2. Autoriser si :
     - `req.user.role ∈ { BACK_OFFICE, DIRECTION_JURIDIQUE, ADMIN, SUPER_ADMIN }`, **OU**
     - `req.user.role === 'CHARGE_AFFAIRES'` ET la branche/département de l'utilisateur correspond à celle du créateur du client (`user.branch || user.department === client.creator.branch || client.creator.department`).
  3. Sinon → 403 avec message `"Téléchargement réservé aux services Back-office / Juridique ou aux chargés d'affaires de l'agence concernée."`
- Pour toute autre catégorie : comportement inchangé.

### 3.3 Audit log à chaque download de contrat

Dans le handler `/api/documents/download/:id`, **après** envoi réussi du fichier (mais avant `pipe(res)` n'est pas safe — on écrit *avant* le pipe pour ne pas dépendre du flux), créer une entrée `AuditLog` lorsque `document.category === 'CONTRACT'` :

```ts
await prisma.auditLog.create({
  data: {
    userId: req.user!.id,
    applicationId: document.applicationId,
    action: 'CONTRACT_DOWNLOAD',
    entityType: 'document',
    entityId: document.id,
    oldValues: Prisma.JsonNull,
    newValues: { filename: document.filename, clientId: client.id },
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  },
});
```

L'écriture audit ne doit pas bloquer le download en cas d'erreur DB (try/catch + log).

### 3.4 Permissions — récap

| Action                | Tous (accès fiche client) | BO / Juridique / Admin / SUPER_ADMIN | CHARGE_AFFAIRES même agence |
|-----------------------|:---:|:---:|:---:|
| Listing contrats      | ✅  | ✅  | ✅ |
| Aperçu (preview)      | ✅  | ✅  | ✅ |
| Téléchargement        | ❌  | ✅  | ✅ |
| Audit log (download)  | —   | ✅  | ✅ |

## 4. Frontend

### 4.1 Nouvel onglet "Contrats" dans le drawer client

Fichier : `src/pages/ClientManagementPage.tsx` (lignes ~955-958).

- Ajouter un 4ᵉ `<Tab label="Contrats" />` après "Échéancier".
- Conditionner le rendu du panneau sur `drawerTab === 3`.

### 4.2 Composant `ClientContractsPanel`

Fichier : `src/components/client/ClientContractsPanel.tsx`.

Props : `{ clientId: string }`.

Comportement :
- Au montage / changement de `clientId` : `GET /api/clients/:id/contracts`.
- Loading → spinner ; error → message + retry ; empty → `"Aucun contrat signé pour ce client."`.
- Table MUI à 5 colonnes : **Dossier** (numéro + chip statut), **Fichier** (nom + taille), **Type de crédit**, **Date upload**, **Actions**.
- Actions par ligne :
  - **Aperçu** : icône œil — ouvre `previewUrl` dans un nouvel onglet.
  - **Télécharger** : icône download — déclenche le download via `downloadUrl` ; bouton `disabled` + Tooltip `"Téléchargement réservé aux services Back-office / Juridique ou aux chargés d'affaires de l'agence concernée."` si `canDownload === false`.

### 4.3 Aucun changement ailleurs

- Pas de modification de la page dossier (`CreditApplicationPage`) ni du module contrat.
- Pas de modification des autres onglets du drawer.

## 5. Hors-périmètre

- Module contrat (`GeneratedContract` / `signatureService`).
- Workflow de signature.
- Téléversement de contrats depuis la fiche client (l'upload reste sur la page dossier).
- Versionning / historique des contrats : on liste l'état actuel des `Document`, sans gestion de versions.

## 6. Limites connues

- **Preview ≠ download** : un PDF affiché en inline reste sauvegardable depuis le navigateur. La restriction download est donc principalement UX + audit, pas une garantie de confidentialité forte. Si une étanchéité plus forte est requise, il faudrait ajouter du watermarking côté serveur ou interdire le preview pour les non-autorisés (changement de scope).
- **Définition de "même agence"** : on compare `user.branch || user.department` à `client.creator.branch || client.creator.department`. Si l'organigramme évolue (ex. utilisateur transféré), un CHARGE_AFFAIRES peut perdre l'accès à un client qu'il a historiquement géré. Acceptable car le BO/Juridique reste accessible en fallback.

## 7. Tests

- Backend :
  - `GET /api/clients/:id/contracts` retourne uniquement les contrats des dossiers `APPROVED|DISBURSED|UNDER_REVIEW`.
  - Filtre tenant : un client d'un autre tenant → 404.
  - `canDownload` = true pour BO/Juridique/Admin, false pour CHARGE_AFFAIRES d'une autre agence.
- `GET /api/documents/download/:id` sur `Document.category=CONTRACT` :
  - BO → 200 + audit log écrit.
  - CHARGE_AFFAIRES même agence → 200 + audit log.
  - CHARGE_AFFAIRES autre agence → 403, pas d'audit.
  - Catégorie ≠ CONTRACT → comportement inchangé.
- Frontend (smoke test manuel) :
  - Onglet "Contrats" charge, affiche la table ; bouton download grisé si `canDownload=false`.

## 8. Migration / déploiement

Aucune migration de schéma. Aucun backfill. La feature est purement additive — désactiver l'onglet côté front suffit à revenir en arrière.
