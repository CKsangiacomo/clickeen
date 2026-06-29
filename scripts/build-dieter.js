#!/usr/bin/env node
/*
 Build @ck/dieter artifacts directly into tokyo/product/dieter:
 - Verify SVGs (scripts/verify-svgs.js)
 - Copy tokens/* -> tokyo/product/dieter/tokens/*
 - Copy icons/icons.json -> tokyo/product/dieter/icons/icons.json
 - Copy icons/svg/* -> tokyo/product/dieter/icons/svg/*
 - Copy component/foundation CSS
 - Bundle component JS per control
*/

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const esbuild = require('esbuild');
const { glob } = require('glob');

function getGitSha(repoRoot) {
  const fromEnv =
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();

  // Prefer a commit SHA that changes only when Dieter inputs change, so local installs/builds
  // don't dirty `tokyo/product/dieter/manifest.json` on every unrelated commit.
  const res = spawnSync(
    'git',
    ['rev-list', '-1', 'HEAD', '--', 'dieter', 'scripts/build-dieter.js', 'scripts/verify-svgs.js'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  );

  if (res.status !== 0) {
    const detail = String(res.stderr || res.stdout || '').trim() || `git exited ${res.status}`;
    throw new Error(`[build-dieter] Failed to resolve Dieter manifest gitSha: ${detail}`);
  }

  const sha = String(res.stdout || '').trim();
  if (!sha) {
    throw new Error('[build-dieter] Failed to resolve Dieter manifest gitSha: git returned an empty SHA');
  }
  return sha;
}

function listComponentBundles(dist) {
  const componentsDir = path.join(dist, 'components');
  if (!fs.existsSync(componentsDir)) return [];
  return fs
    .readdirSync(componentsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(componentsDir, name, `${name}.css`)))
    .sort();
}

function listComponentBundlesWithJs(dist, componentNames) {
  const componentsDir = path.join(dist, 'components');
  return componentNames.filter((name) => fs.existsSync(path.join(componentsDir, name, `${name}.js`)));
}

function writeDieterManifest({ dist, repoRoot }) {
  const components = listComponentBundles(dist);
  const componentsWithJs = listComponentBundlesWithJs(dist, components);

  const aliases = {
    btn: 'button',
    'btn-ic': 'button',
    'btn-txt': 'button',
    'btn-ictxt': 'button',
    'btn-menuactions': 'menuactions',
    'popover-host': 'popover',
  };

  const helpers = ['dropdown-header', 'dropdown-header-label', 'dropdown-header-value', 'dropdown-header-icon'];

  // Explicit dependencies between Dieter bundles (keeps Bob compilation deterministic).
  // Keep this list small and expand only when a component truly depends on others.
  const deps = {
    'bulk-edit': ['button', 'dropdown-upload'],
    'dropdown-actions': ['popover', 'button'],
    'dropdown-border': ['popover', 'button', 'textfield', 'slider', 'toggle'],
    'dropdown-edit': ['popover', 'button', 'popaddlink', 'textfield'],
    'dropdown-fill': ['popover', 'button', 'textfield'],
    'dropdown-shadow': ['popover', 'button', 'textfield', 'slider', 'toggle', 'menuactions'],
    'dropdown-upload': ['popover', 'button', 'textfield'],
    popaddlink: ['popover', 'button', 'textfield'],
  };

  const validateName = (name) => typeof name === 'string' && name.length > 0 && components.includes(name);
  for (const [name, list] of Object.entries(deps)) {
    if (!validateName(name)) {
      throw new Error(`[build-dieter] manifest deps references unknown component "${name}"`);
    }
    if (!Array.isArray(list)) {
      throw new Error(`[build-dieter] manifest deps for "${name}" must be an array`);
    }
    const unknownDeps = list.filter((d) => !validateName(d));
    if (unknownDeps.length) {
      throw new Error(`[build-dieter] manifest deps for "${name}" contains unknown component(s): ${JSON.stringify(unknownDeps)}`);
    }
  }

  const manifest = {
    gitSha: getGitSha(repoRoot),
    components,
    componentsWithJs,
    aliases,
    helpers,
    deps,
  };

  fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

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

  if (source.endsWith('.html') || source.endsWith('.spec.json') || source.endsWith('.js')) {
    const dir = path.dirname(destination);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(source, destination);
  }
}

