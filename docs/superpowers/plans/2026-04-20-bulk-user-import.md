# Bulk User Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Import Excel" button everywhere users are created, allowing bulk creation from a .xlsx template with a live progress bar.

**Architecture:** A single self-contained `BulkUserImportDialog` component handles all 5 steps (template download → upload → preview → import → report). For tenant ADMIN it calls `ApiService.createUser()` (`POST /api/users`, companyId from JWT). For SUPER_ADMIN it calls `POST /api/platform/companies/:id/members` with a per-user auto-generated password. No backend changes required.

**Tech Stack:** React 18, MUI v5, TypeScript, `xlsx` (already in package.json as `^0.18.5`), `ApiService` from `src/services/api.ts`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/BulkUserImportDialog.tsx` | **Create** | All 5 steps, validation, import loop, report |
| `src/pages/UserManagementPage.tsx` | **Modify** (~line 1631) | Add "Import Excel" button + wire dialog |
| `src/pages/PlatformAdminPage.tsx` | **Modify** (~line 340) | Add "Import Excel" button per company + wire dialog |

`xlsx` is already installed — no `npm install` needed.

---

## Codebase Context

- **ADMIN user creation**: `ApiService.createUser({ name, email, role, department, branch, jobTitle })` → `POST /api/users`. Password auto-generated server-side. `req.companyId` injected from JWT. Returns `{ success: boolean, data, error? }`.
- **SUPER_ADMIN user creation**: `ApiService.post('/platform/companies/:id/members', { email, name, role, password })` → `POST /api/platform/companies/:id/members`. Requires an explicit `password` in the body (not auto-generated). Supports only `{ email, name, role }` user fields (department/branch/jobTitle are silently ignored). `ApiService.post()` throws on HTTP 4xx/5xx — no manual success check needed; rely on the catch block.
  > **⚠️ Spec deviation note:** The approved spec says "call POST /api/users with companyId?" for all contexts. The actual backend does not accept a `companyId` body parameter on `POST /api/users`; that endpoint injects companyId from the JWT, which is absent for SUPER_ADMIN. The correct SUPER_ADMIN endpoint is `/platform/companies/:id/members`. This plan uses the correct backend endpoint.
- **`xlsx` import**: `import * as XLSX from 'xlsx';`
- **Design tokens** (teal brand): primary `#0F766E`, background `#F8FAFC`, text `#0F172A`

---

## Task 1 — Types + Dialog Shell (5-step stepper, no logic)

**Files:**
- Create: `src/components/BulkUserImportDialog.tsx`

- [ ] **Step 1: Create the file with types and shell**

