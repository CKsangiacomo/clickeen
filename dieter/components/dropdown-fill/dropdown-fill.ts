import { createDropdownHydrator } from '../shared/dropdownToggle';
import {
  parseFillValue,
  readImageAssetRef,
  readImageName,
  readVideoAssetRef,
  readVideoName,
  readVideoPosterAssetRef,
  resolveModeFromFill,
} from './fill-parser';
import { DEFAULT_GRADIENT, type FillMode, type FillValue } from './fill-types';
import {
  createDefaultGradientStops,
  installGradientHandlers,
  syncGradientUI,
  applyGradientFromFill,
  applyGradientSwatch,
} from './dropdown-fill-gradient';
import type {
  DropdownFillHeaderUpdate,
  DropdownFillState,
  DropdownFillUiDeps,
} from './dropdown-fill-types';
import {
  installImageHandlers as installImageHandlersCore,
  resolveImageAsset as resolveImageAssetCore,
  resolveVideoAsset as resolveVideoAssetCore,
  installVideoHandlers as installVideoHandlersCore,
  setImageSrc as setImageSrcCore,
  setVideoSrc as setVideoSrcCore,
  type SetMediaSrcOptions,
} from './media-controller';
import {
  clampNumber,
  formatHex,
  hexToRgba,
  hsvToRgb,
  normalizeHex,
  parseColor,
  parseCssColor,
  rgbToHsv,
  roundTo,
} from './color-utils';
import type { AccountAssetsClient } from '../shared/account-assets';

const states = new Map<HTMLElement, DropdownFillState>();

const hydrateHost = createDropdownHydrator({
  rootSelector: '.diet-dropdown-fill',
  triggerSelector: '.diet-dropdown-fill__control',
  isInsideTarget: () => false,
});

export function hydrateDropdownFill(
  scope: Element | DocumentFragment,
  options: { accountAssets: AccountAssetsClient },
): void {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>('.diet-dropdown-fill'));
  if (!roots.length) return;

  roots.forEach((root) => {
    if (states.has(root)) return;
    const state = createState(root, options.accountAssets);
    wireModes(state);
    states.set(root, state);
    installHandlers(state);
    syncFromValue(state, state.input.value);
  });

  hydrateHost(scope);
}

export function destroyDropdownFill(root: HTMLElement): void {
  const state = states.get(root);
  if (state) {
    state.imageResolveRequestId += 1;
    state.videoResolveRequestId += 1;
    state.videoPreview?.removeAttribute('src');
  }
  states.delete(root);
  hydrateHost.destroy(root);
}

function parseAllowedModes(root: HTMLElement): FillMode[] {
  return root.dataset.fillModes!.split(',') as FillMode[];
}

