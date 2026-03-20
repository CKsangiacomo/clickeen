import { createDropdownHydrator } from '../shared/dropdownToggle';
import {
  parseFillValue,
  readImageAssetId,
  readImageName,
  readVideoAssetId,
  readVideoName,
  readVideoPosterAssetId,
  resolveModeFromFill,
} from './fill-parser';
import { DEFAULT_GRADIENT, MODE_ORDER, type FillMode, type FillValue } from './fill-types';
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

const MODE_LABELS: Record<FillMode, string> = {
  color: 'Color fill',
  gradient: 'Gradient fill',
  image: 'Image fill',
  video: 'Video fill',
};

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
    if (!state) return;
    wireModes(state);
    states.set(root, state);
    installHandlers(state);
    const initialValue =
      state.input.value || state.input.getAttribute('data-bob-json') || state.input.getAttribute('value') || '';
    syncFromValue(state, initialValue);
  });

  hydrateHost(scope);
}

function parseAllowedModes(root: HTMLElement): FillMode[] {
  const raw = (root.dataset.fillModes || '').trim();
  if (raw) {
    const modes = raw
      .split(',')
      .map((mode) => mode.trim().toLowerCase())
      .filter((mode): mode is FillMode => MODE_ORDER.includes(mode as FillMode));
    return modes.length ? modes : ['color'];
  }

  const allowImageAttr = (root.dataset.allowImage || '').trim().toLowerCase();
  const allowImage = allowImageAttr === '' || allowImageAttr === 'true' || allowImageAttr === '1' || allowImageAttr === 'yes';
  if (!allowImage) return ['color'];
  return ['color', 'gradient', 'image'];
}

function createState(root: HTMLElement, accountAssets: AccountAssetsClient): DropdownFillState | null {
  const input = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__value-field');
  const headerValue = root.querySelector<HTMLElement>('.diet-dropdown-header-value');
  const headerValueLabel = root.querySelector<HTMLElement>('.diet-dropdown-fill__label');
  const headerValueChip = root.querySelector<HTMLElement>('.diet-dropdown-fill__chip');
  const headerLabel = root.querySelector<HTMLElement>('.diet-popover__header-label');
  const preview = root.querySelector<HTMLElement>('.diet-dropdown-fill__preview');
  const nativeColorInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__native-color');
  const hueInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__hue');
  const alphaInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__alpha');
  const hexField = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__hex');
  const alphaField = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__alpha-input');
  const svCanvas = root.querySelector<HTMLElement>('.diet-dropdown-fill__sv-canvas');
  const svThumb = root.querySelector<HTMLElement>('.diet-dropdown-fill__sv-thumb');
  const colorPreview = root.querySelector<HTMLElement>('.diet-dropdown-fill__color-preview');
  const removeFillActions = Array.from(root.querySelectorAll<HTMLButtonElement>('.diet-dropdown-fill__remove-fill'));
  const removeFillLabels = removeFillActions.map(
    (action) => action.querySelector<HTMLElement>('.diet-btn-menuactions__label') ?? null,
  );
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
  const gradientStopHexInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__gradient-hex');
  const gradientStopAlphaField = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__gradient-alpha-field');
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

  if (!input || !hueInput || !alphaInput || !hexField || !alphaField || !svCanvas || !svThumb) {
    return null;
  }

  if (chooseButton) {
    chooseButton.setAttribute('aria-expanded', 'false');
  }
  if (videoChooseButton) {
    videoChooseButton.setAttribute('aria-expanded', 'false');
  }

  const nativeValue = captureNativeValue(input);
  const allowedModes = parseAllowedModes(root);
  const mode = allowedModes[0] || 'color';
  swatches.forEach((swatch) => {
    const color = swatch.dataset.color || '';
    swatch.style.setProperty('--swatch-color', color);
  });

  return {
    root,
    accountAssets,
    input,
    headerValue,
    headerValueLabel,
    headerValueChip,
    headerLabel,
    preview,
    nativeColorInput,
    colorPreview,
    removeFillActions,
    removeFillLabels,
    hueInput,
    alphaInput,
    hexField,
    alphaField,
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
    gradientStopHexInput,
    gradientStopAlphaField,
    gradientActiveStopId,
    gradientStops,
    gradient: { angle: DEFAULT_GRADIENT.angle },
    gradientCss: null,
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
    imageAssetId: null,
    imageName: null,
    imageObjectUrl: null,
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
    videoAssetId: null,
    videoPosterAssetId: null,
    videoName: null,
    videoObjectUrl: null,
    videoResolveRequestId: 0,
    allowedModes,
    mode,
    nativeValue,
    internalWrite: false,
  };
}

