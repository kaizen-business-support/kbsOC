import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Divider,
  useMediaQuery,
  useTheme,
  Alert,
} from '@mui/material';
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as UrgentIcon,
  Campaign as CampaignIcon,
} from '@mui/icons-material';
import { ApiService } from '../services/api';
import { useUser } from '../contexts/UserContext';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'INFO' | 'WARNING' | 'URGENT';
  expiresAt: string;
  createdAt: string;
  creator: { name: string };
}

const PRIORITY_CONFIG = {
  INFO:    { color: 'info'    as const, icon: InfoIcon,    label: 'Information', severity: 'info'    as const },
  WARNING: { color: 'warning' as const, icon: WarningIcon, label: 'Attention',   severity: 'warning' as const },
  URGENT:  { color: 'error'   as const, icon: UrgentIcon,  label: 'Urgent',      severity: 'error'   as const },
};

const DISMISSED_KEY = (userId: string) => `optimus_ann_dismissed_${userId}`;

const getDismissed = (userId: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY(userId)) || '[]');
  } catch {
    return [];
  }
};

const saveDismissed = (userId: string, ids: string[]) => {
  localStorage.setItem(DISMISSED_KEY(userId), JSON.stringify(ids));
};

interface AnnouncementModalProps {
  open: boolean;
  onClose: () => void;
  announcements: Announcement[];
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ open, onClose, announcements }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  if (announcements.length === 0) return null;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const highestPriority = announcements.some(a => a.priority === 'URGENT')
    ? 'URGENT'
    : announcements.some(a => a.priority === 'WARNING')
    ? 'WARNING'
    : 'INFO';

  const headerColor = {
    INFO:    '#1565c0',
    WARNING: '#e65100',
    URGENT:  '#b71c1c',
  }[highestPriority];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
      PaperProps={{ sx: { borderRadius: { xs: 0, sm: 2 } } }}
    >
      <DialogTitle
        sx={{
          bgcolor: headerColor,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 2,
        }}
      >
        <CampaignIcon />
        <Box>
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            Notes d'information
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.85 }}>
            {announcements.length} message{announcements.length > 1 ? 's' : ''} en attente
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {announcements.map((ann, index) => {
          const cfg = PRIORITY_CONFIG[ann.priority];
          const Icon = cfg.icon;

          return (
            <React.Fragment key={ann.id}>
              {index > 0 && <Divider />}
              <Box sx={{ px: 3, py: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
                  <Icon color={cfg.color} sx={{ mt: 0.25, flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                        {ann.title}
                      </Typography>
                      <Chip
                        label={cfg.label}
                        size="small"
                        color={cfg.color}
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                    </Box>
                    <Alert
                      severity={cfg.severity}
                      icon={false}
                      sx={{
                        mb: 1.5,
                        '& .MuiAlert-message': { p: 0 },
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                        {ann.message}
                      </Typography>
                    </Alert>
                    <Typography variant="caption" color="text.secondary">
                      Publié par <strong>{ann.creator?.name}</strong> · Expire le {formatDate(ann.expiresAt)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </React.Fragment>
          );
        })}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          variant="contained"
          onClick={onClose}
          sx={{ bgcolor: headerColor, '&:hover': { filter: 'brightness(0.9)' } }}
        >
          J'ai lu, fermer
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Hook : gestion du chargement + dismissed ─────────────────────────────────

export const useAnnouncements = (userId: string | undefined) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;

    ApiService.getActiveAnnouncements().then(res => {
      if (!res.success || !res.data?.length) return;

      const dismissed = getDismissed(userId);
      const unseen = (res.data as Announcement[]).filter(a => !dismissed.includes(a.id));

      if (unseen.length > 0) {
        setAnnouncements(unseen);
        setModalOpen(true);
      }
    });
  }, [userId]);

  const handleClose = () => {
    if (userId && announcements.length > 0) {
      const dismissed = getDismissed(userId);
      const newDismissed = Array.from(new Set([...dismissed, ...announcements.map(a => a.id)]));
      saveDismissed(userId, newDismissed);
    }
    setModalOpen(false);
  };

  return { announcements, modalOpen, handleClose };
};
