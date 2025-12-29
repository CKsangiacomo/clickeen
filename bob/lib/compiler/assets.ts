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
  if (trimmed === 'popover-host') return 'popover';

  // Button variants (`diet-btn-*`) are all styled by the `button` component, except `btn-menuactions`
  // which is a separate Dieter component bundle.
  if (trimmed === 'btn') return 'button';
  if (trimmed.startsWith('btn-')) {
    const rest = trimmed.slice('btn-'.length).trim();
    if (rest === 'menuactions') return 'menuactions';
    return 'button';
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
  requiredUsages: Set<string>;
  optionalUsages: Set<string>;
}): Promise<CompiledWidget['assets']> {
  const tokyoRoot = requireTokyoUrl().replace(/\/+$/, '');
  const dieterBase = `${tokyoRoot}/dieter`;
  const assetBase = `${tokyoRoot}/widgets/${args.widgetname}`;

  const existsCache = new Map<string, Promise<boolean>>();
  const fileExists = async (url: string) => {
    const cached = existsCache.get(url);
    if (cached) return cached;
    const promise = remoteFileExists(url);
    existsCache.set(url, promise);
    return promise;
  };

  const requiredComponentNames = Array.from(
    new Set(
      Array.from(args.requiredUsages)
        .map(normalizeDieterUsageToComponentName)
        .filter((name): name is string => Boolean(name)),
    ),
  );

  const optionalComponentNames = Array.from(
    new Set(
      Array.from(args.optionalUsages)
        .map(normalizeDieterUsageToComponentName)
        .filter((name): name is string => Boolean(name)),
    ),
  );

  const requiredNameSet = new Set(requiredComponentNames);
  const orderedNames = Array.from(new Set([...requiredComponentNames, ...optionalComponentNames]));

  const componentStyles = (
    await Promise.all(
      orderedNames.map(async (name) => {
        const url = `${dieterBase}/components/${name}/${name}.css`;
        const exists = await fileExists(url);
        if (!exists) {
          if (requiredNameSet.has(name)) {
            throw new Error(`[BobCompiler] Missing Dieter CSS for component "${name}" (${url})`);
          }
          return null;
        }
        return url;
      }),
    )
  ).filter((url): url is string => Boolean(url));

  const componentScripts = (
    await Promise.all(
      orderedNames.map(async (name) => {
        const url = `${dieterBase}/components/${name}/${name}.js`;
        const exists = await fileExists(url);
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
