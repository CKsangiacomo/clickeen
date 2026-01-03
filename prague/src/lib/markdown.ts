import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(process.cwd(), '..');

export async function loadWidgetPageMarkdown(opts: { widget: string; page: string }): Promise<string | null> {
  const filePath = path.join(REPO_ROOT, 'tokyo', 'widgets', opts.widget, 'pages', `${opts.page}.md`);
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export async function listWidgets(): Promise<string[]> {
  const dir = path.join(REPO_ROOT, 'tokyo', 'widgets');
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

export async function listWidgetPages(widget: string): Promise<string[]> {
  const dir = path.join(REPO_ROOT, 'tokyo', 'widgets', widget, 'pages');
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name.slice(0, -3))
      .filter((slug) => slug !== 'landing')
      .sort();
  } catch {
    return [];
  }
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
