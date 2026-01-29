import type { TooldrawerAttrs } from '../compiler.shared';
import { parseTooldrawerAttributes } from '../compiler.shared';
import { getIcon } from '../icons';
import { requireTokyoUrl } from './assets';
import { interpolateStencilContext, renderStencil } from './stencil-renderer';

type ComponentSpec = {
  defaults?: Array<{
    context?: Record<string, unknown>;
    sizeContext?: Record<string, Record<string, unknown>>;
  }>;
};

type WidgetI18nContext = {
  itemKey?: string | null;
  themeOptions?: Array<{ label: string; value: string }>;
  themeSourcePath?: string;
  themeApplyLabel?: string;
  themeCancelLabel?: string;
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function encodeHtmlEntities(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeJsonHtmlAttr(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';

  // Support inputs that are already entity-encoded or even double-encoded (e.g. &amp;quot;).
  const decodedTwice = decodeHtmlEntities(decodeHtmlEntities(trimmed));

  try {
    const parsed = JSON.parse(decodedTwice) as unknown;
    return encodeHtmlEntities(JSON.stringify(parsed));
  } catch {
    // Still ensure the attribute remains valid HTML even if the payload isn't valid JSON.
    return encodeHtmlEntities(decodedTwice);
  }
}

function normalizeJsonDataAttr(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';

  // Support inputs that are already entity-encoded or even double-encoded (e.g. &amp;quot;).
  const decodedTwice = decodeHtmlEntities(decodeHtmlEntities(trimmed));

  try {
    const parsed = JSON.parse(decodedTwice) as unknown;
    // This string is injected into HTML attribute context (e.g. data-i18n-params="..."),
    // so it must be entity-encoded to avoid breaking quotes.
    return encodeHtmlEntities(JSON.stringify(parsed));
  } catch {
    return encodeHtmlEntities(decodedTwice);
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

function parseFillModes(value: string | undefined): string[] | null {
  if (!value) return null;
  const modes = value
    .split(',')
    .map((mode) => mode.trim().toLowerCase())
    .filter(Boolean);
  return modes.length ? modes : null;
}

const stencilCache = new Map<string, Promise<{ stencil: string; spec?: ComponentSpec }>>();

export async function loadComponentStencil(type: string): Promise<{ stencil: string; spec?: ComponentSpec }> {
  const name = type.trim();
  if (!name) throw new Error('[BobCompiler] Missing component type for stencil load');

  const cached = stencilCache.get(name);
  if (cached) return cached;

  const promise = (async () => {
    const tokyoRoot = requireTokyoUrl().replace(/\/+$/, '');
    const base = `${tokyoRoot}/dieter/components/${encodeURIComponent(name)}`;
    const htmlUrl = `${base}/${encodeURIComponent(name)}.html`;
    const specUrl = `${base}/${encodeURIComponent(name)}.spec.json`;

    const stencilRes = await fetch(htmlUrl, { cache: 'no-store' });
    if (!stencilRes.ok) {
      throw new Error(`[BobCompiler] Missing stencil for component "${name}" (${stencilRes.status} ${stencilRes.statusText})`);
    }
    const stencil = await stencilRes.text();

    let spec: ComponentSpec | undefined;
    const specRes = await fetch(specUrl, { cache: 'no-store' });
    if (specRes.ok) {
      spec = (await specRes.json()) as ComponentSpec;
    } else if (specRes.status !== 404) {
      throw new Error(
        `[BobCompiler] Failed to load component spec "${name}" (${specRes.status} ${specRes.statusText})`,
      );
    }

    return { stencil, spec };
  })();

  stencilCache.set(name, promise);
  return promise;
}

function inlineDieterIcons(html: string): string {
  return html.replace(
    /<([a-z0-9-]+)([^>]*?)\sdata-icon="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi,
    (_match, tag, before, iconName, after) => {
      const svg = getIcon(iconName);
      const attrs = `${before}${after}`.replace(/\sdata-icon="[^"]*"/i, '');
      return `<${tag}${attrs}>${svg}</${tag}>`;
    },
  );
}

export function renderComponentStencil(stencil: string, context: Record<string, unknown>): string {
  return inlineDieterIcons(renderStencil(stencil, context));
}

function sanitizeId(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-');
}

async function renderNestedTooldrawerFields(
  markup: string,
  widgetContext?: WidgetI18nContext,
): Promise<string> {
  // Allow '>' inside quoted values and handle both self-closing and open/close forms.
  const tdRegex =
    /<tooldrawer-field(?:-([a-z0-9-]+))?((?:[^>"']|"[^"]*"|'[^']*')*)(?:\/>|>([\s\S]*?)<\/tooldrawer-field>)/gi;

  const coerceRenderedToBobPaths = (rendered: string, path: unknown): string => {
    const pathStr = typeof path === 'string' ? path.trim() : '';
    if (!pathStr) return rendered;

    // Match the main compiler pass: Dieter stencils historically use `data-path`,
    // but Bob binds via `data-bob-path`.
    let next = rendered.replace(/data-path="/g, 'data-bob-path="');

    // Back-compat: if a stencil doesn't declare any binding attribute, attach one to the first input.
    if (!/data-bob-path="/.test(next)) {
      next = next.replace(/<input([^>]*?)(\/?)>/, `<input$1 data-bob-path="${pathStr}"$2>`);
    }

    return next;
  };

  let out = '';
  let cursor = 0;
  tdRegex.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tdRegex.exec(markup)) !== null) {
    const index = match.index ?? 0;
    out += markup.slice(cursor, index);

    const fullMatch = match[0];
    const attrsRaw = match[2] || '';
    const attrsInner = parseTooldrawerAttributes(attrsRaw);
    const typeInner = attrsInner.type;
    if (!typeInner) {
      out += fullMatch;
      cursor = tdRegex.lastIndex;
      continue;
    }

    const { stencil: nestedStencil, spec: nestedSpec } = await loadComponentStencil(typeInner);
    const nestedContext = await buildContext(typeInner, attrsInner, nestedSpec, widgetContext);
    let rendered = renderComponentStencil(nestedStencil, nestedContext);
    rendered = coerceRenderedToBobPaths(rendered, (nestedContext as Record<string, unknown>).path);
    if (attrsInner.template) {
      const decodedNested = decodeHtmlEntities(attrsInner.template);
      rendered = rendered.replace(/{{\s*template\s*}}/g, decodedNested);
    }

    out += rendered;
    cursor = tdRegex.lastIndex;
  }

  out += markup.slice(cursor);
  return out;
}

export async function buildContext(
  component: string,
  attrs: TooldrawerAttrs,
  spec?: ComponentSpec,
  widgetContext?: WidgetI18nContext,
): Promise<Record<string, unknown>> {
  const defaults = spec?.defaults?.[0];
  const size = attrs.size || (defaults?.context?.size as string) || 'md';
  const indexToken = attrs.indexToken || attrs['index-token'] || attrs['data-index-token'] || '__INDEX__';

  const merged: Record<string, unknown> = {
    ...(defaults?.context ?? {}),
    ...(defaults?.sizeContext?.[size] ?? {}),
    size,
  };

  const label = attrs.label || (merged.label as string) || 'Label';
  const pathAttr = attrs.path || '';
  // For path-bound ToolDrawer fields we avoid placeholder hint text entirely.
  // Defaults must always be present in widget instance data; empty placeholder makes drift obvious.
  const placeholder =
    attrs.placeholder ??
    (pathAttr ? '' : ((merged.placeholder as string | undefined) ?? 'Select a fill'));
  const objectType = attrs.objectType || attrs['object-type'] || '';
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
  const reorderThreshold = attrs.reorderThreshold || attrs['reorder-threshold'] || (merged.reorderThreshold as string) || '';
  const defaultItemRaw = attrs.defaultItem || attrs['default-item'] || (merged.defaultItem as string) || '';
  const defaultItem = normalizeJsonHtmlAttr(defaultItemRaw);
  let labelKey = attrs.labelKey || attrs['label-key'] || (merged.labelKey as string) || '';
  const labelParamsRaw = attrs.labelParams || attrs['label-params'] || (merged.labelParams as string) || '';
  let labelParams = normalizeJsonDataAttr(labelParamsRaw);
  const addLabel = attrs.addLabel || attrs['add-label'] || (merged.addLabel as string) || 'Add item';
  let addLabelKey = attrs.addLabelKey || attrs['add-label-key'] || (merged.addLabelKey as string) || '';
  const addLabelParamsRaw = attrs.addLabelParams || attrs['add-label-params'] || (merged.addLabelParams as string) || '';
  let addLabelParams = normalizeJsonDataAttr(addLabelParamsRaw);
  const addOpen = attrs.addOpen || attrs['add-open'] || (merged.addOpen as string) || '';
  let reorderLabelKey =
    attrs.reorderLabelKey || attrs['reorder-label-key'] || (merged.reorderLabelKey as string) || '';
  const reorderLabelParamsRaw =
    attrs.reorderLabelParams || attrs['reorder-label-params'] || (merged.reorderLabelParams as string) || '';
  let reorderLabelParams = normalizeJsonDataAttr(reorderLabelParamsRaw);
  let reorderTitleKey =
    attrs.reorderTitleKey || attrs['reorder-title-key'] || (merged.reorderTitleKey as string) || '';
  const reorderTitleParamsRaw =
    attrs.reorderTitleParams || attrs['reorder-title-params'] || (merged.reorderTitleParams as string) || '';
  let reorderTitleParams = normalizeJsonDataAttr(reorderTitleParamsRaw);
  const rowPath = attrs.rowPath || attrs['row-path'] || (merged.rowPath as string) || '';
  const metaPath = attrs.metaPath || attrs['meta-path'] || (merged.metaPath as string) || '';
  const columnsRaw = attrs.columns || (merged.columns as string) || '';
  const columns = columnsRaw ? normalizeJsonHtmlAttr(columnsRaw) : '';
  const title = attrs.title || (merged.title as string) || label;
  const emptyLabel = attrs.emptyLabel || attrs['empty-label'] || (merged.emptyLabel as string) || '';
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
  const themeSourcePath = widgetContext?.themeSourcePath || '';
  const themeOptions = widgetContext?.themeOptions;
  const isThemeControl =
    Boolean(themeOptions && themeOptions.length > 0) && Boolean(themeSourcePath) && pathAttr === themeSourcePath;
  if (isThemeControl) {
    options = themeOptions;
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
  const fillModesAttr = attrs.fillModes || attrs['fill-modes'];
  const mergedFillModes = (merged.fillModes as string) || '';
  let fillModes = typeof fillModesAttr === 'string' ? fillModesAttr.trim() : '';
  if (component === 'dropdown-fill' && !fillModes) {
    if (allowImageOverride === false) fillModes = 'color';
    else if (allowImageOverride === true) fillModes = mergedFillModes || 'color,gradient,image';
    else fillModes = mergedFillModes;
  }
  const allowImageFromModes = fillModes
    ? parseFillModes(fillModes)?.some((mode) => mode === 'image' || mode === 'video')
    : undefined;

  const allowImage =
    component === 'dropdown-fill' ? (allowImageOverride ?? allowImageFromModes ?? inferredAllowsImage) : undefined;
  if (component === 'dropdown-fill' && !headerLabel) headerLabel = 'Color fill';
  if (component === 'dropdown-shadow' && !headerLabel) headerLabel = 'Shadow';
  const allowLinks =
    attrs.allowLinks ?? attrs['allow-links'] ?? (merged.allowLinks as string | undefined) ?? 'true';

  const applyActions = isThemeControl ? 'true' : '';
  const applyLabel = isThemeControl ? (widgetContext?.themeApplyLabel || 'Apply theme') : '';
  const cancelLabel = isThemeControl ? (widgetContext?.themeCancelLabel || 'Cancel') : '';

  const min = attrs.min || (merged.min as string) || '';
  const max = attrs.max || (merged.max as string) || '';

  const accept = attrs.accept || (merged.accept as string) || 'image/*';
  const maxSizeMb = attrs.maxSizeMb || attrs['max-size-mb'] || (merged.maxSizeMb as string) || '';
  const grantUrl = attrs.grantUrl || attrs['grant-url'] || (merged.grantUrl as string) || '/api/assets/grant';
  const resolveUrl = attrs.resolveUrl || attrs['resolve-url'] || (merged.resolveUrl as string) || '/api/assets/resolve';

  let templateValue = attrs.template ? decodeHtmlEntities(attrs.template) : (merged.template as string) || '';
  if (templateValue) {
    templateValue = templateValue.replace(
      /<([a-z0-9-]+)([^>]*?)\sdata-icon="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi,
      (_match, tag, before, iconName, after) => {
        const svg = getIcon(iconName);
        const attrsValue = `${before}${after}`.replace(/\sdata-icon="[^"]*"/i, '');
        return `<${tag}${attrsValue}>${svg}</${tag}>`;
      },
    );

    templateValue = await renderNestedTooldrawerFields(templateValue, widgetContext);
  }

  const itemKey = typeof widgetContext?.itemKey === 'string' ? widgetContext.itemKey.trim() : '';
  if (itemKey) {
    const hasAttr = (key: string) => Object.prototype.hasOwnProperty.call(attrs, key);
    const hasLabelAttr = hasAttr('label');
    const hasAddLabelAttr = hasAttr('add-label') || hasAttr('addLabel');
    const hasReorderLabelAttr = hasAttr('reorder-label') || hasAttr('reorderLabel');
    const hasReorderTitleAttr = hasAttr('reorder-title') || hasAttr('reorderTitle');
    const isRepeater = component === 'repeater';
    const isObjectManager = component === 'object-manager';

    const singularItemParam = normalizeJsonDataAttr(
      JSON.stringify({ item: { $t: itemKey, count: 1 } }),
    );
    const pluralItemParam = normalizeJsonDataAttr(
      JSON.stringify({ item: { $t: itemKey, count: 2 } }),
    );

    if (!labelKey && !hasLabelAttr && label === 'Items') {
      labelKey = itemKey;
      labelParams = normalizeJsonDataAttr(JSON.stringify({ count: 2 }));
    }

    if (!addLabelKey && !hasAddLabelAttr && (addLabel === 'Add item' || addLabel === 'Add object')) {
      addLabelKey = 'coreui.actions.addItem';
      addLabelParams = singularItemParam;
    }

    if (!reorderLabelKey && !hasReorderLabelAttr) {
      if (isObjectManager && reorderLabel === 'Manage objects') {
        reorderLabelKey = 'coreui.actions.manageItems';
        reorderLabelParams = pluralItemParam;
      } else if (isRepeater && reorderLabel === 'Reorder items') {
        reorderLabelKey = 'coreui.actions.reorderItems';
        reorderLabelParams = pluralItemParam;
      }
    }

    if (!reorderTitleKey && !hasReorderTitleAttr) {
      if (isObjectManager && reorderTitle === 'Manage objects') {
        reorderTitleKey = 'coreui.actions.manageItems';
        reorderTitleParams = pluralItemParam;
      } else if (isRepeater && reorderTitle === 'Reorder items') {
        reorderTitleKey = 'coreui.actions.reorderItems';
        reorderTitleParams = pluralItemParam;
      }
    }
  }

  Object.assign(merged, {
    label,
    labelKey,
    labelParams,
    placeholder,
    value,
    path: pathAttr,
    headerLabel,
    headerIcon,
    allowImage,
    allowLinks,
    applyActions,
    applyLabel,
    cancelLabel,
    fillModes: component === 'dropdown-fill' ? fillModes : undefined,
    min,
    max,
    accept: component === 'dropdown-upload' ? accept : undefined,
    maxSizeMb: component === 'dropdown-upload' ? maxSizeMb : undefined,
    grantUrl: component === 'dropdown-upload' ? grantUrl : undefined,
    resolveUrl: component === 'dropdown-upload' ? resolveUrl : undefined,
    indexToken,
    id,
    options,
    optionsRaw,
    objectType,
    addLabel,
    addLabelKey,
    addLabelParams,
    addOpen,
    labelPath: attrs.labelPath || attrs['label-path'] || (merged.labelPath as string) || '',
    labelInputLabel:
      attrs.labelInputLabel || attrs['label-input-label'] || (merged.labelInputLabel as string) || label || 'Title',
    labelPlaceholder: attrs.labelPlaceholder || attrs['label-placeholder'] || (merged.labelPlaceholder as string) || '',
    labelSize: attrs.labelSize || attrs['label-size'] || (merged.labelSize as string) || size,
    toggleLabel: attrs.toggleLabel || attrs['toggle-label'] || (merged.toggleLabel as string) || '',
    togglePath: attrs.togglePath || attrs['toggle-path'] || (merged.togglePath as string) || '',
    reorderLabel,
    reorderLabelKey,
    reorderLabelParams,
    reorderTitle,
    reorderTitleKey,
    reorderTitleParams,
    reorderLabelPath,
    reorderMode,
    reorderThreshold,
    rowPath,
    metaPath,
    columns,
    title,
    emptyLabel,
    template: templateValue,
    defaultItem,
  });

  // Segmented is special: the Dieter stencil expects `segments` (not `options`), and the radio group name
  // must be unique per control to avoid cross-control selection collisions.
  if (component === 'segmented') {
    const segments = Array.isArray(options)
      ? options.map((opt) => ({
          value: opt?.value == null ? '' : String(opt.value),
          label: opt?.label == null ? '' : String(opt.label),
          icon: opt?.icon == null ? '' : String(opt.icon),
          disabled: opt?.disabled === true,
          checked: false,
        }))
      : [];

    if (segments.length === 0) {
      throw new Error(
        `[BobCompiler] segmented control "${label}" is missing options (path="${pathAttr || ''}")`,
      );
    }

    const hasAnyIcon = segments.some((s) => Boolean(s.icon));
    const hasAnyLabel = segments.some((s) => Boolean(s.label));
    const buttonLayout = hasAnyIcon ? (hasAnyLabel ? 'ictxt' : 'ic') : 'txt';

    Object.assign(merged, {
      // Defaults to a good a11y label for widget controls.
      ariaLabel: label,
      // Use stable, per-control groupName so radio inputs don't conflict across multiple segmented controls.
      groupName: `${id}-seg`,
      variant: buttonLayout,
      buttonLayout,
      buttonClass: `diet-btn-${buttonLayout}`,
      buttonSize: size,
      buttonVariant: 'neutral',
      segments,
    });
  }

  if (merged.labelClass == null) merged.labelClass = 'label-s';
  if (merged.bodyClass == null) merged.bodyClass = 'body-s';
  if (merged.popoverLabel == null) merged.popoverLabel = placeholder || label;

  return interpolateStencilContext(merged, { skipInterpolationKeys: new Set(['template', 'optionsRaw']) });
}
