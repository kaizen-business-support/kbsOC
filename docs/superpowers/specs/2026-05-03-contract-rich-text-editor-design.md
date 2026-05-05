# Éditeur riche pour modèles de contrat — Design Spec

**Date :** 2026-05-03  
**Projet :** OptimusCredit  
**Statut :** Approuvé

---

## Contexte

Les modèles de contrat fonctionnent actuellement par upload de fichier DOCX/PDF. Le `VariableCatalogPanel` permet de copier des variables (`{{client.companyName}}`) dans le presse-papiers pour les coller dans Word avant upload. L'objectif est d'ajouter une alternative : rédiger le contenu juridique directement dans un éditeur riche Quill intégré à l'interface, avec insertion de variables sous forme de chips visuels, et génération PDF côté backend.

---

## Décisions clés

| Sujet | Décision |
|---|---|
| Mode | Upload fichier ET éditeur riche coexistent |
| Format de sortie (éditeur) | PDF via `html-pdf-node` |
| Insertion variables | Toolbar Quill + bouton "Insérer" dans le panneau |
| Affichage variables | Chips colorés non-éditables (custom Quill Blot) |
| Architecture | Étendre `ContractTemplate` existant (Option B) |
| Stockage HTML | HTML brut (chips convertis côté client avant POST) |

---

## 1. Schéma de données

### Migration Prisma

`fileFormat` est actuellement une enum Prisma `ContractFileFormat`. On y ajoute `RICH_TEXT`. Les champs `filePath`, `fileSize`, `originalName` doivent devenir optionnels car ils sont null pour les templates RICH_TEXT.

```prisma
enum ContractFileFormat {
  DOCX       @map("docx")
  PDF        @map("pdf")
  RICH_TEXT  @map("rich_text")  // NOUVEAU
}

model ContractTemplate {
  // champs existants modifiés :
  fileFormat   ContractFileFormat
  filePath     String?  @map("file_path")      // était NOT NULL
  fileSize     Int?     @map("file_size")       // était NOT NULL
  originalName String?  @map("original_name")  // était NOT NULL
  // NOUVEAU :
  htmlContent  String?  @map("html_content")
}
```

**Invariant :**
- `RICH_TEXT` → `htmlContent != null`, `filePath/fileSize/originalName == null`
- `DOCX/PDF` → `filePath/fileSize/originalName != null`, `htmlContent == null`

La migration est backward compatible : les templates existants gardent leurs valeurs, seule la colonne `htmlContent` est ajoutée (nullable, donc pas de valeur par défaut requise). Les champs `filePath/fileSize/originalName` deviennent nullable au niveau Prisma mais restent renseignés pour les templates existants.

---

## 2. Backend

### 2.1 `contractTemplateService.ts`

Ajouter `extractVariablesFromHtml(html: string): string[]` :
- Strip les balises HTML via regex simple : `html.replace(/<[^>]+>/g, ' ')`
- Appliquer la regex existante : `\{\{\s*([\w][\w.]*)\s*\}\}`
- Même classification catalogue/personnalisé que pour DOCX

### 2.2 `contractGenerationService.ts`

Dans `generateContract()`, ajouter une branche `RICH_TEXT` :

```
1. Charger template.htmlContent
2. buildMergeContext(application) → contexte existant
3. flattenContext(context) → clés plates
4. Remplacer {{variables}} dans le HTML via regex
5. Sanitizer le HTML avec `sanitize-html` (supprimer <script>, handlers JS)
6. Envelopper dans layout PDF (CSS marges, police, en-tête)
7. html-pdf-node → Buffer PDF
8. Sauvegarder /uploads/contracts/{applicationId}/{filename}.pdf
9. Créer entrée GeneratedContract (même logique qu'actuellement)
```

**Note opérationnelle :** `html-pdf-node` dépend de Puppeteer/Chromium (~300MB). S'assurer que Chromium est disponible dans l'environnement de déploiement. En conteneur Alpine, utiliser `@sparticuz/chromium` ou une image Node avec Chromium installé. Ajouter cette dépendance au Dockerfile/instructions de déploiement.

### 2.3 `GET /contract-templates/:id/download`

Ajouter une garde avant `res.download()` :

```typescript
if (tpl.fileFormat === 'RICH_TEXT') {
  return res.status(400).json({ error: 'Ce modèle est un éditeur en ligne, pas un fichier téléchargeable.' });
}
```

### 2.4 Routes `POST /contract-templates`

Créer **deux routes séparées** pour éviter le conflit entre multer et JSON. La route spécifique `/rich-text` doit être enregistrée **avant** la route racine `POST /` dans le fichier router (Express évalue les routes dans l'ordre d'enregistrement) :

