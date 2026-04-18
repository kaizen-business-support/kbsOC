import React, { useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Tooltip, Divider, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import {
  CheckCircle as RIcon,
  Verified as AIcon,
  Forum as CIcon,
  NotificationsNone as IIcon,
} from '@mui/icons-material';

// ─── Données RACI ──────────────────────────────────────────────────────────────
// R = Responsible (exécute), A = Accountable (valide/signe), C = Consulted, I = Informed

const ROLES = [
  { key: 'CA',  label: "Chargé d'Affaires",      short: 'CA',  color: '#2563EB' },
  { key: 'ANA', label: 'Analyste Risques',        short: 'ANA', color: '#7C3AED' },
  { key: 'RR',  label: 'Resp. Risques',           short: 'R.Ris', color: '#6D28D9' },
  { key: 'RE',  label: 'Resp. Engagements',       short: 'R.Eng', color: '#0891B2' },
  { key: 'CC',  label: 'Comité de Crédit',        short: 'CC',  color: '#D97706' },
  { key: 'DG',  label: 'Direction Générale',      short: 'DG',  color: '#DC2626' },
  { key: 'DJ',  label: 'Direction Juridique',     short: 'Jur', color: '#059669' },
  { key: 'BO',  label: 'Back Office',             short: 'BO',  color: '#6B7280' },
] as const;

type RoleKey = typeof ROLES[number]['key'];
type RACICode = 'R' | 'A' | 'C' | 'I' | '';

interface Step {
  id: string;
  phase: string;
  label: string;
  description: string;
  raci: Partial<Record<RoleKey, RACICode>>;
}

const STEPS: Step[] = [
  // ── Phase 1 : Montage dossier ─────────────────────────────────────────
  {
    id: 'depot_dossier', phase: 'Montage dossier',
    label: "Dépôt & montage du dossier", description: "Collecte des pièces, saisie de la demande dans le système",
    raci: { CA: 'R', RE: 'I', RR: 'I' },
  },
  {
    id: 'verification_completude', phase: 'Montage dossier',
    label: "Vérification de la complétude", description: "Contrôle de la présence et conformité de toutes les pièces",
    raci: { RE: 'R', CA: 'C', RR: 'I' },
  },

  // ── Phase 2 : Analyse risques ─────────────────────────────────────────
  {
    id: 'contre_analyse', phase: 'Analyse risques',
    label: "Contre-analyse crédit", description: "Analyse financière indépendante du dossier (SYSCOHADA)",
    raci: { ANA: 'R', RR: 'A', RE: 'I', CA: 'I' },
  },
  {
    id: 'calcul_ratios', phase: 'Analyse risques',
    label: "Calcul des ratios prudentiels", description: "Calcul des ratios BCEAO : liquidité, solvabilité, endettement",
    raci: { ANA: 'R', RR: 'A' },
  },
  {
    id: 'notation_interne', phase: 'Analyse risques',
    label: "Notation interne (score)", description: "Attribution d'un score de crédit interne (1-10)",
    raci: { ANA: 'R', RR: 'A' },
  },
  {
    id: 'avis_risques', phase: 'Analyse risques',
    label: "Avis de la Direction Risques", description: "Synthèse et avis formel de la direction des risques",
    raci: { RR: 'R', ANA: 'C', RE: 'I', CC: 'I' },
  },

  // ── Phase 3 : Approbation ─────────────────────────────────────────────
  {
    id: 'validation_comite', phase: 'Approbation',
    label: "Validation Comité de Crédit", description: "Délibération collégiale pour les montants supra-seuil comité",
    raci: { CC: 'R', RR: 'C', RE: 'C', DG: 'I' },
  },
  {
    id: 'decision_direction', phase: 'Approbation',
    label: "Décision Direction Générale", description: "Approbation finale pour les montants supra-seuil DG",
    raci: { DG: 'R', CC: 'C', RR: 'I', RE: 'I' },
  },

  // ── Phase 4 : Mise en place ───────────────────────────────────────────
  {
    id: 'mise_en_place_sib', phase: 'Mise en place',
    label: "Mise en place SIB", description: "Paramétrage et création du crédit dans le système bancaire",
    raci: { RE: 'R', BO: 'R', RR: 'I', CA: 'I' },
  },
  {
    id: 'formalisation_garanties', phase: 'Mise en place',
    label: "Formalisation des garanties", description: "Rédaction et signature des actes de garantie (hypothèque, caution…)",
    raci: { DJ: 'R', RE: 'C', CA: 'I' },
  },
  {
    id: 'saisie_garanties', phase: 'Mise en place',
    label: "Saisie des garanties (système)", description: "Enregistrement des garanties dans le système de gestion",
    raci: { BO: 'R', RE: 'A', DJ: 'C' },
  },
  {
    id: 'tirage_fonds', phase: 'Mise en place',
    label: "Tirage / Décaissement des fonds", description: "Virement effectif des fonds sur le compte du bénéficiaire",
    raci: { RE: 'A', BO: 'R', CA: 'C', DG: 'I' },
  },
];

const PHASES = [...new Set(STEPS.map(s => s.phase))];

const RACI_CONFIG: Record<RACICode, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  R: { label: 'Responsible',  color: '#1D4ED8', bg: '#EFF6FF', icon: RIcon },
  A: { label: 'Accountable',  color: '#B45309', bg: '#FFFBEB', icon: AIcon },
  C: { label: 'Consulted',    color: '#6D28D9', bg: '#F5F3FF', icon: CIcon },
  I: { label: 'Informed',     color: '#6B7280', bg: '#F9FAFB', icon: IIcon },
  '': { label: '—',            color: '#E5E7EB', bg: 'transparent', icon: () => null },
};

