const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function findRoot(startDir = __dirname) {
  let dir = startDir;
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('Not inside monorepo root (pnpm-workspace.yaml not found)');
    dir = parent;
  }
  return dir;
}

function removeTarget(target) {
  if (!fs.existsSync(target)) return;
  try { fs.unlinkSync(target); } catch {
    try { fs.rmSync(target, { recursive: true, force: true }); }
    catch (e) { console.error('Failed to remove existing link/folder:', target, e.message); process.exit(1); }
  }
}

(function main() {
  try {
    const root = findRoot();
    const source = path.join(root, 'dieter', 'dist');
    const target = path.join(root, 'apps', 'app', 'public', 'dieter');

    if (!fs.existsSync(source)) {
      console.warn('[link-dieter] dist folder not found, attempting to create placeholder...');
      try { fs.mkdirSync(source, { recursive: true }); } catch {}
      try { fs.writeFileSync(path.join(source, 'tokens.css'), '/* placeholder */'); } catch {}
    }

    removeTarget(target);

    try {
      fs.symlinkSync(source, target, 'dir');
      console.log('[link-dieter] Created symlink:', target, '→', source);
      process.exit(0);
    } catch (e) {
      console.warn('[link-dieter] Symlink failed, attempting Windows junction fallback...', e.message);
      try {
        cp.execSync(`mklink /J "${target}" "${source}"`, { stdio: 'inherit', shell: 'cmd.exe' });
        console.log('[link-dieter] Created junction (Windows fallback):', target, '→', source);
        process.exit(0);
      } catch (err) {
        console.error('[link-dieter] Failed to create junction:', err.message);
        process.exit(1);
      }
    }
  } catch (fatal) {
    console.error('[link-dieter] Fatal error:', fatal.message);
    process.exit(1);
  }
})();


