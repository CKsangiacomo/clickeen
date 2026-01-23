import fs from 'node:fs/promises';
import path from 'node:path';
import { globSync } from 'glob';

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const DEFAULT_BEFORE = path.join(REPO_ROOT, 'tokyo', 'widgets');
const DEFAULT_AFTER = path.join(REPO_ROOT, 'temp', 'prague-blocks-migration');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const match = args.find((arg) => arg.startsWith(`${name}=`));
  if (!match) return fallback;
  return match.split('=').slice(1).join('=');
};

const beforeRoot = getArg('--before', DEFAULT_BEFORE);
const afterRoot = getArg('--after', DEFAULT_AFTER);

const beforeFiles = globSync(path.join(beforeRoot, '**/pages/*.json'), { nodir: true });
if (!beforeFiles.length) {
  console.error(`[prague-blocks] No page JSON files found under ${beforeRoot}`);
  process.exit(1);
}

const differences = [];

for (const beforePath of beforeFiles) {
  const rel = path.relative(beforeRoot, beforePath);
  const afterPath = path.join(afterRoot, rel);
  let afterRaw = null;
  try {
    afterRaw = await fs.readFile(afterPath, 'utf8');
  } catch {
    continue;
  }
  const beforeRaw = await fs.readFile(beforePath, 'utf8');
  if (beforeRaw !== afterRaw) {
    differences.push(rel);
  }
}

if (!differences.length) {
  console.log('[prague-blocks] No differences detected.');
  process.exit(0);
}

console.log('[prague-blocks] Files changed:');
differences.forEach((file) => console.log(`- ${file}`));
