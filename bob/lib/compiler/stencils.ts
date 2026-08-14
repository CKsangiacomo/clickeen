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
    const nestedContext = await buildContext(typeInner, attrsInner, nestedSpec, loadStencil);
    const rendered = renderComponentStencil(nestedStencil, nestedContext);
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
  const value = pathAttr ? (component === 'dropdown-upload' ? 'null' : '') : attrs.value || '';
  const optionsRaw = attrs.options || '';
  const headerLabel = attrs.headerLabel || '';
  const reorderLabel = attrs.reorderLabel || attrs['reorder-label'] || '';
  const reorderTitle = attrs.reorderTitle || attrs['reorder-title'] || '';
  const defaultItemRaw = attrs.defaultItem || attrs['default-item'] || '';
  const defaultItem = normalizeJsonAttrValue(defaultItemRaw);
  const addLabel = attrs.addLabel || attrs['add-label'] || '';
  const removeLabel = attrs.removeLabel || attrs['remove-label'] || '';
  const moveLabel = attrs.moveLabel || attrs['move-label'] || '';
  const addOpen = attrs.addOpen || attrs['add-open'] || '';
  const rowPath = attrs.rowPath || attrs['row-path'] || (merged.rowPath as string) || '';
  const columnsRaw = attrs.columns || '';
  const columns = columnsRaw ? normalizeJsonAttrValue(columnsRaw) : '';
  const title = attrs.title || label;
  const emptyLabel = attrs.emptyLabel || attrs['empty-label'] || '';
  const closeLabel = attrs.closeLabel || attrs['close-label'] || '';
  const cancelLabel = attrs.cancelLabel || attrs['cancel-label'] || '';
  const saveLabel = attrs.saveLabel || attrs['save-label'] || '';
  const discardTitle = attrs.discardTitle || attrs['discard-title'] || '';
  const discardMessage = attrs.discardMessage || attrs['discard-message'] || '';
  const keepEditingLabel = attrs.keepEditingLabel || attrs['keep-editing-label'] || '';
  const discardLabel = attrs.discardLabel || attrs['discard-label'] || '';
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
  const min = attrs.min ?? '';
  const max = attrs.max ?? '';
  const step = attrs.step ?? '';
  const hasMin = attrs.min !== undefined;
  const hasMax = attrs.max !== undefined;
  const hasStep = attrs.step !== undefined;
  const disabled = attrs.disabled === 'true' || merged.disabled === true;
  const allowStructureRaw = attrs.allowStructure || attrs['allow-structure'];
  const allowStructure = allowStructureRaw?.trim() ?? '';

  const accept = attrs.accept || '';
  const popoverWidth =
    attrs.popoverWidth || attrs['popover-width'] || (merged.popoverWidth as string);

  if (component === 'dropdown-upload') {
    if (attrs.template) {
      throw new Error('[BobCompiler] dropdown-upload does not accept template content');
    }
    const requiredUploadInputs = [
      ['path', pathAttr],
      ['label', label],
      ['placeholder', placeholder],
      ['upload-label', attrs.uploadLabel || attrs['upload-label']],
      ['replace-label', attrs.replaceLabel || attrs['replace-label']],
      ['remove-label', attrs.removeLabel || attrs['remove-label']],
      [
        'upload-asset-error-label',
        attrs.uploadAssetErrorLabel || attrs['upload-asset-error-label'],
      ],
      [
        'preview-asset-error-label',
        attrs.previewAssetErrorLabel || attrs['preview-asset-error-label'],
      ],
    ] as const;
    const missing = requiredUploadInputs.find(([, value]) => !value?.trim());
    if (missing) {
      throw new Error(`[BobCompiler] dropdown-upload requires ${missing[0]}`);
    }
  }

  if (component === 'object-manager') {
    if (allowStructure !== 'true' && allowStructure !== 'false') {
      throw new Error('[BobCompiler] object-manager allow-structure must be true or false');
    }
    const requiredObjectManagerInputs = [
      ['path', pathAttr],
      ['size', attrs.size],
      ['allow-structure', allowStructure],
      ['add-label', addLabel],
      ['reorder-label', reorderLabel],
      ['reorder-title', reorderTitle],
      ['item-label', attrs.itemLabel || attrs['item-label']],
      ['label-path', attrs.labelPath || attrs['label-path']],
      ['index-token', attrs.indexToken || attrs['index-token']],
      ['template', attrs.template],
    ] as const;
    const missing = requiredObjectManagerInputs.find(([, input]) => !input?.trim());
    if (missing) throw new Error(`[BobCompiler] object-manager requires ${missing[0]}`);
    if (allowStructure === 'true' && !defaultItem) {
      throw new Error('[BobCompiler] structural object-manager requires default-item');
    }
  }

  if (component === 'repeater') {
    const requiredRepeaterInputs = [
      ['path', pathAttr],
      ['size', attrs.size],
      ['label', label],
      ['add-label', addLabel],
      ['reorder-label', reorderLabel],
      ['remove-label', removeLabel],
      ['move-label', moveLabel],
      ['default-item', defaultItem],
      ['template', attrs.template],
    ] as const;
    const missing = requiredRepeaterInputs.find(([, input]) => !input?.trim());
    if (missing) throw new Error(`[BobCompiler] repeater requires ${missing[0]}`);
    const labelPath = attrs.labelPath || attrs['label-path'] || '';
    const labelInputLabel = attrs.labelInputLabel || attrs['label-input-label'] || '';
    if (labelPath.trim() && !labelInputLabel.trim()) {
      throw new Error('[BobCompiler] repeater with label-path requires label-input-label');
    }
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
    hasMin,
    hasMax,
    hasStep,
    disabled,
    allowStructure,
    showStructure: allowStructure === 'true',
    accept: component === 'dropdown-upload' ? accept : undefined,
    popoverWidth,
    axis: component === 'dropdown-shadow' ? axis : undefined,
    indexToken,
    id,
    options,
    optionsRaw,
    objectType,
    addLabel,
    removeLabel:
      component === 'dropdown-upload'
        ? attrs.removeLabel || attrs['remove-label'] || ''
        : removeLabel,
    moveLabel,
    addOpen,
    itemLabel: attrs.itemLabel || attrs['item-label'] || '',
    moveUpLabel: attrs.moveUpLabel || attrs['move-up-label'] || '',
    moveDownLabel: attrs.moveDownLabel || attrs['move-down-label'] || '',
    deleteLabel: attrs.deleteLabel || attrs['delete-label'] || '',
    labelPath: attrs.labelPath || attrs['label-path'] || (merged.labelPath as string) || '',
    labelInputLabel:
      attrs.labelInputLabel ||
      attrs['label-input-label'] ||
      (merged.labelInputLabel as string) ||
      '',
    labelPlaceholder:
      attrs.labelPlaceholder ||
      attrs['label-placeholder'] ||
      (merged.labelPlaceholder as string) ||
      '',
    reorderLabel,
    reorderTitle,
    rowPath,
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
    clearFormattingLabel: attrs.clearFormattingLabel || attrs['clear-formatting-label'] || '',
    closeLinkLabel: attrs.closeLinkLabel || attrs['close-link-label'] || '',
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
    addGradientStopLabel: attrs.addGradientStopLabel || attrs['add-gradient-stop-label'] || '',
    editGradientStopLabel: attrs.editGradientStopLabel || attrs['edit-gradient-stop-label'] || '',
    enabledLabel: attrs.enabledLabel || attrs['enabled-label'] || '',
    removeGradientStopLabel:
      attrs.removeGradientStopLabel || attrs['remove-gradient-stop-label'] || '',
    opacityLabel: attrs.opacityLabel || attrs['opacity-label'] || '',
    uploadLabel: attrs.uploadLabel || attrs['upload-label'] || '',
    replaceLabel: attrs.replaceLabel || attrs['replace-label'] || '',
    chooseAssetsLabel: attrs.chooseAssetsLabel || attrs['choose-assets-label'] || '',
    removeAssetLabel: attrs.removeAssetLabel || attrs['remove-asset-label'] || '',
    loadingAssetsLabel: attrs.loadingAssetsLabel || attrs['loading-assets-label'] || '',
    noAssetsLabel: attrs.noAssetsLabel || attrs['no-assets-label'] || '',
    useAssetLabel: attrs.useAssetLabel || attrs['use-asset-label'] || '',
    loadAssetsErrorLabel: attrs.loadAssetsErrorLabel || attrs['load-assets-error-label'] || '',
    uploadAssetErrorLabel: attrs.uploadAssetErrorLabel || attrs['upload-asset-error-label'] || '',
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
    Object.assign(merged, {
      // Defaults to a good a11y label for widget controls.
      ariaLabel: label,
      // Use stable, per-control groupName so radio inputs don't conflict across multiple segmented controls.
      groupName: `${id}-seg`,
      variant: segmentVariant,
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
