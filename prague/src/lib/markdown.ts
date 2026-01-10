import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

export async function loadWidgetPageJsonForLocale(opts: { widget: string; page: string; locale: string }): Promise<unknown | null> {
  if (!opts.locale || opts.locale === 'en') {
    return await loadWidgetPageJson({ widget: opts.widget, page: opts.page });
  }
  const filePath = path.join(
    REPO_ROOT,
    'tokyo',
    'widgets',
    opts.widget,
    'pages',
    '.locales',
    opts.locale,
    `${opts.page}.json`,
  );
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch (err: any) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      // Locale overrides are optional; fall back to the canonical (en) page JSON.
      return await loadWidgetPageJson({ widget: opts.widget, page: opts.page });
    }
    throw err;
  }
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
