import type { CompiledWidget } from '../types';

export function requireTokyoUrl(): string {
  const raw = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_TOKYO_URL : undefined;
  const value = raw?.trim();
  if (!value) {
    throw new Error('[BobCompiler] NEXT_PUBLIC_TOKYO_URL is required to build widget assets');
  }
  return value;
}

function normalizeDieterUsageToComponentName(usage: string): string | null {
  const trimmed = usage.trim();
  if (!trimmed) return null;
  if (trimmed === 'btn') return 'button';
  if (trimmed.startsWith('btn-')) {
    const rest = trimmed.slice('btn-'.length).trim();
    return rest || null;
  }
  return trimmed;
}

async function remoteFileExists(url: string): Promise<boolean> {
  const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
  if (res.ok) return true;
  if (res.status === 404) return false;

  if (res.status === 405) {
    const getRes = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (getRes.ok) return true;
    if (getRes.status === 404) return false;
    throw new Error(`[BobCompiler] Unable to check asset ${url} (GET ${getRes.status})`);
  }

  throw new Error(`[BobCompiler] Unable to check asset ${url} (HEAD ${res.status})`);
}

export async function buildWidgetAssets(args: {
  widgetname: string;
  usages: Set<string>;
}): Promise<CompiledWidget['assets']> {
  const tokyoRoot = requireTokyoUrl().replace(/\/+$/, '');
  const dieterBase = `${tokyoRoot}/dieter`;
  const assetBase = `${tokyoRoot}/widgets/${args.widgetname}`;

  const componentNames = Array.from(
    new Set(
      Array.from(args.usages)
        .map(normalizeDieterUsageToComponentName)
        .filter((name): name is string => Boolean(name)),
    ),
  );

  const componentStyles = await Promise.all(
    componentNames.map(async (name) => {
      const url = `${dieterBase}/components/${name}/${name}.css`;
      const exists = await remoteFileExists(url);
      if (!exists) {
        throw new Error(`[BobCompiler] Missing Dieter CSS for component "${name}" (${url})`);
      }
      return url;
    }),
  );

  const componentScripts = (
    await Promise.all(
      componentNames.map(async (name) => {
        const url = `${dieterBase}/components/${name}/${name}.js`;
        const exists = await remoteFileExists(url);
        return exists ? url : null;
      }),
    )
  ).filter((url): url is string => Boolean(url));

  const dieterAssets = {
    styles: [`${dieterBase}/tokens/tokens.css`, ...componentStyles],
    scripts: componentScripts,
  };

  return {
    htmlUrl: `${assetBase}/widget.html`,
    cssUrl: `${assetBase}/widget.css`,
    jsUrl: `${assetBase}/widget.client.js`,
    dieter: dieterAssets,
  };
}
