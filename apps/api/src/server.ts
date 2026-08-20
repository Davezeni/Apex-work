import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { initSocket } from './realtime/socket.js';

const app = createApp();
const httpServer = createServer(app);

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'Shutting down gracefully…');
  const timeout = setTimeout(() => {
    logger.error('Forcing exit after 10s');
    process.exit(1);
  }, 10_000);

  try {
    await new Promise<void>((resolve, reject) =>
      httpServer.close((err) => (err ? reject(err) : resolve())),
    );
    await prisma.$disconnect();
    await redis.quit().catch(() => undefined);
    clearTimeout(timeout);
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});

const start = async (): Promise<void> => {
  try {
    // Optional but nice: initialize socket layer
    // We initialize lazily — errors here shouldn't kill the API
    initSocket(httpServer).catch((err) => logger.error({ err }, 'Socket init failed'));

    httpServer.listen(env.API_PORT, '0.0.0.0', () => {
      logger.info(`🚀 API listening on http://0.0.0.0:${env.API_PORT} (${env.NODE_ENV})`);
    });
  } catch (err) {
    logger.fatal({ err }, 'Failed to start');
    process.exit(1);
  }
};

void start();
