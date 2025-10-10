/* tools/ci/verify-pnpm-config.cjs */
const fs = require('fs');
const path = require('path');

const roots = ['apps/site','services/embed','dieter'];
const bad = [];
for (const p of roots) {
  for (const f of ['.npmrc','pnpm-lock.yaml']) {
    const fp = path.join(p, f);
    if (fs.existsSync(fp)) bad.push(fp);
  }
}
if (bad.length) {
  console.error('[verify-pnpm-config] Remove nested files:', bad.join(', '));
  process.exit(1);
}

// Enforce packageManager pin at repo root
const pkgPath = path.resolve(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const pm = pkg.packageManager || '';
const required = 'pnpm@10.15.1';
if (!/^pnpm@/.test(pm)) {
  console.error('[verify-pnpm] packageManager must pin pnpm version in package.json');
  process.exit(1);
}
if (pm !== required) {
  console.error(`[verify-pnpm] Expected ${required}, found ${pm}`);
  process.exit(1);
}

console.log('[verify-pnpm-config] OK: no nested .npmrc/lockfiles and packageManager pinned to', pm);


