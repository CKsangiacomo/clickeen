#!/usr/bin/env node
/* eslint-disable no-console */
import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateStaticRegistries } from './generate-static-registries.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const adminRoot = path.resolve(path.dirname(scriptPath), '..');
const repoRoot = path.resolve(adminRoot, '..');
const distRoot = path.join(adminRoot, 'dist');

function resolveExisting(candidate) {
  if (fsSync.existsSync(candidate) && fsSync.statSync(candidate).isFile()) return candidate;

  for (const ext of ['.ts', '.tsx', '.js', '.mjs', '.css', '.json']) {
    const withExt = `${candidate}${ext}`;
    if (fsSync.existsSync(withExt) && fsSync.statSync(withExt).isFile()) return withExt;
  }

  if (fsSync.existsSync(candidate) && fsSync.statSync(candidate).isDirectory()) {
    for (const fileName of ['index.ts', 'index.tsx', 'index.js', 'index.mjs', 'index.css']) {
      const withIndex = path.join(candidate, fileName);
      if (fsSync.existsSync(withIndex) && fsSync.statSync(withIndex).isFile()) return withIndex;
    }
  }

  return candidate;
}

function resolveImport(importPath, resolveDir) {
  if (importPath.startsWith('@dieter/')) {
    return resolveExisting(path.join(repoRoot, 'dieter', importPath.slice('@dieter/'.length)));
  }
  if (path.isAbsolute(importPath)) return resolveExisting(importPath);
  return resolveExisting(path.resolve(resolveDir, importPath));
}

const rawPlugin = {
  name: 'raw-imports',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (args) => {
      const cleanPath = args.path.replace(/\?raw$/, '');
      return {
        path: resolveImport(cleanPath, args.resolveDir),
        namespace: 'raw-file',
      };
    });

    build.onLoad({ filter: /.*/, namespace: 'raw-file' }, async (args) => {
      const contents = await fs.readFile(args.path, 'utf8');
      return {
        contents: `export default ${JSON.stringify(contents)};`,
        loader: 'js',
      };
    });
  },
};

const dieterAliasPlugin = {
  name: 'dieter-alias',
  setup(build) {
    build.onResolve({ filter: /^@dieter\// }, (args) => ({
      path: resolveImport(args.path, args.resolveDir),
    }));
  },
};

async function writeHtml() {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DevStudio - Clickeen</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/index.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/assets/index.js"></script>
  </body>
</html>
`;
  await fs.writeFile(path.join(distRoot, 'index.html'), html, 'utf8');
}

async function main() {
  await generateStaticRegistries();
  await fs.rm(distRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(distRoot, 'assets'), { recursive: true });

  await esbuild.build({
    absWorkingDir: adminRoot,
    entryPoints: ['src/main.ts'],
    outdir: 'dist/assets',
    bundle: true,
    format: 'esm',
    target: ['es2022'],
    entryNames: 'index',
    assetNames: '[name]',
    sourcemap: false,
    minify: false,
    logLevel: 'info',
    plugins: [rawPlugin, dieterAliasPlugin],
  });

  await writeHtml();
}

main().catch((error) => {
  console.error('[devstudio:build] Failed.', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
