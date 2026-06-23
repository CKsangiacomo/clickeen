import { validateBlockMeta, validateBlockStrings } from './blockRegistry';
import { isCompactAccountPublicId, isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';

const ACCOUNT_INSTANCE_VALIDATE =
  process.env.PRAGUE_VALIDATE_ACCOUNT_INSTANCE === '1' ||
  (process.env.NODE_ENV === 'development' && process.env.PRAGUE_VALIDATE_ACCOUNT_INSTANCE !== '0');
const ACCOUNT_INSTANCE_VALIDATE_STRICT =
  process.env.PRAGUE_VALIDATE_ACCOUNT_INSTANCE_STRICT === '1' ||
  (process.env.NODE_ENV === 'production' && process.env.PRAGUE_VALIDATE_ACCOUNT_INSTANCE === '1');
const ACCOUNT_INSTANCE_VALIDATION_CACHE = new Map<string, Promise<void>>();
const ACCOUNT_INSTANCE_REF_KEYS = new Set(['accountPublicId', 'instanceId', 'locale']);

type AccountInstanceRef = {
  accountPublicId: string;
  instanceId: string;
  locale?: string;
};

function resolveClkLiveBaseUrl(): string {
  const raw = String(process.env.PUBLIC_CLK_LIVE_URL || '').trim();
  if (raw) return raw.replace(/\/+$/, '');
  return 'https://clk.live';
}

async function assertAccountInstanceExists(args: AccountInstanceRef & { pagePath: string }): Promise<void> {
  if (!ACCOUNT_INSTANCE_VALIDATE) return;
  const baseUrl = resolveClkLiveBaseUrl();

  const accountPublicId = String(args.accountPublicId || '').trim();
  const instanceId = String(args.instanceId || '').trim();
  const locale = String(args.locale || '').trim().toLowerCase();
  if (!isCompactAccountPublicId(accountPublicId)) {
    throw new Error(
      `[prague] ${args.pagePath}: accountInstanceRef.accountPublicId must be a PRD 099 account public id, got "${args.accountPublicId}"`,
    );
  }
  if (!isCompactInstanceId(instanceId)) {
    throw new Error(
      `[prague] ${args.pagePath}: accountInstanceRef.instanceId must be a PRD 098 compact instance id, got "${args.instanceId}"`,
    );
  }
  if (args.locale != null && !locale) {
    throw new Error(`[prague] ${args.pagePath}: accountInstanceRef.locale must be text`);
  }

  const cacheKey = `${accountPublicId}/${instanceId}/${locale || 'en'}`;
  const cached = ACCOUNT_INSTANCE_VALIDATION_CACHE.get(cacheKey);
  if (cached) return cached;

  const task = (async () => {
    const query = new URLSearchParams();
    if (locale && locale !== 'en') query.set('locale', locale);
    const queryString = query.toString();
    const publicPath = `/${encodeURIComponent(accountPublicId)}/${encodeURIComponent(instanceId)}${queryString ? `?${queryString}` : ''}`;
    const url = `${baseUrl}${publicPath}`;
    let res: Response | null = null;
    try {
      res = await fetch(url, { method: 'GET' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const detail = message ? ` (${message})` : '';
      const warning = `[prague] ${args.pagePath}: account instance validation skipped (clk.live unreachable) for ${instanceId}${queryString ? `?${queryString}` : ''}${detail}`;
      if (ACCOUNT_INSTANCE_VALIDATE_STRICT) throw new Error(warning);
      console.warn(warning);
      return;
    }
    if (res.ok) return;
    if (res.status !== 404) {
      throw new Error(`[prague] Account instance validation failed for ${instanceId} (${res.status})`);
    }

    const message = `[prague] ${args.pagePath}: instance ${instanceId}${queryString ? `?${queryString}` : ''} is not available on clk.live.`;
    if (ACCOUNT_INSTANCE_VALIDATE_STRICT) throw new Error(message);
    console.warn(message);
  })();

  ACCOUNT_INSTANCE_VALIDATION_CACHE.set(cacheKey, task);
  return task;
}

function isAccountRefContainer(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readAccountInstanceRef(args: { value: unknown; pagePath: string; path: string }): AccountInstanceRef {
  const { value, pagePath, path } = args;
  if (!isAccountRefContainer(value)) {
    throw new Error(`[prague] ${pagePath}: ${path} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!ACCOUNT_INSTANCE_REF_KEYS.has(key)) {
      throw new Error(`[prague] ${pagePath}: ${path}.${key} is not supported`);
    }
  }
  const accountPublicId = String(value.accountPublicId || '').trim();
  const instanceId = String(value.instanceId || '').trim();
  if (!accountPublicId) {
    throw new Error(`[prague] ${pagePath}: ${path}.accountPublicId is required`);
  }
  if (!instanceId) {
    throw new Error(`[prague] ${pagePath}: ${path}.instanceId is required`);
  }
  const locale = value.locale == null ? '' : String(value.locale || '').trim().toLowerCase();
  if (value.locale != null && !locale) {
    throw new Error(`[prague] ${pagePath}: ${path}.locale must be a string`);
  }
  return locale ? { accountPublicId, instanceId, locale } : { accountPublicId, instanceId };
}

function collectAccountInstanceRefs(args: {
  value: unknown;
  pagePath: string;
  path: string;
  refs: AccountInstanceRef[];
}): void {
  const { value, pagePath, path, refs } = args;
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      collectAccountInstanceRefs({
        value: entry,
        pagePath,
        path: `${path}[${index}]`,
        refs,
      }),
    );
    return;
  }
  if (!isAccountRefContainer(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (key === 'accountInstanceRef') {
      refs.push(readAccountInstanceRef({ value: entry, pagePath, path: entryPath }));
      continue;
    }
    collectAccountInstanceRefs({ value: entry, pagePath, path: entryPath, refs });
  }
}

async function validateAccountInstanceRefs(args: { pagePath: string; blocks: unknown[] }): Promise<void> {
  if (!ACCOUNT_INSTANCE_VALIDATE) return;
  const accountInstanceRefs: AccountInstanceRef[] = [];
  collectAccountInstanceRefs({
    value: args.blocks,
    pagePath: args.pagePath,
    path: 'blocks',
    refs: accountInstanceRefs,
  });
  if (accountInstanceRefs.length === 0) return;
  await Promise.all(accountInstanceRefs.map((ref) => assertAccountInstanceExists({ ...ref, pagePath: args.pagePath })));
}

function isRealWidgetDir(name: string): boolean {
  if (!name) return false;
  if (name.startsWith('_')) return false;
  if (name === 'shared') return false;
  return true;
}

const TOKYO_PRAGUE_PAGE_GLOB = import.meta.glob('../../../tokyo/prague/pages/**/*.json', { import: 'default' });
const TOKYO_PRAGUE_PAGE_TRANSLATION_GLOB = import.meta.glob('../../../tokyo/prague/pages/**/*.translations/*.json', { import: 'default' });
const WIDGET_PAGE_LOADERS = new Map<string, () => Promise<unknown>>();
const WIDGET_PAGE_TRANSLATION_LOADERS = new Map<string, () => Promise<unknown>>();
const WIDGET_SET = new Set<string>();

for (const [filePath, loader] of Object.entries(TOKYO_PRAGUE_PAGE_GLOB)) {
  const normalized = filePath.replace(/\\/g, '/');
  const marker = '/tokyo/prague/pages/';
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex === -1) continue;
  const rest = normalized.slice(markerIndex + marker.length);
  const parts = rest.split('/');
  if (parts.length < 2) continue;
  const widget = parts[0];
  if (!isRealWidgetDir(widget)) continue;
  const pageFile = parts[1];
  if (!pageFile.endsWith('.json')) continue;
  const page = pageFile.slice(0, -'.json'.length);
  const key = `${widget}/${page}`;
  WIDGET_PAGE_LOADERS.set(key, loader as () => Promise<unknown>);
  WIDGET_SET.add(widget);
}

for (const [filePath, loader] of Object.entries(TOKYO_PRAGUE_PAGE_TRANSLATION_GLOB)) {
  const normalized = filePath.replace(/\\/g, '/');
  const marker = '/tokyo/prague/pages/';
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex === -1) continue;
  const rest = normalized.slice(markerIndex + marker.length);
  const parts = rest.split('/');
  if (parts.length !== 3) continue;
  const widget = parts[0];
  if (!isRealWidgetDir(widget)) continue;
  const translationsDir = parts[1];
  const localeFile = parts[2];
  if (!translationsDir.endsWith('.translations')) continue;
  if (!localeFile.endsWith('.json')) continue;
  const page = translationsDir.slice(0, -'.translations'.length);
  const locale = localeFile.slice(0, -'.json'.length).trim().toLowerCase();
  if (!page || !locale) continue;
  WIDGET_PAGE_TRANSLATION_LOADERS.set(`${widget}/${page}/${locale}`, loader as () => Promise<unknown>);
}

export async function loadWidgetPageJson(opts: { widget: string; page: string }): Promise<unknown | null> {
  const key = `${opts.widget}/${opts.page}`;
  const loader = WIDGET_PAGE_LOADERS.get(key);
  if (!loader) return null;
  return loader();
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function setTranslatedValue(root: Record<string, unknown>, path: string, value: string): void {
  const parts = String(path || '').split('.').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3 || parts[0] !== 'blocks') {
    throw new Error(`[prague] Invalid Prague translation path: ${path}`);
  }

  const blocks = root.blocks;
  if (!Array.isArray(blocks)) throw new Error('[prague] Cannot apply Prague translation: blocks[] missing');
  const block = blocks.find((candidate) => isPlainObject(candidate) && candidate.id === parts[1]);
  if (!isPlainObject(block)) throw new Error(`[prague] Cannot apply Prague translation: block "${parts[1]}" missing`);

  let cursor: unknown = block;
  for (let i = 2; i < parts.length - 1; i += 1) {
    const segment = parts[i];
    if (Array.isArray(cursor)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= cursor.length) {
        throw new Error(`[prague] Cannot apply Prague translation: invalid array segment "${segment}" in ${path}`);
      }
      cursor = cursor[index];
      continue;
    }
    if (!isPlainObject(cursor)) {
      throw new Error(`[prague] Cannot apply Prague translation: invalid object path ${path}`);
    }
    cursor = cursor[segment];
  }

  const last = parts[parts.length - 1];
  if (Array.isArray(cursor)) {
    const index = Number(last);
    if (!Number.isInteger(index) || index < 0 || index >= cursor.length) {
      throw new Error(`[prague] Cannot apply Prague translation: invalid final array segment "${last}" in ${path}`);
    }
    cursor[index] = value;
    return;
  }
  if (!isPlainObject(cursor)) {
    throw new Error(`[prague] Cannot apply Prague translation: invalid final object path ${path}`);
  }
  cursor[last] = value;
}

async function loadPageTranslation(opts: { widget: string; page: string; locale: string }): Promise<unknown | null> {
  const locale = String(opts.locale || '').trim().toLowerCase();
  if (!locale || locale === 'en') return null;
  const loader = WIDGET_PAGE_TRANSLATION_LOADERS.get(`${opts.widget}/${opts.page}/${locale}`);
  if (!loader) {
    throw new Error(`[prague] Missing Prague page translation: tokyo/prague/pages/${opts.widget}/${opts.page}.translations/${locale}.json`);
  }
  return loader();
}

async function applyPageTranslation(
  opts: { widget: string; page: string; locale: string; pageJson: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  const translation = await loadPageTranslation(opts);
  if (!translation) return opts.pageJson;
  if (!isPlainObject(translation) || !Array.isArray(translation.ops)) {
    throw new Error(`[prague] Invalid Prague page translation: tokyo/prague/pages/${opts.widget}/${opts.page}.translations/${opts.locale}.json`);
  }
  const translated = cloneJson(opts.pageJson);
  for (const op of translation.ops) {
    if (!isPlainObject(op) || op.op !== 'set' || typeof op.path !== 'string' || typeof op.value !== 'string') {
      throw new Error(`[prague] Invalid Prague page translation op: tokyo/prague/pages/${opts.widget}/${opts.page}.translations/${opts.locale}.json`);
    }
    setTranslatedValue(translated, op.path, op.value);
  }
  return translated;
}

function buildWidgetPagePath(widget: string, page: string): string {
  return page === 'overview' ? `widgets/${widget}` : `widgets/${widget}/${page}`;
}

export async function loadWidgetPageJsonForLocale(
  opts: { widget: string; page: string; locale: string },
): Promise<unknown | null> {
  const basePageJson = await loadWidgetPageJson({ widget: opts.widget, page: opts.page });
  if (!basePageJson) return null;

  const pagePath = buildWidgetPagePath(opts.widget, opts.page);
  const pageFilePath = `tokyo/prague/pages/${opts.widget}/${opts.page}.json`;
  if (typeof basePageJson !== 'object' || Array.isArray(basePageJson)) {
    throw new Error(`[prague] Invalid base JSON for ${pageFilePath}`);
  }
  const pageJson = await applyPageTranslation({
    widget: opts.widget,
    page: opts.page,
    locale: opts.locale,
    pageJson: basePageJson as Record<string, unknown>,
  });
  const baseBlocks = pageJson.blocks;
  if (!Array.isArray(baseBlocks)) {
    throw new Error(`[prague] Missing blocks[] in ${pageFilePath}`);
  }

  await validateAccountInstanceRefs({ pagePath, blocks: baseBlocks });

  const mergedBlocks = baseBlocks.map((block: any) => {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      throw new Error(`[prague] Invalid block entry in ${pageFilePath}`);
    }
    const blockId = String(block.id || '');
    if (!blockId) throw new Error(`[prague] Missing block id in ${pageFilePath}`);
    const blockType = typeof block.type === 'string' ? block.type : '';
    if (!blockType) throw new Error(`[prague] Missing block type in ${pageFilePath}`);
    validateBlockMeta({ block: block as Record<string, unknown>, pagePath });
    const copy = block.copy;
    if (!copy || typeof copy !== 'object' || Array.isArray(copy)) {
      throw new Error(`[prague] Invalid copy for ${pagePath} block ${blockId}`);
    }
    validateBlockStrings({ blockType, strings: copy as Record<string, unknown>, pagePath, blockId });
    return { ...block, id: blockId, type: blockType, copy };
  });

  return { ...pageJson, blocks: mergedBlocks };
}

export async function loadRequiredWidgetPageJsonForLocale(
  opts: { widget: string; page: string; locale: string },
): Promise<unknown> {
  const json = await loadWidgetPageJsonForLocale(opts);
  if (!json) {
    throw new Error(`[prague] Missing tokyo/prague/pages/${opts.widget}/${opts.page}.json (required)`);
  }
  return json;
}

export async function listWidgets(): Promise<string[]> {
  return Array.from(WIDGET_SET).sort();
}

export async function listWidgetPages(widget: string): Promise<string[]> {
  if (!isRealWidgetDir(widget)) {
    throw new Error(`[prague] Invalid widget directory: ${widget}`);
  }
  // Prague subpages are a fixed product surface (no markdown scanning).
  return ['examples', 'features', 'pricing'];
}
