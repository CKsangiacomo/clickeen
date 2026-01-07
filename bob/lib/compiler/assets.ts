import type { CompiledWidget } from '../types';
import { resolveTokyoBaseUrl } from '../env/tokyo';

export function requireTokyoUrl(): string {
  return resolveTokyoBaseUrl();
}

type DieterManifest = {
  v: number;
  gitSha: string;
  builtAt?: string;
  components: string[];
  componentsWithJs?: string[];
  aliases?: Record<string, string>;
  helpers?: string[];
  deps?: Record<string, string[]>;
};

const dieterManifestCache = new Map<string, Promise<DieterManifest>>();

async function loadDieterManifest(tokyoRoot: string): Promise<DieterManifest> {
  const url = `${tokyoRoot.replace(/\/+$/, '')}/dieter/manifest.json`;
  const shouldCache = process.env.NODE_ENV !== 'development';
  if (shouldCache) {
    const cached = dieterManifestCache.get(url);
    if (cached) return cached;
  }

  const promise = (async () => {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`[BobCompiler] Failed to load Dieter manifest (${res.status}) ${url}`);
    }
    const json = (await res.json()) as DieterManifest;
    if (!json || typeof json !== 'object' || !Array.isArray(json.components)) {
      throw new Error(`[BobCompiler] Invalid Dieter manifest ${url}`);
    }
    return json;
  })();

  if (shouldCache) dieterManifestCache.set(url, promise);
  return promise;
}

function resolveUsageToBundleName(manifest: DieterManifest, usage: string): string | null {
  const trimmed = usage.trim();
  if (!trimmed) return null;

  if (manifest.helpers?.includes(trimmed)) return null;
  if (manifest.components.includes(trimmed)) return trimmed;

  const alias = manifest.aliases?.[trimmed];
  if (alias && manifest.components.includes(alias)) return alias;

  // Back-compat for historical usage tokens (prefer explicit `aliases` in manifest).
  if (trimmed === 'btn' && manifest.components.includes('button')) return 'button';
  if (trimmed.startsWith('btn-') && manifest.components.includes('button')) {
    if (trimmed === 'btn-menuactions' && manifest.components.includes('menuactions')) return 'menuactions';
    return 'button';
  }
  if (trimmed === 'popover-host' && manifest.components.includes('popover')) return 'popover';
  if (trimmed.startsWith('dropdown-header')) return null;

  return null;
}

function expandBundleDeps(manifest: DieterManifest, roots: Set<string>): Set<string> {
  const out = new Set<string>(roots);
  const queue = Array.from(roots);
  const deps = manifest.deps ?? {};

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const children = deps[current] ?? [];
    for (const child of children) {
      if (!out.has(child)) {
        out.add(child);
        queue.push(child);
      }
    }
  }

  return out;
}

export async function buildWidgetAssets(args: {
  widgetname: string;
  requiredUsages: Set<string>;
  optionalUsages: Set<string>;
}): Promise<CompiledWidget['assets']> {
  const tokyoRoot = requireTokyoUrl().replace(/\/+$/, '');
  // Serve widget + Dieter assets through Bob so the preview iframe runs same-origin.
  // This enables in-memory `blob:` URLs (locked editor contract) to render inside the preview.
  const dieterBase = `/dieter`;
  const assetBase = `/widgets/${args.widgetname}`;

  const manifest = await loadDieterManifest(tokyoRoot);
  const cacheBust = manifest.gitSha && manifest.gitSha !== 'unknown' ? `?v=${encodeURIComponent(manifest.gitSha)}` : '';

  const requiredBundles = new Set<string>();
  for (const usage of args.requiredUsages) {
    const resolved = resolveUsageToBundleName(manifest, usage);
    if (!resolved) {
      throw new Error(`[BobCompiler] Unknown Dieter component bundle "${usage}" (see ${tokyoRoot}/dieter/manifest.json)`);
    }
    requiredBundles.add(resolved);
  }

  const bundlesWithDeps = expandBundleDeps(manifest, requiredBundles);

  // Optional hints (derived from markup classnames) are constrained by the manifest; they cannot invent new bundles.
  // Prefer explicit `deps` in the manifest over expanding this.
  for (const usage of args.optionalUsages) {
    const resolved = resolveUsageToBundleName(manifest, usage);
    if (resolved) bundlesWithDeps.add(resolved);
  }

  const orderedNames = Array.from(bundlesWithDeps).sort();
  const jsSet = new Set(manifest.componentsWithJs ?? []);

  const componentStyles = orderedNames.map((name) => `${dieterBase}/components/${name}/${name}.css${cacheBust}`);
  const componentScripts = orderedNames
    .filter((name) => jsSet.has(name))
    .map((name) => `${dieterBase}/components/${name}/${name}.js${cacheBust}`);

  const dieterAssets = {
    styles: [`${dieterBase}/tokens/tokens.css${cacheBust}`, ...componentStyles],
    scripts: componentScripts,
  };

  return {
    htmlUrl: `${assetBase}/widget.html`,
    cssUrl: `${assetBase}/widget.css`,
    jsUrl: `${assetBase}/widget.client.js`,
    dieter: dieterAssets,
  };
}
