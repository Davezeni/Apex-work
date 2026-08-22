import { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt.js';
import { redisPub, redisSub } from '../lib/redis.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { assertMember, markAsRead } from '../services/chat.service.js';

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

    // Join a conversation room — with server-side authorization.
    socket.on('conversation:join', async (conversationId: string, ack?: (ok: boolean) => void) => {
      try {
        if (typeof conversationId !== 'string' || conversationId.length > 40) {
          ack?.(false);
          return;
        }
        await assertMember(conversationId, socket.userId!);
        socket.join(`conv:${conversationId}`);
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });

    socket.on('conversation:leave', (conversationId: string) => {
      if (typeof conversationId === 'string') socket.leave(`conv:${conversationId}`);
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

    // Typing indicators are ephemeral, no persistence — just relay
    socket.on('typing:start', (conversationId: string) => {
      if (typeof conversationId !== 'string') return;
      socket.to(`conv:${conversationId}`).emit('typing:start', {
        conversationId,
        userId: socket.userId,
      });
    });
    socket.on('typing:stop', (conversationId: string) => {
      if (typeof conversationId !== 'string') return;
      socket.to(`conv:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId: socket.userId,
      });
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ userId: socket.userId, reason }, 'Socket disconnected');
    });
  });

  ioInstance = io;
  return io;
};
