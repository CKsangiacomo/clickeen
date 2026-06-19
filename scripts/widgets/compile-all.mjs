#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const result = spawnSync('pnpm', ['exec', 'tsx', 'scripts/widgets/compile-all.ts'], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
