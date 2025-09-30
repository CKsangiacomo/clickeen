// AUTO-GENERATED BUILD SCRIPT PER SPEC
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_SVG_DIR = path.join(ROOT, 'icons', 'svg');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_ICONS_DIR = path.join(DIST_DIR, 'icons');
const DIST_INDEX_D_TS = path.join(DIST_DIR, 'icons.d.ts');
const DIST_INDEX_JS = path.join(DIST_DIR, 'icons.js');

fs.mkdirSync(DIST_ICONS_DIR, { recursive: true });

function optimizeOrCopy(inPath, outPath) {
  try {
    execSync(`npx --yes svgo -q -o "${outPath}" "${inPath}"`, { stdio: 'ignore' });
  } catch {
    fs.copyFileSync(inPath, outPath);
  }
}

function toIconName(file) {
  return path.basename(file).replace(/\.svg$/i, '').replace(/[_\s]+/g, '-').toLowerCase();
}

if (!fs.existsSync(SRC_SVG_DIR)) {
  console.error('[dieter:icons] Missing icons/svg folder.');
  process.exit(1);
}

const files = fs.readdirSync(SRC_SVG_DIR).filter(f => f.toLowerCase().endsWith('.svg'));
if (files.length === 0) {
  console.error('[dieter:icons] No SVGs found in icons/svg. Aborting.');
  process.exit(1);
}

const registry = [];
for (const f of files) {
  const name = toIconName(f);
  const src = path.join(SRC_SVG_DIR, f);
  const out = path.join(DIST_ICONS_DIR, `${name}.svg`);
  optimizeOrCopy(src, out);
  registry.push({ name, path: `/dieter/icons/${name}.svg` });
}

const union = registry.map(r => `'${r.name}'`).sort().join(' | ') || 'never';
const dts = `// AUTO-GENERATED. DO NOT EDIT.
export type IconName = ${union};
export type IconEntry = { name: IconName; path: string };
export declare const registry: ReadonlyArray<IconEntry>;
export declare function iconPath(name: IconName): string;
`;
fs.writeFileSync(DIST_INDEX_D_TS, dts, 'utf8');

const js = `// AUTO-GENERATED. DO NOT EDIT.
export const registry = ${JSON.stringify(registry)};
export function iconPath(name) {
  const hit = registry.find(r => r.name === name);
  if (!hit) throw new Error(` + "`" + `@ck/dieter: unknown icon "\${name}"` + "`" + `);
  return hit.path;
}
`;
fs.writeFileSync(DIST_INDEX_JS, js, 'utf8');

console.log(`[dieter:icons] Built ${registry.length} icons → ${DIST_ICONS_DIR}`);
