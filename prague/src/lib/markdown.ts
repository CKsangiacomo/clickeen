import { validateBlockMeta, validateBlockStrings } from './blockRegistry';
import { isCuratedWidgetPublicId } from '@clickeen/ck-contracts';
import { loadPraguePageContent, loadPraguePageContentWithMeta, type PragueOverlayContext, type PragueOverlayMeta } from './pragueL10n';

const CURATED_VALIDATE =
  process.env.PRAGUE_VALIDATE_CURATED === '1' ||
  (process.env.NODE_ENV === 'development' && process.env.PRAGUE_VALIDATE_CURATED !== '0');
const CURATED_VALIDATE_STRICT =
  process.env.PRAGUE_VALIDATE_CURATED_STRICT === '1' ||
  (process.env.NODE_ENV === 'production' && process.env.PRAGUE_VALIDATE_CURATED === '1');
const CURATED_VALIDATION_CACHE = new Map<string, Promise<void>>();

function buildPageBase(args: { pageId: string; pagePath: string; blocks: unknown[] }) {
  const baseBlocks: Record<string, { copy: Record<string, unknown> }> = {};
  for (const block of args.blocks) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      throw new Error(`[prague] Invalid block entry in ${args.pagePath}`);
    }
    const blockId = String((block as any).id || '').trim();
    if (!blockId) {
      throw new Error(`[prague] Missing block id in ${args.pagePath}`);
    }
    const copy = (block as any).copy;
    if (!copy || typeof copy !== 'object' || Array.isArray(copy)) {
      throw new Error(`[prague] NOT TRANSLATED: ${args.pagePath} block "${blockId}" missing copy`);
    }
    baseBlocks[blockId] = { copy: copy as Record<string, unknown> };
  }
  return { v: 1, pageId: args.pageId, blocks: baseBlocks };
}

function resolveParisBaseUrl(): string | null {
  const raw = String(process.env.PUBLIC_PARIS_URL || process.env.PARIS_BASE_URL || '').trim();
  if (raw) return raw.replace(/\/+$/, '');
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3001';
  return null;
}

