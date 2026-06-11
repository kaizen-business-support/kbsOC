import React from 'react';
import {
  Box, Divider, Drawer, IconButton, List, ListItem,
  ListItemText, Typography, Avatar,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { ActivityRecord, actionLabel } from '../../../hooks/useDashboardSocket';

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  activities: ActivityRecord[];
}

const COLOR_MAP: Record<string, string> = {
  widget_added: '#43a047', widget_deleted: '#e53935', widget_moved: '#1e88e5',
  widget_resized: '#fb8c00', widget_config: '#8e24aa', dashboard_renamed: '#039be5',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'à l\'instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ open, onClose, activities }) => (
  <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 320 } }}>
    <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="subtitle2" fontWeight={700}>Historique des modifications</Typography>
      <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
    </Box>

    {activities.length === 0 ? (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="caption" color="text.disabled">Aucune activité enregistrée</Typography>
      </Box>
    ) : (
      <List dense disablePadding>
        {activities.map((a, i) => (
          <React.Fragment key={a.id}>
            <ListItem alignItems="flex-start" sx={{ py: 1, px: 2 }}>
              <Avatar sx={{ bgcolor: COLOR_MAP[a.action] ?? '#90a4ae', width: 28, height: 28, fontSize: '0.65rem', mr: 1.5, mt: 0.3, flexShrink: 0 }}>
                {initials(a.userName)}
              </Avatar>
              <ListItemText
                primary={
                  <Typography variant="caption" component="span">
                    <strong>{a.userName}</strong>{' '}
                    <span style={{ color: COLOR_MAP[a.action] ?? '#555' }}>{actionLabel(a.action)}</span>
                    {a.widgetTitle ? <> <em>"{a.widgetTitle}"</em></> : ''}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" color="text.disabled" component="span">
                    {timeAgo(a.createdAt)}
                  </Typography>
                }
              />
            </ListItem>
            {i < activities.length - 1 && <Divider component="li" />}
          </React.Fragment>
        ))}
      </List>
    )}
  </Drawer>
);
