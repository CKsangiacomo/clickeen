#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildSync } from 'esbuild';

const tempRoot = path.join(process.cwd(), '.tmp');
fs.mkdirSync(tempRoot, { recursive: true });
const tempDir = fs.mkdtempSync(path.join(tempRoot, 'clickeen-widget-compile-'));
const tempFile = path.join(tempDir, 'compile-all.mjs');

try {
  buildSync({
    entryPoints: ['scripts/widgets/compile-all.ts'],
    outfile: tempFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
  });

  const result = spawnSync(process.execPath, [tempFile], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