```tsx
// src/components/BulkUserImportDialog.tsx
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Stepper, Step, StepLabel, Button, Box, Typography,
  LinearProgress, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Alert, CircularProgress, IconButton,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Upload as UploadIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { ApiService } from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BulkImportError {
  row: number;    // 1-based data row (header not counted)
  email: string;  // empty string if email is absent
  message: string;
}

interface BulkImportRow {
  rowIndex: number;  // 1-based
  name: string;
  email: string;
  role: string;
  department: string;
  branch: string;
  jobTitle: string;
  valid: boolean;
  errorMessage: string;
  status: 'pending' | 'success' | 'error' | 'skipped';
  apiError?: string;
}

export interface BulkUserImportDialogProps {
  open: boolean;
  /**
   * Called when user closes before reaching step 5 (cancel at steps 1–3,
   * or clicking the X button / backdrop before import starts).
   */
  onClose: () => void;
  /**
   * Called when user leaves step 5 (report), whether import finished
   * normally or was cancelled mid-import. Also called if user dismisses
   * the dialog via backdrop/escape from step 5.
   */
  onComplete: (created: number, errors: BulkImportError[]) => void;
  /**
   * Required only in SUPER_ADMIN context (PlatformAdminPage).
   * When provided, import uses POST /api/platform/companies/:companyId/members.
   * When absent, import uses ApiService.createUser() (companyId from JWT).
   */
  companyId?: string;
}

const STEPS = ['Modèle', 'Upload', 'Aperçu', 'Import', 'Rapport'];

const VALID_ROLES = [
  'CHARGE_AFFAIRES', 'ANALYSTE_RISQUES', 'RESPONSABLE_RISQUES',
  'RESPONSABLE_ENGAGEMENTS', 'COMITE_CREDIT', 'DIRECTION_GENERALE',
  'DIRECTION_JURIDIQUE', 'BACK_OFFICE', 'ADMIN',
];

const EXPECTED_HEADERS = ['Nom complet', 'Email', 'Rôle', 'Département', 'Agence', 'Poste'];

const MAX_ROWS = 500;

// ── Helpers ───────────────────────────────────────────────────────────────────

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const validateRows = (raw: BulkImportRow[]): BulkImportRow[] => {
  const seenEmails = new Map<string, number>(); // normalized email → first rowIndex
  return raw.map(row => {
    const errors: string[] = [];
    if (!row.name) errors.push('Nom obligatoire');
    if (!row.email) {
      errors.push('Email obligatoire');
    } else if (!isValidEmail(row.email)) {
      errors.push('Format email invalide');
    } else {
      const normalized = row.email.toLowerCase();
      if (seenEmails.has(normalized)) {
        errors.push(`Email en doublon (ligne ${seenEmails.get(normalized)})`);
      } else {
        seenEmails.set(normalized, row.rowIndex);
      }
    }
    if (!row.role || !VALID_ROLES.includes(row.role)) errors.push('Rôle invalide');
    return { ...row, valid: errors.length === 0, errorMessage: errors.join(' · ') };
  });
};

// ── Component ─────────────────────────────────────────────────────────────────

export const BulkUserImportDialog: React.FC<BulkUserImportDialogProps> = ({
  open, onClose, onComplete, companyId,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkImportRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [finalErrors, setFinalErrors] = useState<BulkImportError[]>([]);
  const cancelRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setActiveStep(0); setUploadError(null); setRows([]); setProgress(0);
    setImporting(false); setCancelled(false); setCreatedCount(0); setFinalErrors([]);
    cancelRef.current = false;
  };

  // Called by backdrop click, ESC, or the "Annuler" button
  const handleClose = () => {
    if (activeStep < 4) {
      resetState();
      onClose();
    } else {
      // Step 5: treat any dismissal as finishing — same as clicking "Terminer"
      onComplete(createdCount, finalErrors);
      resetState();
    }
  };

  const handleFinish = () => {
    onComplete(createdCount, finalErrors);
    resetState();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 700 }}>
        Import en lot d'utilisateurs
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {STEPS.map(label => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>
        {/* Steps rendered in Tasks 2–6 */}
        <Typography color="text.secondary">Étape {activeStep + 1} — à implémenter</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Fermer</Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkUserImportDialog;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/BulkUserImportDialog.tsx
git commit -m "feat(bulk-import): dialog shell — types + 5-step stepper skeleton"
```

---

## Task 2 — Step 1: Excel Template Generation

**Files:**
- Modify: `src/components/BulkUserImportDialog.tsx`

The template step renders a description and a "Télécharger le modèle" button. Clicking it generates and downloads `modele-import-utilisateurs.xlsx`.

- [ ] **Step 1: Add `downloadTemplate` function and Step 1 render**

Replace `{/* Steps rendered in Tasks 2–6 */}` block inside `<DialogContent>` with a conditional renderer. Add the template generation function inside the component (before `return`):

```tsx
  // ── Template generation ───────────────────────────────────────────────────

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      EXPECTED_HEADERS,
      ['Jean Dupont', 'jean.dupont@banque.com', 'CHARGE_AFFAIRES', 'Commercial', 'Siège', 'Chargé d\'Affaires Senior'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 22 }];

    // NOTE: SheetJS community edition (v0.18.x) does NOT support data validation
    // or cell styles — ws['!dataValidations'] is silently ignored.
    // The generated file will have the correct headers and example row,
    // but column C will NOT have a role dropdown. The valid roles are listed
    // in the dialog description so the user knows what to enter.

    XLSX.utils.book_append_sheet(wb, ws, 'Utilisateurs');
    XLSX.writeFile(wb, 'modele-import-utilisateurs.xlsx');
  };
```

Replace the placeholder `<Typography>` in `<DialogContent>` with a proper step renderer:

