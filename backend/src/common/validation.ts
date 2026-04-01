const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
const BRANCH_RE = /^[a-zA-Z0-9._\-/]+$/;
const GIT_URL_RE = /^(https?:\/\/|git@|ssh:\/\/)/;

export function isValidEmail(email: string): boolean {
  return typeof email === 'string' && email.length <= 255 && EMAIL_RE.test(email);
}

export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && PASSWORD_RE.test(password);
}

export function isValidUsername(username: string): boolean {
  return typeof username === 'string' && username.length >= 2 && username.length <= 50;
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

export function isValidRelativePath(p: string): boolean {
  if (typeof p !== 'string' || p.length === 0 || p.length > 4096) return false;
  if (p.startsWith('/') || p.includes('..')) return false;
  if (p.includes('\0')) return false;
  return true;
}

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1024 && port <= 65535;
}
