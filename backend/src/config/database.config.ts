import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  username: process.env.MYSQL_USER || 'cloudcode',
  password: process.env.MYSQL_PASSWORD || 'cloudcode',
  database: process.env.MYSQL_DATABASE || 'cloudcode',
}));
