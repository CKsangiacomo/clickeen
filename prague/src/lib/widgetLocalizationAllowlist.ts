type L10nAllowlistFile = {
  v: number;
  paths: Array<{ path: string; type?: 'string' | 'richtext' }>;
};

export type WidgetLocalizationAllowlistEntry = { path: string; type: 'string' | 'richtext' };

function isRealWidgetDir(name: string): boolean {
  if (!name) return false;
  if (name.startsWith('_')) return false;
  if (name === 'shared') return false;
  return true;
}

function normalizeAllowlistEntries(entries: L10nAllowlistFile['paths']): WidgetLocalizationAllowlistEntry[] {
  return entries
    .map((entry) => {
      const normalizedType: WidgetLocalizationAllowlistEntry['type'] =
        entry?.type === 'richtext' ? 'richtext' : 'string';
      return {
        path: typeof entry?.path === 'string' ? entry.path.trim() : '',
        type: normalizedType,
      };
    })
    .filter((entry) => entry.path);
}

const TOKYO_WIDGET_L10N_GLOB = import.meta.glob('../../../tokyo/widgets/*/localization.json', { import: 'default' });
const WIDGET_L10N_LOADERS = new Map<string, () => Promise<unknown>>();

for (const [filePath, loader] of Object.entries(TOKYO_WIDGET_L10N_GLOB)) {
  const normalized = filePath.replace(/\\/g, '/');
  const marker = '/tokyo/widgets/';
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex === -1) continue;
  const rest = normalized.slice(markerIndex + marker.length);
  const parts = rest.split('/');
  if (parts.length !== 2) continue;
  const widgetType = parts[0];
  if (!isRealWidgetDir(widgetType)) continue;
  if (parts[1] !== 'localization.json') continue;
  WIDGET_L10N_LOADERS.set(widgetType, loader as () => Promise<unknown>);
}

const ALLOWLIST_CACHE = new Map<string, Promise<WidgetLocalizationAllowlistEntry[] | null>>();

export async function loadWidgetLocalizationAllowlist(widgetTypeRaw: string): Promise<WidgetLocalizationAllowlistEntry[] | null> {
  const widgetType = String(widgetTypeRaw || '').trim();
  if (!widgetType) return null;

  const cached = ALLOWLIST_CACHE.get(widgetType);
  if (cached) return cached;

  const task = (async () => {
    const loader = WIDGET_L10N_LOADERS.get(widgetType);
    if (!loader) return null;
    const json = (await loader().catch(() => null)) as L10nAllowlistFile | null;
    if (!json || json.v !== 1 || !Array.isArray(json.paths)) {
      throw new Error(`[prague] Invalid tokyo/widgets/${widgetType}/localization.json allowlist`);
    }
    return normalizeAllowlistEntries(json.paths);
  })();

  ALLOWLIST_CACHE.set(widgetType, task);
  return task;
}

export async function loadWidgetLocalizationAllowlistPaths(widgetType: string): Promise<string[] | null> {
  const allowlist = await loadWidgetLocalizationAllowlist(widgetType);
  return allowlist ? allowlist.map((entry) => entry.path) : null;
}