async function assertCuratedInstanceExists(args: { publicId: string; pagePath: string }): Promise<void> {
  if (!CURATED_VALIDATE) return;
  const baseUrl = resolveParisBaseUrl();
  if (!baseUrl) {
    throw new Error('[prague] Curated validation requires PUBLIC_PARIS_URL (or PARIS_BASE_URL).');
  }

  const publicId = args.publicId;
  if (!isCuratedWidgetPublicId(publicId)) {
    throw new Error(
      `[prague] ${args.pagePath}: curatedRef.publicId must match wgt_curated_[a-z0-9][a-z0-9_-]*, got "${publicId}"`,
    );
  }

  const cached = CURATED_VALIDATION_CACHE.get(publicId);
  if (cached) return cached;

  const task = (async () => {
    const url = `${baseUrl}/api/instance/${encodeURIComponent(publicId)}`;
    let res: Response | null = null;
    try {
      res = await fetch(url, { method: 'GET' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const detail = message ? ` (${message})` : '';
      const warning = `[prague] ${args.pagePath}: curated validation skipped (Paris unreachable) for ${publicId}${detail}`;
      if (CURATED_VALIDATE_STRICT) throw new Error(warning);
      console.warn(warning);
      return;
    }
    if (res.ok) return;
    if (res.status !== 404) {
      throw new Error(`[prague] Curated validation failed for ${publicId} (${res.status})`);
    }

    const devToken = String(process.env.PARIS_DEV_JWT || '').trim();
    if (devToken) {
      let devRes: Response | null = null;
      try {
        devRes = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${devToken}` } });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const detail = message ? ` (${message})` : '';
        const warning = `[prague] ${args.pagePath}: curated validation skipped (Paris unreachable) for ${publicId}${detail}`;
        if (CURATED_VALIDATE_STRICT) throw new Error(warning);
        console.warn(warning);
        return;
      }
      if (devRes.ok) {
        const payload = await devRes.json().catch(() => null);
        const status = payload && typeof payload.status === 'string' ? payload.status : 'unpublished';
        const message = `[prague] ${args.pagePath}: curated instance ${publicId} is ${status}; publish it before embedding.`;
        if (CURATED_VALIDATE_STRICT) throw new Error(message);
        console.warn(message);
        return;
      }
      if (devRes.status !== 404) {
        throw new Error(`[prague] Curated validation failed for ${publicId} (${devRes.status})`);
      }
    }

    const message = `[prague] ${args.pagePath}: curated instance ${publicId} not found (seed curated_widget_instances or apply migrations).`;
    if (CURATED_VALIDATE_STRICT) throw new Error(message);
    console.warn(message);
  })();

  CURATED_VALIDATION_CACHE.set(publicId, task);
  return task;
}

async function validateCuratedRefs(args: { pagePath: string; blocks: unknown[] }): Promise<void> {
  if (!CURATED_VALIDATE) return;
  const curatedIds = args.blocks
    .map((block) => {
      if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
      const curatedRef = (block as any).curatedRef;
      if (!curatedRef || typeof curatedRef !== 'object' || Array.isArray(curatedRef)) return null;
      const publicId = String((curatedRef as any).publicId || '').trim();
      return publicId ? publicId : null;
    })
    .filter((value): value is string => Boolean(value));
  if (curatedIds.length === 0) return;
  await Promise.all(curatedIds.map((publicId) => assertCuratedInstanceExists({ publicId, pagePath: args.pagePath })));
}

function isRealWidgetDir(name: string): boolean {
  if (!name) return false;
  if (name.startsWith('_')) return false;
  if (name === 'shared') return false;
  return true;
}

const TOKYO_WIDGET_PAGE_GLOB = import.meta.glob('../../../tokyo/widgets/**/pages/*.json', { import: 'default' });
const WIDGET_PAGE_LOADERS = new Map<string, () => Promise<unknown>>();
const WIDGET_SET = new Set<string>();

for (const [filePath, loader] of Object.entries(TOKYO_WIDGET_PAGE_GLOB)) {
  const normalized = filePath.replace(/\\/g, '/');
  const marker = '/tokyo/widgets/';
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex === -1) continue;
  const rest = normalized.slice(markerIndex + marker.length);
  const parts = rest.split('/');
  if (parts.length < 3) continue;
  if (parts[1] !== 'pages') continue;
  const widget = parts[0];
  if (!isRealWidgetDir(widget)) continue;
  const pageFile = parts[2];
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
  opts: { widget: string; page: string; locale: string } & PragueOverlayContext,
): Promise<unknown | null> {
  const pageJson = await loadWidgetPageJson({ widget: opts.widget, page: opts.page });
  if (!pageJson) return null;

  const pagePath = buildWidgetPagePath(opts.widget, opts.page);
  const pageFilePath = `tokyo/widgets/${opts.widget}/pages/${opts.page}.json`;
  if (!pageJson || typeof pageJson !== 'object' || Array.isArray(pageJson)) {
    throw new Error(`[prague] Invalid base JSON for ${pageFilePath}`);
  }
  const baseBlocks = (pageJson as any).blocks;
  if (!Array.isArray(baseBlocks)) {
    throw new Error(`[prague] Missing blocks[] in ${pageFilePath}`);
  }
  const base = buildPageBase({ pageId: pagePath, pagePath: pageFilePath, blocks: baseBlocks });
  const localized = await loadPraguePageContent({
    locale: opts.locale,
    pageId: pagePath,
    base,
    country: opts.country,
    layerContext: opts.layerContext,
  });
  const blocksById = (localized as any)?.blocks;

  if (!blocksById || typeof blocksById !== 'object' || Array.isArray(blocksById)) {
    throw new Error(`[prague] Invalid localized blocks for ${pagePath}`);
  }

  await validateCuratedRefs({ pagePath, blocks: baseBlocks });

  const mergedBlocks = baseBlocks.map((block: any) => {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      throw new Error(`[prague] Invalid block entry in ${pageFilePath}`);
    }
    const blockId = String(block.id || '');
    if (!blockId) throw new Error(`[prague] Missing block id in ${pageFilePath}`);
    const blockType = typeof block.type === 'string' ? block.type : '';
    if (!blockType) throw new Error(`[prague] Missing block type in ${pageFilePath}`);
    validateBlockMeta({ block: block as Record<string, unknown>, pagePath });
    const compiledBlock = blocksById[blockId];
    if (!compiledBlock || typeof compiledBlock !== 'object') {
      throw new Error(`[prague] Missing localized copy for ${pagePath} block ${blockId}`);
    }
    const copy = (compiledBlock as any).copy;
    if (!copy || typeof copy !== 'object' || Array.isArray(copy)) {
      throw new Error(`[prague] Invalid localized copy for ${pagePath} block ${blockId}`);
    }
    validateBlockStrings({ blockType, strings: copy as Record<string, unknown>, pagePath, blockId });
    return { ...block, id: blockId, type: blockType, copy };
  });

  return { ...(pageJson as any), blocks: mergedBlocks };
}

export async function loadWidgetPageJsonForLocaleWithOverlayMeta(
  opts: { widget: string; page: string; locale: string } & PragueOverlayContext,
): Promise<{ json: unknown; overlay: PragueOverlayMeta } | null> {
  const pageJson = await loadWidgetPageJson({ widget: opts.widget, page: opts.page });
  if (!pageJson) return null;

  const pagePath = buildWidgetPagePath(opts.widget, opts.page);
  const pageFilePath = `tokyo/widgets/${opts.widget}/pages/${opts.page}.json`;
  if (!pageJson || typeof pageJson !== 'object' || Array.isArray(pageJson)) {
    throw new Error(`[prague] Invalid base JSON for ${pageFilePath}`);
  }
  const baseBlocks = (pageJson as any).blocks;
  if (!Array.isArray(baseBlocks)) {
    throw new Error(`[prague] Missing blocks[] in ${pageFilePath}`);
  }
  const base = buildPageBase({ pageId: pagePath, pagePath: pageFilePath, blocks: baseBlocks });
  const { content: localized, meta } = await loadPraguePageContentWithMeta({
    locale: opts.locale,
    pageId: pagePath,
    base,
    country: opts.country,
    layerContext: opts.layerContext,
  });
  const blocksById = (localized as any)?.blocks;

  if (!blocksById || typeof blocksById !== 'object' || Array.isArray(blocksById)) {
    throw new Error(`[prague] Invalid localized blocks for ${pagePath}`);
  }

  await validateCuratedRefs({ pagePath, blocks: baseBlocks });

  const mergedBlocks = baseBlocks.map((block: any) => {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      throw new Error(`[prague] Invalid block entry in ${pageFilePath}`);
    }
    const blockId = String(block.id || '');
    if (!blockId) throw new Error(`[prague] Missing block id in ${pageFilePath}`);
    const blockType = typeof block.type === 'string' ? block.type : '';
    if (!blockType) throw new Error(`[prague] Missing block type in ${pageFilePath}`);
    validateBlockMeta({ block: block as Record<string, unknown>, pagePath });
    const compiledBlock = blocksById[blockId];
    if (!compiledBlock || typeof compiledBlock !== 'object') {
      throw new Error(`[prague] Missing localized copy for ${pagePath} block ${blockId}`);
    }
    const copy = (compiledBlock as any).copy;
    if (!copy || typeof copy !== 'object' || Array.isArray(copy)) {
      throw new Error(`[prague] Invalid localized copy for ${pagePath} block ${blockId}`);
    }
    validateBlockStrings({ blockType, strings: copy as Record<string, unknown>, pagePath, blockId });
    return { ...block, id: blockId, type: blockType, copy };
  });

  return { json: { ...(pageJson as any), blocks: mergedBlocks }, overlay: meta };
}

export async function loadRequiredWidgetPageJsonForLocaleWithOverlayMeta(
  opts: { widget: string; page: string; locale: string } & PragueOverlayContext,
): Promise<{ json: unknown; overlay: PragueOverlayMeta }> {
  const result = await loadWidgetPageJsonForLocaleWithOverlayMeta(opts);
  if (!result) {
    throw new Error(`[prague] Missing tokyo/widgets/${opts.widget}/pages/${opts.page}.json (required)`);
  }
  return result;
}

export async function loadRequiredWidgetPageJsonForLocale(
  opts: { widget: string; page: string; locale: string } & PragueOverlayContext,
): Promise<unknown> {
  const json = await loadWidgetPageJsonForLocale(opts);
  if (!json) {
    throw new Error(`[prague] Missing tokyo/widgets/${opts.widget}/pages/${opts.page}.json (required)`);
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
  return ['templates', 'examples', 'features', 'pricing'];
}
