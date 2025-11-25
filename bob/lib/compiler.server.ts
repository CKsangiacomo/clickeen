import fs from 'node:fs';
import path from 'node:path';
import { CompiledPanel, CompiledWidget } from './types';
import { RawWidget, TooldrawerAttrs, parseTooldrawerAttributes, parsePanels } from './compiler.shared';
import { getIcon } from './icons';

function resolveRepoPath(...segments: string[]) {
  const cwd = process.cwd();
  const direct = path.join(cwd, ...segments);
  if (fs.existsSync(direct)) return direct;
  return path.join(cwd, '..', ...segments);
}

type ComponentSpec = {
  defaults?: Array<{
    context?: Record<string, unknown>;
    sizeContext?: Record<string, Record<string, unknown>>;
  }>;
};

function loadComponentTemplate(type: string): { template: string; spec?: ComponentSpec } {
  const base = resolveRepoPath('denver', 'dieter', 'components', type);
  const htmlPath = path.join(base, `${type}.html`);
  const specPath = path.join(base, `${type}.spec.json`);

  if (!fs.existsSync(htmlPath)) {
    throw new Error(`[BobCompiler] Missing template for component ${type} at ${htmlPath}`);
  }
  const template = fs.readFileSync(htmlPath, 'utf8');
  let spec: ComponentSpec | undefined;
  if (fs.existsSync(specPath)) {
    spec = JSON.parse(fs.readFileSync(specPath, 'utf8')) as ComponentSpec;
  }
  return { template, spec };
}

function renderTemplate(raw: string, context: Record<string, unknown>): string {
  const ifElseRegex = /{{#if\s+([\w.]+)}}([\s\S]*?)(?:{{else}}([\s\S]*?))?{{\/if}}/g;
  let rendered = raw.replace(ifElseRegex, (_, key: string, truthy: string, falsy: string | undefined) => {
    const value = context[key];
    const block = value ? truthy : falsy;
    return block ? block : '';
  });

  rendered = rendered.replace(/{{\s*([^#\/][^}\s]+)\s*}}/g, (_, key: string) => {
    const value = context[key];
    return value == null ? '' : String(value);
  });

  // Inline icons server-side so client doesn't need to hydrate data-icon placeholders.
  rendered = rendered.replace(
    /<([a-z0-9-]+)([^>]*?)\sdata-icon="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, tag, before, iconName, after, inner) => {
      const svg = getIcon(iconName);
      if (!svg) {
        throw new Error(`[BobCompiler] Missing Dieter icon "${iconName}" while expanding component markup`);
      }
      const attrs = `${before}${after}`.replace(/\sdata-icon="[^"]*"/i, '');
      return `<${tag}${attrs}>${svg}</${tag}>`;
    },
  );

  return rendered;
}

function sanitizeId(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-');
}

function buildContext(component: string, attrs: TooldrawerAttrs, spec?: ComponentSpec): Record<string, unknown> {
  const defaults = spec?.defaults?.[0];
  const size = attrs.size || (defaults?.context?.size as string) || 'md';

  const merged: Record<string, unknown> = {
    ...(defaults?.context ?? {}),
    ...(defaults?.sizeContext?.[size] ?? {}),
    size,
  };

  const label = attrs.label || (merged.label as string) || 'Label';
  const placeholder = attrs.placeholder || (merged.placeholder as string) || 'Select a fill';
  const pathAttr = attrs.path || '';
  const value = attrs.value || '';
  const headerLabel = attrs.headerLabel || '';
  const headerIcon = attrs.headerIcon || '';
  const idBase = pathAttr || label || `${component}-${size}`;
  const id = sanitizeId(`${component}-${idBase}`);

  Object.assign(merged, {
    label,
    placeholder,
    value,
    path: pathAttr,
    headerLabel,
    headerIcon,
    id,
  });

  if (merged.labelClass == null) merged.labelClass = 'label-s';
  if (merged.bodyClass == null) merged.bodyClass = 'body-s';
  if (merged.popoverLabel == null) merged.popoverLabel = placeholder || label;

  return merged;
}

export function compileWidgetServer(widgetJson: RawWidget): CompiledWidget {
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

  const parsed = parsePanels(widgetJson.html);

  const panels: CompiledPanel[] = parsed.panels.map((panel) => {
    const usages = new Set<string>();
    let html = panel.html;

    const tdRegex = /<tooldrawer-field([^>]*)\/>/gi;
    html = html.replace(tdRegex, (fullMatch: string, attrsRaw: string) => {
      const attrs = parseTooldrawerAttributes(attrsRaw);
      const type = attrs.type;
      if (!type) return fullMatch;
      const { template, spec } = loadComponentTemplate(type);
      const context = buildContext(type, attrs, spec);
      let rendered = renderTemplate(template, context);
      if (context.path) {
        rendered = rendered.replace(/data-path="/g, 'data-bob-path="');
        if (!/data-bob-path="/.test(rendered)) {
          rendered = rendered.replace(/<input([^>]*?)>/, `<input$1 data-bob-path="${context.path}">`);
        }
      }
      usages.add(type);
      return rendered;
    });

    // Also collect usages from rendered markup
    const classRegex = /\bdiet-([a-z0-9-_]+)\b/gi;
    let classMatch: RegExpExecArray | null;
    while ((classMatch = classRegex.exec(html)) !== null) {
      const raw = classMatch[1];
      const base = raw.replace(/(--|__).*/, '');
      if (base) usages.add(base);
    }

    parsed.usages.forEach((u) => usages.add(u));

    return {
      id: panel.id,
      label: panel.label,
      html,
    };
  });

  const denverBase =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DENVER_URL) || 'http://localhost:4000';
  const denverRoot = denverBase.replace(/\/+$/, '');
  const dieterBase = `${denverRoot}/dieter`;
  const assetBase = `${denverRoot}/widgets/${widgetname}`;

  const controlTypes = Array.from(parsed.usages);
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
