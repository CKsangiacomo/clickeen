import fs from 'node:fs/promises';
import path from 'node:path';

type StorageState = {
  cookies: unknown[];
  origins: unknown[];
};

const EMPTY_STATE: StorageState = { cookies: [], origins: [] };

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
  if (hasExistingState) return;

  await writeEmptyState(authStatePath);
  console.warn(`[e2e] No auth state found at ${authStatePath}; authenticated specs will be skipped.`);
}

export default globalSetup;
