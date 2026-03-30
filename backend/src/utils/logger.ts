import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, json, errors, colorize, simple } = winston.format;

const fileTransports: winston.transport[] = [
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: combine(timestamp(), errors({ stack: true }), json()),
  }),
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: combine(timestamp(), errors({ stack: true }), json()),
  }),
];

const consoleTransport = new winston.transports.Console({
  format:
    config.nodeEnv === 'development'
      ? combine(colorize(), simple())
      : combine(timestamp(), errors({ stack: true }), json()),
});

export const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(timestamp(), errors({ stack: true }), json()),
  defaultMeta: { service: 'cloud-code-studio' },
  transports: [consoleTransport, ...fileTransports],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});
