#!/usr/bin/env node
/*
 Generates Dieter Admin icons showcase HTML with one row per icon and
 three columns (sm, md, lg) using the same token sizing pipeline
 components use (.diet-input__icon box + glyph ratios).
*/
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SVG_DIR = path.join(ROOT, 'dieter', 'icons', 'svg');
const OUT_FILE = path.join(ROOT, 'dieter', 'dieteradmin', 'src', 'html', 'dieter-showcase', 'icons.html');

function listIcons(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.svg'))
    .sort((a, b) => a.localeCompare(b));
}

function readSvg(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  // Remove BOM
  content = content.replace(/^\uFEFF/, '');
  // Strip XML declaration and DOCTYPE if present
  content = content.replace(/<\?xml[\s\S]*?\?>/gi, '');
  content = content.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  return content.trim();
}

function row(name, svg) {
  // One row per icon, sizes 16→40 (16,20,24,28,32,36,40)
  const sizes = [16, 20, 24, 28, 32, 36, 40];
  const cells = sizes
    .map((px) => `
      <div class="specdpreview">
        <div class="preview-specs">
          <div class="preview-specs__row"><span class="preview-specs__detail">${px}px</span></div>
        </div>
        <div class="componentpreview">
          <!-- RAW inline SVG as components do: wrapper sets size; svg fills 100% -->
          <span class="diet-icon" aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;width:${px}px;height:${px}px;">
            ${svg.replace('<svg', '<svg style=\"width:100%;height:100%;display:block;\"')}
          </span>
        </div>
      </div>`)
    .join('\n');
  return `
  <div class="row">
    <div class="row-header">${name}</div>
    ${cells}
  </div>`;
}

function buildPage(rowsHtml) {
  return `
<div class="dieter-preview" style="--spec-col-w: 60px;">
  <style>
    /* tighter gaps for the icon grid */
    .dieter-preview .specdpreview { gap: 0.75rem; }
    /* grid columns are defined on .section; .row is display: contents */
  </style>
  <div class="section" data-cols="7">
    <h3 class="section-header">Icons — Sizes 16 to 40</h3>
    ${rowsHtml}
  </div>
  <p class="caption">One row per icon; sizes 16, 20, 24, 28, 32, 36, 40px. SVGs are embedded verbatim; designer exports are authoritative.</p>
  
</div>`;
}

function main() {
  if (!fs.existsSync(SVG_DIR)) {
    console.error('[generate-icons-showcase] Missing dir:', SVG_DIR);
    process.exit(1);
  }
  const files = listIcons(SVG_DIR);
  const rows = files.map((file) => {
    const name = path.basename(file, '.svg');
    const svg = readSvg(path.join(SVG_DIR, file));
    return row(name, svg);
  });
  const html = buildPage(rows.join('\n'));
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, html, 'utf8');
  console.log(`[generate-icons-showcase] Wrote ${files.length} icons → ${OUT_FILE}`);
}

main();
