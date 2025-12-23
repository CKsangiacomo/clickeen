import fs from 'node:fs';
import path from 'node:path';
import { CompiledControl, CompiledControlOption, CompiledPanel, CompiledWidget, ControlKind } from './types';
import { RawWidget, TooldrawerAttrs, parseTooldrawerAttributes, parsePanels } from './compiler.shared';
import { getIcon } from './icons';
import { buildTypographyPanel } from './modules/typography';
import { buildStagePodPanelFields } from './modules/stagePod';
import { getAt } from './utils/paths';

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

const TOKEN_SEGMENT = /^__[^.]+__$/;

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

function parseControlOptions(attrs: TooldrawerAttrs): CompiledControlOption[] | undefined {
  if (!attrs.options) return undefined;
  try {
    const decoded = decodeHtmlEntities(attrs.options);
    const parsed = JSON.parse(decoded) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const options = parsed
      .map((opt) => {
        if (!opt || typeof opt !== 'object') return null;
        const label = 'label' in opt ? String((opt as any).label) : '';
        const value = 'value' in opt ? String((opt as any).value) : '';
        if (!label && !value) return null;
        return { label, value };
      })
      .filter((opt): opt is CompiledControlOption => Boolean(opt));
    return options.length ? options : undefined;
  } catch {
    return undefined;
  }
}

function samplePathForDefaults(pathPattern: string): string {
  const segments = pathPattern.split('.').filter(Boolean);
  return segments.map((segment) => (TOKEN_SEGMENT.test(segment) ? '0' : segment)).join('.');
}

function inferControlMetadata(control: CompiledControl, defaults: Record<string, unknown>): {
  kind: ControlKind;
  enumValues?: string[];
  itemIdPath?: string;
} {
  if (control.options && control.options.length > 0) {
    const enumValues = Array.from(new Set(control.options.map((o) => o.value).filter(Boolean)));
    return { kind: 'enum', enumValues: enumValues.length ? enumValues : undefined };
  }

  if (control.type === 'toggle') return { kind: 'boolean' };
  if (control.type === 'slider') return { kind: 'number' };
  if (control.type === 'dropdown-fill') return { kind: 'color' };
  const samplePath = samplePathForDefaults(control.path);
  const sample = getAt<unknown>(defaults, samplePath);

  if (control.type === 'repeater' || control.type === 'object-manager') {
    const itemIdPath =
      control.type === 'object-manager'
        ? 'id'
        : Array.isArray(sample) && sample.some((item) => item && typeof item === 'object' && !Array.isArray(item))
          ? 'id'
          : undefined;
    return { kind: 'array', itemIdPath };
  }
  if (typeof sample === 'boolean') return { kind: 'boolean' };
  if (typeof sample === 'number') return { kind: 'number' };
  if (typeof sample === 'string') return { kind: 'string' };
  if (Array.isArray(sample)) return { kind: 'array' };
  if (sample && typeof sample === 'object') return { kind: 'object' };

  return { kind: 'unknown' };
}

