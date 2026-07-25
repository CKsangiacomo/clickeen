import type { CompiledWidgetCore } from '../types';

type DieterManifest = {
  gitSha: string;
  builtAt?: string;
  components: string[];
  componentsWithJs?: string[];
  aliases?: Record<string, string>;
  helpers?: string[];
  deps?: Record<string, string[]>;
};

export type WidgetMediaBuilder = (args: {
  widgetname: string;
  requiredUsages: Set<string>;
}) => Promise<CompiledWidgetCore['media']>;

function resolveUsageToBundleName(manifest: DieterManifest, usage: string): string | null {
  const trimmed = usage.trim();
  if (!trimmed) return null;

  if (manifest.helpers?.includes(trimmed)) return null;
  if (manifest.components.includes(trimmed)) return trimmed;

  const alias = manifest.aliases?.[trimmed];
  if (alias && manifest.components.includes(alias)) return alias;

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

export function buildWidgetMediaFromManifest(args: {
  widgetname: string;
  requiredUsages: Set<string>;
  manifest: DieterManifest;
}): CompiledWidgetCore['media'] {
  const dieterBase = '/dieter';
  const mediaBase = `/widgets/${args.widgetname}`;
  const cacheBust =
    args.manifest.gitSha && args.manifest.gitSha !== 'unknown'
      ? `?v=${encodeURIComponent(args.manifest.gitSha)}`
      : '';
  const requiredBundles = new Set<string>();
  for (const usage of args.requiredUsages) {
    const resolved = resolveUsageToBundleName(args.manifest, usage);
    if (!resolved) throw new Error(`[BobCompiler] Unknown Dieter component bundle "${usage}"`);
    requiredBundles.add(resolved);
  }
  const orderedNames = Array.from(expandBundleDeps(args.manifest, requiredBundles).add('icon')).sort();
  const jsSet = new Set(args.manifest.componentsWithJs ?? []);
  return {
    htmlUrl: `${mediaBase}/widget.html`,
    cssUrl: `${mediaBase}/widget.css`,
    jsUrl: `${mediaBase}/widget.client.js`,
    dieter: {
      styles: [
        `${dieterBase}/tokens/tokens.css${cacheBust}`,
        ...orderedNames.map((name) => `${dieterBase}/components/${name}/${name}.css${cacheBust}`),
      ],
      scripts: orderedNames
        .filter((name) => jsSet.has(name))
        .map((name) => `${dieterBase}/components/${name}/${name}.js${cacheBust}`),
    },
  };
}
