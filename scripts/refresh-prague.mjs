#!/usr/bin/env node
/* eslint-disable no-console */
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const pragueSyncScript = path.join(repoRoot, 'scripts', 'prague-sync.mjs');
const logFile = path.join(repoRoot, 'Logs', 'prague-sync.log');

const argv = process.argv.slice(2);
const args = new Set(argv);

if (args.has('--help') || args.has('-h')) {
  console.log('Usage: node scripts/refresh-prague.mjs [options]');
  console.log('');
  console.log('Default behavior:');
  console.log('- Runs Prague refresh in background (async).');
  console.log('- Enforces strict-latest overlay verification.');
  console.log('- Regenerates only missing/stale translations.');
  console.log('');
  console.log('Options:');
  console.log('  --wait             Run in foreground (blocking).');
  console.log('  --publish-local    Publish refreshed overlays to local R2 (wrangler --local).');
  console.log('  --publish-remote   Publish refreshed overlays to remote R2 (wrangler --remote).');
  console.log('  --best-available   Use best-available mode instead of strict-latest.');
  console.log('  --skip-translate   Verify/publish only, do not translate.');
  console.log('  --skip-verify      Translate/publish without verify step.');
  process.exit(0);
}

const runInForeground = args.has('--wait');
const publishLocal = args.has('--publish-local');
const publishRemote = args.has('--publish-remote');
const useBestAvailable = args.has('--best-available');
const skipTranslate = args.has('--skip-translate');
const skipVerify = args.has('--skip-verify');

if (publishLocal && publishRemote) {
  console.error('[refresh-prague] Use only one publish target: --publish-local or --publish-remote.');
  process.exit(1);
}

const syncArgs = [];
if (!runInForeground) syncArgs.push('--background');
if (!useBestAvailable) syncArgs.push('--strict-latest');
if (publishLocal || publishRemote) {
  syncArgs.push('--publish');
  syncArgs.push(publishRemote ? '--remote' : '--local');
}
if (skipTranslate) syncArgs.push('--skip-translate');
if (skipVerify) syncArgs.push('--skip-verify');

console.log(
  `[refresh-prague] Starting Prague refresh (${runInForeground ? 'foreground' : 'background'})...`,
);
const result = spawnSync(process.execPath, [pragueSyncScript, ...syncArgs], {
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!runInForeground) {
  if (fs.existsSync(logFile)) {
    console.log(`[refresh-prague] Async refresh started. Log: ${logFile}`);
    console.log(`[refresh-prague] Follow progress: tail -f ${logFile}`);
  } else {
    console.log('[refresh-prague] Async refresh started.');
  }
} else {
  console.log('[refresh-prague] Prague refresh completed.');
}