```tsx
        {/* Step content */}
        <Box>
          {activeStep === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                Téléchargez le modèle Excel
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 480, mx: 'auto' }}>
                Remplissez le fichier téléchargé avec vos utilisateurs (max 500 lignes),
                puis revenez sur cette page pour l'importer.
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<DownloadIcon />}
                onClick={downloadTemplate}
                sx={{ bgcolor: '#0F766E', '&:hover': { bgcolor: '#0D6560' } }}
              >
                Télécharger le modèle (.xlsx)
              </Button>
              <Box sx={{ mt: 4, textAlign: 'left', mx: 'auto', maxWidth: 420 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Colonnes du modèle :
                </Typography>
                {['A — Nom complet (obligatoire)', 'B — Email (obligatoire)',
                  `C — Rôle (obligatoire) — valeurs : ${VALID_ROLES.join(', ')}`,
                  'D — Département', 'E — Agence', 'F — Poste'].map(col => (
                  <Typography key={col} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>• {col}</Typography>
                ))}
              </Box>
            </Box>
          )}
          {activeStep > 0 && <Typography>Étape {activeStep + 1}</Typography>}
        </Box>
```

Update `<DialogActions>` to include a "Suivant" button on step 0:

```tsx
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {activeStep < 4 && activeStep !== 2 && activeStep !== 3 && (
          <Button onClick={handleClose} disabled={importing}>Annuler</Button>
        )}
        {activeStep === 0 && (
          <Button variant="contained" onClick={() => setActiveStep(1)}
            sx={{ bgcolor: '#0F766E', '&:hover': { bgcolor: '#0D6560' } }}>
            Suivant — Upload
          </Button>
        )}
        {activeStep === 4 && (
          <Button variant="contained" onClick={handleFinish}
            sx={{ bgcolor: '#0F766E', '&:hover': { bgcolor: '#0D6560' } }}>
            Terminer
          </Button>
        )}
      </DialogActions>
```

Note: steps 2 and 3 have their own inline navigation buttons — the global Annuler is hidden for those steps.

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/BulkUserImportDialog.tsx
git commit -m "feat(bulk-import): step 1 — template download (.xlsx generation)"
```

---

## Task 3 — Step 2: File Upload + Format Validation

**Files:**
- Modify: `src/components/BulkUserImportDialog.tsx`

Validates: extension = `.xlsx`, headers match exactly, file not empty. Validation runs once at parse time (in `handleFileUpload`) — results stored in `rows` state so step 3 reads them directly without re-running.

- [ ] **Step 1: Add `handleFileUpload` function and Step 2 render**

Add this function inside the component (after `handleFinish`):

```tsx
  // ── File upload ───────────────────────────────────────────────────────────

  const handleFileUpload = (file: File) => {
    setUploadError(null);

    // 1. Extension check
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setUploadError('Format invalide — seuls les fichiers .xlsx sont acceptés');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // 2. Header check
        const header = (raw[0] ?? []) as string[];
        const mismatch = EXPECTED_HEADERS.some((h, i) => (header[i] || '').trim() !== h);
        if (mismatch || header.length < EXPECTED_HEADERS.length) {
          setUploadError('Structure du fichier invalide — utilisez le modèle fourni');
          return;
        }

        // 3. Empty file check
        const dataRows = raw.slice(1).filter(r => r.some(c => String(c).trim() !== ''));
        if (dataRows.length === 0) {
          setUploadError('Le fichier ne contient aucune donnée');
          return;
        }

        // Parse then validate all rows once — stored directly in state
        const parsed: BulkImportRow[] = dataRows.map((r, i) => ({
          rowIndex: i + 1,
          name: String(r[0] ?? '').trim(),
          email: String(r[1] ?? '').trim(),
          role: String(r[2] ?? '').trim(),
          department: String(r[3] ?? '').trim(),
          branch: String(r[4] ?? '').trim(),
          jobTitle: String(r[5] ?? '').trim(),
          valid: false,
          errorMessage: '',
          status: 'pending' as const,
        }));

        setRows(validateRows(parsed));  // validation happens here, once
        setActiveStep(2);
      } catch {
        setUploadError('Erreur de lecture du fichier — vérifiez que le fichier n\'est pas corrompu');
      }
    };
    reader.readAsArrayBuffer(file);
  };
