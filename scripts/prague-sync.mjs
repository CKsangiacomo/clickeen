#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = path.resolve(__filename, '..');

const TOKYO_ROOT = path.join(repoRoot, 'tokyo');
const PRAGUE_L10N_ROOT = path.join(TOKYO_ROOT, 'l10n', 'prague');
const VERIFY_SCRIPT = path.join(repoRoot, 'scripts', 'prague-l10n', 'verify.mjs');
const TRANSLATE_SCRIPT = path.join(repoRoot, 'scripts', 'prague-l10n', 'translate.mjs');

const WRANGLER_BIN = process.env.WRANGLER_BIN || 'pnpm';
const R2_BUCKET = process.env.TOKYO_R2_BUCKET || 'tokyo-assets-dev';

const args = new Set(process.argv.slice(2));
const runTranslate = !args.has('--skip-translate');
const runVerify = !args.has('--skip-verify');
const runPublish = !args.has('--skip-publish');

async function listFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFiles(fullPath)));
    } else if (entry.isFile()) {
      out.push(fullPath);
    }
  }
  return out;
}

function run(cmd, argsList, options = {}) {
  const result = spawnSync(cmd, argsList, { stdio: 'inherit', ...options });
  if (result.error?.code === 'ENOENT' || result.status === 127) {
    return { ok: false, notFound: true };
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
  return { ok: true };
}

function runWrangler(argsList) {
  if (WRANGLER_BIN === 'pnpm') {
    const viaPnpm = run('pnpm', ['exec', 'wrangler', ...argsList]);
    if (viaPnpm.ok) return;
    console.error('[prague-sync] wrangler not available via pnpm exec. Install it in a workspace (paris/sanfrancisco/tokyo-worker) or add to root devDependencies.');
    process.exit(1);
  }

  if (WRANGLER_BIN === 'npx') {
    const viaNpx = run('npx', ['wrangler', ...argsList]);
    if (viaNpx.ok) return;
    console.error('[prague-sync] Missing wrangler. Install with: pnpm add -D wrangler');
    process.exit(1);
  }

  const direct = run(WRANGLER_BIN, argsList);
  if (direct.ok) return;
  if (direct.notFound && WRANGLER_BIN === 'wrangler') {
    const viaNpx = run('npx', ['wrangler', ...argsList]);
    if (viaNpx.ok) return;
  }
  console.error('[prague-sync] Missing wrangler. Install with: pnpm add -D wrangler');
  process.exit(1);
}

async function publishOverlays() {
  let files = [];
  try {
    files = await listFiles(PRAGUE_L10N_ROOT);
  } catch (err) {
    console.error(`[prague-sync] Missing ${PRAGUE_L10N_ROOT}`);
    process.exit(1);
  }

  if (!files.length) {
    console.error('[prague-sync] No Prague overlay files found to publish.');
    process.exit(1);
  }

  console.log(`[prague-sync] Uploading ${files.length} files to R2 bucket "${R2_BUCKET}"...`);
  for (const filePath of files) {
    const relFromTokyo = path.relative(TOKYO_ROOT, filePath).replace(/\\/g, '/');
    const key = relFromTokyo; // e.g. l10n/prague/...
    runWrangler(['r2', 'object', 'put', key, '--file', filePath, '--bucket', R2_BUCKET]);
  }
}

async function main() {
  if (runTranslate) {
    run(process.execPath, [TRANSLATE_SCRIPT]);
  }
  if (runVerify) {
    run(process.execPath, [VERIFY_SCRIPT]);
  }
  if (runPublish) {
    await publishOverlays();
  }
  console.log('[prague-sync] Done.');
}

main().catch((err) => {
  console.error('[prague-sync] Failed:', err);
  process.exit(1);
});
