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
  // Compact: one column, token + icon next to each other at sm
  return `
  <div class="row" data-cols="1">
    <div class="row-header">${name}</div>
    <div class="specdpreview">
      <div class="preview-specs"></div>
      <div class="componentpreview">
        <div class="diet-input" data-size="sm" style="display:flex;align-items:center;gap:var(--space-3)">
          <code class="caption">--control-icon-sm</code>
          <span class="diet-input__icon" aria-hidden="true">${svg}</span>
        </div>
      </div>
    </div>
  </div>`;
}

function buildPage(rowsHtml) {
  return `
<div class="dieter-preview" style="--spec-col-w: 60px;">
  <h3 class="section-header">Icons — Compact (sm only)</h3>
  ${rowsHtml}
  <p class="caption">Icons rendered with Dieter token sizing (sm). Designer exports are authoritative.</p>
  
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
