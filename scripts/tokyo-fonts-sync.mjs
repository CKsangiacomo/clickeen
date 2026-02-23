#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');
const tokyoFontsRoot = path.join(repoRoot, 'tokyo', 'fonts');
const tokyoWorkerRoot = path.join(repoRoot, 'tokyo-worker');

const args = new Set(process.argv.slice(2));
const publishRemote = args.has('--remote');
const publishLocal = args.has('--local');
const persistToArgIndex = process.argv.indexOf('--persist-to');
const persistToArgValue =
  persistToArgIndex >= 0 && persistToArgIndex + 1 < process.argv.length
    ? String(process.argv[persistToArgIndex + 1] || '').trim()
    : '';

if (publishRemote && publishLocal) {
  console.error('[tokyo-fonts-sync] Use only one of --remote or --local.');
  process.exit(1);
}

const modeFlag = publishRemote ? '--remote' : '--local';
const bucket = process.env.TOKYO_R2_BUCKET || 'tokyo-assets-dev';
const concurrency = Number.parseInt(process.env.TOKYO_FONTS_SYNC_CONCURRENCY || '12', 10);
const persistTo =
  persistToArgValue || process.env.TOKYO_FONTS_SYNC_PERSIST_TO || path.join(repoRoot, '.wrangler', 'state');

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

function buildBulkEntries(files) {
  return files
    .map((filePath) => {
      const rel = path.relative(path.join(repoRoot, 'tokyo'), filePath).replace(/\\/g, '/');
      return { key: rel, file: filePath };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

function runWranglerBulkUpload(bulkFilePath) {
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
    String(Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 12),
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
    console.error('[tokyo-fonts-sync] Failed to run wrangler.', result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  let files = [];
  try {
    files = await walkFiles(tokyoFontsRoot);
  } catch {
    console.log(`[tokyo-fonts-sync] No fonts directory found at ${tokyoFontsRoot}; nothing to sync.`);
    return;
  }

  if (!files.length) {
    console.log('[tokyo-fonts-sync] No files found under tokyo/fonts; nothing to sync.');
    return;
  }

  const bulkEntries = buildBulkEntries(files);
  const bulkFilePath = path.join(tokyoWorkerRoot, `.tokyo-fonts-bulk-${Date.now()}.json`);
  await fs.writeFile(bulkFilePath, `${JSON.stringify(bulkEntries, null, 2)}\n`, 'utf8');
  try {
    console.log(
      `[tokyo-fonts-sync] Uploading ${bulkEntries.length} files to ${bucket} (${publishRemote ? 'remote' : 'local'})${publishRemote ? '' : ` via persist ${persistTo}`}.`,
    );
    runWranglerBulkUpload(bulkFilePath);
  } finally {
    await fs.rm(bulkFilePath, { force: true });
  }
}

main().catch((err) => {
  console.error('[tokyo-fonts-sync] Failed.', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