```

Replace `{activeStep > 0 && <Typography>Étape {activeStep + 1}</Typography>}` with:

```tsx
          {activeStep === 1 && (
            <Box sx={{ py: 2 }}>
              {uploadError && (
                <Alert severity="error" sx={{ mb: 2 }}>{uploadError}</Alert>
              )}
              <Box
                sx={{
                  border: '2px dashed #CBD5E1',
                  borderRadius: 2,
                  p: 5,
                  textAlign: 'center',
                  cursor: 'pointer',
                  bgcolor: '#F8FAFC',
                  '&:hover': { borderColor: '#0F766E', bgcolor: 'rgba(15,118,110,0.04)' },
                  transition: 'all 0.2s',
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
              >
                <UploadIcon sx={{ fontSize: 48, color: '#94A3B8', mb: 1 }} />
                <Typography variant="h6" sx={{ color: '#334155', mb: 0.5 }}>
                  Glissez votre fichier ici
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  ou cliquez pour sélectionner un fichier .xlsx
                </Typography>
              </Box>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = '';
                }}
              />
              <Button sx={{ mt: 2 }} size="small" onClick={() => setActiveStep(0)}>
                ← Retour (télécharger le modèle)
              </Button>
            </Box>
          )}
          {activeStep > 1 && <Typography>Étape {activeStep + 1}</Typography>}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/BulkUserImportDialog.tsx
