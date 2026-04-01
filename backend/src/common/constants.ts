/** Maximum allowed message content length (100 KB) */
export const MAX_MESSAGE_LENGTH = 100_000;

/** Maximum allowed file-write content size (10 MB) */
export const MAX_FILE_CONTENT_LENGTH = 10 * 1024 * 1024;

/** Maximum total attachment size per message (20 MB in base64 characters) */
export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;

/** Allowed MIME types for file uploads */
export const ALLOWED_MIME_TYPES = new Set([
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

/** Allowed file extensions for uploads */
export const ALLOWED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.cs', '.rb', '.php', '.swift', '.kt',
  '.sh', '.bash', '.yaml', '.yml', '.toml', '.env', '.md',
  '.txt', '.json', '.xml', '.html', '.css', '.scss', '.sql',
]);
