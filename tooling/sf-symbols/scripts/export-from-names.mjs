import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of the sf-symbols tool (…/tools/sf-symbols)
const ROOT = path.resolve(__dirname, '..');

// Output folder INSIDE the tool
const OUT = path.join(ROOT, 'src', 'icons');

// Versioned names list (existing in your zip under sources/4.0/names.txt)
const VERSION = '4.0';
const NAMES_PATH = path.join(ROOT, `sources/${VERSION}/names.txt`);
const JSON_PATH = path.join(ROOT, 'src', 'symbolSet.json');

function ensureFile(p) {
  if (!fs.existsSync(p)) {
    throw new Error(`Required file not found: ${p}`);
  }
}

function readLines(p) {
  return fs
    .readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function firstVariant(entry) {
  // Prefer "regular", otherwise take the first available key
  if (!entry || typeof entry !== 'object') return null;
  if (entry.regular) return entry.regular;
  const keys = Object.keys(entry);
  return keys.length ? entry[keys[0]] : null;
}

function buildSvg(node, fallbackSize) {
  if (!node) return null;
  const geom = node.geometry || {};
  const w = Number.isFinite(geom.width) ? geom.width : fallbackSize;
  const h = Number.isFinite(geom.height) ? geom.height : fallbackSize;

  // Common shapes:
  // - node.path: string
  // - node.paths: array of { d, fill? }
  // We support both; default to monochrome if fill is absent.
  let content = '';
  if (typeof node.path === 'string' && node.path.length) {
    content = `<path d="${node.path}"/>`;
  } else if (Array.isArray(node.paths) && node.paths.length) {
    content = node.paths
      .filter(p => p && typeof p.d === 'string' && p.d.length)
      .map(p => (p.fill ? `<path d="${p.d}" fill="${p.fill}"/>` : `<path d="${p.d}"/>`))
      .join('\n  ');
  } else {
    return null; // nothing to draw
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  ${content}
</svg>
`;
}

function safeFileName(symbolName) {
  return symbolName.replace(/[./\\]/g, '-');
}

(function main() {
  ensureFile(NAMES_PATH);
  ensureFile(JSON_PATH);

  const names = readLines(NAMES_PATH);
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

  const fontSize = Number.isFinite(data.fontSize) ? data.fontSize : 28;
  const symbols = data.symbols || {};

  fs.mkdirSync(OUT, { recursive: true });

  let ok = 0;
  let missing = 0;
  let empty = 0;

  for (const name of names) {
    const entry = symbols[name];
    if (!entry) {
      missing++;
      // uncomment if you want verbose: console.warn(`[missing] ${name}`);
      continue;
    }
    const node = firstVariant(entry);
    const svg = buildSvg(node, fontSize);
    if (!svg) {
      empty++;
      // uncomment if you want verbose: console.warn(`[empty] ${name}`);
      continue;
    }

    const fileName = `${safeFileName(name)}.svg`;
    const outPath = path.join(OUT, fileName);
    fs.writeFileSync(outPath, svg, 'utf8');
    ok++;
  }

  console.log(`Wrote ${ok} SVGs to ${OUT}. ${missing} names missing, ${empty} empty.`);
})();