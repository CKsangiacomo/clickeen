import type { TooldrawerAttrs } from '../compiler.shared';
import { encodeHtmlEntities, parseTooldrawerAttributes } from '../compiler.shared';
import { interpolateStencilContext, renderStencil } from './stencil-renderer';
import { validateShowIfExpression } from '../../components/td-menu-content/showIf';

type ComponentSpec = {
  defaults?: Array<{
    context?: Record<string, unknown>;
    sizeContext?: Record<string, Record<string, unknown>>;
  }>;
};

export type ComponentStencil = { stencil: string; spec: ComponentSpec };
export type ComponentStencilLoader = (type: string) => Promise<ComponentStencil>;

function normalizeJsonAttrValue(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';

  const parsed = JSON.parse(trimmed) as unknown;
  return JSON.stringify(parsed);
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
  const modes = value.split(',');
  const allowed = new Set(['color', 'gradient', 'image', 'video']);
  if (new Set(modes).size !== modes.length || modes.some((mode) => !allowed.has(mode))) {
    throw new Error('[BobCompiler] dropdown-fill fill-modes are invalid');
  }
  return modes;
}

export function renderComponentStencil(stencil: string, context: Record<string, unknown>): string {
  return renderStencil(stencil, context, { rawKeys: new Set(['template']) });
}

function sanitizeId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-');
}

