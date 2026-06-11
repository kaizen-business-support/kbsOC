import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface CollabUser {
  userId: string;
  userName: string;
  color: string;
  socketId: string;
}

export interface WidgetActivity {
  widgetId: string;
  widgetTitle: string;
  action: 'drag_start' | 'drag_end' | 'edit_start' | 'edit_end';
  userId: string;
  userName: string;
  color: string;
}

export interface ActivityRecord {
  id: string;
  dashboardId: string;
  userId: string;
  userName: string;
  action: string;
  widgetId?: string;
  widgetTitle?: string;
  details?: Record<string, any>;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  widget_added:    'a ajouté',
  widget_deleted:  'a supprimé',
  widget_moved:    'a déplacé',
  widget_resized:  'a redimensionné',
  widget_config:   'a modifié',
  dashboard_renamed: 'a renommé le tableau',
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

const API_BASE = process.env.REACT_APP_API_URL
  ?? `${window.location.protocol}//${window.location.hostname}:${process.env.REACT_APP_API_PORT ?? 5007}`;

export function useDashboardSocket(dashboardId: string | null, token: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected]               = useState(false);
  const [users, setUsers]                       = useState<CollabUser[]>([]);
  const [widgetActivities, setWidgetActivities] = useState<Record<string, WidgetActivity>>({});
  const [history, setHistory]                   = useState<ActivityRecord[]>([]);

  useEffect(() => {
    if (!dashboardId || !token) return;

    const socket = io(API_BASE, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', { dashboardId });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('presence', ({ users: u }: { users: CollabUser[] }) => setUsers(u));

    socket.on('widget_activity', (evt: WidgetActivity) => {
      setWidgetActivities(prev => {
        if (evt.action === 'drag_end' || evt.action === 'edit_end') {
          const next = { ...prev };
          delete next[evt.widgetId];
          return next;
        }
        return { ...prev, [evt.widgetId]: evt };
      });
    });

    socket.on('history', ({ activities }: { activities: ActivityRecord[] }) => {
      setHistory(activities);
    });

    socket.on('new_activity', ({ activity }: { activity: ActivityRecord }) => {
      setHistory(prev => [activity, ...prev].slice(0, 50));
    });

    return () => {
      socket.emit('leave', { dashboardId });
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setUsers([]);
      setWidgetActivities({});
    };
  }, [dashboardId, token]);

  const emitWidgetActivity = useCallback((widgetId: string, widgetTitle: string, action: WidgetActivity['action']) => {
    socketRef.current?.emit('widget_activity', { dashboardId, widgetId, widgetTitle, action });
  }, [dashboardId]);

  const logAction = useCallback((action: string, widgetId?: string, widgetTitle?: string, details?: Record<string, any>) => {
    socketRef.current?.emit('log_action', { dashboardId, action, widgetId, widgetTitle, details });
  }, [dashboardId]);

  return { connected, users, widgetActivities, history, emitWidgetActivity, logAction };
}
