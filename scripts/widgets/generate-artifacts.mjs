#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tempRoot = path.join(repoRoot, '.tmp');
fs.mkdirSync(tempRoot, { recursive: true });
const tempDir = fs.mkdtempSync(path.join(tempRoot, 'clickeen-widget-artifacts-'));
const tempFile = path.join(tempDir, 'generate-artifacts.mjs');

try {
  buildSync({
    entryPoints: [path.join(repoRoot, 'scripts/widgets/generate-artifacts.ts')],
    outfile: tempFile,
    bundle: true,
    external: ['typescript'],
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
  });
  const result = spawnSync(process.execPath, [tempFile, ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: repoRoot,
  });
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