function createState(root: HTMLElement, accountAssets: AccountAssetsClient): DropdownFillState {
  const input = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__value-field')!;
  const headerValue = root.querySelector<HTMLElement>('.diet-dropdown-header-value');
  const headerValueLabel = root.querySelector<HTMLElement>('.diet-dropdown-fill__label');
  const headerValueNoneIcon = root.querySelector<HTMLElement>('.diet-dropdown-fill__none-icon');
  const headerValueChip = root.querySelector<HTMLElement>('.diet-dropdown-fill__chip');
  const enabledInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__enabled-input')!;
  const editor = root.querySelector<HTMLElement>('.diet-dropdown-fill__editor')!;
  const hueInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__hue')!;
  const alphaInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__alpha')!;
  const alphaValue = root.querySelector<HTMLOutputElement>('.diet-dropdown-fill__panel--color .diet-dropdown-fill__slider-value')!;
  const hexField = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__hex')!;
  const svCanvas = root.querySelector<HTMLElement>('.diet-dropdown-fill__sv-canvas')!;
  const svThumb = root.querySelector<HTMLElement>('.diet-dropdown-fill__sv-thumb')!;
  const swatches = Array.from(root.querySelectorAll<HTMLButtonElement>('.diet-dropdown-fill__swatch'));
  const gradientPreview = root.querySelector<HTMLElement>('.diet-dropdown-fill__gradient-preview');
  const gradientAngleInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__gradient-angle');
  const gradientEditor = root.querySelector<HTMLElement>('.diet-dropdown-fill__gradient-editor');
  const gradientStopBar = root.querySelector<HTMLElement>('.diet-dropdown-fill__gradient-stop-track');
  const gradientStopAdd = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__gradient-stop-add');
  const gradientStopSv = root.querySelector<HTMLElement>('.diet-dropdown-fill__gradient-sv');
  const gradientStopSvThumb = root.querySelector<HTMLElement>('.diet-dropdown-fill__gradient-sv-thumb');
  const gradientStopHueInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__gradient-hue');
  const gradientStopAlphaInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__gradient-alpha');
  const gradientStopAlphaValue = root.querySelector<HTMLOutputElement>('.diet-dropdown-fill__panel--gradient .diet-dropdown-fill__slider-value');
  const gradientStopHexInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__gradient-hex');
  const gradientStops = createDefaultGradientStops(root);
  const gradientActiveStopId = gradientStops[0]?.id ?? '';
  const imagePanel = root.querySelector<HTMLElement>(".diet-dropdown-fill__panel--image");
  const imagePreview = root.querySelector<HTMLElement>('.diet-dropdown-fill__image-preview');
  const imageBrowser = root.querySelector<HTMLElement>('.diet-dropdown-fill__asset-browser--image');
  const imageBrowserMessage = imageBrowser?.querySelector<HTMLElement>('.diet-dropdown-fill__asset-browser-message') ?? null;
  const imageBrowserList = imageBrowser?.querySelector<HTMLElement>('.diet-dropdown-fill__asset-browser-list') ?? null;
  const imageMessage = imagePanel?.querySelector<HTMLElement>('.diet-dropdown-fill__asset-message') ?? null;
  const uploadButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__upload-btn');
  const chooseButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__choose-btn');
  const removeButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__remove-btn');
  const fileInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__file-input');
  const videoPanel = root.querySelector<HTMLElement>('.diet-dropdown-fill__panel--video');
  const videoPreview = root.querySelector<HTMLVideoElement>('.diet-dropdown-fill__video-preview');
  const videoBrowser = root.querySelector<HTMLElement>('.diet-dropdown-fill__asset-browser--video');
  const videoBrowserMessage = videoBrowser?.querySelector<HTMLElement>('.diet-dropdown-fill__asset-browser-message') ?? null;
  const videoBrowserList = videoBrowser?.querySelector<HTMLElement>('.diet-dropdown-fill__asset-browser-list') ?? null;
  const videoMessage = videoPanel?.querySelector<HTMLElement>('.diet-dropdown-fill__asset-message') ?? null;
  const videoUploadButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__video-upload-btn');
  const videoChooseButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__video-choose-btn');
  const videoRemoveButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__video-remove-btn');
  const videoFileInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__video-file-input');

  chooseButton?.setAttribute('aria-expanded', 'false');
  videoChooseButton?.setAttribute('aria-expanded', 'false');

  const nativeValue = captureNativeValue(input);
  const allowedModes = parseAllowedModes(root);
  const mode = allowedModes[0]!;
  swatches.forEach((swatch) => {
    const color = swatch.dataset.color!;
    swatch.style.setProperty('--swatch-color', color);
  });

  return {
    root,
    copy: {
      addGradientStop: root.dataset.copyAddGradientStop!,
      editGradientStop: root.dataset.copyEditGradientStop!,
      loadAssetsError: root.dataset.copyLoadAssetsError!,
      loadingAssets: root.dataset.copyLoadingAssets!,
      noAssets: root.dataset.copyNoAssets!,
      previewAssetError: root.dataset.copyPreviewAssetError!,
      removeGradientStop: root.dataset.copyRemoveGradientStop!,
      uploadAssetError: root.dataset.copyUploadAssetError!,
      useAsset: root.dataset.copyUseAsset!,
    },
    accountAssets,
    input,
    headerValue,
    headerValueLabel,
    headerValueNoneIcon,
    headerValueChip,
    enabledInput,
    editor,
    hueInput,
    alphaInput,
    alphaValue,
    hexField,
    svCanvas,
    svThumb,
    swatches,
    hsv: { h: 0, s: 0, v: 0, a: 0 },
    gradientPreview,
    gradientAngleInput,
    gradientEditor,
    gradientStopBar,
    gradientStopAdd,
    gradientStopButtons: new Map(),
    gradientStopSv,
    gradientStopSvThumb,
    gradientStopHueInput,
    gradientStopAlphaInput,
    gradientStopAlphaValue,
    gradientStopHexInput,
    gradientActiveStopId,
    gradientStops,
    gradient: { kind: DEFAULT_GRADIENT.kind, angle: DEFAULT_GRADIENT.angle },
    imagePanel,
    imagePreview,
    imageBrowser,
    imageBrowserMessage,
    imageBrowserList,
    imageMessage,
    uploadButton,
    chooseButton,
    removeButton,
    fileInput,
    imageSrc: null,
    imageAssetRef: null,
    imageName: null,
    imageResolveRequestId: 0,
    videoPanel,
    videoPreview,
    videoBrowser,
    videoBrowserMessage,
    videoBrowserList,
    videoMessage,
    videoUploadButton,
    videoChooseButton,
    videoRemoveButton,
    videoFileInput,
    videoSrc: null,
    videoAssetRef: null,
    videoPosterAssetRef: null,
    videoName: null,
    videoResolveRequestId: 0,
    allowedModes,
    mode,
    lastEnabledValue: null,
    nativeValue,
    internalWrite: false,
  };
}