function installHandlers(state: DropdownFillState) {
  if (state.nativeValue) {
    Object.defineProperty(state.input, 'value', {
      configurable: true,
      get: () => state.nativeValue?.get() ?? '',
      set: (next: string) => {
        state.nativeValue?.set(String(next ?? ''));
        if (!state.internalWrite) syncFromValue(state, String(next ?? ''));
      },
    });
  }

  const readValue = () => state.input.value || state.input.getAttribute('data-bob-json') || '';
  state.input.addEventListener('external-sync', () => syncFromValue(state, readValue()));
  state.input.addEventListener('input', () => {
    if (state.internalWrite) return;
    syncFromValue(state, readValue());
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

  state.alphaField.addEventListener('change', () => handleAlphaField(state));
  state.alphaField.addEventListener('blur', () => handleAlphaField(state));

  installSvCanvasHandlers(state);
  installSwatchHandlers(state);
  installGradientHandlers(state, mediaDeps());
  installImageHandlers(state);
  installVideoHandlers(state);
  installNativeColorPicker(state);

  if (state.removeFillActions.length) {
    state.removeFillActions.forEach((action) => {
      action.addEventListener('click', (event) => {
        event.preventDefault();
        if (action.disabled) return;
        setInputValue(state, { type: 'none' }, true);
      });
    });
  }
}

function installNativeColorPicker(state: DropdownFillState) {
  const { preview, nativeColorInput } = state;
  if (!preview || !nativeColorInput) return;

  preview.addEventListener('click', (event) => {
    event.preventDefault();
    // Keep the native picker in sync with the current color.
    const hex = formatHex({ ...state.hsv, a: 1 });
    nativeColorInput.value = hex;
    nativeColorInput.click();
  });

  nativeColorInput.addEventListener('input', () => {
    const rgba = hexToRgba(nativeColorInput.value);
    if (!rgba) return;
    // Preserve alpha; native color input only picks RGB.
    state.hsv = { ...rgbToHsv(rgba.r, rgba.g, rgba.b, 1), a: state.hsv.a || 1 };
    syncColorUI(state, { commit: true });
  });
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
    setRemoveFillState,
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
  const json = JSON.stringify(value);
  state.internalWrite = true;
  state.input.value = json;
  state.input.setAttribute('data-bob-json', json);
  if (emit) {
    state.input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  state.internalWrite = false;
}

function setRemoveFillState(state: DropdownFillState, isEmpty: boolean) {
  if (!state.removeFillActions.length) return;
  state.removeFillActions.forEach((action, index) => {
    action.disabled = isEmpty;
    const label = state.removeFillLabels[index];
    if (label) {
      label.textContent = isEmpty ? 'No fill to remove' : 'Remove fill';
    }
  });
}

function getSwatchTarget(swatch: HTMLButtonElement): 'color' | 'gradient' {
  const container = swatch.closest<HTMLElement>('.diet-dropdown-fill__swatches');
  return container?.dataset.swatchTarget === 'gradient' ? 'gradient' : 'color';
}

function installSwatchHandlers(state: DropdownFillState) {
  state.swatches.forEach((swatch) => {
    swatch.addEventListener('click', (event) => {
      event.preventDefault();
      const color = swatch.dataset.color || '';
      const parsed = parseColor(color, state.root);
      if (!parsed) return;
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
  if (!raw) {
    state.hexField.value = formatHex(state.hsv).replace(/^#/, '');
    return;
  }
  const normalized = raw.startsWith('#') ? raw : `#${raw}`;
  const rgba = hexToRgba(normalized);
  if (!rgba) {
    state.hexField.value = formatHex(state.hsv).replace(/^#/, '');
    return;
  }
  state.hsv = { ...rgbToHsv(rgba.r, rgba.g, rgba.b, 1), a: state.hsv.a || 1 };
  syncColorUI(state, { commit: true });
}

function handleAlphaField(state: DropdownFillState) {
  const raw = state.alphaField.value.trim().replace('%', '');
  if (!raw) {
    state.alphaField.value = `${Math.round(state.hsv.a * 100)}%`;
    return;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    state.alphaField.value = `${Math.round(state.hsv.a * 100)}%`;
    return;
  }
  const percent = clampNumber(parsed, 0, 100);
  state.hsv.a = percent / 100;
  syncColorUI(state, { commit: true });
}

function syncFromValue(state: DropdownFillState, raw: string) {
  const fill = parseFillValue(raw, state.root);
  if (!fill) {
    state.root.dataset.invalid = 'true';
    updateHeader(state, { text: 'Invalid', muted: false, chipColor: null, noneChip: true });
    setRemoveFillState(state, true);
    return;
  }

  delete state.root.dataset.invalid;
  const nextMode = resolveModeFromFill(state.mode, state.allowedModes, fill);
  setMode(state, nextMode);

  if (fill.type === 'none') {
    if (nextMode === 'image') {
      state.imageResolveRequestId += 1;
      state.imageAssetId = null;
      state.imageName = null;
      setImageSrc(state, null, { commit: false });
      return;
    }
    if (nextMode === 'video') {
      state.videoResolveRequestId += 1;
      state.videoAssetId = null;
      state.videoPosterAssetId = null;
      state.videoName = null;
      setVideoSrc(state, null, { commit: false });
      return;
    }
    if (nextMode === 'gradient') {
      state.gradient = { angle: DEFAULT_GRADIENT.angle };
      state.gradientStops = createDefaultGradientStops(state.root);
      state.gradientActiveStopId = state.gradientStops[0]?.id ?? '';
      state.gradientCss = null;
      syncGradientUI(state, { commit: false }, mediaDeps());
      return;
    }
    state.hsv = { h: 0, s: 0, v: 0, a: 0 };
    syncColorUI(state, { commit: false });
    return;
  }

  if (fill.type === 'color') {
    const parsed = parseColor(fill.color || '', state.root);
    if (!parsed) {
      state.root.dataset.invalid = 'true';
      state.hsv = { h: 0, s: 0, v: 0, a: 0 };
      syncColorUI(state, { commit: false });
      return;
    }
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
    state.imageAssetId = readImageAssetId(fill);
    state.imageName = readImageName(fill);
    setImageSrc(state, null, { commit: false });
    void resolveImageAssetCore(state, mediaDeps());
    return;
  }

  if (fill.type === 'video') {
    state.videoAssetId = readVideoAssetId(fill);
    state.videoPosterAssetId = readVideoPosterAssetId(fill);
    state.videoName = readVideoName(fill);
    setVideoSrc(state, null, { commit: false });
    void resolveVideoAssetCore(state, mediaDeps());
    return;
  }
}

function syncColorUI(state: DropdownFillState, opts: { commit: boolean; updateHeader?: boolean; updateRemove?: boolean }) {
  const shouldUpdateHeader = opts.updateHeader !== false;
  const shouldUpdateRemove = opts.updateRemove !== false;
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

  state.hexField.value = hex.replace(/^#/, '');
  state.alphaField.value = `${alphaPercent}%`;

  const left = `${s * 100}%`;
  const top = `${(1 - v) * 100}%`;
  state.svThumb.style.left = left;
  state.svThumb.style.top = top;

  if (opts.commit) {
    const fill: FillValue = alphaPercent === 0 ? { type: 'none' } : { type: 'color', color: colorString };
    setInputValue(state, fill, true);
  }

  if (shouldUpdateHeader) {
    const isInvalid = state.root.dataset.invalid === 'true';
    if (isInvalid) {
      updateHeader(state, { text: 'Invalid', muted: false, chipColor: null, noneChip: true });
    } else if (alphaPercent === 0) {
      updateHeader(state, { text: '', muted: true, chipColor: null, noneChip: true });
    } else {
      const label = alphaPercent < 100 ? `${alphaPercent}%` : '';
      updateHeader(state, { text: label, muted: false, chipColor: colorString });
    }
  }

  if (state.colorPreview) {
    state.colorPreview.style.backgroundColor = colorString;
  }
  if (shouldUpdateRemove) {
    setRemoveFillState(state, alphaPercent === 0);
  }

  const normalizedCurrent = normalizeHex(hex);
  state.swatches.forEach((swatch) => {
    if (getSwatchTarget(swatch) !== 'color') return;
    const swatchHex = normalizeHex(swatch.dataset.color || '');
    const match = Boolean(normalizedCurrent && swatchHex && swatchHex === normalizedCurrent);
    swatch.classList.toggle('is-selected', match);
    swatch.setAttribute('aria-pressed', match ? 'true' : 'false');
  });
}

function updateHeader(
  state: DropdownFillState,
  opts: DropdownFillHeaderUpdate,
): void {
  const { headerValue, headerValueLabel, headerValueChip } = state;
  if (headerValueLabel) headerValueLabel.textContent = opts.text;
  if (headerValue) {
    headerValue.dataset.muted = opts.muted ? 'true' : 'false';
    headerValue.classList.toggle('has-chip', !!opts.chipColor || opts.noneChip === true);
  }
  if (headerValueChip) {
    if (opts.noneChip === true) {
      headerValueChip.style.removeProperty('background');
      headerValueChip.hidden = false;
      headerValueChip.classList.add('is-none');
      headerValueChip.classList.remove('is-white');
    } else if (opts.chipColor) {
      headerValueChip.style.background = opts.chipColor;
      headerValueChip.hidden = false;
      headerValueChip.classList.remove('is-none');
      const parsed = parseCssColor(opts.chipColor.trim());
      const isWhite = Boolean(parsed && parsed.r === 255 && parsed.g === 255 && parsed.b === 255);
      headerValueChip.classList.toggle('is-white', isWhite);
    } else {
      headerValueChip.style.background = 'transparent';
      headerValueChip.hidden = true;
      headerValueChip.classList.remove('is-none');
      headerValueChip.classList.remove('is-white');
    }
  }
}

function setMode(state: DropdownFillState, mode: FillMode) {
  const next = state.allowedModes.includes(mode) ? mode : state.allowedModes[0] || 'color';
  state.mode = next;
  state.root.dataset.mode = next;
  state.root.dataset.hasModes = state.allowedModes.length > 1 ? 'true' : 'false';

  const buttons = Array.from(state.root.querySelectorAll<HTMLButtonElement>('.diet-dropdown-fill__mode-btn'));
  buttons.forEach((btn) => {
    const btnMode = (btn.dataset.mode || '') as FillMode;
    const isAllowed = state.allowedModes.includes(btnMode);
    btn.hidden = !isAllowed;
    btn.disabled = !isAllowed;
    const isActive = isAllowed && btnMode === next;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  if (state.headerLabel) {
    state.headerLabel.textContent = MODE_LABELS[next] || state.headerLabel.textContent;
  }

}

function syncModeUI(state: DropdownFillState, opts: { commit: boolean; updateHeader?: boolean; updateRemove?: boolean }) {
  if (state.mode === 'gradient') {
    syncGradientUI(state, opts, mediaDeps());
    return;
  }
  if (state.mode === 'image') {
    const shouldCommit = opts.commit && Boolean(state.imageSrc);
    setImageSrc(state, state.imageSrc, {
      commit: shouldCommit,
      updateHeader: opts.updateHeader,
      updateRemove: opts.updateRemove,
    });
    return;
  }
  if (state.mode === 'video') {
    const shouldCommit = opts.commit && Boolean(state.videoSrc);
    setVideoSrc(state, state.videoSrc, {
      commit: shouldCommit,
      updateHeader: opts.updateHeader,
      updateRemove: opts.updateRemove,
    });
    return;
  }
  syncColorUI(state, opts);
}

function wireModes(state: DropdownFillState) {
  const buttons = Array.from(state.root.querySelectorAll<HTMLButtonElement>('.diet-dropdown-fill__mode-btn'));
  if (!buttons.length) return;
  buttons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const mode = (btn.dataset.mode || 'color') as FillMode;
      setMode(state, mode);
      syncModeUI(state, { commit: true });
    });
  });
  const initial = (state.root.dataset.mode || state.mode) as FillMode;
  setMode(state, initial);
}

function captureNativeValue(input: HTMLInputElement): DropdownFillState['nativeValue'] {
  const proto = Object.getPrototypeOf(input) as typeof HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (!desc?.get || !desc?.set) return undefined;
  return {
    get: () => String(desc.get?.call(input) ?? ''),
    set: (next: string) => {
      desc.set?.call(input, next);
    },
  };
}
