# Éditeur riche Quill pour modèles de contrat — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un éditeur riche Quill dans les modèles de contrat permettant de rédiger le contenu juridique directement dans l'UI, d'insérer des variables comme chips colorés, et de générer un PDF côté backend via html-pdf-node.

**Architecture:** On étend le modèle `ContractTemplate` existant avec un champ `htmlContent` et la valeur d'enum `RICH_TEXT`. Le backend détecte `fileFormat === 'RICH_TEXT'` pour emprunter le chemin de génération PDF (html-pdf-node + sanitize-html) au lieu du chemin DOCX existant. Le frontend introduit un `VariableBlot` Quill custom (chips non-éditables) et ajoute un onglet "Éditeur" dans le dialog de création.

**Tech Stack:** Prisma (migration DDL), html-pdf-node, sanitize-html, react-quill v2 / quill v2, MUI Tabs, TypeScript

**Spec:** `docs/superpowers/specs/2026-05-03-contract-rich-text-editor-design.md`

---

## Cartographie des fichiers

| Fichier | Action | Responsabilité |
|---|---|---|
| `backend/prisma/schema.prisma` | Modifier | Enum + champs nullable + htmlContent |
| `backend/src/services/contractTemplateService.ts` | Modifier | Ajouter extractVariablesFromHtml, reconcileCustomFields |
| `backend/src/services/contractGenerationService.ts` | Modifier | Branche RICH_TEXT (html-pdf-node + sanitize) |
| `backend/src/routes/contract-templates.ts` | Modifier | Route POST /rich-text, garde download, PUT htmlContent |
| `src/types/contracts.ts` | Modifier | RICH_TEXT + champs nullable |
| `src/services/api.ts` | Modifier | contractTemplateApi.createRichText() |
| `src/components/contracts/VariableBlot.ts` | Créer | Custom Quill blot + serialize/deserialize |
| `src/components/contracts/VariableCatalogPanel.tsx` | Modifier | Prop onInsert |
| `src/components/contracts/ContractTemplateUploadDialog.tsx` | Modifier | Onglets + mode éditeur |
| `src/components/contracts/ContractTemplateEditDialog.tsx` | Modifier | Branche RICH_TEXT avec éditeur |

---

## Task 1 — Migration Prisma

**Files:**
- Modify: `backend/prisma/schema.prisma:813-837`

- [ ] **Step 1: Modifier schema.prisma**

Dans `backend/prisma/schema.prisma`, remplacer les lignes 813-837 (bloc `ContractTemplate` + enum) par :

```prisma
// dans model ContractTemplate, remplacer les 4 champs :
  fileFormat        ContractFileFormat @map("file_format")
  filePath          String?  @map("file_path")
  fileSize          Int?     @map("file_size")
  originalName      String?  @map("original_name")
  htmlContent       String?  @map("html_content")
```

Et l'enum :

```prisma
enum ContractFileFormat {
  DOCX      @map("docx")
  PDF       @map("pdf")
  RICH_TEXT @map("rich_text")

  @@map("contract_file_format")
}
```

- [ ] **Step 2: Générer et appliquer la migration**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
npx prisma migrate dev --name add_rich_text_contract_template
```

Expected: migration créée dans `prisma/migrations/`, base de données mise à jour.

- [ ] **Step 3: Régénérer le client Prisma**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
npx prisma generate
```

- [ ] **Step 4: Vérifier que le backend compile sans erreur**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
npx tsc --noEmit
```

Expected: 0 erreurs TypeScript. Si des erreurs apparaissent sur `filePath` ou `fileSize` (utilisés comme non-nullable ailleurs), les corriger en ajoutant `!` ou des guards `if (template.filePath)`.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(schema): ajouter RICH_TEXT à ContractFileFormat, htmlContent nullable"
```

---

## Task 2 — Service contractTemplateService

**Files:**
- Modify: `backend/src/services/contractTemplateService.ts`

- [ ] **Step 1: Ajouter extractVariablesFromHtml et reconcileCustomFields**

Ouvrir `backend/src/services/contractTemplateService.ts`. Ajouter à la fin du fichier :

