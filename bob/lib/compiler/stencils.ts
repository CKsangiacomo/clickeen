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

function parseBooleanAttr(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
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
    const nestedContext = await buildContext(typeInner, attrsInner, nestedSpec);
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
  const placeholder = attrs.placeholder || (merged.placeholder as string) || 'Select a fill';
  const pathAttr = attrs.path || '';
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
  const idBase = pathAttr || label || `${component}-${size}`;
  const id = sanitizeId(`${component}-${idBase}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  if (component === 'dropdown-shadow' && !headerLabel) headerLabel = 'Shadow';

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

    templateValue = await renderNestedTooldrawerFields(templateValue);
  }

  Object.assign(merged, {
    label,
    placeholder,
    value,
    path: pathAttr,
    headerLabel,
    headerIcon,
    allowImage,
    accept: component === 'dropdown-upload' ? accept : undefined,
    maxSizeMb: component === 'dropdown-upload' ? maxSizeMb : undefined,
    grantUrl: component === 'dropdown-upload' ? grantUrl : undefined,
    resolveUrl: component === 'dropdown-upload' ? resolveUrl : undefined,
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
