import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBlockMeta, validateBlockStrings } from './blockRegistry';
import { loadPraguePageContent } from './pragueL10n';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const TOKYO_WIDGETS_DIR = path.join(REPO_ROOT, 'tokyo', 'widgets');

function isRealWidgetDir(name: string): boolean {
  if (!name) return false;
  if (name.startsWith('_')) return false;
  if (name === 'shared') return false;
  return true;
}

export async function loadWidgetPageJson(opts: { widget: string; page: string }): Promise<unknown | null> {
  const filePath = path.join(REPO_ROOT, 'tokyo', 'widgets', opts.widget, 'pages', `${opts.page}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch (err: any) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return null;
    throw err;
  }
}

function buildWidgetPagePath(widget: string, page: string): string {
  return page === 'overview' ? `widgets/${widget}` : `widgets/${widget}/${page}`;
}

export async function loadWidgetPageJsonForLocale(opts: { widget: string; page: string; locale: string }): Promise<unknown | null> {
  const base = await loadWidgetPageJson({ widget: opts.widget, page: opts.page });
  if (!base) return null;

  const pagePath = buildWidgetPagePath(opts.widget, opts.page);
  const localized = await loadPraguePageContent({ locale: opts.locale, pageId: pagePath });
  const blocksById = (localized as any)?.blocks;

  if (!blocksById || typeof blocksById !== 'object' || Array.isArray(blocksById)) {
    throw new Error(`[prague] Invalid localized blocks for ${pagePath}`);
  }

  if (!base || typeof base !== 'object' || Array.isArray(base)) {
    throw new Error(`[prague] Invalid base JSON for ${opts.widget}/${opts.page}`);
  }

  const baseBlocks = (base as any).blocks;
  if (!Array.isArray(baseBlocks)) {
    throw new Error(`[prague] Missing blocks[] in tokyo/widgets/${opts.widget}/pages/${opts.page}.json`);
  }

  const mergedBlocks = baseBlocks.map((block: any) => {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      throw new Error(`[prague] Invalid block entry in tokyo/widgets/${opts.widget}/pages/${opts.page}.json`);
    }
    const blockId = String(block.id || '');
    if (!blockId) throw new Error(`[prague] Missing block id in tokyo/widgets/${opts.widget}/pages/${opts.page}.json`);
    const blockType = typeof block.type === 'string' ? block.type : '';
    if (!blockType) throw new Error(`[prague] Missing block type in tokyo/widgets/${opts.widget}/pages/${opts.page}.json`);
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

  return { ...(base as any), blocks: mergedBlocks };
}

export async function loadRequiredWidgetPageJsonForLocale(opts: { widget: string; page: string; locale: string }): Promise<unknown> {
  const json = await loadWidgetPageJsonForLocale(opts);
  if (!json) {
    throw new Error(`[prague] Missing tokyo/widgets/${opts.widget}/pages/${opts.page}.json (required)`);
  }
  return json;
}

export async function listWidgets(): Promise<string[]> {
  const entries = await fs.readdir(TOKYO_WIDGETS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter(isRealWidgetDir)
    .sort();
}

export async function listWidgetPages(widget: string): Promise<string[]> {
  if (!isRealWidgetDir(widget)) {
    throw new Error(`[prague] Invalid widget directory: ${widget}`);
  }
  // Prague subpages are a fixed product surface (no markdown scanning).
  return ['templates', 'examples', 'features', 'pricing'];
}
