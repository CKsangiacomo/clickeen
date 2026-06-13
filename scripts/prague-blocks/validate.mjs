import fs from 'node:fs/promises';
import path from 'node:path';
import { globSync } from 'glob';

const root = path.join(path.resolve(new URL('../..', import.meta.url).pathname), 'tokyo', 'prague', 'pages');
const files = globSync(path.join(root, '*/*.json'), { nodir: true }), layouts = new Set(['visual-left', 'visual-right', 'stacked']), errors = files.length ? [] : [`No page JSON files found under ${root}`];
for (const file of files) {
  const rel = path.relative(root, file), page = JSON.parse(await fs.readFile(file, 'utf8')), blocks = page && typeof page === 'object' && !Array.isArray(page) ? page.blocks : undefined;
  if (!Array.isArray(blocks)) errors.push(`${rel}: blocks[] missing`); else for (const [i, block] of blocks.entries()) if (!block || typeof block !== 'object' || Array.isArray(block)) errors.push(`${rel}: blocks[${i}] malformed`); else if (block.type === 'split' && block.layout && !layouts.has(block.layout)) errors.push(`${rel}: split layout "${block.layout}" invalid`);
}
if (errors.length) { console.error('[prague-blocks] Validation failed:'); errors.forEach((line) => console.error(`- ${line}`)); process.exit(1); }
console.log('[prague-blocks] Validation passed.');
