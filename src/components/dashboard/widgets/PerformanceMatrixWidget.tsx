import React, { useEffect, useState } from 'react';
import {
  Box, Chip, CircularProgress, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import { ApiService } from '../../../services/api';
import { Period, WidgetDataResult } from '../../../types';

interface PerformanceMatrixWidgetProps {
  data: WidgetDataResult;
  height?: number;
  period: Period;
  targetDays: number;
  initialGroupBy: 'manager' | 'branch';
}

type ViewMode = 'manager' | 'branch';

const numFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

function scoreColor(v: number)                           { return v >= 75 ? '#2e7d32' : v >= 50 ? '#e65100' : '#c62828'; }
function rateColor(v: number, good = 80, warn = 60)      { return v >= good ? '#2e7d32' : v >= warn ? '#e65100' : '#c62828'; }
function delayColor(avg: number, target: number)         { return avg === 0 ? '#9e9e9e' : avg <= target ? '#2e7d32' : avg <= target * 1.5 ? '#e65100' : '#c62828'; }
function bg(color: string)                               { return color + '18'; }

const TH: React.CSSProperties = { fontSize: '0.67rem', fontWeight: 700, whiteSpace: 'nowrap', padding: '6px 8px', backgroundColor: '#f5f6fa' };
const TD: React.CSSProperties = { fontSize: '0.70rem', padding: '5px 8px', whiteSpace: 'nowrap' };

export const PerformanceMatrixWidget: React.FC<PerformanceMatrixWidgetProps> = ({
  data, height = 260, period, targetDays, initialGroupBy,
}) => {
  const [view, setView]       = useState<ViewMode>(initialGroupBy);
  const [cache, setCache]     = useState<Partial<Record<ViewMode, WidgetDataResult>>>({ [initialGroupBy]: data });
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    setCache({ [initialGroupBy]: data });
    setView(initialGroupBy);
  }, [data, initialGroupBy]);

  const toggle = async (next: ViewMode) => {
    if (next === view) return;
    setView(next);
    if (!cache[next]) {
      setFetching(true);
      try {
        const res = await ApiService.getWidgetData({
          source: 'performance',
          metric: 'performance_matrix',
          groupBy: next,
          period,
          filter: { targetDays: String(targetDays) },
        });
        if (res.success && res.data) setCache(c => ({ ...c, [next]: res.data! }));
      } finally {
        setFetching(false);
      }
    }
  };

  const rows = (cache[view]?.rows ?? []) as any[];

  return (
    <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
      {/* Barre de contrôle */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {(['manager', 'branch'] as ViewMode[]).map(v => (
            <Chip
              key={v}
              label={v === 'manager' ? 'Par chargé' : 'Par agence'}
              size="small"
              onClick={() => toggle(v)}
              sx={{
                fontSize: '0.63rem', height: 20, cursor: 'pointer',
                bgcolor: view === v ? '#1565c0' : 'transparent',
                color:   view === v ? '#fff' : '#555',
                border: '1px solid', borderColor: view === v ? '#1565c0' : '#ccc',
                '&:hover': { bgcolor: view === v ? '#1565c0' : '#f0f0f0' },
              }}
            />
          ))}
        </Box>
        {fetching && <CircularProgress size={12} thickness={5} />}
        <Typography sx={{ fontSize: '0.63rem', color: '#999', ml: 'auto' }}>
          Cible : {targetDays}j · Score = 40% délais + 35% appro + 25% volume
        </Typography>
      </Box>

      {/* Légende couleurs */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 0.5 }}>
        {[['#2e7d32', 'Objectif atteint'], ['#e65100', 'À surveiller'], ['#c62828', 'Alerte']].map(([c, l]) => (
          <Box key={l} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>{l}</Typography>
          </Box>
        ))}
      </Box>

      {!rows.length ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="caption" color="text.disabled">Aucune donnée sur la période</Typography>
        </Box>
      ) : (
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell style={{ ...TH, minWidth: 130, position: 'sticky', left: 0, zIndex: 4 }}>
                  {view === 'manager' ? 'Chargé de dossier' : 'Agence'}
                </TableCell>
                <Tooltip title="Dossiers terminés (approuvés, rejetés, décaissés, annulés)" placement="top">
                  <TableCell align="center" style={{ ...TH, minWidth: 62 }}>Traités</TableCell>
                </Tooltip>
                <Tooltip title="Dossiers en cours (soumis, en analyse)" placement="top">
                  <TableCell align="center" style={{ ...TH, minWidth: 62 }}>En cours</TableCell>
                </Tooltip>
                <Tooltip title="Montant total des dossiers approuvés / décaissés" placement="top">
                  <TableCell align="right" style={{ ...TH, minWidth: 110 }}>Vol. approuvé (XOF)</TableCell>
                </Tooltip>
                <Tooltip title="Délai moyen de traitement en jours ouvrés" placement="top">
                  <TableCell align="center" style={{ ...TH, minWidth: 68 }}>Délai moy.</TableCell>
                </Tooltip>
                <Tooltip title="Délai cible (SLA) en jours ouvrés" placement="top">
                  <TableCell align="center" style={{ ...TH, minWidth: 55 }}>Cible</TableCell>
                </Tooltip>
                <Tooltip title="Nombre de dossiers ayant dépassé le délai cible" placement="top">
                  <TableCell align="center" style={{ ...TH, minWidth: 62 }}>Retards</TableCell>
                </Tooltip>
                <Tooltip title="% de dossiers traités dans les délais" placement="top">
                  <TableCell align="center" style={{ ...TH, minWidth: 72 }}>% Délais</TableCell>
                </Tooltip>
                <Tooltip title="% d'approbation (approuvés / (approuvés + rejetés))" placement="top">
                  <TableCell align="center" style={{ ...TH, minWidth: 72 }}>% Appro.</TableCell>
                </Tooltip>
                <Tooltip title="Score composite : 40% délais + 35% approbation + 25% volume relatif" placement="top">
                  <TableCell align="center" style={{ ...TH, minWidth: 90 }}>Score /100</TableCell>
                </Tooltip>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row: any, i: number) => {
                const dColor = delayColor(row.avgDays, row.targetDays);
                const tColor = rateColor(row.onTimeRate, 80, 60);
                const aColor = rateColor(row.approvalRate, 70, 50);
                const sColor = scoreColor(row.score);
                return (
                  <TableRow key={i} hover>
                    <TableCell
                      style={{ ...TD, fontWeight: 600, position: 'sticky', left: 0, backgroundColor: i % 2 === 0 ? '#fafafa' : '#fff', zIndex: 1, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}
                      title={row.dimension}
                    >
                      {row.dimension}
                    </TableCell>

                    <TableCell align="center" style={TD}>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 600 }}>{numFmt.format(row.processed)}</Typography>
                    </TableCell>

                    <TableCell align="center" style={{ ...TD, color: row.inProgress > 0 ? '#e65100' : '#bbb' }}>
                      {row.inProgress > 0 ? numFmt.format(row.inProgress) : '—'}
                    </TableCell>

                    <TableCell align="right" style={TD}>
                      {row.volume > 0 ? numFmt.format(row.volume) : '—'}
                    </TableCell>

                    {/* Délai moyen vs cible */}
                    <TableCell align="center" style={{ ...TD, backgroundColor: bg(dColor) }}>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: dColor }}>
                        {row.avgDays > 0 ? `${row.avgDays}j` : '—'}
                      </Typography>
                    </TableCell>

                    <TableCell align="center" style={{ ...TD, color: '#777' }}>
                      {row.targetDays}j
                    </TableCell>

                    {/* Retards */}
                    <TableCell align="center" style={{ ...TD, backgroundColor: row.overdue > 0 ? '#c6282814' : '#2e7d3214' }}>
                      {row.overdue > 0 ? (
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#c62828' }}>
                          {row.overdue}
                        </Typography>
                      ) : (
                        <Typography sx={{ fontSize: '0.72rem', color: '#2e7d32' }}>✓</Typography>
                      )}
                    </TableCell>

                    {/* % Délais */}
                    <TableCell align="center" style={{ ...TD, backgroundColor: bg(tColor) }}>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: tColor }}>
                        {row.durCount > 0 ? `${row.onTimeRate}%` : '—'}
                      </Typography>
                    </TableCell>

                    {/* % Approbation */}
                    <TableCell align="center" style={{ ...TD, backgroundColor: bg(aColor) }}>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: aColor }}>
                        {row.decidedCount > 0 ? `${row.approvalRate}%` : '—'}
                      </Typography>
                    </TableCell>

                    {/* Score */}
                    <TableCell align="center" style={TD}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                        <Box sx={{ width: 36, height: 7, borderRadius: 4, bgcolor: '#eee', overflow: 'hidden', flexShrink: 0 }}>
                          <Box sx={{ height: '100%', width: `${row.score}%`, bgcolor: sColor, borderRadius: 4 }} />
                        </Box>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: sColor, minWidth: 22 }}>
                          {row.score}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};
