import { CompiledPanel } from './types';

export type RawWidget = {
  widgetname?: unknown;
  displayName?: unknown;
  itemKey?: unknown;
  defaults?: Record<string, unknown>;
  editor?: unknown;
  presets?: unknown;
  normalization?: unknown;
};

export type TooldrawerAttrs = Record<string, string>;

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function parseTooldrawerAttributes(tag: string): TooldrawerAttrs {
  const attrs: TooldrawerAttrs = {};
  // Allow hyphenated names (show-if) and properly capture quoted values that may contain the other quote type.
  const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(tag)) !== null) {
    attrs[m[1]] = m[2] ?? m[3] ?? '';
  }
  return attrs;
}

export function formatPanelLabel(id: string): string {
  if (!id) return 'Panel';
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function parsePanels(htmlLines: unknown): CompiledPanel[] {
  if (!Array.isArray(htmlLines)) {
    throw new Error('[BobCompiler] compiler expected generated editor HTML lines');
  }

  const html = htmlLines.join('\n');
  const panelRegex = /<bob-panel\s+id='([^']+)'[^>]*>([\s\S]*?)<\/bob-panel>/gi;
  const panels: CompiledPanel[] = [];
  let match: RegExpExecArray | null;

  while ((match = panelRegex.exec(html)) !== null) {
    const id = match[1];
    const panelMarkup = match[2];

    panels.push({
      id,
      label: formatPanelLabel(id),
      html: panelMarkup,
    });
  }

  if (panels.length === 0) {
    throw new Error('[BobCompiler] No <bob-panel> definitions found in generated editor HTML');
  }

  return panels;
}