function installHandlers(state: DropdownFillState) {
  if (state.nativeValue) {
    Object.defineProperty(state.input, 'value', {
      configurable: true,
      get: () => state.nativeValue!.get(),
      set: (next: string) => {
        state.nativeValue!.set(next);
        if (!state.internalWrite) syncFromValue(state, next);
      },
    });
  }

  state.input.addEventListener('external-sync', () => syncFromValue(state, state.input.value));
  state.input.addEventListener('input', () => {
    if (state.internalWrite) return;
    syncFromValue(state, state.input.value);
  });

  state.hueInput.addEventListener('input', () => {
    const hue = clampNumber(Number(state.hueInput.value), 0, 360);
    state.hsv.h = hue;
    if (state.hsv.a === 0) state.hsv.a = 1;
    syncColorUI(state, { commit: true });
  });

  state.alphaInput.addEventListener('input', () => {
    const alpha = clampNumber(Number(state.alphaInput.value) / 100, 0, 1);
    state.hsv.a = alpha;
    syncColorUI(state, { commit: true });
  });

  state.hexField.addEventListener('change', () => handleHexInput(state));
  state.hexField.addEventListener('blur', () => handleHexInput(state));

  state.enabledInput.addEventListener('change', () => {
    if (state.enabledInput.checked) {
      enableFill(state);
      return;
    }
    setInputValue(state, { type: 'none' }, true);
  });

  installSvCanvasHandlers(state);
  installSwatchHandlers(state);
  installGradientHandlers(state, mediaDeps());
  installImageHandlers(state);
  installVideoHandlers(state);
}

function installSvCanvasHandlers(state: DropdownFillState) {
  const move = (event: PointerEvent | MouseEvent) => {
    const rect = state.svCanvas.getBoundingClientRect();
    const x = clampNumber(event.clientX - rect.left, 0, rect.width);
    const y = clampNumber(event.clientY - rect.top, 0, rect.height);
    const s = rect.width ? x / rect.width : 0;
    const v = rect.height ? 1 - y / rect.height : 0;
    state.hsv.s = clampNumber(s, 0, 1);
    state.hsv.v = clampNumber(v, 0, 1);
    if (state.hsv.a === 0) state.hsv.a = 1;
    syncColorUI(state, { commit: true });
  };

  const handlePointerDown = (event: PointerEvent) => {
    event.preventDefault();
    state.svCanvas.setPointerCapture(event.pointerId);
    move(event);
  };

  state.svCanvas.addEventListener('pointerdown', handlePointerDown);
  state.svCanvas.addEventListener('pointermove', (event) => {
    if (event.pressure === 0 && event.buttons === 0) return;
    move(event);
  });
  state.svCanvas.addEventListener('click', (event) => {
    move(event);
  });
}

