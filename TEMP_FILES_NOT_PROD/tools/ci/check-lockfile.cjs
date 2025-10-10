/* tools/ci/check-lockfile.cjs */
// Node cjs script to enforce lockfile presence/readability in CI/headless contexts.
// Exits non-zero if pnpm-lock.yaml is missing or unreadable.
const fs = require('fs');
const path = require('path');

const lockPath = path.resolve(process.cwd(), 'pnpm-lock.yaml');
try {
  const stat = fs.statSync(lockPath);
  if (!stat.isFile()) {
    console.error('[lockfile-check] pnpm-lock.yaml exists but is not a regular file:', lockPath);
    process.exit(2);
  }
  const fd = fs.openSync(lockPath, 'r');
  const buf = Buffer.alloc(64);
  fs.readSync(fd, buf, 0, 64, 0);
  fs.closeSync(fd);
  console.log('[lockfile-check] pnpm-lock.yaml present and readable:', lockPath);
} catch (e) {
  console.error('[lockfile-check] pnpm-lock.yaml missing or not readable at repo root:', lockPath);
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
}


