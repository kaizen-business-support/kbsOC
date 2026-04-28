import React from 'react';
import { Chip } from '@mui/material';
import { ContractStatus } from '../../types/contracts';

const CFG: Record<ContractStatus, { label: string; color: 'default' | 'warning' | 'success' | 'info' | 'error' }> = {
  DRAFT:             { label: 'Brouillon',    color: 'default' },
  PENDING_SIGNATURE: { label: 'En signature', color: 'warning' },
  SIGNED:            { label: 'Signé',        color: 'success' },
  ARCHIVED:          { label: 'Archivé',      color: 'info' },
  CANCELLED:         { label: 'Annulé',       color: 'error' },
};

export function ContractStatusChip({ status }: { status: ContractStatus }) {
  const c = CFG[status];
  return <Chip size="small" label={c.label} color={c.color} />;
}
