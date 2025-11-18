const fs = require('fs');
const path = require('path');

const svgDir = path.join(__dirname, '../dieter/icons/svg');
const manifestPath = path.join(__dirname, '../dieter/icons/icons.json');

const violations = [];
let count = 0;
for (const file of fs.readdirSync(svgDir)) {
  if (!file.endsWith('.svg')) continue;
  count++;
  const content = fs.readFileSync(path.join(svgDir, file), 'utf8');
  // Any fill attribute that is not currentColor is a violation
  const attrFills = content.match(/fill="([^"]*)"/g) || [];
  for (const attr of attrFills) {
    if (!/fill="currentColor"/.test(attr)) violations.push(`${file}: attr ${attr}`);
  }
  // Inline style fill declaration must be currentColor if present
  const styleFills = content.match(/fill\s*:\s*([^;\"]+)/gi) || [];
  for (const s of styleFills) {
    if (!/fill\s*:\s*currentColor/i.test(s)) violations.push(`${file}: style ${s}`);
  }
}

if (violations.length) {
  console.error('[verify-svgs] Found non-currentColor fills:');
  console.error(violations.slice(0, 50).join('\n'));
  console.error(`Total violations: ${violations.length}`);
  process.exit(1);
}

// Count check against manifest
try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const manifestCount = manifest && manifest.symbols ? Object.keys(manifest.symbols).length : 0;
  if (manifestCount && manifestCount !== count) {
    console.warn(`[verify-svgs] Count mismatch: manifest=${manifestCount} svgFiles=${count}`);
  }
} catch (e) {
  console.warn(
    '[verify-svgs] Unable to read icons.json for count verification:',
    String(e && e.message ? e.message : e)
  );
}

// Warn on stroke usage (prefer fill-only icons)
const strokeWarn = [];
for (const file of fs.readdirSync(svgDir)) {
  if (!file.endsWith('.svg')) continue;
  const content = fs.readFileSync(path.join(svgDir, file), 'utf8');
  if (/\sstroke=\"/i.test(content)) {
    strokeWarn.push(
      `${file}: contains stroke attribute — consider converting strokes to fills`
    );
  }
}
if (strokeWarn.length) {
  console.warn('[verify-svgs] Stroke usage warnings:');
  console.warn(strokeWarn.slice(0, 50).join('\n'));
}

console.log(`[verify-svgs] OK: ${count} SVG files verified (currentColor only)`);