function generateShadowTokenCss(distTokensDir) {
  if (!fs.existsSync(distTokensDir)) return;

  const files = fs.readdirSync(distTokensDir).filter((name) => name.endsWith('.css'));

  files.forEach((name) => {
    if (name.endsWith('.shadow.css')) return;
    const full = path.join(distTokensDir, name);
    const content = fs.readFileSync(full, 'utf8');
    if (!content.includes(':root')) return;
    const shadow = content.replace(/:root\b/g, ':host');
    const outName = name.replace(/\.css$/, '.shadow.css');
    fs.writeFileSync(path.join(distTokensDir, outName), shadow);
  });

  const wrapperPath = path.join(distTokensDir, 'tokens.css');
  if (fs.existsSync(wrapperPath)) {
    const wrapper = fs.readFileSync(wrapperPath, 'utf8');
    const shadowWrapper = wrapper.replace(/(\.css)(['"]?\)\s*;)/g, '.shadow.css$2');
    fs.writeFileSync(path.join(distTokensDir, 'tokens.shadow.css'), shadowWrapper);
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

async function bundleComponentScripts({ componentsSrc, dist }) {
  const componentEntryFiles = (await glob(path.join(componentsSrc, '**/*.ts').replace(/\\/g, '/')))
    .sort()
    .filter((filePath) => {
      const componentName = path.basename(path.dirname(filePath));
      const fileName = path.basename(filePath, '.ts');
      return fileName === componentName;
    });

  for (const entryFile of componentEntryFiles) {
    const componentName = path.basename(path.dirname(entryFile));
    const outDir = path.join(dist, 'components', componentName);
    const outFile = path.join(outDir, `${componentName}.js`);
    const content = fs.readFileSync(entryFile, 'utf8');
    const match = content.match(/export function (\w+)/);
    if (!match) continue;
    fs.mkdirSync(outDir, { recursive: true });
    await esbuild.build({
      entryPoints: [entryFile],
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
}

function assertExists(label, filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`[build-dieter] Missing expected output (${label}): ${filePath}`);
    process.exit(1);
  }
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const dieterRoot = path.resolve(repoRoot, 'dieter');
  const dist = path.join(repoRoot, 'tokyo', 'product', 'dieter');
  const componentsSrc = path.join(dieterRoot, 'components');
  const foundationsSrc = path.join(dieterRoot, 'foundations');

  // 1) Verify committed icon source without mutating it.
  runNodeScript('verify-svgs.js');

  // 2) Recreate output
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  // 3) Copy tokens
  const tokensDirSrc = path.join(dieterRoot, 'tokens');
  const tokensSrc = path.join(tokensDirSrc, 'tokens.css');
  if (!fs.existsSync(tokensSrc)) {
    console.error('[build-dieter] Missing tokens source:', tokensSrc);
    process.exit(1);
  }
  if (fs.existsSync(tokensDirSrc)) {
    copyRecursiveSync(tokensDirSrc, path.join(dist, 'tokens'));
  }
  generateShadowTokenCss(path.join(dist, 'tokens'));

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

  // 6) Bundle component JS per control
  await bundleComponentScripts({ componentsSrc, dist });

  // 7) Build verification (fail fast if outputs are missing)
  assertExists('tokens/tokens.css', path.join(dist, 'tokens', 'tokens.css'));
  assertExists('icons.json', path.join(dist, 'icons', 'icons.json'));
  assertExists('icons/svg', path.join(dist, 'icons', 'svg'));

  // 8) Emit bundling manifest consumed by Bob/compiler.
  writeDieterManifest({ dist, repoRoot });
  assertExists('manifest.json', path.join(dist, 'manifest.json'));

  console.log(`[build-dieter] Built Dieter media into ${dist}`);
}

main().catch((err) => {
  console.error('[build-dieter] Build failed', err);
  process.exit(1);
});
