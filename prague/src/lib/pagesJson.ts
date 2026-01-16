import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));

export type WidgetPageJsonBlock = {
  id: string;
  type: string;
  copy: Record<string, unknown>;
  visual?: boolean;
};

export type WidgetPageJson = {
  v: 1;
  blocks: WidgetPageJsonBlock[];
};

export async function loadWidgetPageJson(opts: { widgetType: string; page: string }): Promise<WidgetPageJson | null> {
  const filePath = path.join(REPO_ROOT, 'tokyo', 'widgets', opts.widgetType, 'pages', `${opts.page}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const v = (parsed as any).v;
    const blocks = (parsed as any).blocks;
    if (v !== 1 || !Array.isArray(blocks)) return null;
    return parsed as WidgetPageJson;
  } catch (err: any) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return null;
    throw err;
  }
}

