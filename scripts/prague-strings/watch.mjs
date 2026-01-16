#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensurePosixPath, fileExists, listJsonFiles, sha256Hex } from './lib.mjs';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const PRAGUE_STRINGS_ROOT = path.join(REPO_ROOT, 'prague-strings');
const BASE_ROOT = path.join(PRAGUE_STRINGS_ROOT, 'base', 'v1');
const ALLOWLIST_ROOT = path.join(PRAGUE_STRINGS_ROOT, 'allowlists', 'v1');
const OVERLAY_ROOT = path.join(PRAGUE_STRINGS_ROOT, 'overlays', 'v1');

const INTERVAL_MS = Number(process.env.PRAGUE_STRINGS_WATCH_INTERVAL_MS || 2000);
const RETRY_MS = Number(process.env.PRAGUE_STRINGS_WATCH_RETRY_MS || 30000);
const NO_TRANSLATE = new Set(process.argv.slice(2)).has('--no-translate');

async function treeState(root) {
  if (!(await fileExists(root))) return '';
  const files = await listJsonFiles(root);
  const entries = [];
  for (const file of files) {
    const stat = await fs.stat(file);
    entries.push(`${ensurePosixPath(path.relative(REPO_ROOT, file))}:${stat.mtimeMs}:${stat.size}`);
  }
  return sha256Hex(entries.join('\n'));
}

function runNodeScript(label, scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], { cwd: REPO_ROOT, stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${label} failed (exit ${code})`));
    });
  });
}

let running = false;
let pendingReason = null;
let retryAt = null;
let retryReason = null;

async function runPipeline(reason) {
  if (running) {
    pendingReason = reason;
    return;
  }
  running = true;
  try {
    if (!NO_TRANSLATE && (reason === 'base' || reason === 'allowlist')) {
      await runNodeScript('translate', path.join('scripts', 'prague-strings', 'translate.mjs'));
    }
    await runNodeScript('compile', path.join('scripts', 'prague-strings', 'compile.mjs'));
    retryAt = null;
    retryReason = null;
  } catch (err) {
    console.error(`[prague-strings] watch error: ${err?.message || err}`);
    retryAt = Date.now() + RETRY_MS;
    retryReason = reason;
  } finally {
    running = false;
    if (pendingReason) {
      const nextReason = pendingReason;
      pendingReason = null;
      await runPipeline(nextReason);
    }
  }
}

async function main() {
  let lastBase = await treeState(BASE_ROOT);
  let lastAllowlist = await treeState(ALLOWLIST_ROOT);
  let lastOverlay = await treeState(OVERLAY_ROOT);

  console.log('[prague-strings] watch started');
  await runPipeline('base');

  setInterval(async () => {
    try {
      const nextBase = await treeState(BASE_ROOT);
      const nextAllowlist = await treeState(ALLOWLIST_ROOT);
      const nextOverlay = await treeState(OVERLAY_ROOT);

      const baseChanged = nextBase !== lastBase;
      const allowlistChanged = nextAllowlist !== lastAllowlist;
      const overlayChanged = nextOverlay !== lastOverlay;

      if (baseChanged || allowlistChanged) {
        lastBase = nextBase;
        lastAllowlist = nextAllowlist;
        lastOverlay = nextOverlay;
        await runPipeline(baseChanged ? 'base' : 'allowlist');
        return;
      }
      if (overlayChanged) {
        lastOverlay = nextOverlay;
        await runPipeline('overlay');
        return;
      }

      if (retryAt && Date.now() >= retryAt) {
        retryAt = null;
        await runPipeline(retryReason || 'base');
      }
    } catch (err) {
      console.error(`[prague-strings] watch error: ${err?.message || err}`);
    }
  }, INTERVAL_MS);
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exit(1);
});
