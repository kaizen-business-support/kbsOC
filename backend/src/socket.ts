import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from './prismaClient';

const COLLAB_COLORS = ['#e53935','#8e24aa','#1e88e5','#43a047','#f4511e','#039be5','#7cb342','#fb8c00'];

function userColor(userId: string): string {
  let h = 0;
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLLAB_COLORS[h % COLLAB_COLORS.length];
}

interface Presence { userId: string; userName: string; color: string; socketId: string; }

// dashboardId → Map<socketId, Presence>
const rooms = new Map<string, Map<string, Presence>>();

function getPresence(dashboardId: string): Presence[] {
  return Array.from(rooms.get(dashboardId)?.values() ?? []);
}

function leave(socket: Socket, dashboardId: string, io: SocketServer) {
  socket.leave(`dash:${dashboardId}`);
  rooms.get(dashboardId)?.delete(socket.id);
  if (rooms.get(dashboardId)?.size === 0) rooms.delete(dashboardId);
  io.to(`dash:${dashboardId}`).emit('presence', { dashboardId, users: getPresence(dashboardId) });
}

export function initSocket(httpServer: HttpServer): SocketServer {
  const allowedOrigins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (allowedOrigins.length === 0) allowedOrigins.push('http://localhost:3000'); // dev fallback

  const io = new SocketServer(httpServer, {
    path: '/socket.io',
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  });

  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('token_required'));
      const secret = process.env.JWT_SECRET;
      if (!secret) return next(new Error('server_error'));
      const payload = jwt.verify(token, secret) as any;
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, name: true },
      });
      if (!user) return next(new Error('user_not_found'));
      (socket as any).userId   = user.id;
      (socket as any).userName = user.name;
      next();
    } catch {
      next(new Error('invalid_token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId   = (socket as any).userId  as string;
    const userName = (socket as any).userName as string;
    const color    = userColor(userId);

    // Join a dashboard room
    socket.on('join', async ({ dashboardId }: { dashboardId: string }) => {
      try {
        // Check access: owner or shared
        const ok = await prisma.dashboard.findFirst({
          where: {
            id: dashboardId,
            OR: [
              { ownerId: userId },
              { companyId: { not: undefined }, shares: { some: { targetId: userId } } },
            ],
          },
          select: { id: true },
        });
        if (!ok) return;

        socket.join(`dash:${dashboardId}`);
        if (!rooms.has(dashboardId)) rooms.set(dashboardId, new Map());
        rooms.get(dashboardId)!.set(socket.id, { userId, userName, color, socketId: socket.id });

        // Send current presence to everyone in the room
        io.to(`dash:${dashboardId}`).emit('presence', {
          dashboardId, users: getPresence(dashboardId),
        });

        // Send recent history to the joining user
        const rows = await prisma.$queryRaw<any[]>`
          SELECT id, dashboard_id, user_id, user_name, action, widget_id, widget_title, details, created_at
          FROM dashboard_activities
          WHERE dashboard_id = ${dashboardId}
          ORDER BY created_at DESC
          LIMIT 50
        `;
        const activities = rows.map((r: any) => ({
          id:          r.id,
          dashboardId: r.dashboard_id,
          userId:      r.user_id,
          userName:    r.user_name,
          action:      r.action,
          widgetId:    r.widget_id,
          widgetTitle: r.widget_title,
          details:     r.details,
          createdAt:   r.created_at,
        }));
        socket.emit('history', { dashboardId, activities });
      } catch {}
    });

    // Leave a dashboard room explicitly
    socket.on('leave', ({ dashboardId }: { dashboardId: string }) => {
      leave(socket, dashboardId, io);
    });

    const VALID_WIDGET_ACTIONS = new Set(['drag_start', 'drag_end', 'edit_start', 'edit_end']);
    const VALID_LOG_ACTIONS    = new Set(['widget_added', 'widget_deleted', 'widget_moved', 'widget_resized', 'widget_config', 'dashboard_renamed']);

    // Widget activity: drag_start | drag_end | edit_start | edit_end
    socket.on('widget_activity', ({ dashboardId, widgetId, widgetTitle, action }: {
      dashboardId: string; widgetId: string; widgetTitle: string;
      action: 'drag_start' | 'drag_end' | 'edit_start' | 'edit_end';
    }) => {
      if (!socket.rooms.has(`dash:${dashboardId}`)) return;
      if (!VALID_WIDGET_ACTIONS.has(action)) return;
      socket.to(`dash:${dashboardId}`).emit('widget_activity', {
        widgetId, widgetTitle, action, userId, userName, color,
      });
    });

    // Log a meaningful action to DB and broadcast to room
    socket.on('log_action', async ({ dashboardId, action, widgetId, widgetTitle, details }: {
      dashboardId: string; action: string;
      widgetId?: string; widgetTitle?: string; details?: Record<string, any>;
    }) => {
      if (!socket.rooms.has(`dash:${dashboardId}`)) return;
      if (!VALID_LOG_ACTIONS.has(action)) return;
      try {
        const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await prisma.$executeRaw`
          INSERT INTO dashboard_activities (id, dashboard_id, user_id, user_name, action, widget_id, widget_title, details)
          VALUES (${id}, ${dashboardId}, ${userId}, ${userName}, ${action},
                  ${widgetId ?? null}, ${widgetTitle ?? null}, ${JSON.stringify(details ?? {})}::jsonb)
        `;
        const activity = { id, dashboardId, userId, userName, action, widgetId, widgetTitle, details, createdAt: new Date() };
        io.to(`dash:${dashboardId}`).emit('new_activity', { dashboardId, activity });
      } catch {}
    });

    // Clean up on disconnect
    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('dash:')) {
          leave(socket, room.replace('dash:', ''), io);
        }
      }
    });
  });

  return io;
}