function mediaDeps(): DropdownFillUiDeps {
  return {
    setInputValue,
    updateHeader,
  };
}

function installImageHandlers(state: DropdownFillState): void {
  installImageHandlersCore(state, mediaDeps());
}

function installVideoHandlers(state: DropdownFillState): void {
  installVideoHandlersCore(state, mediaDeps());
}

function setImageSrc(state: DropdownFillState, src: string | null, opts: SetMediaSrcOptions): void {
  setImageSrcCore(state, src, opts, mediaDeps());
}

function setVideoSrc(state: DropdownFillState, src: string | null, opts: SetMediaSrcOptions): void {
  setVideoSrcCore(state, src, opts, mediaDeps());
}

function setInputValue(state: DropdownFillState, value: FillValue, emit: boolean) {
  const current = parseFillValue(state.input.value);
  if (value.type === 'none' && current.type !== 'none') {
    state.lastEnabledValue = current;
  }
  const json = JSON.stringify(value);
  state.internalWrite = true;
  state.input.value = json;
  state.input.setAttribute('data-dieter-json', json);
  if (emit) {
    state.input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  state.internalWrite = false;
  setEnabledState(state, value.type !== 'none');
  if (value.type === 'none') {
    updateHeader(state, { text: '', muted: true, chipColor: null, noneChip: true });
  } else {
    state.lastEnabledValue = value;
  }
}

function getSwatchTarget(swatch: HTMLButtonElement): 'color' | 'gradient' {
  return swatch.closest<HTMLElement>('.diet-dropdown-fill__swatches')!.dataset
    .swatchTarget as 'color' | 'gradient';
}

function installSwatchHandlers(state: DropdownFillState) {
  state.swatches.forEach((swatch) => {
    swatch.addEventListener('click', (event) => {
      event.preventDefault();
      const color = swatch.dataset.color!;
      const parsed = parseColor(color, state.root)!;
      const target = getSwatchTarget(swatch);
      if (target === 'gradient') {
        applyGradientSwatch(state, parsed, mediaDeps());
        return;
      }
      // Swatches set a solid color with full opacity.
      state.hsv = { ...parsed, a: 1 };
      syncColorUI(state, { commit: true });
    });
  });
}

function handleHexInput(state: DropdownFillState) {
  const raw = state.hexField.value.trim();
  const normalized = raw.startsWith('#') ? raw : `#${raw}`;
  const rgba = hexToRgba(normalized);
  if (!rgba) return;
  state.hsv = { ...rgbToHsv(rgba.r, rgba.g, rgba.b, 1), a: state.hsv.a || 1 };
  syncColorUI(state, { commit: true });
}

function syncFromValue(state: DropdownFillState, raw: string) {
  const fill = parseFillValue(raw);
  const nextMode = resolveModeFromFill(state.mode, fill);
  setMode(state, nextMode);
  setEnabledState(state, fill.type !== 'none');

  if (fill.type === 'none') {
    if (nextMode === 'image') {
      state.imageResolveRequestId += 1;
      state.imageAssetRef = null;
      state.imageName = null;
      setImageSrc(state, null, { commit: false });
      return;
    }
    if (nextMode === 'video') {
      state.videoResolveRequestId += 1;
      state.videoAssetRef = null;
      state.videoPosterAssetRef = null;
      state.videoName = null;
      setVideoSrc(state, null, { commit: false });
      return;
    }
    if (nextMode === 'gradient') {
      state.gradient = { kind: DEFAULT_GRADIENT.kind, angle: DEFAULT_GRADIENT.angle };
      state.gradientStops = createDefaultGradientStops(state.root);
      state.gradientActiveStopId = state.gradientStops[0]?.id ?? '';
      syncGradientUI(state, { commit: false }, mediaDeps());
      return;
    }
    state.hsv = { h: 0, s: 0, v: 0, a: 0 };
    syncColorUI(state, { commit: false });
    return;
  }

  state.lastEnabledValue = fill;

  if (fill.type === 'color') {
    const parsed = parseColor(fill.color, state.root)!;
    state.hsv = parsed;
    syncColorUI(state, { commit: false });
    return;
  }

  if (fill.type === 'gradient') {
    applyGradientFromFill(state, fill.gradient);
    syncGradientUI(state, { commit: false }, mediaDeps());
    return;
  }

  if (fill.type === 'image') {
    state.imageAssetRef = readImageAssetRef(fill);
    state.imageName = readImageName(fill);
    setImageSrc(state, null, { commit: false });
    void resolveImageAssetCore(state, mediaDeps());
    return;
  }

  if (fill.type === 'video') {
    state.videoAssetRef = readVideoAssetRef(fill);
    state.videoPosterAssetRef = readVideoPosterAssetRef(fill);
    state.videoName = readVideoName(fill);
    setVideoSrc(state, null, { commit: false });
    void resolveVideoAssetCore(state, mediaDeps());
    return;
  }
}

function syncColorUI(state: DropdownFillState, opts: { commit: boolean; updateHeader?: boolean }) {
  const shouldUpdateHeader = opts.updateHeader !== false;
  const { h, s, v, a } = state.hsv;
  const rgb = hsvToRgb(h, s, v);
  const hex = formatHex({ h, s, v, a: 1 });
  const alphaPercent = Math.round(a * 100);
  const colorString = a < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${roundTo(a, 2)})` : hex;

  state.root.style.setProperty('--picker-hue', h.toString());
  state.root.style.setProperty('--picker-rgb', `${rgb.r} ${rgb.g} ${rgb.b}`);

  state.hueInput.value = h.toString();
  state.hueInput.style.setProperty('--value', state.hueInput.value);
  state.hueInput.style.setProperty('--min', '0');
  state.hueInput.style.setProperty('--max', '360');

  state.alphaInput.value = alphaPercent.toString();
  state.alphaInput.style.setProperty('--value', state.alphaInput.value);
  state.alphaInput.style.setProperty('--min', '0');
  state.alphaInput.style.setProperty('--max', '100');
  state.alphaValue.value = `${alphaPercent}%`;

  state.hexField.value = hex.replace(/^#/, '');

  const left = `${s * 100}%`;
  const top = `${(1 - v) * 100}%`;
  state.svThumb.style.left = left;
  state.svThumb.style.top = top;

  if (opts.commit) {
    const fill: FillValue = alphaPercent === 0 ? { type: 'none' } : { type: 'color', color: colorString };
    setInputValue(state, fill, true);
  }

  if (shouldUpdateHeader) {
    if (alphaPercent === 0) {
      updateHeader(state, { text: '', muted: true, chipColor: null, noneChip: true });
    } else {
      const label = alphaPercent < 100 ? `${alphaPercent}%` : '';
      updateHeader(state, { text: label, muted: false, chipColor: colorString });
    }
  }

  const normalizedCurrent = normalizeHex(hex);
  state.swatches.forEach((swatch) => {
    if (getSwatchTarget(swatch) !== 'color') return;
    const swatchHex = normalizeHex(swatch.dataset.color!);
    const match = Boolean(normalizedCurrent && swatchHex && swatchHex === normalizedCurrent);
    swatch.classList.toggle('is-selected', match);
    swatch.setAttribute('aria-pressed', match ? 'true' : 'false');
  });
}

function updateHeader(
  state: DropdownFillState,
  opts: DropdownFillHeaderUpdate,
): void {
  const { headerValue, headerValueLabel, headerValueNoneIcon, headerValueChip } = state;
  if (headerValueLabel) headerValueLabel.textContent = opts.text;
  if (headerValue) {
    headerValue.dataset.muted = opts.muted ? 'true' : 'false';
    headerValue.classList.toggle('has-chip', !!opts.chipColor || opts.noneChip === true);
  }
  if (headerValueChip) {
    if (opts.noneChip === true) {
      headerValueChip.style.removeProperty('background');
      headerValueChip.hidden = true;
      headerValueChip.classList.remove('is-white');
      if (headerValueNoneIcon) headerValueNoneIcon.hidden = false;
    } else if (opts.chipColor) {
      headerValueChip.style.background = opts.chipColor;
      headerValueChip.hidden = false;
      if (headerValueNoneIcon) headerValueNoneIcon.hidden = true;
      const parsed = parseCssColor(opts.chipColor.trim());
      const isWhite = Boolean(parsed && parsed.r === 255 && parsed.g === 255 && parsed.b === 255);
      headerValueChip.classList.toggle('is-white', isWhite);
    } else {
      headerValueChip.style.background = 'transparent';
      headerValueChip.hidden = true;
      headerValueChip.classList.remove('is-white');
      if (headerValueNoneIcon) headerValueNoneIcon.hidden = true;
    }
  }
}

function setMode(state: DropdownFillState, mode: FillMode) {
  state.mode = mode;
  state.root.dataset.mode = mode;
  state.root.dataset.hasModes = state.allowedModes.length > 1 ? 'true' : 'false';

  const segments = Array.from(state.root.querySelectorAll<HTMLElement>('.diet-dropdown-fill__mode'));
  segments.forEach((segment) => {
    const segmentMode = segment.dataset.mode as FillMode;
    const isAllowed = state.allowedModes.includes(segmentMode);
    segment.hidden = !isAllowed;
    const input = segment.querySelector<HTMLInputElement>('.diet-dropdown-fill__mode-input')!;
    const button = segment.querySelector<HTMLButtonElement>('.diet-button')!;
    input.disabled = !isAllowed;
    input.checked = isAllowed && segmentMode === mode;
    button.setAttribute('aria-pressed', input.checked ? 'true' : 'false');
  });
}

function syncModeUI(state: DropdownFillState, opts: { commit: boolean; updateHeader?: boolean }) {
  if (state.mode === 'gradient') {
    syncGradientUI(state, opts, mediaDeps());
    return;
  }
  if (state.mode === 'image') {
    const hasAsset = Boolean(state.imageAssetRef);
    setImageSrc(state, state.imageSrc, {
      commit: opts.commit && hasAsset,
      updateHeader: hasAsset ? opts.updateHeader : false,
    });
    return;
  }
  if (state.mode === 'video') {
    const hasAsset = Boolean(state.videoAssetRef);
    setVideoSrc(state, state.videoSrc, {
      commit: opts.commit && hasAsset,
      updateHeader: hasAsset ? opts.updateHeader : false,
    });
    return;
  }
  syncColorUI(state, opts);
}

function wireModes(state: DropdownFillState) {
  const inputs = Array.from(state.root.querySelectorAll<HTMLInputElement>('.diet-dropdown-fill__mode-input'));
  inputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      const mode = input.value as FillMode;
      setMode(state, mode);
      if (mode === 'color' && state.hsv.a === 0) state.hsv.a = 1;
      syncModeUI(state, { commit: true });
    });
  });
  setMode(state, state.mode);
}

function setEnabledState(state: DropdownFillState, enabled: boolean): void {
  state.root.dataset.fillEnabled = enabled ? 'true' : 'false';
  state.enabledInput.checked = enabled;
  const modes = state.root.querySelector<HTMLElement>('.diet-dropdown-fill__modes')!;
  const showModes = enabled && state.allowedModes.length > 1;
  modes.hidden = !showModes;
  state.editor.hidden = !enabled;
}

function enableFill(state: DropdownFillState): void {
  if (state.lastEnabledValue) {
    const value = state.lastEnabledValue;
    setInputValue(state, value, true);
    syncFromValue(state, JSON.stringify(value));
    return;
  }

  setEnabledState(state, true);
  if (state.mode === 'gradient') {
    syncGradientUI(state, { commit: true }, mediaDeps());
    return;
  }
  if (state.mode === 'color') {
    state.hsv = { h: 0, s: 0, v: 0, a: 1 };
    syncColorUI(state, { commit: true });
  }
}

function captureNativeValue(input: HTMLInputElement): DropdownFillState['nativeValue'] {
  const proto = Object.getPrototypeOf(input) as typeof HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (!desc?.get || !desc?.set) return undefined;
  return {
    get: () => desc.get!.call(input),
    set: (next: string) => {
      desc.set?.call(input, next);
    },
  };
}
