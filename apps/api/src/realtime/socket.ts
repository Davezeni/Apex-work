import { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt.js';
import { redisPub, redisSub } from '../lib/redis.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { assertMember, assertBothMembers, markAsRead } from '../services/chat.service.js';
import { markOnline, markOffline, maybePersistLastSeen } from '../services/presence.service.js';

interface AuthedSocket extends Socket {
  userId?: string;
}

/**
 * Module-scoped Socket.io singleton. Chat routes reach for this via getIo()
 * to broadcast messages after a successful HTTP send. Kept simple: we don't
 * emit from inside the service layer because that would create a hard
 * dependency on the transport.
 */
let ioInstance: Server | null = null;
export const getIo = (): Server | null => ioInstance;

export const initSocket = async (httpServer: HttpServer): Promise<Server> => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS.split(',').map((s) => s.trim()),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25_000,
    pingTimeout: 20_000,
    // WebSocket permessage-deflate: shrinks chat/notification payloads by
    // ~60-80% (they're mostly JSON text). Threshold=1024 skips tiny frames
    // where compression overhead > wire savings.
    perMessageDeflate: {
      threshold: 1024,
      zlibDeflateOptions: { level: 6, memLevel: 7 },
      zlibInflateOptions: { chunkSize: 16 * 1024 },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      concurrencyLimit: 10,
    },
    // Bigger long-poll batches when websocket isn't available. Saves round-trips.
    maxHttpBufferSize: 2e6, // 2 MB
    httpCompression: { threshold: 1024 },
  });

  // Optionally attach Redis adapter for horizontal scale (best-effort).
  try {
    const modName = '@socket.io/redis-adapter';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(/* @vite-ignore */ modName).catch(() => null);
    if (mod?.createAdapter) {
      io.adapter(mod.createAdapter(redisPub, redisSub));
      logger.info('Socket.io Redis adapter attached');
    }
  } catch (err) {
    logger.warn({ err }, 'Redis adapter not attached — running single-node');
  }

  // JWT auth on the handshake — no unauthenticated sockets allowed.
  io.use((socket: AuthedSocket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('UNAUTHORIZED'));
      const payload = verifyAccessToken(token);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket: AuthedSocket) => {
    if (!socket.userId) return socket.disconnect();

    // Every socket joins its private user room for direct notifications
    // (e.g. "you got a new message in conversation X" fired from a background job).
    socket.join(`user:${socket.userId}`);
    logger.debug({ userId: socket.userId, sid: socket.id }, 'Socket connected');
    markOnline(socket.userId);
    maybePersistLastSeen(socket.userId);

    // Presence heartbeat: clients ping this every ~15s so peers see an online
    // dot. The in-process tracker expires stale entries automatically.
    socket.on('presence:heartbeat', () => {
      markOnline(socket.userId!);
      maybePersistLastSeen(socket.userId!);
    });

    // Join a conversation room — with server-side authorization.
    socket.on('conversation:join', async (conversationId: string, ack?: (ok: boolean) => void) => {
      try {
        if (typeof conversationId !== 'string' || conversationId.length > 40) {
          ack?.(false);
          return;
        }
        await assertMember(conversationId, socket.userId!);
        socket.join(`conv:${conversationId}`);
        // Tell the room this member just came online (open threads update live).
        socket.to(`conv:${conversationId}`).emit('presence:update', { userId: socket.userId!, online: true });
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });

    socket.on('conversation:leave', (conversationId: string) => {
      if (typeof conversationId === 'string') {
        socket.to(`conv:${conversationId}`).emit('presence:update', { userId: socket.userId!, online: false });
        socket.leave(`conv:${conversationId}`);
      }
    });

    socket.on('conversation:read', async (conversationId: string) => {
      if (typeof conversationId !== 'string') return;
      try {
        await markAsRead(conversationId, socket.userId!);
        // Notify OTHER members that this user has read up to now
        socket.to(`conv:${conversationId}`).emit('conversation:read', {
          conversationId,
          userId: socket.userId,
          at: new Date().toISOString(),
        });
      } catch {
        // silent — read markers are best-effort
      }
    });

    // Typing indicators are ephemeral, no persistence — just relay.
    // We also push a `typing:inbox` event to the OTHER members' private user
    // rooms so the conversation list (inbox) can show a live "... typing" pulse
    // even when no thread is open. Best-effort: if the member lookup fails we
    // still keep the in-thread relay working.
    const relayInboxTyping = async (conversationId: string, status: 'start' | 'stop') => {
      if (!socket.userId) return;
      try {
        const { prisma } = await import('../lib/prisma.js');
        const [members, typist] = await Promise.all([
          prisma.conversationMember.findMany({
            where: { conversationId, userId: { not: socket.userId } },
            select: { userId: true },
          }),
          prisma.user.findUnique({
            where: { id: socket.userId },
            select: { fullName: true, username: true },
          }),
        ]);
        const name = typist ? typist.fullName.split(' ')[0] : null;
        for (const m of members) {
          io.to(`user:${m.userId}`).emit('typing:inbox', {
            conversationId,
            userId: socket.userId,
            status,
            name,
          });
        }
      } catch {
        /* best-effort only */
      }
    };
    socket.on('typing:start', (conversationId: string) => {
      if (typeof conversationId !== 'string') return;
      socket.to(`conv:${conversationId}`).emit('typing:start', {
        conversationId,
        userId: socket.userId,
      });
      void relayInboxTyping(conversationId, 'start');
    });
    socket.on('typing:stop', (conversationId: string) => {
      if (typeof conversationId !== 'string') return;
      socket.to(`conv:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId: socket.userId,
      });
      void relayInboxTyping(conversationId, 'stop');
    });

    // ------- WebRTC group call signaling -------
    //
    // We don't run a media server (SFU/MCU) — instead we relay signaling
    // messages between conversation members and let the browsers connect
    // peer-to-peer via WebRTC data + media tracks. This is free and works
    // fine up to ~4-5 participants per call, which covers the vast
    // majority of freelance client-freelancer conversations.
    //
    // Client protocol (all payloads carry conversationId):
    //   call:start   → server broadcasts to room so members see the incoming ring
    //   call:end     → server broadcasts to room
    //   call:signal  → { conversationId, targetUserId, payload } — server
    //                  forwards `payload` to the target's user room
    //   call:join    → tells the room this user is joining
    //   call:leave   → tells the room this user left
    socket.on('call:start', async (conversationId: string, mode: 'audio' | 'video' = 'video') => {
      if (typeof conversationId !== 'string') return;
      try {
        await assertMember(conversationId, socket.userId!);
        socket.to(`conv:${conversationId}`).emit('call:start', {
          conversationId, mode, from: socket.userId, at: new Date().toISOString(),
        });
      } catch {
        // silent — non-member; nothing to do
      }
    });

    socket.on('call:end', async (conversationId: string) => {
      if (typeof conversationId !== 'string') return;
      try {
        await assertMember(conversationId, socket.userId!);
        socket.to(`conv:${conversationId}`).emit('call:end', { conversationId, from: socket.userId });
      } catch { /* non-member */ }
    });

    socket.on('call:join', async (conversationId: string) => {
      if (typeof conversationId !== 'string') return;
      try {
        await assertMember(conversationId, socket.userId!);
        socket.to(`conv:${conversationId}`).emit('call:join', { conversationId, from: socket.userId });
      } catch { /* non-member */ }
    });

    socket.on('call:leave', async (conversationId: string) => {
      if (typeof conversationId !== 'string') return;
      try {
        await assertMember(conversationId, socket.userId!);
        socket.to(`conv:${conversationId}`).emit('call:leave', { conversationId, from: socket.userId });
      } catch { /* non-member */ }
    });

    // Forward SDP offers/answers + ICE candidates to a specific peer.
    // The payload can be a large SDP blob; Socket.io compresses it via
    // perMessageDeflate that we enabled last turn.
    socket.on('call:signal', async (input: { conversationId: string; targetUserId: string; payload: unknown }) => {
      if (!input || typeof input.conversationId !== 'string' || typeof input.targetUserId !== 'string') return;
      if (input.targetUserId === socket.userId) return; // no self-relay
      // Authorization: BOTH the caller and the target must belong to the
      // conversation before any SDP/ICE payload is forwarded. Prevents an
      // authenticated user from pushing call/signal data to arbitrary users
      // or spoofing a target outside a conversation they share.
      try {
        await assertBothMembers(input.conversationId, socket.userId!, input.targetUserId);
      } catch {
        return; // silent — non-member or unknown target; nothing to forward
      }
      io.to(`user:${input.targetUserId}`).emit('call:signal', {
        conversationId: input.conversationId,
        from: socket.userId,
        payload: input.payload,
      });
    });

    socket.on('disconnect', (reason) => {
      if (socket.userId) {
        markOffline(socket.userId);
        maybePersistLastSeen(socket.userId);
      }
      logger.debug({ userId: socket.userId, reason }, 'Socket disconnected');
    });
  });

  ioInstance = io;
  return io;
};
