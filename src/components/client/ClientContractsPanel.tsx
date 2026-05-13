import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Chip, CircularProgress, IconButton, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import { ApiService } from '../../services/api';

interface ContractRow {
  id: string;
  filename: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
  uploadedBy: { id: string; name: string };
  application: {
    id: string;
    applicationNumber: string;
    status: string;
    amount: number;
    creditTypeName: string | null;
  };
  previewUrl: string;
  downloadUrl: string;
  canDownload: boolean;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED:     { label: 'Approuvé',      color: '#065f46', bg: '#d1fae5' },
  DISBURSED:    { label: 'Décaissé',      color: '#1e3a8a', bg: '#dbeafe' },
  UNDER_REVIEW: { label: 'En instruction', color: '#92400e', bg: '#fef3c7' },
};

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

const DOWNLOAD_RESERVED_TOOLTIP =
  "Téléchargement réservé aux services Back-office / Juridique ou aux chargés d'affaires de l'agence concernée.";

export function ClientContractsPanel({ clientId }: { clientId: string }) {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    ApiService.getClientContracts(clientId)
      .then((res) => {
        if (cancelled) return;
        setContracts(res.contracts);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.error ?? 'Erreur lors du chargement des contrats');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>;
  }

  if (contracts.length === 0) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        Aucun contrat signé pour ce client.
      </Alert>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none' }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: '#f8fafc' }}>
            <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Dossier</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Fichier</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Type</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Date</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 12 }} align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {contracts.map((c) => {
            const status = STATUS_LABELS[c.application.status] ?? { label: c.application.status, color: '#374151', bg: '#f3f4f6' };
            return (
              <TableRow key={c.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#1f4e79' }}>
                      {c.application.applicationNumber}
                    </Typography>
                    <Chip
                      label={status.label}
                      size="small"
                      sx={{ fontSize: 10, height: 20, fontWeight: 600, bgcolor: status.bg, color: status.color, border: 'none' }}
                    />
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 12.5 }}>{c.filename}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatSize(c.fileSize)}</Typography>
                </TableCell>
                <TableCell sx={{ fontSize: 12 }}>{c.application.creditTypeName ?? '—'}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{formatDate(c.createdAt)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Aperçu">
                    <IconButton size="small" onClick={() => window.open(c.previewUrl, '_blank', 'noopener')}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={c.canDownload ? 'Télécharger' : DOWNLOAD_RESERVED_TOOLTIP}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={!c.canDownload}
                        onClick={() => { window.location.href = c.downloadUrl; }}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