```typescript
export function extractVariablesFromHtml(html: string): string[] {
  // Passe défensive : extraire les data-variable si chips non-sérialisés arrivent
  const withInlined = html.replace(/data-variable="(\{\{[^"]+\}\})"/g, ' $1 ');
  const text = withInlined.replace(/<[^>]+>/g, ' ');
  return extractVariablesFromText(text);
}

export function reconcileCustomFields(
  existing: Array<{ name: string; label: string; type: string; required: boolean }>,
  detectedCustomNames: string[],
): Array<{ name: string; label: string; type: string; required: boolean }> {
  const existingMap = new Map(existing.map((f) => [f.name, f]));
  return detectedCustomNames.map((name) =>
    existingMap.get(name) ?? { name, label: name, type: 'text', required: false },
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
npx tsc --noEmit
```

Expected: 0 erreurs.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/contractTemplateService.ts
git commit -m "feat(contracts): extractVariablesFromHtml + reconcileCustomFields"
```

---

## Task 3 — Installer les dépendances backend + branche RICH_TEXT dans la génération

**Files:**
- Modify: `backend/src/services/contractGenerationService.ts`

- [ ] **Step 1: Installer html-pdf-node et sanitize-html**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
npm install html-pdf-node sanitize-html
npm install --save-dev @types/sanitize-html @types/html-pdf-node
```

Note : si `@types/html-pdf-node` n'existe pas sur npm, utiliser `// @ts-ignore` avant l'import.

- [ ] **Step 2: Ajouter la branche RICH_TEXT dans generateContract()**

Ouvrir `backend/src/services/contractGenerationService.ts`. Ajouter les imports en haut du fichier (après les imports existants) :

```typescript
import sanitizeHtml from 'sanitize-html';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const htmlPdf = require('html-pdf-node');
```

Dans la fonction `generateContract()`, remplacer le bloc `if (template.fileFormat === 'DOCX') { ... } else { ... }` (lignes 111-129 actuelles) par :

```typescript
  if (template.fileFormat === 'DOCX') {
    const data = fs.readFileSync(template.filePath!);
    const zip = new PizZip(data);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });
    const ctx = buildMergeContext(app, opts.customValues);
    doc.render(flattenContext(ctx));
    const buf = doc.getZip().generate({ type: 'nodebuffer' });
    outFilename = `${contractId}.docx`;
    outPath = path.join(outDir, outFilename);
    fs.writeFileSync(outPath, buf);
  } else if (template.fileFormat === 'RICH_TEXT') {
    const ctx = buildMergeContext(app, opts.customValues);
    const flat = flattenContext(ctx);
    let html = template.htmlContent!;
    // Remplacer {{variables}} par leurs valeurs
    html = html.replace(/\{\{\s*([\w][\w.]*)\s*\}\}/g, (_, key) =>
      flat[key] !== undefined ? String(flat[key]) : '',
    );
    // Sanitiser avant PDF (interdire <script>, attributs on*, javascript:)
    const clean = sanitizeHtml(html, {
      allowedTags: [
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'strong', 'em', 'u', 's',
        'table', 'thead', 'tbody', 'tr', 'td', 'th',
        'br', 'hr', 'blockquote', 'pre', 'code', 'span', 'div',
      ],
      allowedAttributes: {
        '*': ['style', 'class'],
        'a': ['href'],
        'td': ['colspan', 'rowspan'],
        'th': ['colspan', 'rowspan'],
      },
      allowedSchemes: ['http', 'https'],
    });
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12pt; margin: 40px; color: #111; }
  h1, h2, h3 { color: #1e3a5f; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #ccc; padding: 6px 10px; }
  p { margin: 0.5em 0; line-height: 1.6; }
</style></head><body>${clean}</body></html>`;
    const file = { content: fullHtml };
    const options = { format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' } };
    const pdfBuffer: Buffer = await htmlPdf.generatePdf(file, options);
    outFilename = `${contractId}.pdf`;
    outPath = path.join(outDir, outFilename);
    fs.writeFileSync(outPath, pdfBuffer);
  } else {
    outFilename = `${contractId}.pdf`;
    outPath = path.join(outDir, outFilename);
    fs.copyFileSync(template.filePath!, outPath);
  }
