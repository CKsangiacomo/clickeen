// Tiny idempotent loader for Dieter drawer CSS assets.
// Accepts abstract asset names (matches component css filenames) and injects <link> once per asset.

const LOADED_KEY = '__dieterCssLoaded';

function getLoadedSet(): Set<string> {
  const w = globalThis as any;
  if (!w[LOADED_KEY]) w[LOADED_KEY] = new Set<string>();
  return w[LOADED_KEY] as Set<string>;
}

export function loadDieterCss(assets: Iterable<string> | undefined | null) {
  if (!assets) return;
  const loaded = getLoadedSet();
  for (const name of assets) {
    const key = String(name).trim();
    if (!key || loaded.has(key)) continue;
    const href = `/dieter/components/${key}.css`;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.dieter = key;
    document.head.appendChild(link);
    loaded.add(key);
  }
}

