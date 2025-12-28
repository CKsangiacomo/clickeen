import fs from 'node:fs';
import path from 'node:path';
import type { CompiledWidget } from '../types';

function resolveRepoPath(...segments: string[]) {
  const cwd = process.cwd();
  const direct = path.join(cwd, ...segments);
  if (fs.existsSync(direct)) return direct;
  return path.join(cwd, '..', ...segments);
}

function requireTokyoUrl(): string {
  const raw = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_TOKYO_URL : undefined;
  const value = raw?.trim();
  if (!value) {
    throw new Error('[BobCompiler] NEXT_PUBLIC_TOKYO_URL is required to build widget assets');
  }
  return value;
}

export function buildWidgetAssets(args: {
  widgetname: string;
  usages: Set<string>;
}): CompiledWidget['assets'] {
  const tokyoRoot = requireTokyoUrl().replace(/\/+$/, '');
  const dieterBase = `${tokyoRoot}/dieter`;
  const assetBase = `${tokyoRoot}/widgets/${args.widgetname}`;
  const componentAssetPath = (name: string, ext: 'css' | 'js') =>
    resolveRepoPath('tokyo', 'dieter', 'components', name, `${name}.${ext}`);

  const controlTypes = Array.from(args.usages);
  const dieterAssets = {
    styles: [
      `${dieterBase}/tokens/tokens.css`,
      ...controlTypes
        .filter((t) => fs.existsSync(componentAssetPath(t, 'css')))
        .map((t) => `${dieterBase}/components/${t}/${t}.css`),
    ],
    scripts: controlTypes
      .filter((t) => fs.existsSync(componentAssetPath(t, 'js')))
      .map((t) => `${dieterBase}/components/${t}/${t}.js`),
  };

  return {
    htmlUrl: `${assetBase}/widget.html`,
    cssUrl: `${assetBase}/widget.css`,
    jsUrl: `${assetBase}/widget.client.js`,
    dieter: dieterAssets,
  };
}