```
POST /api/contract-templates/rich-text → JSON body (RICH_TEXT) — NOUVEAU (enregistrer en premier)
POST /api/contract-templates           → multer upload (DOCX/PDF) — existant
```

La route `rich-text` accepte `{ name, documentType, creditTypeIds, description, htmlContent }`, appelle `extractVariablesFromHtml()` au lieu de `extractVariablesFromDocx()`, puis retourne le même format de réponse que la route existante.

**Précondition de `extractVariablesFromHtml` :** cette fonction suppose que le client a déjà appelé `serializeEditorContent()` avant le POST — le HTML reçu contient des `{{variables}}` textuelles, pas des chips DOM. Si des chips non-sérialisés arrivent (scenario de copier-coller futur), la regex `data-variable` ne sera pas détectée. Pour robustesse, avant le strip de balises, appliquer une passe qui extrait les `data-variable="{{...}}"` et les insère en texte :
```typescript
html = html.replace(/data-variable="(\{\{[^"]+\}\})"/g, ' $1 ');
```

### 2.5 `PUT /contract-templates/:id`

Ajouter `htmlContent` aux champs acceptés. Quand `htmlContent` est fourni et que le template est `RICH_TEXT`, re-dériver `detectedVariables` et `customFields` via `extractVariablesFromHtml(htmlContent)` :

```typescript
const { name, description, creditTypeIds, customFields, isActive, htmlContent } = req.body;

let updateData: any = { name, description, creditTypeIds, isActive };

if (htmlContent !== undefined) {
  const { catalogVariables, customVars } = extractVariablesFromHtml(htmlContent);
  updateData.htmlContent = htmlContent;
  updateData.detectedVariables = [...catalogVariables, ...customVars.map(v => v.name)];
  // customFields : préserver les labels/types existants, ajouter les nouveaux, supprimer les disparus
  updateData.customFields = reconcileCustomFields(customFields, customVars);
} else {
  updateData.customFields = customFields;
}

await prisma.contractTemplate.update({ data: updateData });
```

**Note :** `reconcileCustomFields(existing, detected)` conserve les configs (label, type, required) des variables qui existent encore, supprime celles qui ont disparu, ajoute les nouvelles avec des valeurs par défaut.

### 2.6 Sanitisation XSS

Installer `sanitize-html` côté backend. Appeler `sanitizeHtml(html, { allowedTags: sanitizeHtml.defaults.allowedTags, allowedAttributes: {...} })` avant de passer le HTML à `html-pdf-node`. Autoriser les balises de mise en forme (p, h1-h3, ul, ol, li, strong, em, u, table, tr, td, th) mais interdire `<script>`, `<style>`, les attributs `on*` et `javascript:`.

### 2.7 Installation

```bash
cd backend && npm install html-pdf-node sanitize-html
cd backend && npm install --save-dev @types/sanitize-html
```

---

## 3. Frontend

### 3.1 Custom Quill Blot — `VariableBlot`

Fichier : `src/components/contracts/VariableBlot.ts`

- Type : `Quill.import('blots/embed')`
- Données stockées en Quill Delta : `{ variable: '{{client.companyName}}', label: 'Raison sociale', group: 'client' }`
- Rendu DOM : `<span class="ql-variable-chip" data-variable="{{client.companyName}}" data-group="client">Raison sociale</span>`
- Couleurs par groupe :
  - `client` → bleu (`#3b82f6`)
  - `application` → violet (`#7c3aed`)
  - `bank` → vert (`#16a34a`)
  - `meta` → gris (`#64748b`)
- Sélectionnable via clic → supprimable via Backspace

**Sérialisation avant POST :** avant d'envoyer le HTML au backend, une fonction `serializeEditorContent(quill: Quill): string` parcourt `quill.root.innerHTML` et remplace chaque `<span class="ql-variable-chip" data-variable="{{...}}">...</span>` par la valeur de `data-variable` (ex: `{{client.companyName}}`). Le HTML stocké en base contient donc des `{{variables}}` textuelles, pas des chips DOM. Le `extractVariablesFromHtml()` backend opère sur ce HTML sérialisé.

**Désérialisation à l'édition :** à l'ouverture de l'éditeur pour un template existant, une fonction `deserializeHtmlToQuill(html: string, quill: Quill)` remplace chaque `{{variable}}` par l'insertion du `VariableBlot` correspondant via `quill.insertEmbed()`.

### 3.2 `ContractTemplateUploadDialog`

