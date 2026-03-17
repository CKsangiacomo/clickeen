#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '../..');

function printUsage() {
  console.log(`Usage: node scripts/dev/seed-local-platform-state.mjs [options]

Runs the explicit local platform-state seed steps:
1. seed canonical platform asset manifests + blobs into local Tokyo R2
2. materialize DevStudio-visible Tokyo saved snapshots locally

Pass-through options:
  --persist-to <dir>
  --local-base <url>
  --remote-base <url>
  --bucket <name>
  --platform-account <id>
  --max <n>
  --help
`);
}

function runNode(script, extraArgs = [], extraEnv = {}) {
  const result = spawnSync('node', [script, ...extraArgs], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
  if (result.status === 0) return;
  process.exit(result.status ?? 1);
}

function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  const args = process.argv.slice(2);
  runNode(path.join(repoRoot, 'scripts/dev/seed-local-platform-assets.mjs'), args);
  runNode(path.join(repoRoot, 'scripts/dev/ensure-curated-tokyo-saved.mjs'), [], {
    TOKYO_WORKER_BASE_URL: process.env.TOKYO_WORKER_BASE_URL || 'http://localhost:8791',
  });
}

main();
