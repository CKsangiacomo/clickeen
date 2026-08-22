#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceFile = path.join(repoRoot, 'scripts/widgets/generate-artifacts.ts');
const sourceArgs = process.argv.slice(2);
const result = spawnSync(process.execPath, ['--import', 'tsx', sourceFile, ...sourceArgs], {
  stdio: 'inherit',
  cwd: repoRoot,
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
