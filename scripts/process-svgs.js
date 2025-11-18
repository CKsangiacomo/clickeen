const fs = require('fs');
const path = require('path');

const svgDir = path.join(__dirname, '../dieter/icons/svg');
const manifestPath = path.join(__dirname, '../dieter/icons/icons.json');

let processed = 0;
for (const file of fs.readdirSync(svgDir)) {
  if (!file.endsWith('.svg')) continue;
  const filePath = path.join(svgDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Normalize quotes
  content = content.replace(/fill='([^']*)'/g, 'fill="$1"');

  // Replace any explicit fill with currentColor (attribute form)
  content = content.replace(/fill="(?!currentColor)[^"]*"/g, 'fill="currentColor"');

  // Replace inline style fill declarations to currentColor
  content = content.replace(/style="([^"]*)"/g, (m, styles) => {
    const updated = styles.replace(/fill\s*:\s*[^;\"]+/gi, 'fill: currentColor');
    return `style="${updated}"`;
  });

  // If no fill anywhere, add to root <svg>
  if (!/fill=/.test(content)) {
    content = content.replace(/<svg([^>]*)>/, '<svg$1 fill="currentColor">');
  }

  fs.writeFileSync(filePath, content);
  processed++;
}

// Manifest count check
try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const manifestCount = manifest && manifest.symbols ? Object.keys(manifest.symbols).length : 0;
  const svgCount = fs.readdirSync(svgDir).filter((f) => f.endsWith('.svg')).length;
  if (manifestCount && manifestCount !== svgCount) {
    console.warn(`[process-svgs] Count mismatch: manifest=${manifestCount} svgFiles=${svgCount}`);
  } else {
    console.log(`[process-svgs] Count OK: ${svgCount} SVGs match manifest (${manifestCount}).`);
  }
} catch (e) {
  console.warn(
    '[process-svgs] Unable to read icons.json for count verification:',
    String(e && e.message ? e.message : e)
  );
}

console.log(`Processed ${processed} SVG files in ${svgDir}`);