```

Et pour le `mimeType` dans `prisma.document.create()`, remplacer la ligne 137-139 par :

```typescript
      mimeType: template.fileFormat === 'DOCX'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf',
```

(déjà correct, juste s'assurer que `RICH_TEXT` est couvert par le `else` qui retourne `application/pdf`)

- [ ] **Step 3: Vérifier la compilation**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/contractGenerationService.ts backend/package.json backend/package-lock.json
git commit -m "feat(contracts): génération PDF depuis template RICH_TEXT via html-pdf-node"
```

---

## Task 4 — Routes contract-templates (backend)

**Files:**
- Modify: `backend/src/routes/contract-templates.ts`

- [ ] **Step 1: Ajouter l'import de extractVariablesFromHtml et reconcileCustomFields**

En haut du fichier, modifier la ligne d'import du service :

```typescript
import {
  extractVariablesFromDocx, extractVariablesFromHtml,
  classifyVariables, validateMagicBytes, reconcileCustomFields,
} from '../services/contractTemplateService';
```

- [ ] **Step 2: Ajouter la route POST /rich-text avant la route POST /**

Juste avant la ligne `router.post('/', authorize(...)` (ligne 69), insérer :

```typescript
// ─── POST /rich-text ──────────────────────────────────────────────────────────
router.post('/rich-text', authorize(['manage_contract_templates']), async (req: Request, res: Response) => {
  try {
    const { name, documentType, description, htmlContent } = req.body;
    const creditTypeIds = Array.isArray(req.body.creditTypeIds) ? req.body.creditTypeIds : [];
    if (!name || !documentType || !htmlContent) {
      return res.status(400).json({ success: false, error: 'name, documentType et htmlContent obligatoires' });
    }
    const vars = extractVariablesFromHtml(htmlContent);
    const { custom } = classifyVariables(vars);
    const customFields = custom.map((n) => ({ name: n, label: n, type: 'text', required: false }));
    const tpl = await prisma.contractTemplate.create({
      data: {
        companyId: req.companyId!,
        name,
        documentType,
        description: description || null,
        fileFormat: 'RICH_TEXT',
        htmlContent,
        creditTypeIds,
        customFields,
        detectedVariables: vars,
        createdBy: req.user!.id,
      },
    });
    res.status(201).json({ success: true, data: tpl });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Un modèle avec ce nom existe déjà' });
    }
    console.error('[contract-templates] POST /rich-text', e);
    res.status(500).json({ success: false, error: e.message });
  }
});
```

- [ ] **Step 3: Mettre à jour PUT /:id pour gérer htmlContent**

Remplacer le bloc `router.put('/:id', ...)` existant par :

```typescript
router.put('/:id', authorize(['manage_contract_templates']), async (req: Request, res: Response) => {
  try {
    const { name, description, creditTypeIds, customFields, isActive, htmlContent } = req.body;
    const existing = await prisma.contractTemplate.findFirst({
      where: { id: req.params.id, companyId: req.companyId },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Modèle introuvable' });

    const updateData: any = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(creditTypeIds !== undefined && { creditTypeIds }),
      ...(isActive !== undefined && { isActive }),
    };

    if (htmlContent !== undefined && existing.fileFormat === 'RICH_TEXT') {
      const vars = extractVariablesFromHtml(htmlContent);
      const { custom } = classifyVariables(vars);
      updateData.htmlContent = htmlContent;
      updateData.detectedVariables = vars;
      updateData.customFields = reconcileCustomFields(customFields ?? [], custom);
    } else if (customFields !== undefined) {
      updateData.customFields = customFields;
    }

    const tpl = await prisma.contractTemplate.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json({ success: true, data: tpl });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Un modèle avec ce nom existe déjà' });
    }
    console.error('[contract-templates] PUT', e);
    res.status(500).json({ success: false, error: e.message });
  }
});
```

- [ ] **Step 4: Ajouter la garde RICH_TEXT dans GET /:id/download**

Remplacer le handler `router.get('/:id/download', ...)` par :

```typescript
router.get('/:id/download', async (req: Request, res: Response) => {
  const tpl = await prisma.contractTemplate.findFirst({
    where: { id: req.params.id, companyId: req.companyId },
  });
  if (!tpl) return res.status(404).json({ success: false, error: 'Modèle introuvable' });
  if (tpl.fileFormat === 'RICH_TEXT') {
    return res.status(400).json({ success: false, error: 'Ce modèle est un éditeur en ligne, non téléchargeable' });
  }
  res.download(tpl.filePath!, tpl.originalName!);
});
```

- [ ] **Step 5: Vérifier la compilation**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/contract-templates.ts
git commit -m "feat(contracts): route POST /rich-text, garde download, PUT htmlContent"
```

---

## Task 5 — Types TypeScript frontend + API service

**Files:**
- Modify: `src/types/contracts.ts`
- Modify: `src/services/api.ts:1784-1843`

- [ ] **Step 1: Mettre à jour src/types/contracts.ts**

Remplacer la ligne 1 et l'interface `ContractTemplate` :

```typescript
export type ContractFileFormat = 'DOCX' | 'PDF' | 'RICH_TEXT';
```

Dans `ContractTemplate`, remplacer les champs concernés :

```typescript
export interface ContractTemplate {
  id: string;
  companyId: string;
  name: string;
  documentType: string;
  description: string | null;
  fileFormat: ContractFileFormat;
  filePath: string | null;      // était absent du type
  fileSize: number | null;      // était number
  originalName: string | null;  // était string
  htmlContent: string | null;   // NOUVEAU
  creditTypeIds: string[];
  customFields: ContractCustomField[];
  detectedVariables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Ajouter contractTemplateApi.createRichText() dans src/services/api.ts**

Après la méthode `create()` (ligne ~1813), ajouter :

```typescript
  async createRichText(payload: {
    name: string;
    documentType: string;
    creditTypeIds: string[];
    description?: string;
    htmlContent: string;
  }): Promise<any> {
    try {
      const r = await api.post('/contract-templates/rich-text', payload);
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur création modèle éditeur' };
    }
  },
```

- [ ] **Step 3: Vérifier que le frontend compile**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit
```

Corriger les éventuelles erreurs dues aux champs devenus `null` (ex: `template.fileSize` utilisé sans guard).

- [ ] **Step 4: Commit**

```bash
git add src/types/contracts.ts src/services/api.ts
git commit -m "feat(contracts): types RICH_TEXT + contractTemplateApi.createRichText"
```

---

## Task 6 — VariableBlot (custom Quill embed)

**Files:**
- Create: `src/components/contracts/VariableBlot.ts`

- [ ] **Step 1: Créer le fichier VariableBlot.ts**

**Important :** ne pas importer `Quill` depuis `'quill'` directement — sous CRA/webpack, `react-quill` v2 embarque sa propre copie de quill v1, et les deux instances seraient distinctes, ce qui ferait échouer l'enregistrement du blot. Utiliser `ReactQuill.Quill` pour garantir que l'on opère sur la même instance qu'utilise l'éditeur.

Créer `src/components/contracts/VariableBlot.ts` avec le contenu suivant :

```typescript
import type Quill from 'quill';  // type uniquement — pour annoter les paramètres de fonction
import ReactQuill from 'react-quill';

const Quill = (ReactQuill as any).Quill;
const Embed = Quill.import('blots/embed') as any;

const GROUP_COLORS: Record<string, string> = {
  client:      '#3b82f6',
  application: '#7c3aed',
  bank:        '#16a34a',
  meta:        '#64748b',
};

export class VariableBlot extends Embed {
  static blotName = 'variable';
  static tagName = 'span';

  static create(value: { variable: string; label: string; group: string }) {
    const node = super.create() as HTMLElement;
    node.setAttribute('data-variable', value.variable);
    node.setAttribute('data-group', value.group);
    node.setAttribute('contenteditable', 'false');
    node.classList.add('ql-variable-chip');
    node.textContent = value.label;
    const color = GROUP_COLORS[value.group] || '#64748b';
    node.style.cssText = [
      `background:${color}18`,
      `color:${color}`,
      'border:1px solid currentColor',
      'border-radius:4px',
      'padding:1px 6px',
      'font-size:12px',
      'font-family:monospace',
      'cursor:default',
      'user-select:none',
      'display:inline-block',
      'margin:0 2px',
    ].join(';');
    return node;
  }

  static value(node: HTMLElement) {
    return {
      variable: node.getAttribute('data-variable') || '',
      label: node.textContent || '',
      group: node.getAttribute('data-group') || '',
    };
  }
}

Quill.register(VariableBlot);

// ─── Helpers sérialisation ────────────────────────────────────────────────────

export function serializeEditorContent(quill: Quill): string {
  const container = quill.root.cloneNode(true) as HTMLElement;
  container.querySelectorAll<HTMLElement>('.ql-variable-chip').forEach((chip) => {
    const variable = chip.getAttribute('data-variable') || '';
    const text = document.createTextNode(variable);
    chip.replaceWith(text);
  });
  return container.innerHTML;
}

export function deserializeHtmlToQuill(html: string, quill: Quill): void {
  // Remplacer {{vars}} par des spans marqués ; dangerouslyPasteHTML reconstruit les blots
  const markedHtml = html.replace(
    /\{\{\s*([\w][\w.]*)\s*\}\}/g,
    (_, v) => `<span class="ql-variable-chip" data-variable="{{${v}}}" data-group="${v.split('.')[0]}">${v}</span>`,
  );
  quill.clipboard.dangerouslyPasteHTML(markedHtml);
}
```

- [ ] **Step 2: Vérifier que le frontend compile**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/contracts/VariableBlot.ts
git commit -m "feat(contracts): VariableBlot Quill custom avec serialize/deserialize"
```

---

## Task 7 — VariableCatalogPanel : prop onInsert

**Files:**
- Modify: `src/components/contracts/VariableCatalogPanel.tsx`

- [ ] **Step 1: Ajouter la prop onInsert**

Ouvrir `src/components/contracts/VariableCatalogPanel.tsx`. Trouver l'interface `Props` (ou les props du composant) et ajouter :

```typescript
interface Props {
  onInsert?: (variable: string, label: string, group: string) => void;
}
```

Dans la signature du composant :

```typescript
export function VariableCatalogPanel({ onInsert }: Props = {}) {
```

- [ ] **Step 2: Ajouter le bouton Insérer à côté du bouton Copier**

Le composant itère `Object.entries(groups).map(([g, fields]) => ...)` puis `fields.map((f) => ...)`. Le label d'affichage est `FIELD_LABELS[f] ?? f`.

Dans `AccordionDetails`, remplacer le `Chip` existant par un groupe Chip + bouton Insérer :

```tsx
{fields.map((f) => (
  <Box key={f} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <Tooltip title={`{{${g}.${f}}}`}>
      <Chip
        size="small"
        label={FIELD_LABELS[f] ?? f}
        onClick={() => copy(g, f)}
        sx={{ cursor: 'pointer', fontSize: 11 }}
      />
    </Tooltip>
    {onInsert && (
      <Button
        size="small"
        variant="outlined"
        sx={{ minWidth: 0, px: 1, fontSize: 11, py: 0 }}
        onClick={() => onInsert(`{{${g}.${f}}}`, FIELD_LABELS[f] ?? f, g)}
      >
        Insérer
      </Button>
    )}
  </Box>
))}
```

Ajouter `Button` à l'import MUI en haut du fichier.

- [ ] **Step 3: Vérifier que le frontend compile**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/contracts/VariableCatalogPanel.tsx
git commit -m "feat(contracts): VariableCatalogPanel prop onInsert pour éditeur Quill"
```

---

## Task 8 — ContractTemplateUploadDialog : onglets + mode éditeur

**Files:**
- Modify: `src/components/contracts/ContractTemplateUploadDialog.tsx`

- [ ] **Step 1: Ajouter les imports nécessaires**

En haut du fichier, modifier l'import `react` existant pour ajouter `useRef` :

```typescript
import React, { useEffect, useState, useRef } from 'react';
```

Fusionner `Tabs, Tab` dans le bloc MUI existant (ne pas ajouter un deuxième `import from '@mui/material'`) :

```typescript
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Select, MenuItem, InputLabel, FormControl, Box, Typography,
  Chip, Stack, Alert, IconButton, Checkbox, FormControlLabel,
  Stepper, Step, StepLabel, OutlinedInput,
  Tabs, Tab, Menu,  // ← ajouter ces trois
} from '@mui/material';
```

Ajouter après les imports MUI :

```typescript
import ReactQuill from 'react-quill';  // PAS { Quill } — react-quill v2 ne le re-exporte pas
import 'react-quill/dist/quill.snow.css';
import { serializeEditorContent } from './VariableBlot';  // auto-enregistre VariableBlot à l'import
```

`VariableBlot` s'auto-enregistre à l'import de `VariableBlot.ts` — pas besoin d'appel explicite.

- [ ] **Step 2: Ajouter l'état du mode et de l'éditeur**

Dans le composant, ajouter les états :

```typescript
const [mode, setMode] = useState<'file' | 'editor'>('file');
const [htmlContent, setHtmlContent] = useState('');
const [varMenuAnchor, setVarMenuAnchor] = useState<null | HTMLElement>(null);
const quillRef = useRef<ReactQuill>(null);
```

Réinitialiser dans le `else` du `useEffect` sur `open` :

```typescript
setMode('file');
setHtmlContent('');
```

- [ ] **Step 3: Créer le handler handleSubmitEditor**

```typescript
const handleSubmitEditor = async () => {
  if (!name || !htmlContent) { setError('Nom et contenu obligatoires'); return; }
  setError(null); setLoading(true);
  const serialized = serializeEditorContent(quillRef.current!.getEditor());
  const r = await contractTemplateApi.createRichText({
    name, documentType, description, creditTypeIds, htmlContent: serialized,
  });
  setLoading(false);
  if (!r.success) { setError(r.error); return; }
  setCreated(r.data);
  setCustomFields(r.data.customFields || []);
  setStep(1);
};
```

- [ ] **Step 4: Définir QUILL_MODULES (à partager entre les deux dialogs)**

Créer `src/components/contracts/quillConfig.ts` :

```typescript
export const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['blockquote'],
    ['clean'],
  ],
};
```

Dans `ContractTemplateUploadDialog.tsx`, importer :

```typescript
import { QUILL_MODULES } from './quillConfig';
```

Le bouton variable `{ }` est un `Button` MUI + `Menu` placé juste au-dessus de l'éditeur Quill (voir Step 5 pour le JSX complet).

- [ ] **Step 5: Ajouter les onglets et le rendu du mode éditeur dans le JSX**

Dans le `DialogContent`, avant le `Stepper`, ajouter (seulement si `step === 0`) :

```tsx
{step === 0 && (
  <Tabs value={mode} onChange={(_, v) => setMode(v)} sx={{ mb: 2 }}>
    <Tab value="file" label="Fichier (.docx / .pdf)" />
    <Tab value="editor" label="Éditeur de contenu" />
  </Tabs>
)}
```

Entourer le contenu actuel du `step === 0` dans un `{step === 0 && mode === 'file' && (...)}`.

Ajouter le rendu éditeur :

```tsx
{step === 0 && mode === 'editor' && (
  <Stack spacing={2}>
    <TextField label="Nom du modèle *" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" />
    <FormControl fullWidth size="small">
      <InputLabel>Type de document</InputLabel>
      <Select value={documentType} label="Type de document" onChange={(e) => setDocumentType(e.target.value)}>
        {DOCUMENT_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
      </Select>
    </FormControl>
    {/* Types de crédit — même Select multiple que dans le mode fichier */}
    <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={2} fullWidth size="small" />

    <Box sx={{ display: 'flex', gap: 2 }}>
      {/* Éditeur Quill — col gauche */}
      <Box sx={{ flex: 7 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Contenu du contrat</Typography>
          {/* Bouton { } pour insérer une variable depuis la toolbar */}
          <Button
            size="small"
            variant="outlined"
            sx={{ fontFamily: 'monospace', fontSize: 12 }}
            onClick={(e) => setVarMenuAnchor(e.currentTarget)}
          >
            {'{ }'}
          </Button>
          <Menu anchorEl={varMenuAnchor} open={!!varMenuAnchor} onClose={() => setVarMenuAnchor(null)}>
            {/* Groupes chargés depuis l'API catalog — catalogGroups est un état à ajouter */}
            {Object.entries(catalogGroups).map(([g, fields]) =>
              (fields as string[]).map((f: string) => (
                <MenuItem
                  key={`${g}.${f}`}
                  dense
                  onClick={() => {
                    setVarMenuAnchor(null);
                    const q = quillRef.current?.getEditor();
                    if (!q) return;
                    const range = q.getSelection(true);
                    q.insertEmbed(range.index, 'variable', {
                      variable: `{{${g}.${f}}}`,
                      label: `${g}.${f}`,
                      group: g,
                    });
                    q.setSelection(range.index + 1);
                  }}
                >
                  <Typography sx={{ fontFamily: 'monospace', fontSize: 12 }}>{`{{${g}.${f}}}`}</Typography>
                </MenuItem>
              ))
            )}
          </Menu>
        </Box>
        <ReactQuill
          ref={quillRef}
          value={htmlContent}
          onChange={setHtmlContent}
          modules={QUILL_MODULES}
          style={{ height: 350, marginBottom: 42 }}
        />
      </Box>
      {/* Panneau variables — col droite */}
      <Box sx={{ flex: 5 }}>
        <VariableCatalogPanel
          onInsert={(variable, label, group) => {
            const q = quillRef.current?.getEditor();
            if (!q) return;
            const range = q.getSelection(true);
            q.insertEmbed(range.index, 'variable', { variable, label, group });
            q.setSelection(range.index + 1);
          }}
        />
      </Box>
    </Box>
  </Stack>
)}
```

Ajouter également l'état `catalogGroups` et le charger dans le `useEffect` existant sur `open` :

```typescript
const [catalogGroups, setCatalogGroups] = useState<Record<string, string[]>>({});

