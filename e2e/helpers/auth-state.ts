import fs from 'node:fs';

type StorageState = {
  cookies?: unknown[];
};

export function authStatePath(): string {
  return process.env.E2E_AUTH_STATE || 'e2e/.auth/roma-dev.json';
}

export function hasAuthCookies(): boolean {
  try {
    const raw = fs.readFileSync(authStatePath(), 'utf8');
    const parsed = JSON.parse(raw) as StorageState;
    return Array.isArray(parsed.cookies) && parsed.cookies.length > 0;
  } catch {
    return false;
  }
}