async function renderNestedTooldrawerFields(
  markup: string,
  loadStencil?: ComponentStencilLoader,
): Promise<string> {
  if (!loadStencil) throw new Error('[BobCompiler] Missing component stencil loader');
  // Allow '>' inside quoted values and handle both self-closing and open/close forms.
  const tdRegex =
    /<tooldrawer-field(?:-([a-z0-9-]+))?((?:[^>"']|"[^"]*"|'[^']*')*)(?:\/>|>([\s\S]*?)<\/tooldrawer-field>)/gi;

  const coerceRenderedToBobPaths = (rendered: string, path: unknown): string => {
    const pathStr = typeof path === 'string' ? path.trim() : '';
    if (!pathStr) return rendered;

    return rendered.replace(/data-path="/g, 'data-bob-path="');
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

    const { stencil: nestedStencil, spec: nestedSpec } = await loadStencil(typeInner);
    const nestedContext = await buildContext(
      typeInner,
      attrsInner,
      nestedSpec,
      loadStencil,
    );
    let rendered = renderComponentStencil(nestedStencil, nestedContext);
    rendered = coerceRenderedToBobPaths(rendered, (nestedContext as Record<string, unknown>).path);
    const showIf = attrsInner['show-if'] || '';
    if (showIf) validateShowIfExpression(showIf);
    out += showIf
      ? `<div data-bob-showif="${encodeHtmlEntities(showIf)}">${rendered}</div>`
      : rendered;
    cursor = tdRegex.lastIndex;
  }

  out += markup.slice(cursor);
  return out;
}

export async function buildContext(
  component: string,
  attrs: TooldrawerAttrs,
  spec: ComponentSpec,
  loadStencil?: ComponentStencilLoader,
): Promise<Record<string, unknown>> {
  const defaults = spec.defaults?.[0];
  const size = attrs.size || (defaults?.context?.size as string) || 'md';
  const indexToken =
    attrs.indexToken || attrs['index-token'] || attrs['data-index-token'] || '__INDEX__';

  const merged: Record<string, unknown> = {
    ...(defaults?.context ?? {}),
    ...(defaults?.sizeContext?.[size] ?? {}),
    size,
  };

  const label = attrs.label || '';
  const pathAttr = attrs.path || '';
  // Visible product copy comes from the resolved caller contract, never a
  // Dieter example context.
  const placeholder = attrs.placeholder ?? '';
  const objectType = attrs.objectType || attrs['object-type'] || '';
  const value = pathAttr ? '' : attrs.value || '';
  const optionsRaw = attrs.options || '';
  const headerLabel = attrs.headerLabel || '';
  const reorderLabel =
    attrs.reorderLabel ||
    attrs['reorder-label'] ||
    (merged.reorderLabel as string) ||
    'Reorder items';
  const reorderTitle =
    attrs.reorderTitle ||
    attrs['reorder-title'] ||
    (merged.reorderTitle as string) ||
    'Reorder items';
  const reorderLabelPath =
    attrs.reorderLabelPath ||
    attrs['reorder-label-path'] ||
    (merged.reorderLabelPath as string) ||
    '';
  const reorderMode =
    attrs.reorderMode || attrs['reorder-mode'] || (merged.reorderMode as string) || 'inline';
  const reorderThreshold =
    attrs.reorderThreshold ||
    attrs['reorder-threshold'] ||
    (merged.reorderThreshold as string) ||
    '';
  const defaultItemRaw =
    attrs.defaultItem || attrs['default-item'] || (merged.defaultItem as string) || '';
  const defaultItem = normalizeJsonAttrValue(defaultItemRaw);
  const addLabel =
    attrs.addLabel || attrs['add-label'] || (merged.addLabel as string) || 'Add item';
  const removeLabel =
    attrs.removeLabel ||
    attrs['remove-label'] ||
    (merged.removeLabel as string) ||
    'Remove item {index}';
  const moveLabel =
    attrs.moveLabel || attrs['move-label'] || (merged.moveLabel as string) || 'Move item {index}';
  const addOpen = attrs.addOpen || attrs['add-open'] || (merged.addOpen as string) || '';
  const rowPath = attrs.rowPath || attrs['row-path'] || (merged.rowPath as string) || '';
  const metaPath = attrs.metaPath || attrs['meta-path'] || (merged.metaPath as string) || '';
  const columnsRaw = attrs.columns || '';
  const columns = columnsRaw ? normalizeJsonAttrValue(columnsRaw) : '';
  const title = attrs.title || label;
  const emptyLabel =
    attrs.emptyLabel || attrs['empty-label'] || '';
  const closeLabel =
    attrs.closeLabel || attrs['close-label'] || '';
  const cancelLabel =
    attrs.cancelLabel || attrs['cancel-label'] || '';
  const saveLabel =
    attrs.saveLabel || attrs['save-label'] || '';
  const discardTitle =
    attrs.discardTitle || attrs['discard-title'] || '';
  const discardMessage =
    attrs.discardMessage || attrs['discard-message'] || '';
  const keepEditingLabel =
    attrs.keepEditingLabel ||
    attrs['keep-editing-label'] ||
    '';
  const discardLabel =
    attrs.discardLabel || attrs['discard-label'] || '';
  const idBase = pathAttr || label || `${component}-${size}`;
  const id = sanitizeId(`${component}-${idBase}`);

  let options: unknown;
  if (attrs.options) {
    const parsed = JSON.parse(attrs.options);
    if (!Array.isArray(parsed)) {
      throw new Error(`[BobCompiler] options for component "${component}" must be a JSON array`);
    }
    options = parsed;
  }
  if (Array.isArray(options)) {
    options = options.map((opt) => ({ bodyClass: merged.bodyClass, size, ...opt }));
  }

  const fillModesAttr = attrs.fillModes || attrs['fill-modes'];
  const fillModes = component === 'dropdown-fill' ? fillModesAttr : undefined;
  if (component === 'dropdown-fill' && !parseFillModes(fillModes)) {
    throw new Error(`[BobCompiler] dropdown-fill control "${pathAttr}" requires fill-modes`);
  }
  const axis = attrs.axis || attrs['data-axis'] || (merged.axis as string) || '';
  const min = attrs.min || (merged.min as string) || '';
  const max = attrs.max || (merged.max as string) || '';
  const step = attrs.step || (merged.step as string) || '';
  const allowStructureRaw =
    attrs.allowStructure || attrs['allow-structure'] || (merged.allowStructure as string) || 'true';
  const allowStructure = parseBooleanAttr(allowStructureRaw) === false ? 'false' : 'true';

  const accept = attrs.accept || (merged.accept as string) || 'image/*';
  const maxSizeMb = attrs.maxSizeMb || attrs['max-size-mb'] || (merged.maxSizeMb as string) || '';
  const popoverWidth =
    attrs.popoverWidth || attrs['popover-width'] || (merged.popoverWidth as string);

  if (component === 'dropdown-upload' && !metaPath.trim()) {
    const controlId = pathAttr || label || idBase || 'unknown';
    throw new Error(`[BobCompiler] dropdown-upload control "${controlId}" requires meta-path`);
  }

  let templateValue = attrs.template || (merged.template as string) || '';
  if (templateValue) {
    templateValue = await renderNestedTooldrawerFields(templateValue, loadStencil);
  }

  Object.assign(merged, {
    label,
    placeholder,
    value,
    path: pathAttr,
    headerLabel,
    fillModes: component === 'dropdown-fill' ? fillModes : undefined,
    min,
    max,
    step,
    allowStructure,
    accept: component === 'dropdown-upload' ? accept : undefined,
    maxSizeMb: component === 'dropdown-upload' ? maxSizeMb : undefined,
    popoverWidth,
    axis: component === 'dropdown-shadow' ? axis : undefined,
    indexToken,
    id,
    options,
    optionsRaw,
    objectType,
    addLabel,
    removeLabel,
    moveLabel,
    addOpen,
    labelPath: attrs.labelPath || attrs['label-path'] || (merged.labelPath as string) || '',
    labelInputLabel:
      attrs.labelInputLabel ||
      attrs['label-input-label'] ||
      (merged.labelInputLabel as string) ||
      label ||
      'Title',
    labelPlaceholder:
      attrs.labelPlaceholder ||
      attrs['label-placeholder'] ||
      (merged.labelPlaceholder as string) ||
      '',
    labelSize: attrs.labelSize || attrs['label-size'] || (merged.labelSize as string) || size,
    toggleLabel: attrs.toggleLabel || attrs['toggle-label'] || (merged.toggleLabel as string) || '',
    togglePath: attrs.togglePath || attrs['toggle-path'] || (merged.togglePath as string) || '',
    reorderLabel,
    reorderTitle,
    reorderLabelPath,
    reorderMode,
    reorderThreshold,
    rowPath,
    metaPath,
    columns,
    title,
    emptyLabel,
    closeLabel,
    cancelLabel,
    saveLabel,
    discardTitle,
    discardMessage,
    keepEditingLabel,
    discardLabel,
    template: templateValue,
    defaultItem,
    colorLabel: attrs.colorLabel || attrs['color-label'] || '',
    defaultColorsLabel: attrs.defaultColorsLabel || attrs['default-colors-label'] || '',
    hexLabel: attrs.hexLabel || attrs['hex-label'] || '',
    hueLabel: attrs.hueLabel || attrs['hue-label'] || '',
    widthLabel: attrs.widthLabel || attrs['width-label'] || '',
    addLinkLabel: attrs.addLinkLabel || attrs['add-link-label'] || '',
    boldLabel: attrs.boldLabel || attrs['bold-label'] || '',
    clearFormattingLabel:
      attrs.clearFormattingLabel || attrs['clear-formatting-label'] || '',
    italicLabel: attrs.italicLabel || attrs['italic-label'] || '',
    linkLabel: attrs.linkLabel || attrs['link-label'] || '',
    removeLinkLabel: attrs.removeLinkLabel || attrs['remove-link-label'] || '',
    strikethroughLabel: attrs.strikethroughLabel || attrs['strikethrough-label'] || '',
    underlineLabel: attrs.underlineLabel || attrs['underline-label'] || '',
    urlLabel: attrs.urlLabel || attrs['url-label'] || '',
    colorFillLabel: attrs.colorFillLabel || attrs['color-fill-label'] || '',
    gradientFillLabel: attrs.gradientFillLabel || attrs['gradient-fill-label'] || '',
    imageFillLabel: attrs.imageFillLabel || attrs['image-fill-label'] || '',
    videoFillLabel: attrs.videoFillLabel || attrs['video-fill-label'] || '',
    angleLabel: attrs.angleLabel || attrs['angle-label'] || '',
    gradientStopsLabel: attrs.gradientStopsLabel || attrs['gradient-stops-label'] || '',
    addGradientStopLabel:
      attrs.addGradientStopLabel || attrs['add-gradient-stop-label'] || '',
    editGradientStopLabel:
      attrs.editGradientStopLabel || attrs['edit-gradient-stop-label'] || '',
    enabledLabel: attrs.enabledLabel || attrs['enabled-label'] || '',
    removeGradientStopLabel:
      attrs.removeGradientStopLabel || attrs['remove-gradient-stop-label'] || '',
    opacityLabel: attrs.opacityLabel || attrs['opacity-label'] || '',
    uploadLabel: attrs.uploadLabel || attrs['upload-label'] || '',
    chooseAssetsLabel: attrs.chooseAssetsLabel || attrs['choose-assets-label'] || '',
    removeAssetLabel: attrs.removeAssetLabel || attrs['remove-asset-label'] || '',
    loadingAssetsLabel: attrs.loadingAssetsLabel || attrs['loading-assets-label'] || '',
    noAssetsLabel: attrs.noAssetsLabel || attrs['no-assets-label'] || '',
    useAssetLabel: attrs.useAssetLabel || attrs['use-asset-label'] || '',
    loadAssetsErrorLabel:
      attrs.loadAssetsErrorLabel || attrs['load-assets-error-label'] || '',
    uploadAssetErrorLabel:
      attrs.uploadAssetErrorLabel || attrs['upload-asset-error-label'] || '',
    previewAssetErrorLabel:
      attrs.previewAssetErrorLabel || attrs['preview-asset-error-label'] || '',
    blurLabel: attrs.blurLabel || attrs['blur-label'] || '',
    horizontalLabel: attrs.horizontalLabel || attrs['horizontal-label'] || '',
    previewLabel: attrs.previewLabel || attrs['preview-label'] || '',
    spreadLabel: attrs.spreadLabel || attrs['spread-label'] || '',
    verticalLabel: attrs.verticalLabel || attrs['vertical-label'] || '',
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
    const segmentVariant = hasAnyIcon ? (hasAnyLabel ? 'ictxt' : 'ic') : 'txt';
    const buttonByControlSize = {
      sm: { buttonSize: 'small', buttonIconSize: '12' },
      md: { buttonSize: 'medium', buttonIconSize: '16' },
      lg: { buttonSize: 'large', buttonIconSize: '20' },
    } as const;
    const buttonContext = buttonByControlSize[size as keyof typeof buttonByControlSize] ?? buttonByControlSize.md;

    Object.assign(merged, {
      // Defaults to a good a11y label for widget controls.
      ariaLabel: label,
      // Use stable, per-control groupName so radio inputs don't conflict across multiple segmented controls.
      groupName: `${id}-seg`,
      variant: segmentVariant,
      buttonSize: buttonContext.buttonSize,
      buttonType: 'quaternary',
      buttonIconSize: buttonContext.buttonIconSize,
      segments,
    });
  }

  if (merged.labelClass == null) merged.labelClass = 'label-s';
  if (merged.bodyClass == null) merged.bodyClass = 'body-s';
  if (merged.popoverLabel == null) merged.popoverLabel = placeholder || label;

  return interpolateStencilContext(merged, {
    skipInterpolationKeys: new Set(['template', 'optionsRaw']),
  });
}
