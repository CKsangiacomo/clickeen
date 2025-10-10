/* tools/ci/verify-vercel-config.cjs */
const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'vercel.json');
if (!fs.existsSync(p)) {
  console.error('[verify-vercel-config] vercel.json missing at repo root');
  process.exit(1);
}
let cfg;
try {
  cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
} catch (e) {
  console.error('[verify-vercel-config] vercel.json is not valid JSON');
  process.exit(1);
}
if ('buildCommand' in cfg && String(cfg.buildCommand || '').trim() !== '') {
  console.error('[verify-vercel-config] REMOVE repo-level "buildCommand" from vercel.json — it overrides per-project builds on Vercel.');
  process.exit(1);
}
const ic = String(cfg.installCommand || '');
if (!ic.includes('--frozen-lockfile')) {
  console.error('[verify-vercel-config] installCommand must enforce "--frozen-lockfile".');
  process.exit(1);
}
console.log('[verify-vercel-config] OK');


