import { CompiledPanel, CompiledWidget, ControlDescriptor } from './types';

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

function parseControls(markup: string, defaults: Record<string, unknown>): ControlDescriptor[] {
  const controls: ControlDescriptor[] = [];
  const fieldRegex = /<tooldrawer-field\s+([^>]+?)\/>/gi;
  let fieldMatch: RegExpExecArray | null;

  while ((fieldMatch = fieldRegex.exec(markup)) !== null) {
    const attrString = fieldMatch[1];
    const attrs: Record<string, string> = {};
    attrString.replace(/([a-zA-Z0-9_.-]+)='([^']*)'/g, (_full, key, value) => {
      attrs[key] = value;
      return '';
    });

    const rawType = attrs['type']?.trim();
    if (!rawType) {
      throw new Error('[BobCompiler] <tooldrawer-field> missing type attribute');
    }

    if (rawType !== 'toggle' && rawType !== 'textfield') {
      throw new Error(`[BobCompiler] Unsupported control type: ${rawType}`);
    }

    const path = attrs['path']?.trim();
    if (!path) {
      throw new Error('[BobCompiler] <tooldrawer-field> missing path attribute');
    }

    const control: ControlDescriptor = {
      key: path,
      type: rawType as ControlDescriptor['type'],
      label: attrs['label'] ?? '',
      path,
    };

    if (attrs['size'] && ['sm', 'md', 'lg'].includes(attrs['size'])) {
      control.size = attrs['size'] as ControlDescriptor['size'];
    }

    if (attrs['placeholder']) {
      control.placeholder = attrs['placeholder'];
    }

    if (attrs['show-if']) {
      control.showIf = attrs['show-if'];
    }

    if (!control.placeholder) {
      const placeholder = getValueFromDefaults(defaults, path);
      if (typeof placeholder === 'string') {
        control.placeholder = placeholder;
      }
    }

    controls.push(control);
  }

  return controls;
}

function parsePanels(htmlLines: unknown, defaults: Record<string, unknown>): CompiledPanel[] {
  if (!Array.isArray(htmlLines)) {
    throw new Error('[BobCompiler] widget JSON missing html array');
  }

  const html = htmlLines.join('\n');
  const panelRegex = /<bob-panel\s+id='([^']+)'[^>]*>([\s\S]*?)<\/bob-panel>/gi;
  const panels: CompiledPanel[] = [];
  let match: RegExpExecArray | null;

  while ((match = panelRegex.exec(html)) !== null) {
    const id = match[1];
    const panelMarkup = match[2];
    const controls = parseControls(panelMarkup, defaults);
    panels.push({
      id,
      label: formatPanelLabel(id),
      controls,
    });
  }

  if (panels.length === 0) {
    throw new Error('[BobCompiler] No <bob-panel> definitions found in widget JSON');
  }

  return panels;
}

function getValueFromDefaults(defaults: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = defaults;
  for (const segment of segments) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function compileWidget(widgetJson: RawWidget): CompiledWidget {
  if (!widgetJson || typeof widgetJson !== 'object') {
    throw new Error('[BobCompiler] Invalid widget JSON payload');
  }

  const defaults = (widgetJson.defaults ?? {}) as Record<string, unknown>;

  const rawWidgetName = widgetJson.widgetname;
  const widgetname =
    typeof rawWidgetName === 'string' && rawWidgetName.trim() ? rawWidgetName : null;
  if (!widgetname) {
    throw new Error('[BobCompiler] widget JSON missing widgetname');
  }

  const displayName =
    (typeof widgetJson.displayName === 'string' && widgetJson.displayName.trim()) ||
    widgetname;

  const panels = parsePanels(widgetJson.html, defaults);

  const denverBase =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DENVER_URL) || '';
  const assetBase = denverBase
    ? `${denverBase.replace(/\/+$/, '')}/widgets/${widgetname}`
    : `/widgets/${widgetname}`;

  const assets = {
    htmlUrl: `${assetBase}/widget.html`,
    cssUrl: `${assetBase}/widget.css`,
    jsUrl: `${assetBase}/widget.client.js`,
  };

  return {
    widgetname,
    displayName,
    defaults,
    panels,
    assets,
  };
}