// dans useEffect sur open=true, après creditPolicyApi.getCreditTypes() :
contractTemplateApi.getCatalog().then((r) => {
  if (r.success) setCatalogGroups(r.data.groups);
});
// dans le else (reset) :
setCatalogGroups({});
```

- [ ] **Step 6: Mettre à jour les boutons DialogActions**

Dans `DialogActions`, le bouton "Suivant" du step 0 doit appeler le bon handler :

```tsx
{step === 0 && (
  <Button
    onClick={mode === 'file' ? handleUpload : handleSubmitEditor}
    variant="contained"
    disabled={(mode === 'file' ? (!file || !name) : (!name || !htmlContent)) || loading}
  >
    Suivant
  </Button>
)}
```

- [ ] **Step 7: Vérifier que le frontend compile**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/components/contracts/ContractTemplateUploadDialog.tsx
git commit -m "feat(contracts): onglets Fichier/Éditeur dans ContractTemplateUploadDialog"
```

---

## Task 9 — ContractTemplateEditDialog : support RICH_TEXT

**Files:**
- Modify: `src/components/contracts/ContractTemplateEditDialog.tsx`

- [ ] **Step 1: Ajouter les imports**

Modifier l'import `react` existant pour ajouter `useRef` :

```typescript
import React, { useEffect, useState, useRef } from 'react';
```