function collectControlsFromMarkup(markup: string, panelId: string, controls: CompiledControl[]) {
  // Allow '>' inside quoted attribute values (e.g., template strings) and match both self-closing and open/close.
  const tdRegex =
    /<tooldrawer-field(?:-([a-z0-9-]+))?((?:[^>"']|"[^"]*"|'[^']*')*)(?:\/>|>([\s\S]*?)<\/tooldrawer-field>)/gi;
  let match: RegExpExecArray | null;

  while ((match = tdRegex.exec(markup)) !== null) {
    const groupId = match[1];
    const attrsRaw = match[2] || '';
    const inner = match[3];
    const attrs = parseTooldrawerAttributes(attrsRaw);
    const type = attrs.type;
    const path = attrs.path;
    const addDerivedPath = (candidate: string | undefined) => {
      if (!candidate) return;
      const trimmed = candidate.trim();
      if (!trimmed) return;
      // Heuristic: only treat as a path if it looks like dot-notation or tokenized paths.
      if (!trimmed.includes('.') && !/__[^.]+__/.test(trimmed)) return;
      controls.push({
        panelId,
        type: 'field',
        path: trimmed,
      });
    };

    if (type && path) {
      const min = parseNumberAttr(attrs.min);
      const max = parseNumberAttr(attrs.max);
      controls.push({
        panelId,
        groupId,
        groupLabel: groupId ? groupKeyToLabel(groupId) : undefined,
        type,
        path,
        label: attrs.label,
        showIf: attrs['show-if'],
        options: parseControlOptions(attrs),
        min,
        max,
      });
      addDerivedPath(attrs.labelPath);
      addDerivedPath(attrs.reorderLabelPath || attrs['reorder-label-path']);
    }

    if (attrs.template) {
      const decodedTemplate = decodeHtmlEntities(attrs.template);
      collectControlsFromMarkup(decodedTemplate, panelId, controls);
    }
    if (inner) {
      collectControlsFromMarkup(inner, panelId, controls);
    }
  }

  // Some widgets embed editable paths directly in the component template markup (e.g. repeater item bodies).
  const bobPathRegex = /data-bob-path=(?:"([^"]+)"|'([^']+)')/gi;
  let bobMatch: RegExpExecArray | null;
  while ((bobMatch = bobPathRegex.exec(markup)) !== null) {
    const path = bobMatch[1] || bobMatch[2];
    if (!path) continue;
    controls.push({
      panelId,
      type: 'field',
      path,
    });
  }
}

function parseBooleanAttr(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function parseNumberAttr(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : undefined;
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
  const resolveKey = (key: string, stack: Array<Record<string, unknown>>): unknown => {
    let remaining = key;
    let upLevels = 0;
    while (remaining.startsWith('../')) {
      upLevels += 1;
      remaining = remaining.slice(3);
    }
    const segments = remaining.split('.').filter(Boolean);
    let ctxIndex = stack.length - 1 - upLevels;
    if (ctxIndex < 0) return undefined;
    let value: any = stack[ctxIndex];
    for (let i = 0; i < segments.length; i += 1) {
      if (value == null) return undefined;
      value = value[segments[i]];
    }
    return value;
  };

  const renderBlock = (input: string, stack: Array<Record<string, unknown>>): string => {
    const eachRegex = /{{#each\s+([^\s}]+)}}([\s\S]*?){{\/each}}/g;
    input = input.replace(eachRegex, (_, key: string, block: string) => {
      const value = resolveKey(key, stack);
      if (!Array.isArray(value)) return '';
      return value
        .map((item: any) => renderBlock(block, [...stack, typeof item === 'object' ? item : { this: item }]))
        .join('');
    });

    const ifElseRegex = /{{#if\s+([^\s}]+)}}([\s\S]*?)(?:{{else}}([\s\S]*?))?{{\/if}}/g;
    input = input.replace(ifElseRegex, (_, key: string, truthy: string, falsy: string | undefined) => {
      const value = resolveKey(key, stack);
      const block = value ? truthy : falsy;
      return block ? renderBlock(block, stack) : '';
    });

    input = input.replace(/{{\s*([^#\/][^}\s]+)\s*}}/g, (_, key: string) => {
      const value = resolveKey(key, stack);
      return value == null ? '' : String(value);
    });

    return input;
  };

  let rendered = renderBlock(raw, [context]);

  // Inline icons server-side so client doesn't need to hydrate data-icon placeholders.
  rendered = rendered.replace(
    /<([a-z0-9-]+)([^>]*?)\sdata-icon="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, tag, before, iconName, after) => {
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
  const indexToken =
    attrs.indexToken || attrs['index-token'] || attrs['data-index-token'] || '__INDEX__';

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
  let headerLabel = attrs.headerLabel || '';
  const headerIcon = attrs.headerIcon || '';
  const reorderLabel =
    attrs.reorderLabel || attrs['reorder-label'] || (merged.reorderLabel as string) || 'Reorder items';
  const reorderTitle =
    attrs.reorderTitle || attrs['reorder-title'] || (merged.reorderTitle as string) || 'Reorder items';
  const reorderLabelPath =
    attrs.reorderLabelPath || attrs['reorder-label-path'] || (merged.reorderLabelPath as string) || '';
  const reorderMode = attrs.reorderMode || attrs['reorder-mode'] || (merged.reorderMode as string) || 'inline';
  const reorderThreshold =
    attrs.reorderThreshold || attrs['reorder-threshold'] || (merged.reorderThreshold as string) || '';
  const defaultItem = attrs.defaultItem || attrs['default-item'] || (merged.defaultItem as string) || '';
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
  if (Array.isArray(options)) {
    options = options.map((opt) => ({ bodyClass: merged.bodyClass, size, ...opt }));
  }

  const allowImageOverride = parseBooleanAttr(attrs.allowImage || attrs['allow-image']);
  const inferredAllowsImage = (() => {
    const pathLower = pathAttr.toLowerCase();
    if (pathLower.includes('background')) return true;
    const labelLower = label.toLowerCase();
    return labelLower.includes('background');
  })();

  const allowImage = component === 'dropdown-fill' ? (allowImageOverride ?? inferredAllowsImage) : undefined;
  if (component === 'dropdown-fill' && !headerLabel) headerLabel = 'Color fill';

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
    // Expand any nested tooldrawer fields inside template attributes
    const tdRegex =
      /<tooldrawer-field(?:-([a-z0-9-]+))?((?:[^>"']|"[^"]*"|'[^']*')*)(?:\/>|>([\s\S]*?)<\/tooldrawer-field>)/gi;
    templateValue = templateValue.replace(tdRegex, (fullMatch: string, _groupKey: string | undefined, attrsRaw: string) => {
      const attrsInner = parseTooldrawerAttributes(attrsRaw);
      const typeInner = attrsInner.type;
      if (!typeInner) return fullMatch;
      const { template: nestedTemplate, spec: nestedSpec } = loadComponentTemplate(typeInner);
      const nestedContext = buildContext(typeInner, attrsInner, nestedSpec);
      let rendered = renderTemplate(nestedTemplate, nestedContext);
      if (attrsInner.template) {
        const decodedNested = decodeHtmlEntities(attrsInner.template);
        rendered = rendered.replace(/{{\s*template\s*}}/g, decodedNested);
      }
      return rendered;
    });
  }

  Object.assign(merged, {
    label,
    placeholder,
    value,
    path: pathAttr,
    headerLabel,
    headerIcon,
    allowImage,
    indexToken,
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
    reorderLabel,
    reorderTitle,
    reorderLabelPath,
    reorderMode,
    reorderThreshold,
    template: templateValue,
    defaultItem,
  });

  if (merged.labelClass == null) merged.labelClass = 'label-s';
  if (merged.bodyClass == null) merged.bodyClass = 'body-s';
  if (merged.popoverLabel == null) merged.popoverLabel = placeholder || label;

  return merged;
}

function buildHtmlWithGeneratedPanels(widgetJson: RawWidget): string[] {
  const rawHtml = Array.isArray(widgetJson.html) ? widgetJson.html : [];
  const htmlLines: string[] = rawHtml.filter((line): line is string => typeof line === 'string');

  const typographyRoles = (widgetJson.defaults as any)?.typography?.roles;
  const hasStage = (widgetJson.defaults as any)?.stage != null;
  const hasPod = (widgetJson.defaults as any)?.pod != null;

  const filtered: string[] = [];
  let skippingTypography = false;
  htmlLines.forEach((line) => {
    // Strip author-defined typography panel entirely; we'll inject a standardized one.
    if (!skippingTypography && line.includes("<bob-panel id='typography'>")) {
      skippingTypography = true;
      return;
    }
    if (skippingTypography) {
      if (line.includes('</bob-panel>')) {
        skippingTypography = false;
      }
      return;
    }
    // Remove stage/pod layout controls; compiler will inject the shared panel.
    if (line.includes('tooldrawer-field-podstagelayout') || line.includes('Stage/Pod layout')) {
      return;
    }
    filtered.push(line);
  });

  // Inject shared Stage/Pod layout panel if defaults declare stage/pod.
  if (hasStage || hasPod) {
    const stagePodFields = buildStagePodPanelFields();
    const layoutIdx = filtered.findIndex((line) => line.includes("<bob-panel id='layout'>"));
    if (layoutIdx >= 0) {
      const layoutEndIdx = filtered.findIndex((line, idx) => idx > layoutIdx && line.includes('</bob-panel>'));
      if (layoutEndIdx >= 0) filtered.splice(layoutEndIdx, 0, ...stagePodFields);
      else filtered.push(...stagePodFields);
    } else {
      filtered.push("<bob-panel id='layout'>", ...stagePodFields, '</bob-panel>');
    }
  }

  // Inject standardized Typography panel if roles are defined.
  if (typographyRoles) {
    const generatedTypography = buildTypographyPanel(typographyRoles);
    const insertAt = filtered.findIndex((line) => line.includes("<bob-panel id='layout'>"));
    if (insertAt >= 0) filtered.splice(insertAt, 0, ...generatedTypography);
    else filtered.push(...generatedTypography);
  }

  return filtered;
}

export function compileWidgetServer(widgetJson: RawWidget): CompiledWidget {
  if (!widgetJson || typeof widgetJson !== 'object') {
    throw new Error('[BobCompiler] Invalid widget JSON payload');
  }

  const defaults = widgetJson.defaults;
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
    throw new Error('[BobCompiler] widget JSON missing defaults object');
  }

  const rawWidgetName = widgetJson.widgetname;
  const widgetname = typeof rawWidgetName === 'string' && rawWidgetName.trim() ? rawWidgetName : null;
  if (!widgetname) {
    throw new Error('[BobCompiler] widget JSON missing widgetname');
  }

  const displayName =
    (typeof widgetJson.displayName === 'string' && widgetJson.displayName.trim()) || widgetname;

  const htmlWithGenerated = buildHtmlWithGeneratedPanels(widgetJson);
  const parsed = parsePanels(htmlWithGenerated);
  const controls = (() => {
    const rawControls = parsed.panels.flatMap((panel) => {
      const panelControls: CompiledControl[] = [];
      collectControlsFromMarkup(panel.html, panel.id, panelControls);
      return panelControls;
    });

    const score = (control: CompiledControl) =>
      (control.options && control.options.length ? 100 : 0) +
      (control.type === 'field' ? 0 : 10) +
      (control.label ? 1 : 0);

    const deduped = new Map<string, CompiledControl>();
    rawControls.forEach((control) => {
      const key = `${control.panelId}|${control.path}`;
      const existing = deduped.get(key);
      if (!existing || score(control) > score(existing)) {
        deduped.set(key, control);
      }
    });
    return Array.from(deduped.values()).map((control) => {
      const meta = inferControlMetadata(control, defaults);
      return { ...control, ...meta };
    });
  })();
  const unknownControl = controls.find((control) => !control.kind || control.kind === 'unknown');
  if (unknownControl) {
    throw new Error(`[BobCompiler] Control "${unknownControl.path}" is missing kind metadata`);
  }

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
    controls,
    assets,
  };
}
