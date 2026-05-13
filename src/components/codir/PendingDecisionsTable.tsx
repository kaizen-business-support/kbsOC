import React, { useMemo, useState } from 'react';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { PendingDecisionItem } from '../../types';
import { RelanceDialog } from './RelanceDialog';
import { ReassignDialog } from './ReassignDialog';
import { EscaladeDialog } from './EscaladeDialog';
import { DataTable, DataTableColumn } from '../common/DataTable';

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

function slaCategory(item: PendingDecisionItem): 'overdue' | 'soon' | 'ok' {
  if (item.isOverdue) return 'overdue';
  if (item.deadline) {
    const h = (new Date(item.deadline).getTime() - Date.now()) / 3_600_000;
    if (h < 24) return 'soon';
  }
  return 'ok';
}

function fmtAmount(v: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);
}

export const PendingDecisionsTable: React.FC<Props> = ({ items, stepFilter, onRefresh }) => {
  const navigate = useNavigate();
  const [relanceItem, setRelanceItem]   = useState<PendingDecisionItem | null>(null);
  const [reassignItem, setReassignItem] = useState<PendingDecisionItem | null>(null);
  const [escaladeItem, setEscaladeItem] = useState<PendingDecisionItem | null>(null);

  // Options dynamiques pour les filtres enum (Étape, Agent)
  const stepOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach(i => map.set(i.stepName, i.stepLabel));
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [items]);

  const agentOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach(i => { if (i.assigneeId && i.assigneeName) map.set(i.assigneeId, i.assigneeName); });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [items]);

  // Si le parent a sélectionné une étape via BottleneckKpiBar, on filtre côté
  // amont (avant DataTable) pour conserver le comportement existant.
  const upstreamFiltered = useMemo(
    () => (stepFilter ? items.filter(i => i.stepName === stepFilter) : items),
    [items, stepFilter]
  );

  const columns: DataTableColumn<PendingDecisionItem>[] = [
    {
      id: 'applicationNumber',
      header: 'N° Dossier',
      accessor: (r) => r.applicationNumber,
      filter: { type: 'text' },
      render: (r) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{r.applicationNumber}</Typography>
          {r.isEscalated && (
            <Chip label="Escaladé" size="small" color="warning" sx={{ fontSize: '0.6rem', height: 18 }} />
          )}
          {r.lastRelancedAt && !r.isEscalated && (
            <Chip label="Relancé" size="small" sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#f1f5f9' }} />
          )}
        </Box>
      ),
    },
    {
      id: 'clientName',
      header: 'Client',
      accessor: (r) => r.clientName,
      filter: { type: 'text' },
    },
    {
      id: 'amount',
      header: 'Montant',
      accessor: (r) => r.amount,
      filter: { type: 'number' },
      align: 'right',
      render: (r) => <Typography sx={{ fontSize: 13 }} noWrap>{fmtAmount(r.amount, r.currency)}</Typography>,
    },
    {
      id: 'stepName',
      header: 'Étape',
      accessor: (r) => r.stepName,
      filter: { type: 'enum', options: stepOptions },
      render: (r) => <Typography sx={{ fontSize: 13 }}>{r.stepLabel}</Typography>,
    },
    {
      id: 'assignee',
      header: 'Agent assigné',
      accessor: (r) => r.assigneeId ?? '',
      filter: { type: 'enum', options: agentOptions },
      render: (r) =>
        r.assigneeName
          ? <Typography sx={{ fontSize: 13 }}>{r.assigneeName}</Typography>
          : <Typography sx={{ fontSize: 13, fontStyle: 'italic', color: '#94a3b8' }}>Non assigné</Typography>,
    },
    {
      id: 'sla',
      header: 'SLA',
      accessor: (r) => slaCategory(r),
      filter: {
        type: 'enum',
        options: [
          { value: 'overdue', label: 'En retard' },
          { value: 'soon',    label: '< 24h' },
          { value: 'ok',      label: 'Dans les délais' },
        ],
      },
      render: (r) => <SlaChip item={r} />,
    },
    {
      id: 'daysWaiting',
      header: 'Attente',
      accessor: (r) => r.daysWaiting,
      filter: { type: 'number' },
      align: 'right',
      render: (r) => (
        <Typography sx={{ fontSize: 13, color: r.daysWaiting > 3 ? '#9F1239' : '#475569' }}>
          {r.daysWaiting}j
        </Typography>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      accessor: () => '',
      filter: { type: 'none' },
      sortable: false,
      align: 'right',
      render: (r) => (
        <>
          <Tooltip title="Voir le dossier">
            <IconButton size="small" onClick={() => navigate(`/workflow`)}>
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={r.assigneeId ? "Relancer l'agent" : 'Aucun agent assigné'}>
            <span>
              <IconButton size="small" disabled={!r.assigneeId} onClick={() => setRelanceItem(r)}>
                <NotificationsActiveIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Réaffecter">
            <IconButton size="small" onClick={() => setReassignItem(r)}>
              <SwapHorizIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={r.isEscalated ? 'Déjà escaladé' : 'Escalader'}>
            <span>
              <IconButton size="small" color="warning" disabled={r.isEscalated} onClick={() => setEscaladeItem(r)}>
                <ReportProblemIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </>
      ),
    },
  ];

  const getRowSx = (r: PendingDecisionItem) => {
    if (r.isEscalated) return { bgcolor: '#fff7ed', '&:hover': { bgcolor: '#ffedd5' } };
    if (r.isOverdue)   return { bgcolor: '#fef2f2', '&:hover': { bgcolor: '#fee2e2' } };
    return {};
  };

  return (
    <Box>
      <DataTable
        rows={upstreamFiltered}
        columns={columns}
        getRowId={(r) => r.stepId}
        pageSize={20}
        dense
        emptyMessage="Aucun dossier en attente"
        getRowSx={getRowSx}
      />

      <RelanceDialog  item={relanceItem}  onClose={() => setRelanceItem(null)}  onSuccess={onRefresh} />
      <ReassignDialog item={reassignItem} onClose={() => setReassignItem(null)} onSuccess={onRefresh} />
      <EscaladeDialog item={escaladeItem} onClose={() => setEscaladeItem(null)} onSuccess={onRefresh} />
    </Box>
  );
};
