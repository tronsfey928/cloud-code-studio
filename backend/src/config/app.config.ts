import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  workspacesDir: process.env.WORKSPACES_DIR || '/data/workspaces',
}));
