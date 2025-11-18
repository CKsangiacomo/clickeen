#!/usr/bin/env node
/*
 Generates Dieter Admin icons showcase HTML with one row per icon and
 eight columns (xxs → 3xl) using the same token sizing model DevStudio
 uses (`.diet-icon` with data-size + data-icon).
*/
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ICONS_JSON = path.join(ROOT, 'dieter', 'icons', 'icons.json');
const OUT_FILE = path.join(
  ROOT,
  'dieter',
  'dieteradmin',
  'src',
  'html',
  'dieter-showcase',
  'icons.html'
);

function listIconNames(manifestPath) {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw);
  const symbols = parsed && parsed.symbols ? parsed.symbols : {};
  return Object.keys(symbols).sort((a, b) => a.localeCompare(b));
}

function row(name) {
  // One row per icon: token sizes and pixel values
  const sizes = [
    { token: 'xxs', label: 'xxs · 12px' },
    { token: 'xs', label: 'xs · 16px' },
    { token: 'sm', label: 'sm · 20px' },
    { token: 'md', label: 'md · 24px' },
    { token: 'lg', label: 'lg · 28px' },
    { token: 'xl', label: 'xl · 32px' },
    { token: '2xl', label: '2xl · 36px' },
    { token: '3xl', label: '3xl · 40px' },
  ];

  const cells = sizes
    .map(
      ({ token, label }) => `
      <div class="specdpreview">
        <div class="preview-specs">
          <div class="preview-specs__row"><span class="preview-specs__detail">${label}</span></div>
        </div>
        <div class="componentpreview">
          <span class="diet-icon" aria-hidden="true" data-size="${token}" data-icon="${name}"></span>
        </div>
      </div>`
    )
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
  <div class="section" data-cols="8">
    <h3 class="section-header">Icons — Sizes 12 to 40</h3>
    ${rowsHtml}
  </div>
  <p class="caption">One row per icon; sizes 12px, 16px, 20px, 24px, 28px, 32px, 36px, 40px. SVGs are embedded verbatim; designer exports are authoritative.</p>
  
</div>`;
}

function main() {
  if (!fs.existsSync(ICONS_JSON)) {
    console.error('[generate-icons-showcase] Missing manifest:', ICONS_JSON);
    process.exit(1);
  }

  const names = listIconNames(ICONS_JSON);
  const rows = names.map((name) => row(name));
  const html = buildPage(rows.join('\n'));

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, html, 'utf8');
  console.log(`[generate-icons-showcase] Wrote ${names.length} icons → ${OUT_FILE}`);
}

main();
