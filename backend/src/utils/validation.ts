/**
 * Centralized input validation utilities for production-grade request handling.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
const BRANCH_RE = /^[a-zA-Z0-9._\-/]+$/;
const GIT_URL_RE = /^(https?:\/\/|git@|ssh:\/\/)/;

export function isValidEmail(email: string): boolean {
  return typeof email === 'string' && email.length <= 255 && EMAIL_RE.test(email);
}

/**
 * Password must be 8–128 chars and contain at least one lowercase letter,
 * one uppercase letter, and one digit.
 */
export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && PASSWORD_RE.test(password);
}

export function isValidUsername(username: string): boolean {
  return (
    typeof username === 'string' &&
    username.length >= 2 &&
    username.length <= 50
  );
}

export function isValidBranch(branch: string): boolean {
  return typeof branch === 'string' && branch.length <= 200 && BRANCH_RE.test(branch);
}

export function isValidGitUrl(url: string): boolean {
  return typeof url === 'string' && url.length <= 2048 && GIT_URL_RE.test(url);
}

export function isValidWorkspaceName(name: string): boolean {
  return typeof name === 'string' && name.length >= 1 && name.length <= 100;
}

/** Reject path components that attempt directory traversal */
export function isValidRelativePath(p: string): boolean {
  if (typeof p !== 'string' || p.length === 0 || p.length > 4096) return false;
  // Forbid absolute paths and traversal patterns
  if (p.startsWith('/') || p.includes('..')) return false;
  // Forbid null bytes
  if (p.includes('\0')) return false;
  return true;
}

/**
 * Validate a port number is in the non-privileged range.
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1024 && port <= 65535;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Maximum allowed message content length (100 KB) */
export const MAX_MESSAGE_LENGTH = 100_000;

/** Maximum allowed file-write content size (10 MB) */
export const MAX_FILE_CONTENT_LENGTH = 10 * 1024 * 1024;

/** Maximum total attachment size per message (20 MB in base64 characters) */
export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
