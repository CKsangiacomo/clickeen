import fs from 'node:fs/promises';
import path from 'node:path';
import { globSync } from 'glob';

const root = path.join(path.resolve(new URL('../..', import.meta.url).pathname), 'tokyo', 'prague', 'pages');
const files = globSync(path.join(root, '*/*.json'), { nodir: true }), layouts = new Set(['visual-left', 'visual-right', 'stacked']), errors = files.length ? [] : [`No page JSON files found under ${root}`], pageAssetRefs = new Set();

function addPageAssetRef(widget, value) {
  const ref = typeof value === 'string' ? value.trim().replace(/^\/+/, '') : '';
  if (!ref || /^https?:\/\//i.test(ref)) return;
  pageAssetRefs.add(`${widget}/assets/${ref}`);
  pageAssetRefs.add(`${widget}/${ref}`);
  if (ref.startsWith('pages/')) pageAssetRefs.add(ref.slice('pages/'.length));
  if (ref.startsWith('prague/pages/')) pageAssetRefs.add(ref.slice('prague/pages/'.length));
  const runtimePrefix = `widgets/${widget}/pages/assets/`;
  if (ref.startsWith(runtimePrefix)) pageAssetRefs.add(`${widget}/assets/${ref.slice(runtimePrefix.length)}`);
}

function collectPageAssetRefs(widget, value) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectPageAssetRefs(widget, entry));
    return;
  }
  if (value && typeof value === 'object') {
    addPageAssetRef(widget, value.backgroundPath);
    addPageAssetRef(widget, value.imagePath);
    if (value.visual && typeof value.visual === 'object') addPageAssetRef(widget, value.visual.image);
    Object.values(value).forEach((entry) => collectPageAssetRefs(widget, entry));
  }
}

for (const file of files) {
  const rel = path.relative(root, file), page = JSON.parse(await fs.readFile(file, 'utf8')), blocks = page && typeof page === 'object' && !Array.isArray(page) ? page.blocks : undefined;
  const widget = rel.split(path.sep)[0];
  collectPageAssetRefs(widget, page);
  if (!Array.isArray(blocks)) errors.push(`${rel}: blocks[] missing`); else for (const [i, block] of blocks.entries()) if (!block || typeof block !== 'object' || Array.isArray(block)) errors.push(`${rel}: blocks[${i}] malformed`); else if (block.type === 'split' && block.layout && !layouts.has(block.layout)) errors.push(`${rel}: split layout "${block.layout}" invalid`);
}

const pageAssets = globSync(path.join(root, '*/assets/**/*'), { nodir: true });
for (const file of pageAssets) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (!pageAssetRefs.has(rel)) errors.push(`${rel}: orphan page asset`);
}

if (errors.length) { console.error('[prague-blocks] Validation failed:'); errors.forEach((line) => console.error(`- ${line}`)); process.exit(1); }
console.log('[prague-blocks] Validation passed.');
