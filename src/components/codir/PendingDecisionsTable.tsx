import React, { useState } from 'react';
import {
  Box, Table, TableBody, TableCell, TableHead, TableRow, Paper,
  Chip, IconButton, Tooltip, Typography, FormControl, InputLabel,
  Select, MenuItem, Switch, FormControlLabel,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { PendingDecisionItem } from '../../types';
import { RelanceDialog } from './RelanceDialog';
import { ReassignDialog } from './ReassignDialog';
import { EscaladeDialog } from './EscaladeDialog';

interface Props {
  items: PendingDecisionItem[];
  stepFilter: string | null;
  onRefresh: () => void;
}

function SlaChip({ item }: { item: PendingDecisionItem }) {
  if (item.isOverdue) return <Chip label="En retard" color="error" size="small" />;
  if (item.deadline) {
    const h = (new Date(item.deadline).getTime() - Date.now()) / 3_600_000;
    if (h < 24) return <Chip label="< 24h" color="warning" size="small" />;
  }
  return <Chip label="Dans les délais" color="success" size="small" variant="outlined" />;
}

function fmtAmount(v: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);
}

export const PendingDecisionsTable: React.FC<Props> = ({ items, stepFilter, onRefresh }) => {
  const navigate = useNavigate();
  const [agentFilter, setAgentFilter]     = useState('all');
  const [overdueOnly, setOverdueOnly]     = useState(false);
  const [relanceItem, setRelanceItem]     = useState<PendingDecisionItem | null>(null);
  const [reassignItem, setReassignItem]   = useState<PendingDecisionItem | null>(null);
  const [escaladeItem, setEscaladeItem]   = useState<PendingDecisionItem | null>(null);

  const agents = Array.from(new Set(
    items.filter(i => i.assigneeName).map(i => i.assigneeId!)
  )).map(id => ({ id, name: items.find(i => i.assigneeId === id)!.assigneeName! }));

  const filtered = items.filter(item => {
    if (stepFilter && item.stepName !== stepFilter) return false;
    if (agentFilter !== 'all' && item.assigneeId !== agentFilter) return false;
    if (overdueOnly && !item.isOverdue) return false;
    return true;
  });

  return (
    <Box>
      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Agent</InputLabel>
          <Select value={agentFilter} label="Agent" onChange={e => setAgentFilter(e.target.value)}>
            <MenuItem value="all">Tous les agents</MenuItem>
            {agents.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControlLabel
          control={<Switch checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} size="small" />}
          label={<Typography variant="body2">En retard uniquement</Typography>}
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
          {filtered.length} dossier{filtered.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Table */}
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell><Typography variant="caption" fontWeight={600}>N° Dossier</Typography></TableCell>
              <TableCell><Typography variant="caption" fontWeight={600}>Client</Typography></TableCell>
              <TableCell><Typography variant="caption" fontWeight={600}>Montant</Typography></TableCell>
              <TableCell><Typography variant="caption" fontWeight={600}>Étape</Typography></TableCell>
              <TableCell><Typography variant="caption" fontWeight={600}>Agent assigné</Typography></TableCell>
              <TableCell><Typography variant="caption" fontWeight={600}>SLA</Typography></TableCell>
              <TableCell><Typography variant="caption" fontWeight={600}>Attente</Typography></TableCell>
              <TableCell align="right"><Typography variant="caption" fontWeight={600}>Actions</Typography></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">Aucun dossier en attente</Typography>
                </TableCell>
              </TableRow>
            ) : filtered.map(item => (
              <TableRow
                key={item.stepId}
                sx={{
                  bgcolor: item.isEscalated ? '#fff7ed' : item.isOverdue ? '#fef2f2' : 'inherit',
                  '&:hover': { bgcolor: item.isEscalated ? '#ffedd5' : item.isOverdue ? '#fee2e2' : '#f8fafc' },
                }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>{item.applicationNumber}</Typography>
                    {item.isEscalated && (
                      <Chip label="Escaladé" size="small" color="warning" sx={{ fontSize: '0.6rem', height: 18 }} />
                    )}
                    {item.lastRelancedAt && !item.isEscalated && (
                      <Chip label="Relancé" size="small" sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#f1f5f9' }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell><Typography variant="body2">{item.clientName}</Typography></TableCell>
                <TableCell><Typography variant="body2" noWrap>{fmtAmount(item.amount, item.currency)}</Typography></TableCell>
                <TableCell><Typography variant="body2">{item.stepLabel}</Typography></TableCell>
                <TableCell>
                  {item.assigneeName
                    ? <Typography variant="body2">{item.assigneeName}</Typography>
                    : <Typography variant="body2" color="text.disabled" fontStyle="italic">Non assigné</Typography>}
                </TableCell>
                <TableCell><SlaChip item={item} /></TableCell>
                <TableCell>
                  <Typography variant="body2" color={item.daysWaiting > 3 ? 'error' : 'text.secondary'}>
                    {item.daysWaiting}j
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Voir le dossier">
                    <IconButton size="small" onClick={() => navigate(`/workflow`)}>
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={item.assigneeId ? 'Relancer l\'agent' : 'Aucun agent assigné'}>
                    <span>
                      <IconButton size="small" disabled={!item.assigneeId} onClick={() => setRelanceItem(item)}>
                        <NotificationsActiveIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Réaffecter">
                    <IconButton size="small" onClick={() => setReassignItem(item)}>
                      <SwapHorizIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={item.isEscalated ? 'Déjà escaladé' : 'Escalader'}>
                    <span>
                      <IconButton size="small" color="warning" disabled={item.isEscalated}
                        onClick={() => setEscaladeItem(item)}>
                        <ReportProblemIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <RelanceDialog  item={relanceItem}  onClose={() => setRelanceItem(null)}  onSuccess={onRefresh} />
      <ReassignDialog item={reassignItem} onClose={() => setReassignItem(null)} onSuccess={onRefresh} />
      <EscaladeDialog item={escaladeItem} onClose={() => setEscaladeItem(null)} onSuccess={onRefresh} />
    </Box>
  );
};
