#!/usr/bin/env node
/*
 Build @ck/dieter artifacts to dieter/dist using a deterministic, cross-platform flow:
 - Normalize SVGs to fill="currentColor" (scripts/process-svgs.js)
 - Verify SVGs (scripts/verify-svgs.js)
 - Copy tokens/tokens.css -> dist/tokens.css
 - Copy icons/icons.json -> dist/icons/icons.json
 - Copy icons/svg/* -> dist/icons/svg/*
*/

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function copyRecursiveSync(source, destination) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      const src = path.join(source, entry);
      const dst = path.join(destination, entry);
      copyRecursiveSync(src, dst);
    }
  } else {
    const dir = path.dirname(destination);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(source, destination);
  }
}

function copyCssOnly(source, destination) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    // Recurse into subdirectories, but only create destination folders when needed
    for (const entry of fs.readdirSync(source)) {
      const src = path.join(source, entry);
      const dst = path.join(destination, entry);
      copyCssOnly(src, dst);
    }
    return;
  }

  if (path.extname(source) !== '.css') {
    return;
  }

  const dir = path.dirname(destination);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(source, destination);
}

function runNodeScript(scriptRelPath) {
  const p = path.resolve(__dirname, scriptRelPath);
  const res = spawnSync(process.execPath, [p], { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`[build-dieter] Subprocess failed: ${scriptRelPath} (exit ${res.status})`);
    process.exit(res.status || 1);
  }
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const dieterRoot = path.resolve(repoRoot, 'dieter');
  const dist = path.join(dieterRoot, 'dist');

  // 1) Normalize and verify SVGs in-place under dieter/icons/svg
  // If a curated svg_new override folder exists, copy it over the base source first
  let usingOverrides = false;
  try {
    const svgNew = path.join(dieterRoot, 'icons', 'svg_new');
    const svgBase = path.join(dieterRoot, 'icons', 'svg');
    if (fs.existsSync(svgNew)) {
      console.log('[build-dieter] Using curated overrides from icons/svg_new (designer-authoritative)');
      copyRecursiveSync(svgNew, svgBase);
      usingOverrides = true;
    }
  } catch (_) {}

  // Always enforce currentColor fills
  runNodeScript('process-svgs.js');
  runNodeScript('verify-svgs.js');

  // 2) Recreate dist
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  // 3) Copy tokens
  const tokensSrc = path.join(dieterRoot, 'tokens', 'tokens.css');
  const tokensDst = path.join(dist, 'tokens.css');
  if (!fs.existsSync(tokensSrc)) {
    console.error('[build-dieter] Missing tokens source:', tokensSrc);
    process.exit(1);
  }
  copyRecursiveSync(tokensSrc, tokensDst);

  // 4) Copy icons manifest and svgs
  const iconsJsonSrc = path.join(dieterRoot, 'icons', 'icons.json');
  const iconsJsonDst = path.join(dist, 'icons', 'icons.json');
  const svgsSrc = path.join(dieterRoot, 'icons', 'svg');
  const svgsDst = path.join(dist, 'icons', 'svg');
  if (!fs.existsSync(svgsSrc)) {
    console.error('[build-dieter] Missing icons svg directory:', svgsSrc);
    process.exit(1);
  }
  if (fs.existsSync(iconsJsonSrc)) copyRecursiveSync(iconsJsonSrc, iconsJsonDst);
  copyRecursiveSync(svgsSrc, svgsDst);

  // 4b) Generate DevStudio icons showcase from icon sources
  try {
    runNodeScript('generate-icons-showcase.js');
  } catch (_) {}

  // 5) Copy component CSS (tokens refer to these in consumers)
  const componentsSrc = path.join(dieterRoot, 'components');
  const componentsDst = path.join(dist, 'components');
  if (fs.existsSync(componentsSrc)) {
    copyCssOnly(componentsSrc, componentsDst);
  }

  const foundationsSrc = path.join(dieterRoot, 'foundations');
  const foundationsDst = path.join(dist, 'foundations');
  if (fs.existsSync(foundationsSrc)) {
    copyCssOnly(foundationsSrc, foundationsDst);
  }

  console.log(`[build-dieter] Built Dieter assets into ${dist}${usingOverrides ? ' (with svg_new overrides)' : ''}`);
}

main();
