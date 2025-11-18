const path = require('node:path');
const child_process = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
child_process.execFileSync('node', [path.resolve(repoRoot, 'scripts/generate-icons-showcase.js')], {
  stdio: 'inherit',
});