// ─── Component ────────────────────────────────────────────────────────────────
const RACIMatrixPage: React.FC = () => {
  const [activePhase, setActivePhase] = useState<string>('all');

  const filteredSteps = activePhase === 'all'
    ? STEPS
    : STEPS.filter(s => s.phase === activePhase);

  const phaseColor: Record<string, string> = {
    'Montage dossier': '#2563EB',
    'Analyse risques': '#7C3AED',
    'Approbation':     '#D97706',
    'Mise en place':   '#059669',
  };

  const RACICell: React.FC<{ code: RACICode }> = ({ code }) => {
    if (!code) return <TableCell align="center" sx={{ color: '#E5E7EB', fontSize: 14 }}>–</TableCell>;
    const cfg = RACI_CONFIG[code];
    const Icon = cfg.icon;
    return (
      <TableCell align="center" sx={{ px: 1 }}>
        <Tooltip title={cfg.label} arrow>
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: '6px',
            bgcolor: cfg.bg, border: `1px solid ${cfg.color}22`,
          }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: cfg.color, fontFamily: 'monospace' }}>
              {code}
            </Typography>
          </Box>
        </Tooltip>
      </TableCell>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>Matrice RACI — Processus Crédit</Typography>
        <Typography variant="body2" color="text.secondary">
          Répartition des responsabilités par étape du workflow d'instruction crédit
        </Typography>
      </Box>

      {/* Légende */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }} elevation={0} variant="outlined">
        {(Object.entries(RACI_CONFIG) as [RACICode, typeof RACI_CONFIG[RACICode]][])
          .filter(([k]) => k !== '')
          .map(([code, cfg]) => (
            <Box key={code} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '5px', bgcolor: cfg.bg, border: `1px solid ${cfg.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: cfg.color, fontFamily: 'monospace' }}>{code}</Typography>
              </Box>
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                {code} — {cfg.label}
              </Typography>
            </Box>
          ))}
      </Paper>

      {/* Filtre par phase */}
      <ToggleButtonGroup
        value={activePhase}
        exclusive
        onChange={(_, v) => v && setActivePhase(v)}
        size="small"
        sx={{ mb: 2.5 }}
      >
        <ToggleButton value="all">Toutes les phases</ToggleButton>
        {PHASES.map(p => (
          <ToggleButton key={p} value={p} sx={{ color: phaseColor[p] }}>
            {p}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* Table */}
      <Paper sx={{ overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 200, bgcolor: '#F8FAFC', fontWeight: 700 }}>Étape</TableCell>
              <TableCell sx={{ minWidth: 260, bgcolor: '#F8FAFC', fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>Description</TableCell>
              {ROLES.map(r => (
                <TableCell
                  key={r.key}
                  align="center"
                  sx={{ bgcolor: '#F8FAFC', minWidth: 58, px: 1 }}
                >
                  <Tooltip title={r.label} arrow>
                    <Box>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: r.color, whiteSpace: 'nowrap' }}>
                        {r.short}
                      </Typography>
                    </Box>
                  </Tooltip>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSteps.map((step, idx) => {
              const prevPhase = idx > 0 ? filteredSteps[idx - 1].phase : null;
              const showPhaseLabel = step.phase !== prevPhase;
              return (
                <React.Fragment key={step.id}>
                  {showPhaseLabel && (
                    <TableRow>
                      <TableCell
                        colSpan={ROLES.length + 2}
                        sx={{
                          bgcolor: `${phaseColor[step.phase]}12`,
                          borderLeft: `3px solid ${phaseColor[step.phase]}`,
                          py: 0.75, px: 2,
                        }}
                      >
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: phaseColor[step.phase], textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {step.phase}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow hover sx={{ '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' } }}>
                    <TableCell sx={{ py: 1 }}>
                      <Typography fontSize={13} fontWeight={600}>{step.label}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Typography fontSize={12} color="text.secondary">{step.description}</Typography>
                    </TableCell>
                    {ROLES.map(r => (
                      <RACICell key={r.key} code={step.raci[r.key] ?? ''} />
                    ))}
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      {/* Rôles détail */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>Rôles & périmètres</Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
          {[
            { key: 'CA',  title: "Chargé d'Affaires",     desc: "Relation client, montage et dépôt des dossiers. Interlocuteur principal de l'emprunteur.",                 color: '#2563EB' },
            { key: 'ANA', title: 'Analyste Risques',       desc: "Analyse financière SYSCOHADA, calcul des ratios prudentiels, notation interne. Mur chinois SIB.",         color: '#7C3AED' },
            { key: 'RR',  title: 'Resp. Direction Risques',desc: "Supervise les analystes, valide les avis risques. Mur chinois : interdit sur les étapes Engagements.",     color: '#6D28D9' },
            { key: 'RE',  title: 'Resp. Engagements',      desc: "Vérification complétude, mise en place SIB, décaissement. Mur chinois : interdit sur l'analyse risques.", color: '#0891B2' },
            { key: 'CC',  title: 'Comité de Crédit',       desc: "Délibération collégiale sur les dossiers dépassant le seuil directeur d'agence.",                        color: '#D97706' },
            { key: 'DG',  title: 'Direction Générale',     desc: "Approbation finale sur les montants supra-comité. Supervision globale du portefeuille.",                  color: '#DC2626' },
            { key: 'DJ',  title: 'Direction Juridique',    desc: "Rédaction et signature des actes de garantie. Conseil juridique sur les sûretés.",                       color: '#059669' },
            { key: 'BO',  title: 'Back Office',            desc: "Opérations de mise en place dans le système (SIB), saisie garanties, support décaissement.",             color: '#6B7280' },
          ].map(r => (
            <Paper key={r.key} variant="outlined" sx={{ p: 2, borderLeft: `3px solid ${r.color}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Chip label={r.key} size="small" sx={{ bgcolor: `${r.color}18`, color: r.color, fontWeight: 700, fontSize: 11 }} />
                <Typography fontWeight={700} fontSize={13}>{r.title}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" lineHeight={1.5}>{r.desc}</Typography>
            </Paper>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default RACIMatrixPage;
