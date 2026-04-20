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

// Display labels shown in template and UI (no underscores)
const ROLE_LABELS: Record<string, string> = {
  CHARGE_AFFAIRES:        "Chargé d'Affaires",
  ANALYSTE_RISQUES:       'Analyste Risques',
  RESPONSABLE_RISQUES:    'Responsable Risques',
  RESPONSABLE_ENGAGEMENTS:'Responsable Engagements',
  COMITE_CREDIT:          'Comité de Crédit',
  DIRECTION_GENERALE:     'Direction Générale',
  DIRECTION_JURIDIQUE:    'Direction Juridique',
  BACK_OFFICE:            'Back Office',
  ADMIN:                  'Administrateur',
};

// Reverse map: lowercase display label → enum value
const ROLE_FROM_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_LABELS).map(([k, v]) => [v.toLowerCase(), k])
);

/**
 * Accepts both display labels ("Chargé d'Affaires") and enum values ("CHARGE_AFFAIRES").
 * Returns the canonical enum value, or null if unrecognised.
 */
const normalizeRole = (input: string): string | null => {
  const t = input.trim();
  if (!t) return null;
  // Direct enum match (case-insensitive)
  const upper = t.toUpperCase();
  if (VALID_ROLES.includes(upper)) return upper;
  // Display label match (case-insensitive)
  const fromLabel = ROLE_FROM_LABEL[t.toLowerCase()];
  if (fromLabel) return fromLabel;
  // Spaces → underscores fallback
  const underscored = upper.replace(/\s+/g, '_');
  if (VALID_ROLES.includes(underscored)) return underscored;
  return null;
};

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
  const seenEmails = new Map<string, number>();
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
    const canonicalRole = normalizeRole(row.role);
    if (!canonicalRole) {
      errors.push(`Rôle invalide : "${row.role}" — valeurs acceptées : ${Object.values(ROLE_LABELS).join(', ')}`);
    }
    // Store canonical enum value so the API receives the correct value
    const resolvedRow = canonicalRole ? { ...row, role: canonicalRole } : row;
    return { ...resolvedRow, valid: errors.length === 0, errorMessage: errors.join(' · ') };
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

  const handleClose = () => {
    if (activeStep < 4) {
      resetState();
      onClose();
    } else {
      onComplete(createdCount, finalErrors);
      resetState();
    }
  };

  const handleFinish = () => {
    onComplete(createdCount, finalErrors);
    resetState();
  };

  // ── Template generation ───────────────────────────────────────────────────

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      EXPECTED_HEADERS,
      ['Jean Dupont', 'jean.dupont@banque.com', ROLE_LABELS['CHARGE_AFFAIRES'], 'Commercial', 'Siège', 'Chargé d\'Affaires Senior'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 22 }];

    // NOTE: SheetJS community edition (v0.18.x) does NOT support data validation
    // or cell styles — ws['!dataValidations'] is silently ignored.
    // Column C will NOT have a role dropdown in the generated file.
    // Valid roles are listed in the dialog description.

    XLSX.utils.book_append_sheet(wb, ws, 'Utilisateurs');
    XLSX.writeFile(wb, 'modele-import-utilisateurs.xlsx');
  };

  // ── File upload ───────────────────────────────────────────────────────────

  const handleFileUpload = (file: File) => {
    setUploadError(null);

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setUploadError('Format invalide — seuls les fichiers .xlsx sont acceptés');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setUploadError('Impossible de lire le fichier — vérifiez que le fichier n\'est pas corrompu ou protégé');
    };
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });

        if (!wb.SheetNames.length) {
          setUploadError('Le fichier Excel ne contient aucune feuille');
          return;
        }

        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (!raw.length) {
          setUploadError('Le fichier est vide');
          return;
        }

        const header = (raw[0] ?? []) as string[];
        // Identify exactly which columns are wrong
        const badCols = EXPECTED_HEADERS
          .map((expected, i) => {
            const got = String(header[i] ?? '').trim();
            return got !== expected ? `colonne ${String.fromCharCode(65 + i)} : attendu "${expected}", trouvé "${got || '(vide)'}"` : null;
          })
          .filter(Boolean);

        if (badCols.length > 0 || header.length < EXPECTED_HEADERS.length) {
          setUploadError(`En-têtes incorrects — ${badCols.length > 0 ? badCols.join(' | ') : 'colonnes manquantes'}. Utilisez le modèle fourni.`);
          return;
        }

        const dataRows = raw.slice(1).filter(r => r.some(c => String(c).trim() !== ''));
        if (dataRows.length === 0) {
          setUploadError('Le fichier ne contient aucune donnée (seulement la ligne d\'en-têtes)');
          return;
        }

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

        setRows(validateRows(parsed));
        setActiveStep(2);
      } catch (err: any) {
        setUploadError(`Erreur de lecture : ${err?.message || 'fichier corrompu ou format non supporté'}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

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
          // SUPER_ADMIN: POST /api/platform/companies/:id/members
          // ApiService.post() throws on HTTP 4xx/5xx — no manual success check needed.
          await ApiService.post(`/platform/companies/${companyId}/members`, {
            email: row.email.toLowerCase(),
            name: row.name,
            role: row.role,
            password: generateTempPassword(),
          });
        } else {
          // ADMIN: POST /api/users (companyId injected from JWT by backend)
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
        const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Erreur serveur';
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

  // ── Render ────────────────────────────────────────────────────────────────

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

        <Box>
          {/* ── Step 1: Template ── */}
          {activeStep === 0 && (
            <Box sx={{ py: 2 }}>
              {/* Header + download button */}
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                  Téléchargez le modèle Excel
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2.5, maxWidth: 480, mx: 'auto', fontSize: 14 }}>
                  Remplissez le fichier avec vos utilisateurs (max 500 lignes) puis importez-le à l'étape suivante.
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
              </Box>

              {/* Columns table */}
              <Box sx={{ border: '1px solid #E2E8F0', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
                <Box sx={{ bgcolor: '#F1F5F9', px: 2, py: 1, borderBottom: '1px solid #E2E8F0' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>
                    Structure du fichier
                  </Typography>
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                      <TableCell sx={{ fontWeight: 600, color: '#64748B', fontSize: 12, width: 40 }}>Col.</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#64748B', fontSize: 12 }}>Champ</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#64748B', fontSize: 12, width: 90 }}>Requis</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      { col: 'A', label: 'Nom complet', required: true },
                      { col: 'B', label: 'Email',       required: true },
                      { col: 'C', label: 'Rôle',        required: true },
                      { col: 'D', label: 'Département', required: false },
                      { col: 'E', label: 'Agence',      required: false },
                      { col: 'F', label: 'Poste',       required: false },
                    ].map(({ col, label, required }) => (
                      <TableRow key={col} sx={{ '&:last-child td': { border: 0 } }}>
                        <TableCell>
                          <Chip label={col} size="small" sx={{ bgcolor: '#0F766E', color: '#fff', fontWeight: 700, fontSize: 11, height: 20, borderRadius: 1 }} />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500, color: '#1E293B', fontSize: 13 }}>{label}</TableCell>
                        <TableCell>
                          {required
                            ? <Chip label="Obligatoire" size="small" color="error" variant="outlined" sx={{ fontSize: 11, height: 20 }} />
                            : <Chip label="Optionnel"   size="small" variant="outlined" sx={{ fontSize: 11, height: 20, color: '#94A3B8', borderColor: '#CBD5E1' }} />
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>

              {/* Roles */}
              <Box sx={{ border: '1px solid #E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ bgcolor: '#F1F5F9', px: 2, py: 1, borderBottom: '1px solid #E2E8F0' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>
                    Valeurs acceptées pour la colonne Rôle
                  </Typography>
                </Box>
                <Box sx={{ px: 2, py: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {Object.values(ROLE_LABELS).map(label => (
                    <Chip
                      key={label}
                      label={label}
                      size="small"
                      sx={{ bgcolor: '#F0FDF9', color: '#0F766E', border: '1px solid #CCFBF1', fontSize: 12 }}
                    />
                  ))}
                </Box>
              </Box>
            </Box>
          )}

          {/* ── Step 2: Upload ── */}
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

          {/* ── Step 3: Preview ── */}
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
                          <TableCell>
                            {row.name || <Typography component="span" color="error" variant="body2">—</Typography>}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.email || <Typography component="span" color="error" variant="body2">—</Typography>}
                          </TableCell>
                          <TableCell>
                            {row.role || <Typography component="span" color="error" variant="body2">—</Typography>}
                          </TableCell>
                          <TableCell>
                            {row.valid
                              ? <Chip label="✓ Valide" size="small" color="success" variant="outlined" />
                              : <Chip
                                  label={`✗ ${row.errorMessage}`}
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  sx={{ maxWidth: 240, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                                />
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
                    sx={{
                      bgcolor: '#0F766E',
                      '&:hover': { bgcolor: '#0D6560' },
                      '&.Mui-disabled': { bgcolor: '#CBD5E1' },
                    }}
                  >
                    Importer {validCount} ligne{validCount > 1 ? 's' : ''} valide{validCount > 1 ? 's' : ''}
                  </Button>
                </Box>
              </Box>
            );
          })()}

          {/* ── Step 4: Import ── */}
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
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{
                          flex: 1,
                          height: 10,
                          borderRadius: 5,
                          '& .MuiLinearProgress-bar': { bgcolor: '#0F766E' },
                        }}
                      />
                      <Typography variant="body2" sx={{ minWidth: 40 }}>
                        {Math.round(progress)}%
                      </Typography>
                      {importing && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => { cancelRef.current = true; }}
                          title="Annuler l'import"
                        >
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

          {/* ── Step 5: Report ── */}
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
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {activeStep < 4 && activeStep !== 2 && activeStep !== 3 && (
          <Button onClick={handleClose} disabled={importing}>Annuler</Button>
        )}
        {activeStep === 0 && (
          <Button
            variant="contained"
            onClick={() => setActiveStep(1)}
            sx={{ bgcolor: '#0F766E', '&:hover': { bgcolor: '#0D6560' } }}
          >
            Suivant — Upload
          </Button>
        )}
        {activeStep === 4 && (
          <Button
            variant="contained"
            onClick={handleFinish}
            sx={{ bgcolor: '#0F766E', '&:hover': { bgcolor: '#0D6560' } }}
          >
            Terminer
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BulkUserImportDialog;
