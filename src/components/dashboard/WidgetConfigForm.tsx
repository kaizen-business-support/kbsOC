import React, { useCallback, useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button,
  CircularProgress, FormControl, InputLabel, MenuItem, Select,
  TextField, Typography,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { Period } from '../../types';

export interface WidgetFormValues {
  title: string;
  type: 'kpi_card' | 'bar_chart' | 'line_chart' | 'gauge' | 'table' | 'trend_chart';
  source: 'applications' | 'clients' | 'analytics';
  metric: string;
  groupBy?: 'month' | 'status' | 'branch' | 'manager' | 'sector' | 'credit_type';
  filterStatus?: string;
  periodOverride?: Period;
  colorScheme?: 'blue' | 'green' | 'orange' | 'red';
  color?: string;
  thresholdWarning?: number;
  thresholdCritical?: number;
  limit?: number;
  regressionType?: 'linear' | 'logarithmic';
  forecastMonths?: number;
}

interface WidgetConfigFormProps {
  initialValues?: Partial<WidgetFormValues>;
  onSubmit: (values: WidgetFormValues) => void;
  loading?: boolean;
}

const SOURCE_BY_TYPE: Record<string, string[]> = {
  kpi_card:    ['applications', 'clients', 'analytics'],
  bar_chart:   ['applications'],
  line_chart:  ['applications'],
  gauge:       ['analytics'],
  table:       ['applications', 'clients'],
  trend_chart: ['applications'],
};

const METRICS_BY_SOURCE: Record<string, Array<{ value: string; label: string; tableOnly?: boolean }>> = {
  applications: [
    { value: 'count',               label: 'Nombre de dossiers' },
    { value: 'sum_amount',          label: 'Montant total' },
    { value: 'approval_rate',       label: "Taux d'approbation" },
    { value: 'avg_processing_time', label: 'Délai moyen (jours)' },
    { value: 'list',                label: 'Liste des dossiers', tableOnly: true },
  ],
  clients: [
    { value: 'count', label: 'Nombre de clients actifs' },
    { value: 'list',  label: 'Liste des clients', tableOnly: true },
  ],
  analytics: [
    { value: 'approval_rate',   label: "Taux d'approbation" },
    { value: 'npl_ratio',       label: 'Ratio NPL (%)' },
    { value: 'solvency_ratio',  label: 'Ratio de solvabilité (%)' },
    { value: 'liquidity_ratio', label: 'Ratio de liquidité (%)' },
  ],
};

const STATUS_OPTIONS = ['APPROVED', 'REJECTED', 'UNDER_REVIEW', 'SUBMITTED', 'DISBURSED', 'CANCELLED', 'DRAFT'];
const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Approuvé', REJECTED: 'Rejeté', UNDER_REVIEW: 'En analyse',
  SUBMITTED: 'Soumis', DISBURSED: 'Décaissé', CANCELLED: 'Annulé', DRAFT: 'Brouillon',
};
const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: 'this_month',     label: 'Ce mois' },
  { value: 'this_quarter',   label: 'Ce trimestre' },
  { value: 'this_year',      label: 'Cette année' },
  { value: 'last_6_months',  label: '6 derniers mois' },
  { value: 'last_12_months', label: '12 derniers mois' },
];
const PRESET_COLORS = ['#1565c0', '#2e7d32', '#e65100', '#c62828', '#7b1fa2', '#f9a825'];

const DEFAULT_VALUES: WidgetFormValues = {
  title: '', type: 'kpi_card', source: 'applications', metric: 'count',
};

