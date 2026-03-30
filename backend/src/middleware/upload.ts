import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';
import { config } from '../config';

const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/typescript',
  'application/json',
  'application/xml',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
  'application/zip',
  'application/x-tar',
  'application/gzip',
]);

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (allowedMimeTypes.has(file.mimetype)) {
    cb(null, true);
  } else {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = new Set([
      '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java',
      '.c', '.cpp', '.h', '.cs', '.rb', '.php', '.swift', '.kt',
      '.sh', '.bash', '.yaml', '.yml', '.toml', '.env', '.md',
      '.txt', '.json', '.xml', '.html', '.css', '.scss', '.sql',
    ]);
    if (allowedExtensions.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize,
    files: 10,
  },
  fileFilter,
});