Ajouter après les imports MUI existants :

```typescript
import ReactQuill from 'react-quill';  // PAS { Quill } — non exporté par react-quill v2
import 'react-quill/dist/quill.snow.css';
import { serializeEditorContent, deserializeHtmlToQuill } from './VariableBlot';
import { QUILL_MODULES } from './quillConfig';
import { VariableCatalogPanel } from './VariableCatalogPanel';  // déjà peut-être importé
```

- [ ] **Step 2: Ajouter l'état htmlContent et la ref Quill**

```typescript
const [htmlContent, setHtmlContent] = useState<string>('');
const quillRef = useRef<ReactQuill>(null);
```

Dans `useEffect` (ou initialisation), si `template.fileFormat === 'RICH_TEXT'` :

```typescript
useEffect(() => {
  if (template.fileFormat === 'RICH_TEXT' && template.htmlContent) {
    setHtmlContent(template.htmlContent);
    // La désérialisation en blots se fait après le mount de ReactQuill
  }
}, [template]);
```

- [ ] **Step 3: Mettre à jour handleSave**

Modifier `handleSave` pour inclure `htmlContent` si RICH_TEXT :

```typescript
const handleSave = async () => {
  setError(null); setLoading(true);
  const payload: any = { name, description, creditTypeIds, isActive };
  if (template.fileFormat === 'RICH_TEXT' && quillRef.current) {
    payload.htmlContent = serializeEditorContent(quillRef.current.getEditor());
  } else {
    payload.customFields = customFields;
  }
  const r = await contractTemplateApi.update(template.id, payload);
  setLoading(false);
  if (!r.success) { setError(r.error); return; }
  onSaved();
};
```

