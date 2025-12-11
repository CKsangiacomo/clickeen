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

function groupKeyToLabel(key: string): string {
  const map: Record<string, string> = {
    wgtappearance: 'Widget appearance',
    wgtlayout: 'Widget layout',
    podstageappearance: 'Stage/Pod appearance',
    podstagelayout: 'Stage/Pod layout',
  };
  return map[key] || key.replace(/-/g, ' ');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

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
  const eachRegex = /{{#each\s+([\w.]+)}}([\s\S]*?){{\/each}}/g;
  raw = raw.replace(eachRegex, (_, key: string, block: string) => {
    const value = context[key];
    if (!Array.isArray(value)) return '';
    return value
      .map((item: any) =>
        block.replace(/{{\s*([\w.]+)\s*}}/g, (_match, innerKey: string) => {
          if (innerKey === 'this') return item == null ? '' : String(item);
          const val = innerKey in item ? item[innerKey] : context[innerKey];
          return val == null ? '' : String(val);
        }),
      )
      .join('');
  });

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
  const objectType = attrs.objectType || attrs['object-type'] || '';
  // When a path is provided, let the runtime binding populate the value to avoid leaking template
  // handlebars (e.g., {{title}}) into the initial render.
  const value = pathAttr ? '' : attrs.value || '';
  const optionsRaw = attrs.options ? decodeHtmlEntities(attrs.options) : '';
  const headerLabel = attrs.headerLabel || '';
  const headerIcon = attrs.headerIcon || '';
  const idBase = pathAttr || label || `${component}-${size}`;
  const id = sanitizeId(`${component}-${idBase}`);
  const defaultOptions = (defaults?.context as any)?.options;
  let options = defaultOptions;
  if (attrs.options) {
    const decoded = decodeHtmlEntities(attrs.options);
    const parsed = JSON.parse(decoded);
    if (Array.isArray(parsed)) {
      options = parsed;
    }
  }

  // Process template value to inject icons before it becomes part of context
  let templateValue = attrs.template ? decodeHtmlEntities(attrs.template) : (merged.template as string) || '';
  if (templateValue) {
    templateValue = templateValue.replace(
      /<([a-z0-9-]+)([^>]*?)\sdata-icon="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi,
      (match, tag, before, iconName, after, inner) => {
        const svg = getIcon(iconName);
        if (!svg) {
          console.warn(`[BobCompiler] Missing Dieter icon "${iconName}" in template attribute`);
          return match; // Return original if icon not found
        }
        const attrs = `${before}${after}`.replace(/\sdata-icon="[^"]*"/i, '');
        return `<${tag}${attrs}>${svg}</${tag}>`;
      },
    );
  }

  Object.assign(merged, {
    label,
    placeholder,
    value,
    path: pathAttr,
    headerLabel,
    headerIcon,
    id,
    options,
    optionsRaw,
    objectType,
    addLabel: attrs.addLabel || attrs['add-label'] || (merged.addLabel as string) || 'Add item',
    labelPath: attrs.labelPath || (merged.labelPath as string) || '',
    labelInputLabel: attrs.labelInputLabel || (merged.labelInputLabel as string) || label || 'Title',
    labelPlaceholder: attrs.labelPlaceholder || (merged.labelPlaceholder as string) || '',
    labelSize: attrs.labelSize || (merged.labelSize as string) || size,
    toggleLabel: attrs.toggleLabel || (merged.toggleLabel as string) || '',
    togglePath: attrs.togglePath || (merged.togglePath as string) || '',
    template: templateValue,
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

    // Expand simple divider tag to a neutral separator
    html = html.replace(/<tooldrawer-divider\s*\/>/gi, '<div aria-hidden="true"></div>');

    // Expand simple eyebrow tag to overline text
    html = html.replace(/<tooldrawer-eyebrow([^>]*)\/>/gi, (_full, attrsRaw: string) => {
      const attrs = parseTooldrawerAttributes(attrsRaw || '');
      const text = attrs.text || '';
      return `<div class="overline" style="padding-inline: var(--control-padding-inline);">${text}</div>`;
    });

    // Allow '>' inside quoted values and handle both self-closing and open/close forms.
    const tdRegex =
      /<tooldrawer-field(?:-([a-z0-9-]+))?((?:[^>"']|"[^"]*"|'[^']*')*)(?:\/>|>([\s\S]*?)<\/tooldrawer-field>)/gi;
    html = html.replace(tdRegex, (fullMatch: string, groupKey: string | undefined, attrsRaw: string) => {
      const attrs = parseTooldrawerAttributes(attrsRaw);
      const type = attrs.type;
      if (!type) return fullMatch;
      const { template, spec } = loadComponentTemplate(type);
      const context = buildContext(type, attrs, spec);
      let rendered = renderTemplate(template, context);
      if (context.path) {
      rendered = rendered.replace(/data-path="/g, 'data-bob-path="');
      if (!/data-bob-path="/.test(rendered)) {
        rendered = rendered.replace(
          /<input([^>]*?)(\/?)>/,
          `<input$1 data-bob-path="${context.path}"$2>`,
        );
      }
    }
      usages.add(type);
      const showIf = attrs['show-if'];
      const wrappers: string[] = [];
      const shouldWrapGroup = groupKey && !['podstagelayout', 'podstageappearance'].includes(groupKey);
      if (shouldWrapGroup && groupKey) {
        const label = groupKeyToLabel(groupKey);
        wrappers.push(`data-bob-group="${groupKey}"`, `data-bob-group-label="${label}"`);
      }
      if (showIf) {
        wrappers.push(`data-bob-showif="${showIf}"`);
      }
      if (wrappers.length > 0) {
        return `<div ${wrappers.join(' ')}>${rendered}</div>`;
      }
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
  const componentAssetPath = (name: string, ext: 'css' | 'js') =>
    resolveRepoPath('denver', 'dieter', 'components', name, `${name}.${ext}`);

  const controlTypes = Array.from(parsed.usages);
  const dieterAssets = {
    styles: [
      `${dieterBase}/tokens/tokens.css`,
      ...controlTypes
        .filter((t) => fs.existsSync(componentAssetPath(t, 'css')))
        .map((t) => `${dieterBase}/components/${t}/${t}.css`),
    ],
    scripts: controlTypes
      .filter((t) => fs.existsSync(componentAssetPath(t, 'js')))
      .map((t) => `${dieterBase}/components/${t}/${t}.js`),
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
