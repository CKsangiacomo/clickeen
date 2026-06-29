const fs = require('fs');
const path = require('path');

const svgDir = path.join(__dirname, '../dieter/icons/svg');
const manifestPath = path.join(__dirname, '../dieter/icons/icons.json');

const violations = [];
const svgFiles = fs.readdirSync(svgDir).filter((file) => file.endsWith('.svg')).sort();
for (const file of svgFiles) {
  const content = fs.readFileSync(path.join(svgDir, file), 'utf8');

  let fillDeclarationCount = 0;

  const attrFillRegex = /\bfill\s*=\s*(['"])(.*?)\1/gi;
  let attrMatch;
  while ((attrMatch = attrFillRegex.exec(content)) !== null) {
    fillDeclarationCount += 1;
    const value = attrMatch[2].trim();
    if (value !== 'currentColor') violations.push(`${file}: attr fill="${value}"`);
  }

  const styleAttrRegex = /\bstyle\s*=\s*(['"])([\s\S]*?)\1/gi;
  let styleAttrMatch;
  while ((styleAttrMatch = styleAttrRegex.exec(content)) !== null) {
    for (const declaration of styleAttrMatch[2].split(';')) {
      const fillMatch = declaration.match(/^\s*fill\s*:\s*(.*?)\s*$/i);
      if (!fillMatch) continue;
      fillDeclarationCount += 1;
      const value = fillMatch[1].trim();
      if (value !== 'currentColor') violations.push(`${file}: style fill:${value}`);
    }
  }

  const styleBlockRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let styleBlockMatch;
  while ((styleBlockMatch = styleBlockRegex.exec(content)) !== null) {
    const fillRegex = /\bfill\s*:\s*([^;}\n]+)/gi;
    let fillMatch;
    while ((fillMatch = fillRegex.exec(styleBlockMatch[1])) !== null) {
      fillDeclarationCount += 1;
      const value = fillMatch[1].trim();
      if (value !== 'currentColor') violations.push(`${file}: style block fill:${value}`);
    }
  }

  if (fillDeclarationCount === 0) {
    violations.push(`${file}: missing explicit currentColor fill declaration`);
  }
}

if (violations.length) {
  console.error('[verify-svgs] Found non-currentColor fills:');
  console.error(violations.slice(0, 50).join('\n'));
  console.error(`Total violations: ${violations.length}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error(
    '[verify-svgs] Unable to read icons.json for verification:',
    String(e && e.message ? e.message : e)
  );
  process.exit(1);
}

const manifestNames = Object.keys((manifest && manifest.symbols) || {}).sort();
const svgNames = svgFiles.map((file) => path.basename(file, '.svg')).sort();
const missingSource = manifestNames.filter((name) => !svgNames.includes(name));
const missingManifest = svgNames.filter((name) => !manifestNames.includes(name));
if (missingSource.length || missingManifest.length) {
  console.error('[verify-svgs] Icon manifest/source mismatch:');
  if (missingSource.length) console.error(`Missing source SVGs: ${missingSource.join(', ')}`);
  if (missingManifest.length) console.error(`Source SVGs missing manifest symbols: ${missingManifest.join(', ')}`);
  process.exit(1);
}

// Warn on stroke usage (prefer fill-only icons)
const strokeWarn = [];
for (const file of svgFiles) {
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

console.log(`[verify-svgs] OK: ${svgFiles.length} SVG files verified (manifest parity + currentColor only)`);
