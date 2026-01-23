import fs from 'node:fs/promises';
import path from 'node:path';
import { globSync } from 'glob';

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const DEFAULT_INPUT = path.join(REPO_ROOT, 'tokyo', 'widgets');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const match = args.find((arg) => arg.startsWith(`${name}=`));
  if (!match) return fallback;
  return match.split('=').slice(1).join('=');
};

const inputRoot = getArg('--input', DEFAULT_INPUT);
const pageFiles = globSync(path.join(inputRoot, '**/pages/*.json'), { nodir: true });

const VALID_SPLIT_LAYOUTS = new Set(['visual-left', 'visual-right', 'stacked']);

if (!pageFiles.length) {
  console.error(`[prague-blocks] No page JSON files found under ${inputRoot}`);
  process.exit(1);
}

const violations = [];

for (const filePath of pageFiles) {
  const raw = await fs.readFile(filePath, 'utf8');
  const json = JSON.parse(raw);
  if (!json || typeof json !== 'object' || !Array.isArray(json.blocks)) continue;
  json.blocks.forEach((block) => {
    if (!block || typeof block !== 'object') return;
    if (block.type === 'split' && block.layout && !VALID_SPLIT_LAYOUTS.has(block.layout)) {
      violations.push(`${path.relative(inputRoot, filePath)}: split layout "${block.layout}" invalid`);
    }
  });
}

if (!violations.length) {
  console.log('[prague-blocks] Validation passed.');
  process.exit(0);
}

console.error('[prague-blocks] Validation failed:');
violations.forEach((line) => console.error(`- ${line}`));
process.exit(1);
