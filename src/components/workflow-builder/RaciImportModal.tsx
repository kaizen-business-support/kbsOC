import React, { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, Chip, Alert, Tabs, Tab, Tooltip,
  CircularProgress,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import * as XLSX from 'xlsx';
import { PolicyStep, PolicyStepType } from '../../types/creditPolicyBuilder';

// ── Matrice RACI filtrée (décision crédit uniquement, hors SIB) ──────────────

const RACI_COLS = [
  'Direction Risques',
  'Direction Engagements',
  'Back-office Crédit',
  'Direction Juridique',
  'Dir. Commerciale',
];

const RACI_ROWS: { activite: string; values: string[] }[] = [
  { activite: 'Vérification complétude dossiers crédit', values: ['C', 'R/A', '',  '',  'I'] },
  { activite: 'Contre-analyse dossiers crédit',          values: ['R/A', 'C', '',  '',  'I'] },
  { activite: 'Calcul ratios prudentiels',               values: ['R/A', 'C', '',  '',  ''] },
  { activite: 'Organisation comités crédit',             values: ['C', 'R/A',  '',  'I', 'I'] },
  { activite: 'Notifications de crédit',                 values: ['I', 'R/A',  '',  'C', 'I'] },
];

const RACI_LEGEND = [
  { code: 'R', label: 'Réalisateur', color: '#1d4ed8', bg: '#dbeafe' },
  { code: 'A', label: 'Approbateur (responsable final)', color: '#15803d', bg: '#dcfce7' },
  { code: 'C', label: 'Consulté', color: '#b45309', bg: '#fef3c7' },
  { code: 'I', label: 'Informé', color: '#6b7280', bg: '#f3f4f6' },
];

// ── Mapping rôles RACI → enum système ────────────────────────────────────────

const ROLE_MAP: Record<string, string> = {
  'direction risques':      'RESPONSABLE_RISQUES',
  'dir. risques':           'RESPONSABLE_RISQUES',
  'responsable risques':    'RESPONSABLE_RISQUES',
  'analyste risques':       'ANALYSTE_RISQUES',
  'direction engagements':  'RESPONSABLE_ENGAGEMENTS',
  'dir. engagements':       'RESPONSABLE_ENGAGEMENTS',
  'responsable engagements':'RESPONSABLE_ENGAGEMENTS',
  'back-office crédit':     'BACK_OFFICE',
  'back office':            'BACK_OFFICE',
  'back_office':            'BACK_OFFICE',
  'direction juridique':    'DIRECTION_JURIDIQUE',
  'dir. juridique':         'DIRECTION_JURIDIQUE',
  'dir. commerciale':       'CHARGE_AFFAIRES',
  'direction commerciale':  'CHARGE_AFFAIRES',
  'charge affaires':        'CHARGE_AFFAIRES',
  'chargé d\'affaires':     'CHARGE_AFFAIRES',
  'comite credit':          'COMITE_CREDIT',
  'comité crédit':          'COMITE_CREDIT',
  'direction générale':     'DIRECTION_GENERALE',
  'direction generale':     'DIRECTION_GENERALE',
  'admin':                  'ADMIN',
  // Valeurs directes (déjà en format système)
  'charge_affaires':        'CHARGE_AFFAIRES',
  'analyste_risques':       'ANALYSTE_RISQUES',
  'responsable_risques':    'RESPONSABLE_RISQUES',
  'responsable_engagements':'RESPONSABLE_ENGAGEMENTS',
  'comite_credit':          'COMITE_CREDIT',
  'direction_generale':     'DIRECTION_GENERALE',
  'back_office_credit':     'BACK_OFFICE',
  'direction_juridique':    'DIRECTION_JURIDIQUE',
};

const TYPE_MAP: Record<string, PolicyStepType> = {
  'creation':  'CREATION',
  'dispatch':  'DISPATCH',
  'analysis':  'ANALYSIS',
  'analyse':   'ANALYSIS',
  'approval':  'APPROVAL',
  'approbation':'APPROVAL',
  'committee': 'COMMITTEE',
  'comité':    'COMMITTEE',
  'comite':    'COMMITTEE',
};

// ── Modèle pré-rempli depuis la matrice RACI ─────────────────────────────────

const TEMPLATE_ROWS = [
  ['Vérification complétude dossier', 'ANALYSIS',  'Direction Engagements', 24, 48,  'Montage dossier',  ''],
  ['Contre-analyse dossier crédit',   'ANALYSIS',  'Direction Risques',     48, 120, 'Analyse risques',  ''],
  ['Calcul ratios prudentiels',        'ANALYSIS',  'Direction Risques',     24, 72,  'Analyse risques',  ''],
  ['Organisation comité crédit',       'COMMITTEE', 'Direction Engagements', 48, 120, 'Approbation',      ''],
  ['Notifications de crédit',          'DISPATCH',  'Direction Engagements', 24, 48,  'Approbation',      ''],
];

const TEMPLATE_HEADERS = [
  'Étape', 'Type', 'Rôle assigné',
  'Durée attendue (h)', 'Durée max (h)', 'Phase', 'Description',
];

const TYPE_VALUES = 'CREATION | DISPATCH | ANALYSIS | APPROVAL | COMMITTEE';
const ROLE_VALUES = 'Direction Risques | Direction Engagements | Back-office Crédit | Direction Juridique | Dir. Commerciale | RESPONSABLE_RISQUES | ANALYSTE_RISQUES | RESPONSABLE_ENGAGEMENTS | BACK_OFFICE | DIRECTION_JURIDIQUE | CHARGE_AFFAIRES | COMITE_CREDIT | DIRECTION_GENERALE | ADMIN';

// ── Helpers ──────────────────────────────────────────────────────────────────

function cellColor(val: string) {
  if (!val) return {};
  if (val.includes('R')) return { bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 700 };
  if (val === 'A')        return { bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700 };
  if (val === 'C')        return { bgcolor: '#fef3c7', color: '#b45309' };
  if (val === 'I')        return { bgcolor: '#f3f4f6', color: '#6b7280' };
  return {};
}

function resolveRole(raw: string): string {
  return ROLE_MAP[raw.trim().toLowerCase()] ?? raw.trim().toUpperCase().replace(/\s+/g, '_');
}

function resolveType(raw: string): PolicyStepType {
  return TYPE_MAP[raw.trim().toLowerCase()] ?? 'ANALYSIS';
}

function generateTempId() {
  return `new_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// ── Composant ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (steps: PolicyStep[]) => void;
  canEdit: boolean;
}

export function RaciImportModal({ open, onClose, onImport, canEdit }: Props) {
  const [tab, setTab]         = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PolicyStep[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Feuille principale
    const data = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 26 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Workflow');

    // Feuille référence
    const refData = [
      ['Types valides', TYPE_VALUES],
      ['Rôles valides', ROLE_VALUES],
      ['', ''],
      ['Colonne', 'Description'],
      ['Étape', 'Nom de l\'étape (obligatoire)'],
      ['Type', 'Type d\'étape parmi les types valides'],
      ['Rôle assigné', 'Rôle responsable de l\'étape'],
      ['Durée attendue (h)', 'Durée cible en heures (ex: 24)'],
      ['Durée max (h)', 'Délai maximum en heures (ex: 72)'],
      ['Phase', 'Regroupement (ex: Montage dossier, Analyse risques, Approbation)'],
      ['Description', 'Description libre (optionnel)'],
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(refData);
    wsRef['!cols'] = [{ wch: 22 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsRef, 'Référence');

    XLSX.writeFile(wb, 'modele_workflow_credit.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setPreview(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        if (rows.length === 0) {
          setParseError('Le fichier est vide ou le format ne correspond pas au modèle.');
          return;
        }

        const steps: PolicyStep[] = rows
          .filter(r => String(r['Étape'] ?? '').trim() !== '')
          .map((r, idx) => ({
            id: generateTempId(),
            policyId: '',
            stepName: String(r['Étape']).trim().toLowerCase().replace(/\s+/g, '_').normalize('NFD').replace(/[̀-ͯ]/g, ''),
            stepLabel: String(r['Étape']).trim(),
            order: idx + 1,
            stepType: resolveType(String(r['Type'] ?? 'ANALYSIS')),
            assignedRole: resolveRole(String(r['Rôle assigné'] ?? 'CHARGE_AFFAIRES')),
            conditionMinAmount: null,
            conditionMaxAmount: null,
            expectedDurationHours: Number(r['Durée attendue (h)']) || 24,
            maxDurationHours: Number(r['Durée max (h)']) || 72,
            isRequired: true,
            isActive: true,
            description: String(r['Description'] ?? '').trim() || null,
            creditTypeIds: [],
            guards: null,
            phase: String(r['Phase'] ?? '').trim() || undefined,
          } as any));

        if (steps.length === 0) {
          setParseError('Aucune étape valide trouvée. Vérifiez que la colonne "Étape" est remplie.');
          return;
        }

        setPreview(steps);
        setTab(2);
      } catch {
        setParseError('Impossible de lire le fichier. Utilisez le modèle téléchargeable.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!preview) return;
    setImporting(true);
    setTimeout(() => {
      onImport(preview);
      setImporting(false);
      setPreview(null);
      setTab(0);
      onClose();
    }, 200);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 2, maxHeight: '85vh' } }}>
      <DialogTitle sx={{ pb: 0 }}>
        <Typography fontWeight={700} fontSize={15}>Matrice RACI — Import Workflow</Typography>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 1 }}>
          <Tab label="Voir la matrice" sx={{ fontSize: 12, textTransform: 'none' }} />
          <Tab label="Télécharger le modèle" sx={{ fontSize: 12, textTransform: 'none' }} />
          <Tab label={`Aperçu import${preview ? ` (${preview.length} étapes)` : ''}`}
            sx={{ fontSize: 12, textTransform: 'none' }} disabled={!preview} />
        </Tabs>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>

        {/* ── Onglet 0 : Matrice RACI ── */}
        {tab === 0 && (
          <Box>
            <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
              Matrice filtrée — décision crédit uniquement (étapes SIB exclues).
            </Alert>
            {/* Légende */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              {RACI_LEGEND.map(l => (
                <Chip key={l.code} size="small"
                  label={`${l.code} : ${l.label}`}
                  sx={{ bgcolor: l.bg, color: l.color, fontWeight: 600, fontSize: 11 }} />
              ))}
            </Box>
            <Table size="small" sx={{ '& td, & th': { fontSize: 12, py: 0.8, px: 1 } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700, minWidth: 220 }}>Activité</TableCell>
                  {RACI_COLS.map(c => (
                    <TableCell key={c} align="center" sx={{ fontWeight: 700 }}>{c}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {RACI_ROWS.map((row, i) => (
                  <TableRow key={i} hover>
                    <TableCell>{row.activite}</TableCell>
                    {row.values.map((v, j) => (
                      <TableCell key={j} align="center"
                        sx={{ ...cellColor(v), borderRadius: v ? '4px' : 0 }}>
                        {v || '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* ── Onglet 1 : Télécharger + Importer ── */}
        {tab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 1 }}>
            <Box sx={{ p: 2.5, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#f8fafc' }}>
              <Typography fontWeight={600} fontSize={13} mb={0.5}>1. Télécharger le modèle</Typography>
              <Typography fontSize={12} color="text.secondary" mb={1.5}>
                Le modèle est pré-rempli avec les étapes issues de la matrice RACI (décision crédit).
                Modifiez-le selon vos besoins puis importez-le.
              </Typography>
              <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
                sx={{ textTransform: 'none', fontSize: 12 }}>
                Télécharger modele_workflow_credit.xlsx
              </Button>
            </Box>

            {canEdit && (
              <Box sx={{ p: 2.5, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#f8fafc' }}>
                <Typography fontWeight={600} fontSize={13} mb={0.5}>2. Importer votre fichier modifié</Typography>
                <Typography fontSize={12} color="text.secondary" mb={1.5}>
                  Le fichier doit respecter le format du modèle (colonne "Étape" obligatoire).
                  L'import <strong>remplace</strong> les étapes actuelles du workflow.
                </Typography>
                {parseError && (
                  <Alert severity="error" sx={{ mb: 1.5, fontSize: 12 }}>{parseError}</Alert>
                )}
                <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleFileChange} />
                <Button variant="contained" size="small" startIcon={<UploadFileIcon />}
                  onClick={() => fileRef.current?.click()}
                  sx={{ textTransform: 'none', fontSize: 12 }}>
                  Choisir un fichier Excel
                </Button>
              </Box>
            )}
          </Box>
        )}

        {/* ── Onglet 2 : Aperçu import ── */}
        {tab === 2 && preview && (
          <Box>
            <Alert severity="success" sx={{ mb: 2, fontSize: 12 }}>
              {preview.length} étapes prêtes à être importées. Vérifiez ci-dessous avant de confirmer.
            </Alert>
            <Table size="small" sx={{ '& td, & th': { fontSize: 12, py: 0.7, px: 1 } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Étape</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Rôle</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Durée (h)</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Phase</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.map((s, i) => (
                  <TableRow key={s.id} hover>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{s.stepLabel}</TableCell>
                    <TableCell>
                      <Chip size="small" label={s.stepType}
                        sx={{ fontSize: 10, height: 18, bgcolor: '#e0f2fe', color: '#0369a1' }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: 11, color: '#475569' }}>{s.assignedRole}</TableCell>
                    <TableCell>{s.expectedDurationHours}h / {s.maxDurationHours}h</TableCell>
                    <TableCell sx={{ color: '#64748b' }}>{(s as any).phase ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        {tab === 2 && preview && canEdit && (
          <Tooltip title="Remplace les étapes actuelles du workflow par celles du fichier importé">
            <Button variant="contained" color="primary" size="small"
              onClick={handleConfirmImport} disabled={importing}
              startIcon={importing ? <CircularProgress size={13} /> : <UploadFileIcon />}
              sx={{ textTransform: 'none', fontSize: 12 }}>
              Confirmer l'import ({preview.length} étapes)
            </Button>
          </Tooltip>
        )}
        <Button onClick={onClose} size="small" sx={{ textTransform: 'none', fontSize: 12 }}>
          Fermer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