git commit -m "feat(bulk-import): step 2 — file upload + format validation"
```

---

## Task 4 — Step 3: Preview + 500-Row Limit

**Files:**
- Modify: `src/components/BulkUserImportDialog.tsx`

Reads pre-validated `rows` from state (validated in Task 3 at parse time — no re-validation here). Shows preview table with ✓/✗. Blocks import if >500 rows or all invalid.

- [ ] **Step 1: Replace placeholder and add Step 3 render**

Replace `{activeStep > 1 && <Typography>Étape {activeStep + 1}</Typography>}` with:

```tsx
          {activeStep === 2 && (() => {
            const validCount = rows.filter(r => r.valid).length;
            const invalidCount = rows.length - validCount;
            const overLimit = rows.length > MAX_ROWS;
            const noValidRows = validCount === 0;

            return (
              <Box>
                {overLimit && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    ⚠️ Votre fichier contient {rows.length} lignes. La limite maximale est de {MAX_ROWS} lignes.
                    Le bouton d'import est désactivé. Divisez votre fichier en plusieurs lots.
                  </Alert>
                )}
                {!overLimit && noValidRows && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    ✗ Aucune ligne valide à importer. Corrigez le fichier et rechargez-le.
                  </Alert>
                )}
                {!overLimit && !noValidRows && (
                  <Alert severity={invalidCount > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
                    {validCount} ligne{validCount > 1 ? 's' : ''} valide{validCount > 1 ? 's' : ''}
                    {invalidCount > 0 && ` · ${invalidCount} invalide${invalidCount > 1 ? 's' : ''} (ignorées)`}
                  </Alert>
                )}
                <Box sx={{ maxHeight: 320, overflow: 'auto' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Ligne</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Nom</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Rôle</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Statut</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map(row => (
                        <TableRow key={row.rowIndex} sx={{ bgcolor: row.valid ? 'inherit' : 'rgba(239,68,68,0.05)' }}>
                          <TableCell>{row.rowIndex}</TableCell>
                          <TableCell>{row.name || <Typography component="span" color="error" variant="body2">—</Typography>}</TableCell>
                          <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.email || <Typography component="span" color="error" variant="body2">—</Typography>}
                          </TableCell>
                          <TableCell>{row.role || <Typography component="span" color="error" variant="body2">—</Typography>}</TableCell>
                          <TableCell>
                            {row.valid
                              ? <Chip label="✓ Valide" size="small" color="success" variant="outlined" />
                              : <Chip label={`✗ ${row.errorMessage}`} size="small" color="error" variant="outlined"
                                  sx={{ maxWidth: 240, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button size="small" onClick={() => {
                    setRows([]); setUploadError(null); setProgress(0); setActiveStep(1);
                  }}>
                    ← Changer de fichier
                  </Button>
                  <Box sx={{ flex: 1 }} />
                  <Button
                    variant="contained"
                    disabled={overLimit || noValidRows}
                    onClick={() => setActiveStep(3)}
                    sx={{ bgcolor: '#0F766E', '&:hover': { bgcolor: '#0D6560' }, '&.Mui-disabled': { bgcolor: '#CBD5E1' } }}
                  >
                    Importer {validCount} ligne{validCount > 1 ? 's' : ''} valide{validCount > 1 ? 's' : ''}
                  </Button>
                </Box>
              </Box>
            );
          })()}
          {activeStep > 2 && <Typography>Étape {activeStep + 1}</Typography>}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/BulkUserImportDialog.tsx
git commit -m "feat(bulk-import): step 3 — preview table + 500-row limit"
```

---

## Task 5 — Step 4: Sequential Import + Progress Bar + Cancellation

**Files:**
- Modify: `src/components/BulkUserImportDialog.tsx`

Loops over valid rows, calls the right API (ADMIN vs SUPER_ADMIN), updates progress bar and row status live.

- [ ] **Step 1: Add `runImport` function and Step 4 render**

Add after `handleFileUpload`:

```tsx
  // ── Import loop ────────────────────────────────────────────────────────────

  const runImport = async () => {
    const validRows = rows.filter(r => r.valid);
    if (validRows.length === 0) return;

    setImporting(true);
    setCancelled(false);
    cancelRef.current = false;
    let created = 0;
    const errors: BulkImportError[] = [];

    for (let i = 0; i < validRows.length; i++) {
      if (cancelRef.current) {
        setCancelled(true);
        break;
      }

      const row = validRows[i];

      try {
        if (companyId) {
          // SUPER_ADMIN context: POST /api/platform/companies/:id/members
          // ApiService.post() throws on HTTP 4xx/5xx — no manual success check needed.
          // Note: department/branch/jobTitle are NOT sent — the platform endpoint ignores them.
          await ApiService.post(`/platform/companies/${companyId}/members`, {
            email: row.email.toLowerCase(),
            name: row.name,
            role: row.role,
            password: generateTempPassword(),
          });
        } else {
          // ADMIN context: POST /api/users (companyId injected from JWT by backend)
          const res = await ApiService.createUser({
            name: row.name,
            email: row.email,
            role: row.role,
            department: row.department || undefined,
            branch: row.branch || undefined,
            jobTitle: row.jobTitle || undefined,
          });
          if (!res.success) throw new Error(res.error || 'Erreur API');
        }

        created++;
        setRows(prev => prev.map(r =>
          r.rowIndex === row.rowIndex ? { ...r, status: 'success' } : r
        ));
      } catch (err: any) {
        const msg = err?.response?.data?.error || err?.message || 'Erreur serveur';
        errors.push({ row: row.rowIndex, email: row.email, message: msg });
        setRows(prev => prev.map(r =>
          r.rowIndex === row.rowIndex ? { ...r, status: 'error', apiError: msg } : r
        ));
      }

      setProgress(((i + 1) / validRows.length) * 100);
      await sleep(150);
    }

    setCreatedCount(created);
    setFinalErrors(errors);
    setImporting(false);
    setActiveStep(4);
  };
```

Replace `{activeStep > 2 && <Typography>Étape {activeStep + 1}</Typography>}` with:

```tsx
          {activeStep === 3 && (() => {
            const validRows = rows.filter(r => r.valid);
            return (
              <Box sx={{ py: 1 }}>
                {!importing && progress === 0 && (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      Prêt à importer {validRows.length} utilisateur{validRows.length > 1 ? 's' : ''}
                    </Typography>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={runImport}
                      sx={{ bgcolor: '#0F766E', '&:hover': { bgcolor: '#0D6560' } }}
                    >
                      Démarrer l'import
                    </Button>
                  </Box>
                )}
                {(importing || progress > 0) && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <LinearProgress variant="determinate" value={progress}
                        sx={{ flex: 1, height: 10, borderRadius: 5,
                          '& .MuiLinearProgress-bar': { bgcolor: '#0F766E' } }} />
                      <Typography variant="body2" sx={{ minWidth: 40 }}>
                        {Math.round(progress)}%
                      </Typography>
                      {importing && (
                        <IconButton size="small" color="error"
                          onClick={() => { cancelRef.current = true; }}
                          title="Annuler l'import">
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                    <Box sx={{ maxHeight: 260, overflow: 'auto', mt: 1 }}>
                      <Table size="small">
                        <TableBody>
                          {validRows.map(row => (
                            <TableRow key={row.rowIndex}>
                              <TableCell sx={{ width: 50 }}>{row.rowIndex}</TableCell>
                              <TableCell>{row.name}</TableCell>
                              <TableCell sx={{ color: '#64748B', fontSize: 12 }}>{row.email}</TableCell>
                              <TableCell sx={{ width: 80 }}>
                                {row.status === 'success' && <CheckIcon fontSize="small" sx={{ color: '#10B981' }} />}
                                {row.status === 'error' && <ErrorIcon fontSize="small" sx={{ color: '#EF4444' }} />}
                                {row.status === 'pending' && importing && <CircularProgress size={14} />}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  </>
                )}
              </Box>
            );
          })()}
          {activeStep > 3 && <Typography>Étape {activeStep + 1}</Typography>}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/BulkUserImportDialog.tsx
git commit -m "feat(bulk-import): step 4 — sequential import loop + progress bar + cancellation"
```

---

## Task 6 — Step 5: Report + Error File Download

**Files:**
- Modify: `src/components/BulkUserImportDialog.tsx`

Shows summary (created / errors). If errors exist, offers download as .xlsx.

- [ ] **Step 1: Add `downloadErrorReport` function and Step 5 render**

Add after `runImport`:

```tsx
  // ── Error report download ──────────────────────────────────────────────────

  const downloadErrorReport = () => {
    const data = [
      ['Ligne', 'Email', 'Erreur'],
      ...finalErrors.map(e => [e.row, e.email, e.message]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Erreurs');
    XLSX.writeFile(wb, 'import-erreurs.xlsx');
  };
```

Replace `{activeStep > 3 && <Typography>Étape {activeStep + 1}</Typography>}` with:

```tsx
          {activeStep === 4 && (
            <Box sx={{ py: 2 }}>
              {cancelled && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Import annulé — {createdCount} utilisateur{createdCount > 1 ? 's' : ''} créé{createdCount > 1 ? 's' : ''} avant l'annulation.
                </Alert>
              )}
              <Box sx={{ display: 'flex', gap: 4, mb: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" sx={{ color: '#10B981', fontWeight: 700 }}>{createdCount}</Typography>
                  <Typography color="text.secondary" variant="body2">créé{createdCount > 1 ? 's' : ''}</Typography>
                </Box>
                {finalErrors.length > 0 && (
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h3" sx={{ color: '#EF4444', fontWeight: 700 }}>{finalErrors.length}</Typography>
                    <Typography color="text.secondary" variant="body2">erreur{finalErrors.length > 1 ? 's' : ''}</Typography>
                  </Box>
                )}
              </Box>
              {finalErrors.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Erreurs :</Typography>
                  <Box sx={{ maxHeight: 200, overflow: 'auto', mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Ligne</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Erreur</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {finalErrors.map((e, i) => (
                          <TableRow key={i}>
                            <TableCell>{e.row}</TableCell>
                            <TableCell sx={{ fontSize: 12, color: '#64748B' }}>{e.email}</TableCell>
                            <TableCell sx={{ color: '#EF4444', fontSize: 12 }}>{e.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={downloadErrorReport}
                    sx={{ borderColor: '#0F766E', color: '#0F766E' }}
                  >
                    Télécharger les erreurs (.xlsx)
                  </Button>
                </>
              )}
            </Box>
          )}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/BulkUserImportDialog.tsx
git commit -m "feat(bulk-import): step 5 — report + error file download"
```

---

## Task 7 — Integrate into UserManagementPage

**Files:**
- Modify: `src/pages/UserManagementPage.tsx`

Add an "Import Excel" button next to "Ajouter Utilisateur" (~line 1631). Wire up the dialog (no `companyId` prop — ADMIN context). On `onComplete`, reload the user list.

- [ ] **Step 1: Add import and state**

At the top of `UserManagementPage.tsx`, add the import after the last existing import:

```tsx
import { BulkUserImportDialog } from '../components/BulkUserImportDialog';
import FileUploadIcon from '@mui/icons-material/FileUpload';
```

Inside the component, after the existing state declarations, add:

```tsx
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
```

- [ ] **Step 2: Add button in the toolbar**

Find this exact block (around line 1630–1647, includes both "Ajouter Utilisateur" and "Actualiser" — use this full snippet to locate unambiguously):

```tsx
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => openEditDialog()}
                    disabled={!canEditUserManagement}
                  >
                    Ajouter Utilisateur
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadUsers}
                    disabled={loading}
                  >
                    Actualiser
                  </Button>
                </Box>
```

Replace with:

```tsx
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<FileUploadIcon />}
                    onClick={() => setBulkImportOpen(true)}
                    disabled={!canEditUserManagement}
                    sx={{ borderColor: '#0F766E', color: '#0F766E', '&:hover': { borderColor: '#0D6560', bgcolor: 'rgba(15,118,110,0.06)' } }}
                  >
                    Import Excel
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => openEditDialog()}
                    disabled={!canEditUserManagement}
                  >
                    Ajouter Utilisateur
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadUsers}
                    disabled={loading}
                  >
                    Actualiser
                  </Button>
                </Box>
```

- [ ] **Step 3: Add dialog at the end of JSX (before closing tag of the component's return)**

Find the last `</Box>` closing the returned JSX (near end of file, after all other dialogs). Add before it:

```tsx
      <BulkUserImportDialog
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onComplete={(created, errors) => {
          setBulkImportOpen(false);
          loadUsers();
          if (created > 0) {
            setNotification({
              open: true,
              message: `${created} utilisateur${created > 1 ? 's' : ''} importé${created > 1 ? 's' : ''} avec succès${errors.length > 0 ? ` (${errors.length} erreur${errors.length > 1 ? 's' : ''})` : ''}`,
              severity: errors.length > 0 ? 'warning' : 'success',
            });
          }
        }}
      />
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/UserManagementPage.tsx
git commit -m "feat(bulk-import): integrate into UserManagementPage (ADMIN)"
```

---

## Task 8 — Integrate into PlatformAdminPage

**Files:**
- Modify: `src/pages/PlatformAdminPage.tsx`

Add "Import Excel" button next to "Ajouter un utilisateur" in the expanded members panel (~line 336–342). Pass `companyId={c.id}` to the dialog. On `onComplete`, refresh the company's member list.

- [ ] **Step 1: Add import, icon, and state**

At the top of `PlatformAdminPage.tsx`, add after the last existing import:

```tsx
import { BulkUserImportDialog } from '../components/BulkUserImportDialog';
import FileUploadIcon from '@mui/icons-material/FileUpload';
```

Inside the component, after the existing state declarations (around line 100), add:

```tsx
  const [bulkImportTarget, setBulkImportTarget] = useState<CompanyEntry | null>(null);
```

- [ ] **Step 2: Add "Import Excel" button in members panel**

Find this exact block (around line 336–342):

```tsx
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
                            Membres — {c.name}
                          </Typography>
                          <Button size="small" startIcon={<PersonAddIcon />} onClick={() => openAddMember(c)}>
                            Ajouter un utilisateur
                          </Button>
                        </Box>
```

Replace with:

```tsx
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
                            Membres — {c.name}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<FileUploadIcon />}
                              onClick={() => setBulkImportTarget(c)}
                              sx={{ color: '#0F766E', borderColor: '#0F766E' }}
                            >
                              Import Excel
                            </Button>
                            <Button size="small" startIcon={<PersonAddIcon />} onClick={() => openAddMember(c)}>
                              Ajouter un utilisateur
                            </Button>
                          </Box>
                        </Box>
```

- [ ] **Step 3: Add dialog at the end of JSX (before the last `</Box>` closing the return)**

```tsx
      <BulkUserImportDialog
        open={Boolean(bulkImportTarget)}
        companyId={bulkImportTarget?.id}
        onClose={() => setBulkImportTarget(null)}
        onComplete={(created, _errors) => {
          if (bulkImportTarget && expandedId === bulkImportTarget.id) {
            fetchMembers(bulkImportTarget.id);
          }
          fetchCompanies();
          setBulkImportTarget(null);
        }}
      />
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/PlatformAdminPage.tsx
git commit -m "feat(bulk-import): integrate into PlatformAdminPage (SUPER_ADMIN)"
```

---

## Manual Verification Checklist

After all tasks are complete, verify in the browser (`npm run dev`):

**ADMIN context (UserManagementPage):**
- [ ] "Import Excel" button appears next to "Ajouter Utilisateur"
- [ ] Template download generates a valid .xlsx with correct headers and example row
- [ ] Upload rejects non-.xlsx files with error message
- [ ] Upload rejects files with wrong headers
- [ ] Upload rejects empty files
- [ ] Preview shows ✓/✗ per row with correct error messages
- [ ] Files with >500 rows show warning and disable import button
- [ ] Import progress bar advances per row and reaches exactly 100%
- [ ] Cancellation mid-import stops after current row, advances to step 5
- [ ] Report shows correct created/error counts with cancellation banner if cancelled
- [ ] Error download generates correct .xlsx
- [ ] User list refreshes after "Terminer"

**SUPER_ADMIN context (PlatformAdminPage):**
- [ ] "Import Excel" button appears per company in the expanded members panel
- [ ] Import creates members in the correct company (check members list after import)
- [ ] Duplicate email returns API error on that row (not a crash) and continues
