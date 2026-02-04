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
const TOKYO_WORKER_ROOT = path.join(repoRoot, 'tokyo-worker');
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
const runPublish = args.has('--publish') && !args.has('--skip-publish');
const strictLatest = args.has('--strict-latest') || (runPublish && !args.has('--best-available'));
const publishRemote = args.has('--remote');
const publishLocal = args.has('--local');

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const PUBLISH_CONCURRENCY = parsePositiveInt(
  process.env.PRAGUE_SYNC_PUBLISH_CONCURRENCY,
  process.env.CI ? 8 : 4,
);
const PUBLISH_TIMEOUT_MS = parsePositiveInt(process.env.PRAGUE_SYNC_PUBLISH_TIMEOUT_MS, 120_000);
const PUBLISH_RETRIES = parsePositiveInt(process.env.PRAGUE_SYNC_PUBLISH_RETRIES, 2);
const PUBLISH_PROGRESS_EVERY = parsePositiveInt(process.env.PRAGUE_SYNC_PUBLISH_PROGRESS_EVERY, 25);

if (publishRemote && publishLocal) {
  console.error('[prague-sync] Use only one of --remote or --local.');
  process.exit(1);
}

if ((publishRemote || publishLocal) && !args.has('--publish')) {
  console.error('[prague-sync] --remote/--local require --publish.');
  process.exit(1);
}

if (args.has('--publish') && args.has('--skip-publish')) {
  console.warn('[prague-sync] Both --publish and --skip-publish set; publish will be skipped.');
}

if (runPublish && !publishRemote && !publishLocal) {
  console.error('[prague-sync] --publish requires exactly one of --remote or --local.');
  process.exit(1);
}

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

function getWranglerInvocation(argsList) {
  if (WRANGLER_BIN === 'pnpm') {
    return { cmd: 'pnpm', args: ['exec', 'wrangler', ...argsList], cwd: TOKYO_WORKER_ROOT };
  }
  if (WRANGLER_BIN === 'npx') {
    return { cmd: 'npx', args: ['wrangler', ...argsList], cwd: TOKYO_WORKER_ROOT };
  }
  return { cmd: WRANGLER_BIN, args: argsList, cwd: TOKYO_WORKER_ROOT };
}

function appendLimited(existing, chunk, limit) {
  if (!chunk) return existing;
  const next = existing + chunk;
  if (next.length <= limit) return next;
  return next.slice(next.length - limit);
}

function runWranglerAsync(argsList, options = {}) {
  const { timeoutMs = PUBLISH_TIMEOUT_MS } = options;
  const invocation = getWranglerInvocation(argsList);

  return new Promise((resolve) => {
    const child = spawn(invocation.cmd, invocation.args, {
      cwd: invocation.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const outputLimit = 20_000;
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout = appendLimited(stdout, chunk.toString('utf8'), outputLimit);
    });
    child.stderr?.on('data', (chunk) => {
      stderr = appendLimited(stderr, chunk.toString('utf8'), outputLimit);
    });

    let timedOut = false;
    const timeout =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            child.kill('SIGTERM');
            setTimeout(() => child.kill('SIGKILL'), 5_000).unref();
          }, timeoutMs).unref()
        : null;

    child.on('error', (err) => {
      if (timeout) clearTimeout(timeout);
      resolve({ ok: false, status: 1, error: err, timedOut, stdout, stderr });
    });

    child.on('close', (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({ ok: code === 0, status: code ?? 1, timedOut, stdout, stderr });
    });
  });
}

async function uploadToR2({ objectPath, filePath, modeFlag }) {
  const argsList = ['r2', 'object', 'put', objectPath, '--file', filePath, modeFlag];
  const maxAttempts = PUBLISH_RETRIES + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await runWranglerAsync(argsList, { timeoutMs: PUBLISH_TIMEOUT_MS });
    if (result.ok) return;

    const hint = result.timedOut ? ` (timed out after ${PUBLISH_TIMEOUT_MS}ms)` : '';
    console.warn(
      `[prague-sync] Upload failed (${attempt}/${maxAttempts}) for "${objectPath}"${hint}.`,
    );
    if (result.stdout) console.warn(result.stdout.trim());
    if (result.stderr) console.warn(result.stderr.trim());

    if (attempt < maxAttempts) {
      const backoffMs = 500 * attempt;
      await new Promise((r) => setTimeout(r, backoffMs));
    } else {
      throw new Error(`[prague-sync] Failed to upload "${objectPath}" after ${maxAttempts} attempts.`);
    }
  }
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

  const target = publishRemote ? 'remote' : 'local';
  console.log(`[prague-sync] Publishing Prague overlays to R2 (${target}). Bucket: "${R2_BUCKET}"`);
  console.log(
    `[prague-sync] Uploading ${files.length} files (concurrency=${PUBLISH_CONCURRENCY}, timeout=${PUBLISH_TIMEOUT_MS}ms, retries=${PUBLISH_RETRIES})...`,
  );

  files.sort();
  const modeFlag = publishRemote ? '--remote' : '--local';
  const tasks = files.map((filePath) => {
    const relFromTokyo = path.relative(TOKYO_ROOT, filePath).replace(/\\/g, '/');
    const key = relFromTokyo; // e.g. l10n/prague/...
    const objectPath = `${R2_BUCKET}/${key}`;
    return { objectPath, filePath, modeFlag };
  });

  const startedAt = Date.now();
  const total = tasks.length;
  const concurrency = Math.min(PUBLISH_CONCURRENCY, total);
  let nextIndex = 0;
  let done = 0;

  async function worker() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const index = nextIndex++;
      const task = tasks[index];
      if (!task) return;

      await uploadToR2(task);
      done++;
      if (done === total || (PUBLISH_PROGRESS_EVERY > 0 && done % PUBLISH_PROGRESS_EVERY === 0)) {
        const elapsedS = Math.round((Date.now() - startedAt) / 1000);
        console.log(`[prague-sync] Uploaded ${done}/${total} files (${elapsedS}s).`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
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
    const verifyArgs = strictLatest ? [VERIFY_SCRIPT, '--strict-latest'] : [VERIFY_SCRIPT];
    const bestAvailableVerifyArgs = [VERIFY_SCRIPT];
    const initialVerify = run(process.execPath, verifyArgs, { allowFail: true });
    if (!initialVerify.ok) {
      if (!runTranslate) {
        console.error('[prague-sync] Prague l10n overlays missing or invalid. Re-run without --skip-translate to generate them.');
        process.exit(1);
      }
      const translateRes = run(process.execPath, [TRANSLATE_SCRIPT], { allowFail: true });
      if (!translateRes.ok) {
        console.warn('[prague-sync] Translate failed; falling back to best-available overlays.');
        const bestAvailableVerify = run(process.execPath, bestAvailableVerifyArgs, { allowFail: true });
        if (!bestAvailableVerify.ok) {
          console.error('[prague-sync] Best-available verification failed; refusing to publish overlays.');
          process.exit(1);
        }
      } else {
        run(process.execPath, verifyArgs);
      }
    }
  } else if (runTranslate) {
    run(process.execPath, [TRANSLATE_SCRIPT]);
  }

  if (runPublish) {
    await publishOverlays();
  } else {
    console.log('[prague-sync] Skipping publish (pass --publish --remote|--local to publish overlays).');
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