export const WidgetConfigForm: React.FC<WidgetConfigFormProps> = ({ initialValues, onSubmit, loading }) => {
  const [values, setValues] = useState<WidgetFormValues>({ ...DEFAULT_VALUES, ...initialValues });

  useEffect(() => {
    const sources = SOURCE_BY_TYPE[values.type] ?? ['applications'];
    const needsSeries = values.type === 'bar_chart' || values.type === 'line_chart';
    setValues(v => ({
      ...v,
      ...(needsSeries && !v.groupBy ? { groupBy: 'month' } : {}),
      ...(!sources.includes(v.source) ? { source: sources[0] as WidgetFormValues['source'], metric: '' } : {}),
    }));
  }, [values.type]);

  useEffect(() => {
    const isTable = values.type === 'table';
    const available = (METRICS_BY_SOURCE[values.source] ?? []).filter(m => !m.tableOnly || isTable);
    if (!available.find(m => m.value === values.metric)) {
      setValues(v => ({ ...v, metric: available[0]?.value ?? '' }));
    }
  }, [values.source, values.type]);

  const set = useCallback((key: keyof WidgetFormValues, val: any) => {
    setValues(v => ({ ...v, [key]: val }));
  }, []);

  const availableSources = SOURCE_BY_TYPE[values.type] ?? ['applications'];
  const availableMetrics = (METRICS_BY_SOURCE[values.source] ?? []).filter(
    m => !m.tableOnly || values.type === 'table'
  );

  const showGroupBy      = values.type === 'bar_chart' || values.type === 'line_chart';
  const showFilterStatus = values.source === 'applications';
  const showColorScheme  = values.type === 'kpi_card';
  const showColor        = values.type === 'bar_chart' || values.type === 'line_chart' || values.type === 'trend_chart';
  const showThreshold    = values.type === 'gauge';
  const showLimit        = values.metric === 'list';
  const showRegression   = values.type === 'trend_chart';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Titre" required size="small" fullWidth
        value={values.title} onChange={e => set('title', e.target.value)}
      />
      <FormControl size="small" fullWidth required>
        <InputLabel>Type</InputLabel>
        <Select value={values.type} label="Type" onChange={e => set('type', e.target.value)}>
          <MenuItem value="kpi_card">KPI Card</MenuItem>
          <MenuItem value="bar_chart">Bar Chart</MenuItem>
          <MenuItem value="line_chart">Line Chart</MenuItem>
          <MenuItem value="trend_chart">Régression / Tendance</MenuItem>
          <MenuItem value="gauge">Gauge</MenuItem>
          <MenuItem value="table">Table</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" fullWidth required>
        <InputLabel>Source</InputLabel>
        <Select value={values.source} label="Source" onChange={e => set('source', e.target.value)}>
          {availableSources.map(s => (
            <MenuItem key={s} value={s}>
              {s === 'applications' ? 'Dossiers de crédit' : s === 'clients' ? 'Clients' : 'Analytique BCEAO'}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" fullWidth required>
        <InputLabel>Métrique</InputLabel>
        <Select value={values.metric} label="Métrique" onChange={e => set('metric', e.target.value)}>
          {availableMetrics.map(m => (
            <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary">Options avancées</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0 }}>
          {showGroupBy && (
            <FormControl size="small" fullWidth>
              <InputLabel>Grouper par</InputLabel>
              <Select value={values.groupBy ?? ''} label="Grouper par" onChange={e => set('groupBy', e.target.value || undefined)}>
                <MenuItem value=""><em>Aucun</em></MenuItem>
                <MenuItem value="month">Mois</MenuItem>
                <MenuItem value="status">Statut</MenuItem>
                <MenuItem value="branch">Agence</MenuItem>
                <MenuItem value="manager">Chargé de dossier</MenuItem>
                <MenuItem value="sector">Secteur d'activité</MenuItem>
                <MenuItem value="credit_type">Type de crédit</MenuItem>
              </Select>
            </FormControl>
          )}
          {showFilterStatus && (
            <FormControl size="small" fullWidth>
              <InputLabel>Filtre statut</InputLabel>
              <Select value={values.filterStatus ?? ''} label="Filtre statut" onChange={e => set('filterStatus', e.target.value || undefined)}>
                <MenuItem value=""><em>Tous</em></MenuItem>
                {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{STATUS_LABELS[s]}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          <FormControl size="small" fullWidth>
            <InputLabel>Override période</InputLabel>
            <Select value={values.periodOverride ?? ''} label="Override période" onChange={e => set('periodOverride', e.target.value as Period || undefined)}>
              <MenuItem value=""><em>Période globale</em></MenuItem>
              {PERIOD_OPTIONS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
            </Select>
          </FormControl>
          {showColorScheme && (
            <FormControl size="small" fullWidth>
              <InputLabel>Couleur</InputLabel>
              <Select value={values.colorScheme ?? 'blue'} label="Couleur" onChange={e => set('colorScheme', e.target.value)}>
                <MenuItem value="blue">Bleu</MenuItem>
                <MenuItem value="green">Vert</MenuItem>
                <MenuItem value="orange">Orange</MenuItem>
                <MenuItem value="red">Rouge</MenuItem>
              </Select>
            </FormControl>
          )}
          {showColor && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Couleur du graphique</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {PRESET_COLORS.map(c => (
                  <Box
                    key={c}
                    onClick={() => set('color', c)}
                    sx={{
                      width: 28, height: 28, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                      border: values.color === c ? '3px solid #1a1a2e' : '2px solid transparent',
                      transition: 'border 0.15s',
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
          {showThreshold && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                label="Seuil warning (%)" type="number" size="small"
                value={values.thresholdWarning ?? 70}
                onChange={e => set('thresholdWarning', parseInt(e.target.value))}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Seuil critique (%)" type="number" size="small"
                value={values.thresholdCritical ?? 50}
                onChange={e => set('thresholdCritical', parseInt(e.target.value))}
                sx={{ flex: 1 }}
              />
            </Box>
          )}
          {showLimit && (
            <TextField
              label="Nombre de lignes" type="number" size="small" fullWidth
              value={values.limit ?? 10}
              onChange={e => set('limit', parseInt(e.target.value))}
              inputProps={{ min: 1, max: 50 }}
            />
          )}
          {showRegression && (
            <>
              <FormControl size="small" fullWidth>
                <InputLabel>Type de régression</InputLabel>
                <Select value={values.regressionType ?? 'linear'} label="Type de régression" onChange={e => set('regressionType', e.target.value)}>
                  <MenuItem value="linear">Linéaire (y = mx + b)</MenuItem>
                  <MenuItem value="logarithmic">Logarithmique (y = a·ln(x) + b)</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Mois de prévision</InputLabel>
                <Select value={values.forecastMonths ?? 3} label="Mois de prévision" onChange={e => set('forecastMonths', Number(e.target.value))}>
                  <MenuItem value={0}>Aucun (tendance uniquement)</MenuItem>
                  <MenuItem value={1}>1 mois</MenuItem>
                  <MenuItem value={2}>2 mois</MenuItem>
                  <MenuItem value={3}>3 mois</MenuItem>
                  <MenuItem value={6}>6 mois</MenuItem>
                </Select>
              </FormControl>
            </>
          )}
        </AccordionDetails>
      </Accordion>

      <Button type="submit" variant="contained" fullWidth disabled={loading} sx={{ borderRadius: 2, mt: 1 }}>
        {loading ? <CircularProgress size={20} color="inherit" /> : (initialValues ? 'Enregistrer' : 'Ajouter le widget')}
      </Button>
    </Box>
  );
};
