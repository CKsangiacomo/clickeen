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

export async function loadWidgetPageMarkdown(opts: { widget: string; page: string }): Promise<string> {
  const filePath = path.join(REPO_ROOT, 'tokyo', 'widgets', opts.widget, 'pages', `${opts.page}.md`);
  return await fs.readFile(filePath, 'utf8');
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
  const dir = path.join(TOKYO_WIDGETS_DIR, widget, 'pages');
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name.slice(0, -3))
    .filter((slug) => slug !== 'landing')
    .sort();
}

export function parseMarkdownSections(md: string): Map<string, string> {
  // Extremely small, deterministic parser:
  // - Split by `## {Heading}`
  // - Store lowercase keys with spaces collapsed.
  // - Values are raw text trimmed (markdown rendering comes later block-by-block).
  const out = new Map<string, string>();
  const normalized = md.replace(/\r\n/g, '\n');
  const parts = normalized.split(/\n##\s+/g);
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const firstNewline = part.indexOf('\n');
    const rawKey = (firstNewline >= 0 ? part.slice(0, firstNewline) : part).trim();
    const key = rawKey.toLowerCase().replace(/\s+/g, ' ');
    const value = (firstNewline >= 0 ? part.slice(firstNewline + 1) : '').trim();
    if (key) out.set(key, value);
  }
  return out;
}

export function parsePipeBullets(value: string): string[][] {
  // Deterministic list parser for our Prague markdown contract.
  // Each list item is a bullet with optional `|`-separated fields:
  // - `- A | B`
  // - `- A | B | C`
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).split('|').map((part) => part.trim()));
}
