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
const purgeOnly = process.argv.includes('--purge-only');
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
      purgeOnly,
    }),
  );
  if (dryRun) return;
  if (!purgeOnly) {
    let cursor = 0;
    async function worker() {
      while (cursor < keys.length) {
        const index = cursor;
        cursor += 1;
        await deleteKey(keys[index]);
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    console.log(`[126-cleanup] deletion complete exactKeyCount=${keys.length}`);
  }

  const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const zoneId = String(process.env.CLOUDFLARE_ZONE_ID || '').trim();
  if (!token || !zoneId) {
    throw new Error('Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID for retired URL purge');
  }
  const coordinates = new Set();
  for (const key of keys) {
    const match = key.match(
      /^accounts\/CLICKEEN\/instances\/([A-Z0-9]+)\/locales\/([a-z0-9-]+)\//,
    );
    if (!match) throw new Error(`Could not derive retired coordinate from ${key}`);
    coordinates.add(`${match[1]}/${match[2]}`);
  }
  if (coordinates.size !== 134) {
    throw new Error(`Expected 134 retired coordinates; found ${coordinates.size}`);
  }
  const urls = [];
  for (const coordinate of [...coordinates].sort()) {
    const base = `https://dev.clk.live/CLICKEEN/${coordinate.replace('/', '/locales/')}`;
    urls.push(base, `${base}/`, `${base}/index.html`, `${base}/styles.css`, `${base}/runtime.js`);
  }
  for (let index = 0; index < urls.length; index += 100) {
    const files = urls.slice(index, index + 100);
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ files }),
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) {
      throw new Error(
        `[126-cleanup] cache purge failed HTTP ${response.status}: ${JSON.stringify(payload)}`,
      );
    }
  }
  console.log(
    `[126-cleanup] cache purge complete coordinates=${coordinates.size} urls=${urls.length} requests=${Math.ceil(urls.length / 100)}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
