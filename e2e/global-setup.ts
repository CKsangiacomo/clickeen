import fs from 'node:fs/promises';
import path from 'node:path';
import { request } from '@playwright/test';

type StorageState = {
  cookies: unknown[];
  origins: unknown[];
};

const EMPTY_STATE: StorageState = { cookies: [], origins: [] };

function resolveBaseURL(): string {
  return (process.env.E2E_ROMA_URL || process.env.E2E_BASE_URL || 'https://roma.dev.clickeen.com').replace(/\/+$/, '');
}

function resolveAuthStatePath(): string {
  return process.env.E2E_AUTH_STATE || 'e2e/.auth/roma-dev.json';
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeEmptyState(authStatePath: string): Promise<void> {
  await fs.mkdir(path.dirname(authStatePath), { recursive: true });
  await fs.writeFile(authStatePath, `${JSON.stringify(EMPTY_STATE, null, 2)}\n`);
}

async function globalSetup(): Promise<void> {
  const authStatePath = resolveAuthStatePath();
  const hasExistingState = await fileExists(authStatePath);
  if (hasExistingState && process.env.E2E_REFRESH_AUTH !== '1') return;

  const email = process.env.E2E_USER_EMAIL?.trim();
  const secret = process.env.E2E_AUTH_SECRET?.trim();
  if (!email || !secret) {
    if (!hasExistingState) await writeEmptyState(authStatePath);
    console.warn('[e2e] E2E_USER_EMAIL/E2E_AUTH_SECRET are missing; authenticated specs will be skipped.');
    return;
  }

  const baseURL = resolveBaseURL();
  const api = await request.newContext({ baseURL });
  const response = await api.post('/api/e2e/session', {
    headers: {
      'x-ck-e2e-auth': secret,
    },
    data: {
      email,
    },
  });

  if (!response.ok()) {
    const body = await response.text().catch(() => '');
    await api.dispose();
    throw new Error(`[e2e] Failed to bootstrap auth at ${baseURL}/api/e2e/session: ${response.status()} ${body}`);
  }

  await fs.mkdir(path.dirname(authStatePath), { recursive: true });
  await api.storageState({ path: authStatePath });
  await api.dispose();
}

export default globalSetup;