- [ ] **Step 4: Ajouter la branche RICH_TEXT dans le rendu**

Dans le JSX, ajouter après les champs nom/description/crédit :

```tsx
{template.fileFormat === 'RICH_TEXT' && (
  <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
    <Box sx={{ flex: 7 }}>
      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>Contenu du contrat</Typography>
      <ReactQuill
        ref={quillRef}
        value={htmlContent}
        onChange={setHtmlContent}
        modules={QUILL_MODULES}
        style={{ height: 350, marginBottom: 42 }}
      />
    </Box>
    <Box sx={{ flex: 5 }}>
      <VariableCatalogPanel
        onInsert={(variable, label, group) => {
          const q = quillRef.current?.getEditor();
          if (!q) return;
          const range = q.getSelection(true);
          q.insertEmbed(range.index, 'variable', { variable, label, group });
          q.setSelection(range.index + 1);
        }}
      />
    </Box>
  </Box>
)}

{template.fileFormat !== 'RICH_TEXT' && customFields.length > 0 && (
  // ... bloc customFields existant ...
)}
```

`QUILL_MODULES` est importé depuis `./quillConfig` (créé en Task 8 Step 4) — ne pas le redéfinir.

- [ ] **Step 5: Vérifier que le frontend compile**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/components/contracts/ContractTemplateEditDialog.tsx
git commit -m "feat(contracts): ContractTemplateEditDialog support RICH_TEXT"
```

---

## Task 10 — Test manuel de bout en bout

- [ ] **Step 1: Démarrer le backend et le frontend**

```bash
# Terminal 1
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npm run dev

