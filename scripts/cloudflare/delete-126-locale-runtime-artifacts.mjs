#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '../..');
const manifestPath = path.join(
  repoRoot,
  'Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/evidence/126-localization-cleanup-manifest.txt',
);
const expectedCount = 400;
const bucket = process.env.TOKYO_R2_BUCKET || 'tokyo-assets-dev';
const concurrency = 8;
const dryRun = process.argv.includes('--dry-run');
const keyPattern =
  /^accounts\/CLICKEEN\/instances\/[A-Z0-9]+\/locales\/[a-z0-9-]+\/(index\.html|styles\.css|runtime\.js)$/;

async function loadManifest() {
  const keys = (await fs.readFile(manifestPath, 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (keys.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} manifest keys; found ${keys.length}`);
  }
  if (new Set(keys).size !== keys.length) {
    throw new Error('Cleanup manifest contains duplicate keys');
  }
  for (const key of keys) {
    if (!keyPattern.test(key)) {
      throw new Error(`Cleanup manifest contains an unsafe key: ${key}`);
    }
  }
  return keys;
}

function deleteKey(key) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'pnpm',
      [
        '--filter',
        '@clickeen/tokyo-worker',
        'exec',
        'wrangler',
        'r2',
        'object',
        'delete',
        `${bucket}/${key}`,
        '--remote',
      ],
      {
        cwd: repoRoot,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`[126-cleanup] deleted ${key}`);
        resolve();
        return;
      }
      reject(new Error(`[126-cleanup] delete failed for ${key}: ${stderr.trim()}`));
    });
  });
}

async function main() {
  const keys = await loadManifest();
  console.log(
    JSON.stringify({
      operation: '126-locale-runtime-artifact-cleanup',
      bucket,
      exactKeyCount: keys.length,
      concurrency,
      dryRun,
    }),
  );
  if (dryRun) return;
  let cursor = 0;
  async function worker() {
    while (cursor < keys.length) {
      const index = cursor;
      cursor += 1;
      await deleteKey(keys[index]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`[126-cleanup] complete exactKeyCount=${keys.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
