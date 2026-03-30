import { Sequelize } from 'sequelize';
import { config } from './index';
import { logger } from '../utils/logger';

export const sequelize = new Sequelize(
  config.mysql.database,
  config.mysql.user,
  config.mysql.password,
  {
    host: config.mysql.host,
    port: config.mysql.port,
    dialect: 'mysql',
    logging: (sql) => logger.debug(sql),
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

export async function connectDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    logger.info('Connected to MySQL successfully');

    // Sync all models — only in development/test (creates tables if they do not exist).
    // In production, use proper database migrations (e.g. Sequelize CLI or Umzug).
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: false });
      logger.info('Database schema synchronised');
    }
  } catch (error) {
    logger.error('Failed to connect to MySQL', { error });
    throw error;
  }
}
