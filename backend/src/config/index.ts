import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'cloudcode',
    password: process.env.MYSQL_PASSWORD || 'cloudcode',
    database: process.env.MYSQL_DATABASE || 'cloudcode',
  },
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiry: process.env.JWT_EXPIRY || '24h',
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  containerTimeout: parseInt(process.env.CONTAINER_TIMEOUT || '3600000', 10),
  sandboxImage: process.env.SANDBOX_IMAGE || 'ubuntu:22.04',
  opencode: {
    llmProvider: process.env.OPENCODE_LLM_PROVIDER || 'anthropic',
    llmModel: process.env.OPENCODE_LLM_MODEL || '',
    llmApiKey: process.env.OPENCODE_LLM_API_KEY || '',
    llmBaseUrl: process.env.OPENCODE_LLM_BASE_URL || '',
  },
};
