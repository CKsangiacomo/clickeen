import { CompiledPanel } from './types';

export type RawWidget = {
  widgetname?: unknown;
  displayName?: unknown;
  itemKey?: unknown;
  defaults?: Record<string, unknown>;
  html?: unknown;
  presets?: unknown;
};

export type TooldrawerAttrs = Record<string, string>;

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

export type WidgetUsageSets = {
  required: Set<string>;
  optional: Set<string>;
};

export function collectTooldrawerTypes(markup: string, usages: WidgetUsageSets) {
  const decodeHtmlEntities = (value: string) =>
    value
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

  // Allow '>' inside quoted attribute values (e.g., template strings) and match both self-closing and open/close.
  const tdRegex =
    /<tooldrawer-field(?:-[a-z0-9-]+)?((?:[^>"']|"[^"]*"|'[^']*')*)(?:\/>|>([\s\S]*?)<\/tooldrawer-field>)/gi;
  let m: RegExpExecArray | null;
  while ((m = tdRegex.exec(markup)) !== null) {
    const attrs = parseTooldrawerAttributes(m[1]);
    if (attrs.type) usages.required.add(attrs.type);
    if (attrs.template) {
      const decoded = decodeHtmlEntities(attrs.template);
      collectTooldrawerTypes(decoded, usages);
      // Pull in class-based hints referenced inside templates.
      const classRegex = /\bdiet-([a-z0-9-_]+)\b/gi;
      let classMatch: RegExpExecArray | null;
      while ((classMatch = classRegex.exec(decoded)) !== null) {
        const raw = classMatch[1];
        const base = raw.replace(/(--|__).*/, '');
        if (base) usages.optional.add(base);
      }
    }
  }
}

export function formatPanelLabel(id: string): string {
  if (!id) return 'Panel';
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function parsePanels(htmlLines: unknown): {
  panels: CompiledPanel[];
  usages: WidgetUsageSets;
} {
  if (!Array.isArray(htmlLines)) {
    throw new Error('[BobCompiler] widget JSON missing html array');
  }

  const html = htmlLines.join('\n');
  const panelRegex = /<bob-panel\s+id='([^']+)'[^>]*>([\s\S]*?)<\/bob-panel>/gi;
  const panels: CompiledPanel[] = [];
  const usages: WidgetUsageSets = { required: new Set<string>(), optional: new Set<string>() };
  let match: RegExpExecArray | null;

  while ((match = panelRegex.exec(html)) !== null) {
    const id = match[1];
    const panelMarkup = match[2];

    collectTooldrawerTypes(panelMarkup, usages);

    const classRegex = /\bdiet-([a-z0-9-_]+)\b/gi;
    let classMatch: RegExpExecArray | null;
    while ((classMatch = classRegex.exec(panelMarkup)) !== null) {
      const raw = classMatch[1];
      const base = raw.replace(/(--|__).*/, '');
      if (base) usages.optional.add(base);
    }

    panels.push({
      id,
      label: formatPanelLabel(id),
      html: panelMarkup,
    });
  }

  if (panels.length === 0) {
    throw new Error('[BobCompiler] No <bob-panel> definitions found in widget JSON');
  }

  return { panels, usages };
}
