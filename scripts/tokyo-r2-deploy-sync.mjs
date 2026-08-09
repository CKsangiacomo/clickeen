#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');

const args = new Set(process.argv.slice(2));
const publishRemote = args.has('--remote');
const dryRun = args.has('--dry-run') || !publishRemote;
const jsonOutput = args.has('--json');

const bucket = process.env.TOKYO_R2_BUCKET || 'tokyo-assets-dev';
const concurrency = Number.parseInt(process.env.TOKYO_R2_DEPLOY_SYNC_CONCURRENCY || '3', 10);
const maxUploadAttempts = Number.parseInt(process.env.TOKYO_R2_DEPLOY_SYNC_ATTEMPTS || '4', 10);

const mappings = [
  { source: 'tokyo/product/widgets', target: 'product/widgets' },
  { source: 'dieter/icons/svg', target: 'dieter/icons/svg' },
  { source: 'tokyo/product/fonts', target: 'fonts' },
  { source: 'tokyo/prague', target: 'prague' },
];

const allowedRoots = new Set(['dieter', 'fonts', 'product', 'prague']);
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function deployContentType(file) {
  const ext = path.extname(file).toLowerCase();
  const contentType = contentTypes.get(ext);
  if (!contentType) {
    throw new Error(`[tokyo-r2-deploy-sync] Missing content type for "${file}" (${ext || 'no extension'})`);
  }
  return contentType;
}

async function walkFiles(root) {
  const out = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(fullPath)));
      continue;
    }
    if (entry.isFile()) out.push(fullPath);
  }
  return out;
}

function assertCanonicalKey(key) {
  if (key.startsWith('accounts/')) {
    throw new Error(`[tokyo-r2-deploy-sync] Refusing to write account runtime key "${key}"`);
  }
  const [root] = key.split('/');
  if (!allowedRoots.has(root)) {
    throw new Error(`[tokyo-r2-deploy-sync] Refusing deploy key outside current roots for key "${key}"`);
  }
}

async function buildBulkEntries() {
  const entries = [];

  for (const mapping of mappings) {
    const sourceRoot = path.join(repoRoot, mapping.source);
    const files = await walkFiles(sourceRoot);

    for (const file of files) {
      const rel = path.relative(sourceRoot, file).replace(/\\/g, '/');
      const key = path.posix.join(mapping.target, rel);
      assertCanonicalKey(key);
      entries.push({ key, file, contentType: deployContentType(file) });
    }
  }

  entries.sort((a, b) => a.key.localeCompare(b.key));
  return entries;
}

function summarize(entries) {
  const roots = new Map();
  for (const entry of entries) {
    const [root] = entry.key.split('/');
    roots.set(root, (roots.get(root) || 0) + 1);
  }
  const contentTypes = new Map();
  for (const entry of entries) {
    contentTypes.set(entry.contentType, (contentTypes.get(entry.contentType) || 0) + 1);
  }
  return {
    bucket,
    mode: dryRun ? 'dry-run' : 'remote',
    files: entries.length,
    roots: Object.fromEntries([...roots.entries()].sort(([a], [b]) => a.localeCompare(b))),
    contentTypes: Object.fromEntries([...contentTypes.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadWithRetry(entry, upload) {
  const attempts = Number.isFinite(maxUploadAttempts) && maxUploadAttempts > 0 ? maxUploadAttempts : 4;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await upload(entry);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delayMs = 500 * attempt;
      console.log(`[tokyo-r2-deploy-sync] Retry ${attempt}/${attempts - 1} for ${entry.key} after ${delayMs}ms`);
      await sleep(delayMs);
    }
  }
  throw lastError;
}

function runWranglerPut(entry) {
  return new Promise((resolve, reject) => {
    const wranglerArgs = [
      '-C',
      'tokyo-worker',
      'exec',
      'wrangler',
      'r2',
      'object',
      'put',
      `${bucket}/${entry.key}`,
      '--file',
      entry.file,
      '--remote',
      '--content-type',
      entry.contentType,
    ];

    const child = spawn('pnpm', wranglerArgs, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Wrangler put failed for ${entry.key} (exit ${code}): ${stderr || stdout}`));
    });
  });
}

async function uploadEntries(entries) {
  const width = Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 20;
  console.log(`[tokyo-r2-deploy-sync] Writer: wrangler-object-put content-type=explicit concurrency=${width}`);
  let index = 0;
  let uploaded = 0;

  async function worker() {
    while (index < entries.length) {
      const current = entries[index];
      index += 1;
      await uploadWithRetry(current, runWranglerPut);
      uploaded += 1;
      if (uploaded === entries.length || uploaded % 50 === 0) {
        console.log(`[tokyo-r2-deploy-sync] Uploaded ${uploaded}/${entries.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(width, entries.length) }, () => worker()));
}

async function main() {
  const entries = await buildBulkEntries();
  const summary = summarize(entries);

  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      `[tokyo-r2-deploy-sync] ${dryRun ? 'Would upload' : 'Uploading'} ${entries.length} files to ${bucket} (${summary.mode}).`,
    );
    console.log(`[tokyo-r2-deploy-sync] Roots: ${Object.entries(summary.roots).map(([root, count]) => `${root}/=${count}`).join(', ')}`);
    console.log(`[tokyo-r2-deploy-sync] Content types: ${Object.entries(summary.contentTypes).map(([type, count]) => `${type}=${count}`).join(', ')}`);
  }

  if (dryRun) return;
  await uploadEntries(entries);
}

main().catch((err) => {
  console.error('[tokyo-r2-deploy-sync] Failed.', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
