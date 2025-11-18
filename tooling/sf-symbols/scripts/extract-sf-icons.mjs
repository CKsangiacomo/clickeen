// tools/extract-sf-icons.mjs
// Strict CTO: no placeholders. Requires you to provide exact SF names below.
// Usage (from repo root):
//   node tools/extract-sf-icons.mjs tools/sf-symbols/src/symbolSet.json 16 apps/app/public/dieter/icons
//
// If you want 20px/24px too, run again with size 20 or 24 and adjust output filenames.

import fs from 'node:fs';
import path from 'node:path';

const [,, jsonPath, sizeArg, outDir] = process.argv;
if (!jsonPath || !sizeArg || !outDir) {
  console.error('Usage: node tools/extract-sf-icons.mjs <path-to-symbolSet.json> <size> <out-dir>');
  process.exit(1);
}

const SIZE = parseInt(sizeArg, 10);
if (![16, 20, 24].includes(SIZE)) {
  console.error('Size must be one of 16, 20, 24.');
  process.exit(1);
}

// ---- REQUIRED: Provide exact SF Symbol names for each output file ----
// Fill these with the OFFICIAL SF Symbols names you want. No guessing.
const MAP = {
  // "output-filename-without-extension": "sf.symbol.name",
  // Examples (confirm/replace with your choices):
  // "chevron-left": "chevron.left",
  // "chevron-right": "chevron.right",
  // "copy": "doc.on.doc",
  // "desktop": "desktopcomputer",
  // "phone": "iphone",
  // "sun": "sun.max",
  // "moon": "moon",
  // "folder": "folder",
  // "pencil": "pencil",
  // "wrench": "wrench.adjustable"
};

if (Object.keys(MAP).length === 0) {
  console.error('MAP is empty. Provide exact SF Symbol names for each output. Aborting (no placeholders).');
  process.exit(1);
}

const raw = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);

/**
 * The JSON shape is:
 * {
 *   version: "4.0",
 *   precision: 2,
 *   fontSize: 28,
 *   symbols: {
 *     "<sf.name>": {
 *       regular|bold|...: {
 *         path: "M ... Z",
 *         geometry: { width: <number>, height: <number> }
 *       },
 *       ...
 *     }
 *   }
 * }
 */
function getEntry(sfName) {
  const entry = data.symbols?.[sfName];
  if (!entry) throw new Error(`SF symbol not found: ${sfName}`);

  // Choose a weight. If your UI wants a specific weight, set it here.
  // We’ll prefer 'regular' when present, otherwise the first available style.
  const weight = entry.regular ? 'regular' : Object.keys(entry)[0];
  const node = entry[weight];
  if (!node?.path || !node?.geometry) {
    throw new Error(`Missing path/geometry for ${sfName} (${weight})`);
  }
  return { path: node.path, width: node.geometry.width, height: node.geometry.height, weight };
}

function svgFor({ path: d, width, height }) {
  // Use the intrinsic geometry from SF data as viewBox.
  // Scale is handled by CSS (diet-icon classes); fill is currentColor.
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="currentColor" aria-hidden="true">`,
    `  <path d="${d}"/>`,
    `</svg>\n`
  ].join('\n');
}

fs.mkdirSync(outDir, { recursive: true });

for (const [outBase, sfName] of Object.entries(MAP)) {
  const entry = getEntry(sfName);
  const svg = svgFor(entry);
  const file = path.join(outDir, `${outBase}-${SIZE}.svg`);
  fs.writeFileSync(file, svg, 'utf8');
  console.log(`✓ wrote ${file}  (SF: ${sfName})`);
}

console.log('Done.');