import fs from 'node:fs';
import path from 'node:path';
import type { TooldrawerAttrs } from '../compiler.shared';
import { parseTooldrawerAttributes } from '../compiler.shared';
import { getIcon } from '../icons';
import { interpolateStencilContext, renderStencil } from './stencil-renderer';

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

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseBooleanAttr(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

export function loadComponentStencil(type: string): { stencil: string; spec?: ComponentSpec } {
  const base = resolveRepoPath('tokyo', 'dieter', 'components', type);
  const htmlPath = path.join(base, `${type}.html`);
  const specPath = path.join(base, `${type}.spec.json`);

  if (!fs.existsSync(htmlPath)) {
    throw new Error(`[BobCompiler] Missing stencil for component ${type} at ${htmlPath}`);
  }
  const stencil = fs.readFileSync(htmlPath, 'utf8');
  let spec: ComponentSpec | undefined;
  if (fs.existsSync(specPath)) {
    spec = JSON.parse(fs.readFileSync(specPath, 'utf8')) as ComponentSpec;
  }
  return { stencil, spec };
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

export function buildContext(component: string, attrs: TooldrawerAttrs, spec?: ComponentSpec): Record<string, unknown> {
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
  const defaultItem = attrs.defaultItem || attrs['default-item'] || (merged.defaultItem as string) || '';
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

    const tdRegex =
      /<tooldrawer-field(?:-([a-z0-9-]+))?((?:[^>"']|"[^"]*"|'[^']*')*)(?:\/>|>([\s\S]*?)<\/tooldrawer-field>)/gi;
    templateValue = templateValue.replace(tdRegex, (fullMatch: string, _groupKey: string | undefined, attrsRaw: string) => {
      const attrsInner = parseTooldrawerAttributes(attrsRaw);
      const typeInner = attrsInner.type;
      if (!typeInner) return fullMatch;
      const { stencil: nestedStencil, spec: nestedSpec } = loadComponentStencil(typeInner);
      const nestedContext = buildContext(typeInner, attrsInner, nestedSpec);
      let rendered = renderComponentStencil(nestedStencil, nestedContext);
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

  return interpolateStencilContext(merged, { skipInterpolationKeys: new Set(['template', 'optionsRaw']) });
}