# Terminal 2
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npm run dev
```

- [ ] **Step 2: Créer un template RICH_TEXT**

1. Aller dans Paramètres → Modèles de contrats → "Nouveau modèle"
2. Cliquer sur l'onglet "Éditeur de contenu"
3. Saisir un nom, un type de document
4. Rédiger un texte avec des variables : cliquer "Insérer" dans le panneau → chips colorés apparaissent
5. Cliquer "Suivant" → step 2 doit afficher les variables personnalisées détectées
6. Cliquer "Terminer"

Expected: le template apparaît dans la liste avec le badge `RICH_TEXT`.

- [ ] **Step 3: Générer un contrat depuis ce template**

1. Aller sur un dossier de crédit → étape Juridique
2. Cliquer "Générer" sur le template RICH_TEXT
3. Remplir les variables personnalisées (si présentes) → Générer
4. Le contrat apparaît dans la liste → cliquer Télécharger

Expected: un fichier PDF téléchargeable avec les variables remplacées par les données du dossier.

- [ ] **Step 4: Modifier le template RICH_TEXT**

1. Dans Modèles de contrats → icône Modifier sur le template RICH_TEXT
2. Vérifier que l'éditeur Quill s'affiche avec le contenu existant (chips reconstitués)
3. Ajouter/supprimer des variables → Enregistrer

Expected: les modifications sont sauvegardées.

- [ ] **Step 5: Vérifier que le mode fichier est inchangé**

Créer un template en mode "Fichier" (upload DOCX) → vérifier que le comportement existant est intact.

- [ ] **Step 6: Commit final si tout est OK**

```bash
git add -A
git commit -m "feat(contracts): éditeur riche Quill pour modèles de contrat — intégration complète"
```
