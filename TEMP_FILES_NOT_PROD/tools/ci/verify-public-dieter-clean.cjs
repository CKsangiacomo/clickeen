#!/usr/bin/env node
/* Fail CI if any files under apps/app/public/dieter (except README.md) are tracked by git */
const { spawnSync } = require('node:child_process');

// List tracked files under the directory (not the directory itself)
const res = spawnSync('git', ['ls-files', '--', 'apps/app/public/dieter/**'], { encoding: 'utf8' });
if (res.status !== 0) {
  console.error('[verify-public-dieter-clean] git ls-files failed');
  process.exit(res.status || 1);
}
const tracked = res.stdout
  .split('\n')
  .map(s => s.trim())
  .filter(Boolean)
  .filter(p => p !== 'apps/app/public/dieter/README.md');
if (tracked.length) {
  console.error('[verify-public-dieter-clean] The following files are tracked but must not be committed:');
  console.error(tracked.join('\n'));
  process.exit(1);
}
console.log('[verify-public-dieter-clean] OK: no tracked files under apps/app/public/dieter');