Ajouter deux onglets (`Tabs`) en haut du Dialog :
- **Onglet "Fichier"** → formulaire upload existant (inchangé)
- **Onglet "Éditeur"** → layout deux colonnes :
  - Gauche (7/12) : Quill avec toolbar enrichie + champs nom/type/description
  - Droite (5/12) : `VariableCatalogPanel` avec prop `onInsert`

Au submit (onglet Éditeur) :
1. `serializeEditorContent(quill)` → HTML avec `{{variables}}`
2. POST JSON vers `/api/contract-templates/rich-text` via `contractTemplateApi.createRichText()`
3. Afficher step 2 (variables personnalisées détectées) — même flow qu'actuellement

### 3.3 Toolbar Quill enrichie

Ajouter un bouton custom `{ }` dans la toolbar :
- Ouvre un `Menu` MUI groupé par catégorie (Client / Dossier / Banque / Méta)
- Chaque entrée insère le `VariableBlot` correspondant via `quill.insertEmbed(index, 'variable', { variable, label, group })`

### 3.4 `VariableCatalogPanel`

Ajouter prop optionnelle :

```typescript
interface Props {
  onInsert?: (variable: string, label: string, group: string) => void;
}
```

Quand `onInsert` est fourni, chaque variable affiche un bouton **Insérer** à côté du bouton Copier.

### 3.5 `ContractTemplateEditDialog`

Si `template.fileFormat === 'RICH_TEXT'` :
- Afficher l'éditeur Quill initialisé via `deserializeHtmlToQuill(template.htmlContent ?? '', quill)`
- Afficher `VariableCatalogPanel` avec `onInsert`
- Au save : `serializeEditorContent()` → PUT JSON avec `htmlContent`

Sinon → formulaire existant (inchangé).

**Format immuable :** le `fileFormat` d'un template est fixé à la création et ne peut pas être changé après. L'UI ne propose pas de basculer entre "Fichier" et "Éditeur" en mode édition. Si un admin veut changer de format, il doit désactiver le template existant et en créer un nouveau.

### 3.6 `src/types/contracts.ts`

```typescript
export type ContractFileFormat = 'DOCX' | 'PDF' | 'RICH_TEXT'; // ajouter RICH_TEXT

export interface ContractTemplate {
  // champs devenus optionnels (ajout filePath qui était absent du type) :
  filePath:     string | null;  // NOUVEAU dans le type (était absent)
  fileSize:     number | null;  // était number
  originalName: string | null;  // était string
  // NOUVEAU :
  htmlContent:  string | null;
}
```

### 3.7 `src/services/api.ts` — `contractTemplateApi`

Ajouter méthode :

```typescript
createRichText: async (payload: {
  name: string;
  documentType: string;
  creditTypeIds: string[];
  description?: string;
  htmlContent: string;
}) => { /* POST /api/contract-templates/rich-text */ }
```

---

## 4. Flux utilisateur complet (mode éditeur)

```
1. Admin → "Nouveau modèle" → onglet "Éditeur"
2. Rédige le texte juridique dans Quill
3. Clique sur { } toolbar ou bouton "Insérer" du panneau → chip variable insérée
4. Valide → serializeEditorContent() → POST JSON /rich-text
   → backend extractVariablesFromHtml() → crée ContractTemplate (RICH_TEXT)
5. Step 2 : configure les variables personnalisées (si présentes)
6. À la génération : buildMergeContext → sanitizeHtml → remplace {{vars}} → html-pdf-node → PDF
7. PDF disponible dans ContractsListOnApplication → téléchargement / signature
```

---

## 5. Fichiers créés / modifiés

| Fichier | Action |
|---|---|
| `backend/prisma/schema.prisma` | Enum `RICH_TEXT`, rendre `filePath/fileSize/originalName` nullable, ajouter `htmlContent` |
| `backend/prisma/migrations/…` | Migration générée par `prisma migrate dev` |
| `backend/src/services/contractTemplateService.ts` | Ajouter `extractVariablesFromHtml()` |
| `backend/src/services/contractGenerationService.ts` | Branche `RICH_TEXT` + sanitisation |
| `backend/src/routes/contract-templates.ts` | Nouvelle route `POST /rich-text`, garde download, `htmlContent` dans PUT |
| `src/components/contracts/VariableBlot.ts` | NOUVEAU — custom Quill blot + serialize/deserialize |
| `src/components/contracts/ContractTemplateUploadDialog.tsx` | Onglets + éditeur |
| `src/components/contracts/ContractTemplateEditDialog.tsx` | Support RICH_TEXT |
| `src/components/contracts/VariableCatalogPanel.tsx` | Prop `onInsert` |
| `src/types/contracts.ts` | Ajouter `RICH_TEXT`, rendre champs nullable |
| `src/services/api.ts` | Ajouter `contractTemplateApi.createRichText()` |
