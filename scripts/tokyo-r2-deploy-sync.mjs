#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');
const tokyoWorkerRoot = path.join(repoRoot, 'tokyo-worker');

const args = new Set(process.argv.slice(2));
const publishRemote = args.has('--remote');
const publishLocal = args.has('--local');
const dryRun = args.has('--dry-run') || (!publishRemote && !publishLocal);
const jsonOutput = args.has('--json');

if (publishRemote && publishLocal) {
  console.error('[tokyo-r2-deploy-sync] Use only one of --remote or --local.');
  process.exit(1);
}

const bucket = process.env.TOKYO_R2_BUCKET || 'tokyo-assets-dev';
const concurrency = Number.parseInt(process.env.TOKYO_R2_DEPLOY_SYNC_CONCURRENCY || '20', 10);
const persistToArgIndex = process.argv.indexOf('--persist-to');
const persistToArgValue =
  persistToArgIndex >= 0 && persistToArgIndex + 1 < process.argv.length
    ? String(process.argv[persistToArgIndex + 1] || '').trim()
    : '';
const persistTo =
  persistToArgValue || process.env.TOKYO_R2_DEPLOY_SYNC_PERSIST_TO || path.join(repoRoot, '.wrangler', 'state');

const mappings = [
  { source: 'tokyo/product/widgets', target: 'product/widgets' },
  { source: 'tokyo/product/media', target: 'product/media', optional: true },
  { source: 'tokyo/product/themes', target: 'product/themes', optional: true },
  { source: 'tokyo/product/dieter', target: 'dieter' },
  { source: 'tokyo/product/fonts', target: 'fonts' },
  { source: 'tokyo/roma', target: 'product/roma', optional: true },
  { source: 'tokyo/prague', target: 'prague' },
];

const allowedRoots = new Set(['dieter', 'fonts', 'product', 'prague']);

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
  const [root] = key.split('/');
  if (!allowedRoots.has(root)) {
    throw new Error(`[tokyo-r2-deploy-sync] Refusing non-canonical deploy root for key "${key}"`);
  }
  if (key.startsWith('accounts/')) {
    throw new Error(`[tokyo-r2-deploy-sync] Refusing to write account runtime key "${key}"`);
  }
  if (/^(l10n|public|published|widgets)\//.test(key)) {
    throw new Error(`[tokyo-r2-deploy-sync] Refusing stale root key "${key}"`);
  }
}

async function buildBulkEntries() {
  const entries = [];
  const skipped = [];

  for (const mapping of mappings) {
    const sourceRoot = path.join(repoRoot, mapping.source);
    let files = [];
    try {
      files = await walkFiles(sourceRoot);
    } catch (error) {
      if (mapping.optional) {
        skipped.push(mapping.source);
        continue;
      }
      throw error;
    }

    for (const file of files) {
      const rel = path.relative(sourceRoot, file).replace(/\\/g, '/');
      const key = path.posix.join(mapping.target, rel);
      assertCanonicalKey(key);
      entries.push({ key, file });
    }
  }

  entries.sort((a, b) => a.key.localeCompare(b.key));
  return { entries, skipped };
}

function summarize(entries, skipped) {
  const roots = new Map();
  for (const entry of entries) {
    const [root] = entry.key.split('/');
    roots.set(root, (roots.get(root) || 0) + 1);
  }
  return {
    bucket,
    mode: dryRun ? 'dry-run' : publishRemote ? 'remote' : 'local',
    files: entries.length,
    roots: Object.fromEntries([...roots.entries()].sort(([a], [b]) => a.localeCompare(b))),
    skipped,
  };
}

function runWranglerBulkUpload(bulkFilePath) {
  const modeFlag = publishRemote ? '--remote' : '--local';
  const wranglerArgs = [
    '-C',
    'tokyo-worker',
    'exec',
    'wrangler',
    'r2',
    'bulk',
    'put',
    bucket,
    '--filename',
    bulkFilePath,
    modeFlag,
    '--concurrency',
    String(Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 20),
  ];
  if (!publishRemote && persistTo) {
    wranglerArgs.push('--persist-to', persistTo);
  }

  const result = spawnSync('pnpm', wranglerArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error('[tokyo-r2-deploy-sync] Failed to run wrangler.', result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  const { entries, skipped } = await buildBulkEntries();
  const summary = summarize(entries, skipped);

  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      `[tokyo-r2-deploy-sync] ${dryRun ? 'Would upload' : 'Uploading'} ${entries.length} files to ${bucket} (${summary.mode}).`,
    );
    console.log(`[tokyo-r2-deploy-sync] Roots: ${Object.entries(summary.roots).map(([root, count]) => `${root}/=${count}`).join(', ')}`);
    if (skipped.length) console.log(`[tokyo-r2-deploy-sync] Skipped optional roots: ${skipped.join(', ')}`);
  }

  if (dryRun) return;

  const bulkFilePath = path.join(tokyoWorkerRoot, `.tokyo-r2-deploy-bulk-${Date.now()}.json`);
  await fs.writeFile(bulkFilePath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  try {
    runWranglerBulkUpload(bulkFilePath);
  } finally {
    await fs.rm(bulkFilePath, { force: true });
  }
}

main().catch((err) => {
  console.error('[tokyo-r2-deploy-sync] Failed.', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
