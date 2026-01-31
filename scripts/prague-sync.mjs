#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';

const __filename = fileURLToPath(new URL('.', import.meta.url));
const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(__filename, '..');

const TOKYO_ROOT = path.join(repoRoot, 'tokyo');
const PRAGUE_L10N_ROOT = path.join(TOKYO_ROOT, 'l10n', 'prague');
const VERIFY_SCRIPT = path.join(repoRoot, 'scripts', 'prague-l10n', 'verify.mjs');
const TRANSLATE_SCRIPT = path.join(repoRoot, 'scripts', 'prague-l10n', 'translate.mjs');

const LOG_DIR = path.join(repoRoot, 'Logs');
const LOG_FILE = path.join(LOG_DIR, 'prague-sync.log');
const defaultWranglerPath = path.join(repoRoot, 'tokyo-worker', 'node_modules', '.bin', 'wrangler');
const WRANGLER_BIN =
  process.env.WRANGLER_BIN || (fsSync.existsSync(defaultWranglerPath) ? defaultWranglerPath : 'pnpm');
const R2_BUCKET = process.env.TOKYO_R2_BUCKET || 'tokyo-assets-dev';

const args = new Set(process.argv.slice(2));
const runBackground = args.has('--background');
const isBackgroundChild = args.has('--background-child');
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
  const { allowFail = false, ...spawnOptions } = options;
  const result = spawnSync(cmd, argsList, { stdio: 'inherit', ...spawnOptions });
  if (result.error?.code === 'ENOENT' || result.status === 127) {
    return { ok: false, notFound: true, status: result.status ?? 1 };
  }
  const ok = result.status === 0;
  if (!ok && !allowFail) process.exit(result.status ?? 1);
  return { ok, status: result.status ?? 1 };
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
    const objectPath = `${R2_BUCKET}/${key}`;
    runWrangler(['r2', 'object', 'put', objectPath, '--file', filePath]);
  }
}

async function main() {
  if (runBackground && !isBackgroundChild) {
    fsSync.mkdirSync(LOG_DIR, { recursive: true });
    fsSync.appendFileSync(
      LOG_FILE,
      `\n--- Prague sync started ${new Date().toISOString()} ---\n`,
      'utf8',
    );
    const childArgs = process.argv.slice(2).filter((arg) => arg !== '--background');
    childArgs.push('--background-child');
    const logFd = fsSync.openSync(LOG_FILE, 'a');
    const child = spawn(process.execPath, [scriptPath, ...childArgs], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
    });
    if (child.pid) child.unref();
    console.log(`[prague-sync] Running in background. Log: ${LOG_FILE}`);
    process.exit(0);
  }

  // Verify first and only translate when required.
  // Translation uses SanFrancisco and may be slow/costly, so we keep it demand-driven.
  if (runVerify) {
    const initialVerify = run(process.execPath, [VERIFY_SCRIPT], { allowFail: true });
    if (!initialVerify.ok) {
      if (!runTranslate) {
        console.error('[prague-sync] Prague l10n overlays missing or invalid. Re-run without --skip-translate to generate them.');
        process.exit(1);
      }
      run(process.execPath, [TRANSLATE_SCRIPT]);
      run(process.execPath, [VERIFY_SCRIPT]);
    }
  } else if (runTranslate) {
    run(process.execPath, [TRANSLATE_SCRIPT]);
  }

  if (runPublish) {
    await publishOverlays();
  }
  console.log('[prague-sync] Done.');
  if (isBackgroundChild) {
    fsSync.appendFileSync(
      LOG_FILE,
      `--- Prague sync finished ${new Date().toISOString()} ---\n`,
      'utf8',
    );
  }
}

main().catch((err) => {
  console.error('[prague-sync] Failed:', err);
  process.exit(1);
});
