import { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt.js';
import { redisPub, redisSub } from '../lib/redis.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

/**
 * Wire up Socket.io on top of an HTTP server.
 * NOTE: @socket.io/redis-adapter is optional; we skip cleanly if unavailable.
 * For MVP local dev, single-node in-memory adapter is fine.
 */

interface AuthedSocket extends Socket {
  userId?: string;
}

export const initSocket = async (httpServer: HttpServer): Promise<Server> => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS.split(',').map((s) => s.trim()),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // Optionally attach Redis adapter for horizontal scale.
  // Skipped if @socket.io/redis-adapter isn't installed — single-node still works.
  try {
    // Dynamic import so it's optional (install @socket.io/redis-adapter to enable).
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

  // Auth middleware — expects `auth.token` on handshake
  io.use((socket: AuthedSocket, next) => {
    try {
      const token = (socket.handshake.auth?.token as string | undefined) ?? undefined;
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

    // Join a user-scoped room for direct notifications
    socket.join(`user:${socket.userId}`);
    logger.debug({ userId: socket.userId }, 'Socket connected');

    // Join a conversation room
    socket.on('conversation:join', async (conversationId: string) => {
      // TODO: authorize membership via DB before joining
      socket.join(`conv:${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conv:${conversationId}`);
    });

    // Client emits typing indicator
    socket.on('typing:start', (conversationId: string) => {
      socket.to(`conv:${conversationId}`).emit('typing:start', { userId: socket.userId });
    });
    socket.on('typing:stop', (conversationId: string) => {
      socket.to(`conv:${conversationId}`).emit('typing:stop', { userId: socket.userId });
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ userId: socket.userId, reason }, 'Socket disconnected');
    });
  });

  return io;
};
