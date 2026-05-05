import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  AssignmentTurnedIn as ActionIcon,
} from '@mui/icons-material';
import { ApiService } from '../services/api';
import { PageType } from '../types';

interface NotifItem {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'ACTION_REQUIRED' | 'SUCCESS' | 'WARNING';
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  relatedId?: string;
}

interface NotificationBellProps {
  onPageChange: (page: PageType) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'à l\'instant';
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${Math.floor(hours / 24)}j`;
}

const typeIcon = (type: NotifItem['type']) => {
  switch (type) {
    case 'ACTION_REQUIRED': return <ActionIcon fontSize="small" color="warning" />;
    case 'SUCCESS': return <SuccessIcon fontSize="small" color="success" />;
    case 'WARNING': return <WarningIcon fontSize="small" color="error" />;
    default: return <InfoIcon fontSize="small" color="info" />;
  }
};

const typeBg = (type: NotifItem['type']) => {
  switch (type) {
    case 'ACTION_REQUIRED': return 'rgba(255, 152, 0, 0.08)';
    case 'SUCCESS': return 'rgba(76, 175, 80, 0.08)';
    case 'WARNING': return 'rgba(244, 67, 54, 0.08)';
    default: return 'rgba(33, 150, 243, 0.08)';
  }
};

export const NotificationBell: React.FC<NotificationBellProps> = ({ onPageChange }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = useCallback(async () => {
    const res = await ApiService.getUnreadNotifCount();
    if (res.success && res.data !== undefined) setUnreadCount(res.data);
  }, []);

  const fetchNotifications = useCallback(async () => {
    const res = await ApiService.getMyNotifications();
    if (res.success && res.data) {
      setNotifications(res.data.slice(0, 10));
    }
  }, []);

  useEffect(() => {
    fetchCount();
    intervalRef.current = setInterval(fetchCount, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchCount]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    fetchNotifications();
    fetchCount();
  };

  const handleClose = () => setAnchorEl(null);

  const handleItemClick = async (notif: NotifItem) => {
    if (!notif.isRead) {
      await ApiService.markNotifRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    handleClose();
    // Si la notification est liée à un dossier, le pré-sélectionner dans WorkflowPage
    if (notif.relatedId) {
      localStorage.setItem('pending_workflow_app', notif.relatedId);
    }
    onPageChange('workflow');
  };

  const handleMarkAll = async () => {
    await ApiService.markAllNotifsRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          onClick={handleOpen}
          sx={{
            color: 'inherit',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Badge
            badgeContent={unreadCount > 0 ? unreadCount : undefined}
            color="error"
            max={99}
          >
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        disableScrollLock
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 380, maxHeight: 520, display: 'flex', flexDirection: 'column' } }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Notifications {unreadCount > 0 && `(${unreadCount} non lues)`}
          </Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={handleMarkAll}>
              Tout marquer lu
            </Button>
          )}
        </Box>

        {/* List */}
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Aucune notification
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {notifications.map((notif, idx) => (
                <React.Fragment key={notif.id}>
                  {idx > 0 && <Divider />}
                  <ListItem
                    alignItems="flex-start"
                    onClick={() => handleItemClick(notif)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: notif.isRead ? 'transparent' : typeBg(notif.type),
                      '&:hover': { bgcolor: 'action.hover' },
                      py: 1.5,
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                      {typeIcon(notif.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight={notif.isRead ? 400 : 600} noWrap>
                          {notif.title}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {notif.message.length > 80 ? `${notif.message.slice(0, 80)}…` : notif.message}
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            {timeAgo(notif.createdAt)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
};
