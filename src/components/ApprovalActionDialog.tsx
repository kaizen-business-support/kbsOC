import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress,
  Alert, Divider,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  HelpOutline as InfoIcon,
  SwapHoriz as TransferIcon,
} from '@mui/icons-material';
import { ApprovalItem } from '../types';
import { ApiService } from '../services/api';
import { useUser } from '../contexts/UserContext';
import { OtpVerificationDialog } from './OtpVerificationDialog';

interface Props {
  item: ApprovalItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (itemId: string) => void;
}

function fmtAmount(v: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);
}

const ACTION_CONFIG = {
  approve:      { label: 'Approuver',         color: 'success' as const, icon: ApproveIcon,  decision: 'APPROVED'      as const },
  reject:       { label: 'Rejeter',            color: 'error'   as const, icon: RejectIcon,   decision: 'REJECTED'      as const },
  request_info: { label: 'Demander des infos', color: 'warning' as const, icon: InfoIcon,     decision: 'REQUEST_INFO'  as const },
  transfer:     { label: 'Transférer',         color: 'info'    as const, icon: TransferIcon, decision: 'TRANSFER'      as const },
};

type ActionKey = keyof typeof ACTION_CONFIG;
const ALL_ACTIONS: ActionKey[] = ['approve', 'reject', 'request_info', 'transfer'];

export const ApprovalActionDialog: React.FC<Props> = ({ item, open, onClose, onSuccess }) => {
  const { state: userState } = useUser();
  const [comments, setComments]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const [otpDialog, setOtpDialog]   = useState<{ open: boolean; action: ActionKey | null }>({
    open: false, action: null,
  });

  if (!item) return null;

  const visibleActions: ActionKey[] = item.allowedActions.length === 0
    ? ALL_ACTIONS
    : ALL_ACTIONS.filter((a) => item.allowedActions.includes(a));

  const handleAction = (action: ActionKey) => {
    if (action === 'approve' || action === 'reject') {
      setOtpDialog({ open: true, action });
    } else {
      submitDecision(action);
    }
  };

  const submitDecision = async (action: ActionKey) => {
    if (!userState.currentUser) return;
    const cfg = ACTION_CONFIG[action];
    setSubmitting(true);
    setError(null);
    try {
      const data = await ApiService.approveWorkflow(item.applicationId, {
        userId: userState.currentUser.id,
        decision: cfg.decision,
        comments: comments.trim() || undefined,
        stepId: item.id,
        stepName: item.stepName,
      });
      if (!data.success) throw new Error(data.error || 'Erreur');
      setSuccess(cfg.label + ' — décision enregistrée');
      setComments('');
      setTimeout(() => {
        onSuccess(item.id);
        onClose();
        setSuccess(null);
      }, 1500);
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '14px' } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            {item.applicationNumber} — {item.clientName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Étape : {item.stepLabel}
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            {item.creditType && (
              <Box>
                <Typography variant="caption" color="text.secondary">Type crédit</Typography>
                <Typography variant="body2" fontWeight={600}>{item.creditType}</Typography>
              </Box>
            )}
            {item.branch && (
              <Box>
                <Typography variant="caption" color="text.secondary">Agence</Typography>
                <Typography variant="body2" fontWeight={600}>{item.branch}</Typography>
              </Box>
            )}
            {item.type === 'financial' && (
              <Box>
                <Typography variant="caption" color="text.secondary">Montant</Typography>
                <Typography variant="body2" fontWeight={700} color="primary.main">
                  {fmtAmount(item.amount, item.currency)}
                </Typography>
              </Box>
            )}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {item.purpose}
          </Typography>

          <Divider sx={{ mb: 2 }} />

          {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <TextField
            label="Commentaire (optionnel)"
            multiline
            minRows={2}
            maxRows={4}
            fullWidth
            size="small"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            disabled={submitting}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={onClose} disabled={submitting} sx={{ textTransform: 'none', color: '#636366' }}>
            Fermer
          </Button>
          <Box sx={{ flex: 1 }} />
          {visibleActions.map((action) => {
            const cfg = ACTION_CONFIG[action];
            const IconComponent = cfg.icon;
            return (
              <Button
                key={action}
                variant={action === 'approve' ? 'contained' : 'outlined'}
                color={cfg.color}
                size="small"
                startIcon={submitting ? <CircularProgress size={13} /> : <IconComponent sx={{ fontSize: 14 }} />}
                onClick={() => handleAction(action)}
                disabled={submitting}
                sx={{
                  borderRadius: '10px', px: 2, fontSize: '13px',
                  fontWeight: 600, textTransform: 'none', whiteSpace: 'nowrap',
                  boxShadow: 'none', '&:hover': { boxShadow: 'none' },
                }}
              >
                {cfg.label}
              </Button>
            );
          })}
        </DialogActions>
      </Dialog>

      <OtpVerificationDialog
        open={otpDialog.open}
        actionLabel={otpDialog.action === 'approve' ? 'Approuver la demande' : 'Rejeter la demande'}
        purpose={otpDialog.action === 'approve' ? 'approve_credit' : 'reject_credit'}
        onClose={() => setOtpDialog({ open: false, action: null })}
        onVerified={async () => {
          const action = otpDialog.action;
          setOtpDialog({ open: false, action: null });
          if (action) await submitDecision(action);
        }}
      />
    </>
  );
};
