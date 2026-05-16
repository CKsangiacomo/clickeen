import { validateBlockMeta, validateBlockStrings } from './blockRegistry';
import { isCompactAccountPublicId, isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';

const ACCOUNT_INSTANCE_VALIDATE =
  process.env.PRAGUE_VALIDATE_ACCOUNT_INSTANCE === '1' ||
  (process.env.NODE_ENV === 'development' && process.env.PRAGUE_VALIDATE_ACCOUNT_INSTANCE !== '0');
const ACCOUNT_INSTANCE_VALIDATE_STRICT =
  process.env.PRAGUE_VALIDATE_ACCOUNT_INSTANCE_STRICT === '1' ||
  (process.env.NODE_ENV === 'production' && process.env.PRAGUE_VALIDATE_ACCOUNT_INSTANCE === '1');
const ACCOUNT_INSTANCE_VALIDATION_CACHE = new Map<string, Promise<void>>();

function resolveVeniceBaseUrl(): string | null {
  const raw = String(process.env.PUBLIC_VENICE_URL || '').trim();
  if (raw) return raw.replace(/\/+$/, '');
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3003';
  return null;
}

async function assertAccountInstanceExists(args: { accountPublicId: string; instanceId: string; pagePath: string }): Promise<void> {
  if (!ACCOUNT_INSTANCE_VALIDATE) return;
  const baseUrl = resolveVeniceBaseUrl();
  if (!baseUrl) {
    throw new Error('[prague] Account instance validation requires PUBLIC_VENICE_URL.');
  }

  const accountPublicId = String(args.accountPublicId || '').trim();
  const instanceId = String(args.instanceId || '').trim();
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

  const cacheKey = `${accountPublicId}/${instanceId}`;
  const cached = ACCOUNT_INSTANCE_VALIDATION_CACHE.get(cacheKey);
  if (cached) return cached;

  const task = (async () => {
    const url = `${baseUrl}/widget/${encodeURIComponent(accountPublicId)}/${encodeURIComponent(instanceId)}`;
    let res: Response | null = null;
    try {
      res = await fetch(url, { method: 'GET' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const detail = message ? ` (${message})` : '';
      const warning = `[prague] ${args.pagePath}: account instance validation skipped (Venice unreachable) for ${instanceId}${detail}`;
      if (ACCOUNT_INSTANCE_VALIDATE_STRICT) throw new Error(warning);
      console.warn(warning);
      return;
    }
    if (res.ok) return;
    if (res.status !== 404) {
      throw new Error(`[prague] Account instance validation failed for ${instanceId} (${res.status})`);
    }

    const message = `[prague] ${args.pagePath}: instance ${instanceId} is not published in Venice.`;
    if (ACCOUNT_INSTANCE_VALIDATE_STRICT) throw new Error(message);
    console.warn(message);
  })();

  ACCOUNT_INSTANCE_VALIDATION_CACHE.set(cacheKey, task);
  return task;
}

async function validateAccountInstanceRefs(args: { pagePath: string; blocks: unknown[] }): Promise<void> {
  if (!ACCOUNT_INSTANCE_VALIDATE) return;
  const accountInstanceRefs = args.blocks
    .map((block) => {
      if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
      const accountInstanceRef = (block as any).accountInstanceRef;
      if (!accountInstanceRef || typeof accountInstanceRef !== 'object' || Array.isArray(accountInstanceRef)) return null;
      const accountPublicId = String((accountInstanceRef as any).accountPublicId || '').trim();
      const instanceId = String((accountInstanceRef as any).instanceId || '').trim();
      return accountPublicId || instanceId ? { accountPublicId, instanceId } : null;
    })
    .filter((value): value is { accountPublicId: string; instanceId: string } => Boolean(value));
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
const WIDGET_PAGE_LOADERS = new Map<string, () => Promise<unknown>>();
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

export async function loadWidgetPageJson(opts: { widget: string; page: string }): Promise<unknown | null> {
  const key = `${opts.widget}/${opts.page}`;
  const loader = WIDGET_PAGE_LOADERS.get(key);
  if (!loader) return null;
  return loader();
}

function buildWidgetPagePath(widget: string, page: string): string {
  return page === 'overview' ? `widgets/${widget}` : `widgets/${widget}/${page}`;
}

export async function loadWidgetPageJsonForLocale(
  opts: { widget: string; page: string; locale: string },
): Promise<unknown | null> {
  const pageJson = await loadWidgetPageJson({ widget: opts.widget, page: opts.page });
  if (!pageJson) return null;

  const pagePath = buildWidgetPagePath(opts.widget, opts.page);
  const pageFilePath = `tokyo/prague/pages/${opts.widget}/${opts.page}.json`;
  if (!pageJson || typeof pageJson !== 'object' || Array.isArray(pageJson)) {
    throw new Error(`[prague] Invalid base JSON for ${pageFilePath}`);
  }
  const baseBlocks = (pageJson as any).blocks;
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

  return { ...(pageJson as any), blocks: mergedBlocks };
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
