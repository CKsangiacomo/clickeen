#!/usr/bin/env node
/*
 Build @ck/dieter artifacts directly into denver/dieter:
 - Normalize SVGs to fill="currentColor" (scripts/process-svgs.js)
 - Verify SVGs (scripts/verify-svgs.js)
 - Copy tokens/tokens.css -> dist/tokens.css
 - Copy icons/icons.json -> dist/icons/icons.json
 - Copy icons/svg/* -> dist/icons/svg/*
 - Copy component/foundation CSS
 - Bundle component JS per control + aggregate components.js
*/

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const esbuild = require('esbuild');
const { glob } = require('glob');

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

function copyComponentStatics(source, destination) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(source)) {
      const src = path.join(source, entry);
      const dst = path.join(destination, entry);
      copyComponentStatics(src, dst);
    }
    return;
  }

  if (source.endsWith('.html') || source.endsWith('.spec.json')) {
    const dir = path.dirname(destination);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(source, destination);
  }
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
  const dist = path.join(repoRoot, 'denver', 'dieter');
  const componentsSrc = path.join(dieterRoot, 'components');
  const foundationsSrc = path.join(dieterRoot, 'foundations');

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

  // 2) Recreate output
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  // 3) Copy tokens
  const tokensDirSrc = path.join(dieterRoot, 'tokens');
  const tokensSrc = path.join(tokensDirSrc, 'tokens.css');
  const tokensDst = path.join(dist, 'tokens.css');
  if (!fs.existsSync(tokensSrc)) {
    console.error('[build-dieter] Missing tokens source:', tokensSrc);
    process.exit(1);
  }
  copyRecursiveSync(tokensSrc, tokensDst);
  if (fs.existsSync(tokensDirSrc)) {
    copyRecursiveSync(tokensDirSrc, path.join(dist, 'tokens'));
  }

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

  // 5) Copy component and foundation CSS (for direct consumers)
  const componentsDst = path.join(dist, 'components');
  if (fs.existsSync(componentsSrc)) {
    copyCssOnly(componentsSrc, componentsDst);
    copyComponentStatics(componentsSrc, componentsDst);
  }

  const foundationsDst = path.join(dist, 'foundations');
  if (fs.existsSync(foundationsSrc)) {
    copyCssOnly(foundationsSrc, foundationsDst);
  }

  // 6) Bundle component JS per control and aggregate components.js
  (async () => {
    const tsFiles = await glob(path.join(componentsSrc, '**/*.ts').replace(/\\/g, '/'));
    // Per-component bundles (exported on window.Dieter via globalName)
    for (const tsFile of tsFiles) {
      const parts = tsFile.split('/');
      const name = parts[parts.length - 2]; // e.g., textfield/toggle
      const outDir = path.join(dist, 'components', name);
      const outFile = path.join(outDir, `${name}.js`);
      const content = fs.readFileSync(tsFile, 'utf8');
      const match = content.match(/export function (\w+)/);
      if (!match) continue;
      fs.mkdirSync(outDir, { recursive: true });
      await esbuild.build({
        entryPoints: [tsFile],
        bundle: true,
        format: 'iife',
        globalName: 'Dieter',
        target: ['es2020'],
        outfile: outFile,
        banner: {
          js: 'var __prevDieter = window.Dieter ? { ...window.Dieter } : {};',
        },
        footer: {
          js: 'window.Dieter = { ...__prevDieter, ...Dieter };',
        },
      });
    }
  })().catch((err) => {
    console.error('[build-dieter] Failed to bundle component JS', err);
    process.exit(1);
  });

  console.log(`[build-dieter] Built Dieter assets into ${dist}${usingOverrides ? ' (with svg_new overrides)' : ''}`);
}

main();
