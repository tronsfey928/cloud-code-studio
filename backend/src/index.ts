import { config } from './config';
import { connectDatabase } from './config/database';
import { createApp } from './app';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  try {
    await connectDatabase();

    const { server } = createApp();

    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`, {
        env: config.nodeEnv,
        port: config.port,
      });
    });

    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received, shutting down gracefully`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force shutdown after 10s
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

void main();
