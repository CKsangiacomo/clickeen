import { CompiledPanel, CompiledWidget } from './types';

type RawWidget = {
  widgetname?: unknown;
  displayName?: unknown;
  defaults?: Record<string, unknown>;
  html?: unknown;
};

function formatPanelLabel(id: string): string {
  if (!id) return 'Panel';
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function parsePanels(htmlLines: unknown): { panels: CompiledPanel[]; usages: Set<string> } {
  if (!Array.isArray(htmlLines)) {
    throw new Error('[BobCompiler] widget JSON missing html array');
  }

  const html = htmlLines.join('\n');
  const panelRegex = /<bob-panel\s+id='([^']+)'[^>]*>([\s\S]*?)<\/bob-panel>/gi;
  const panels: CompiledPanel[] = [];
  const usages = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = panelRegex.exec(html)) !== null) {
    const id = match[1];
    const panelMarkup = match[2];

    // Detect Dieter components by class names in the markup (diet-<component>).
    const classRegex = /\bdiet-([a-z0-9-_]+)\b/gi;
    let classMatch: RegExpExecArray | null;
    while ((classMatch = classRegex.exec(panelMarkup)) !== null) {
      // Normalize: drop modifiers/variants like --split or __control
      const raw = classMatch[1];
      const base = raw.replace(/(--|__).*/, '');
      if (base) usages.add(base);
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

export function compileWidget(widgetJson: RawWidget): CompiledWidget {
  if (!widgetJson || typeof widgetJson !== 'object') {
    throw new Error('[BobCompiler] Invalid widget JSON payload');
  }

  const defaults = (widgetJson.defaults ?? {}) as Record<string, unknown>;

  const rawWidgetName = widgetJson.widgetname;
  const widgetname = typeof rawWidgetName === 'string' && rawWidgetName.trim() ? rawWidgetName : null;
  if (!widgetname) {
    throw new Error('[BobCompiler] widget JSON missing widgetname');
  }

  const displayName =
    (typeof widgetJson.displayName === 'string' && widgetJson.displayName.trim()) || widgetname;

  const { panels, usages } = parsePanels(widgetJson.html);

  const denverBase =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DENVER_URL) || 'http://localhost:4000';
  const denverRoot = denverBase.replace(/\/+$/, '');
  const dieterBase = `${denverRoot}/dieter`;
  const assetBase = `${denverRoot}/widgets/${widgetname}`;

  const controlTypes = Array.from(usages);
  const dieterAssets = {
    styles: controlTypes.map((t) => `${dieterBase}/components/${t}/${t}.css`),
    scripts: controlTypes.map((t) => `${dieterBase}/components/${t}/${t}.js`),
  };

  const assets = {
    htmlUrl: `${assetBase}/widget.html`,
    cssUrl: `${assetBase}/widget.css`,
    jsUrl: `${assetBase}/widget.client.js`,
    dieter: dieterAssets,
  };

  return {
    widgetname,
    displayName,
    defaults,
    panels,
    assets,
  };
}
