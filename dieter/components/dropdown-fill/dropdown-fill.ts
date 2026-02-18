import { createDropdownHydrator } from '../shared/dropdownToggle';
import { uploadEditorAsset } from '../shared/assetUpload';

type FillMode = 'color' | 'gradient' | 'image' | 'video';
type GradientStop = { color: string; position: number };
type GradientStopState = { id: string; color: string; position: number; hsv: { h: number; s: number; v: number; a: number } };
type GradientValue = { kind: 'linear' | 'radial' | 'conic'; angle: number; stops: GradientStop[] };
type ImageValue = { src: string; fit?: 'cover' | 'contain'; position?: string; repeat?: string; fallback?: string };
type VideoValue = {
  src: string;
  poster?: string;
  fit?: 'cover' | 'contain';
  position?: string;
  loop?: boolean;
  muted?: boolean;
  autoplay?: boolean;
  fallback?: string;
};
type FillValue = {
  type: 'none' | FillMode;
  color?: string;
  gradient?: GradientValue | { css?: string };
  image?: ImageValue;
  video?: VideoValue;
};

type DropdownFillState = {
  root: HTMLElement;
  input: HTMLInputElement;
  headerValue: HTMLElement | null;
  headerValueLabel: HTMLElement | null;
  headerValueChip: HTMLElement | null;
  headerLabel: HTMLElement | null;
  preview: HTMLElement | null;
  nativeColorInput: HTMLInputElement | null;
  colorPreview: HTMLElement | null;
  removeFillActions: HTMLButtonElement[];
  removeFillLabels: Array<HTMLElement | null>;
  hueInput: HTMLInputElement;
  alphaInput: HTMLInputElement;
  hexField: HTMLInputElement;
  alphaField: HTMLInputElement;
  svCanvas: HTMLElement;
  svThumb: HTMLElement;
  swatches: HTMLButtonElement[];
  hsv: { h: number; s: number; v: number; a: number };
  gradientPreview: HTMLElement | null;
  gradientAngleInput: HTMLInputElement | null;
  gradientEditor: HTMLElement | null;
  gradientStopBar: HTMLElement | null;
  gradientStopAdd: HTMLButtonElement | null;
  gradientStopButtons: Map<string, HTMLButtonElement>;
  gradientStopSv: HTMLElement | null;
  gradientStopSvThumb: HTMLElement | null;
  gradientStopHueInput: HTMLInputElement | null;
  gradientStopAlphaInput: HTMLInputElement | null;
  gradientStopHexInput: HTMLInputElement | null;
  gradientStopAlphaField: HTMLInputElement | null;
  gradientActiveStopId: string;
  gradientStops: GradientStopState[];
  gradient: { angle: number };
  gradientCss: string | null;
  gradientDrag?: { id: string; pointerId: number };
  imagePanel: HTMLElement | null;
  imagePreview: HTMLElement | null;
  uploadButton: HTMLButtonElement | null;
  replaceButton: HTMLButtonElement | null;
  removeButton: HTMLButtonElement | null;
  fileInput: HTMLInputElement | null;
  imageSrc: string | null;
  imageName: string | null;
  imageObjectUrl: string | null;
  videoPanel: HTMLElement | null;
  videoPreview: HTMLVideoElement | null;
  videoUploadButton: HTMLButtonElement | null;
  videoReplaceButton: HTMLButtonElement | null;
  videoRemoveButton: HTMLButtonElement | null;
  videoFileInput: HTMLInputElement | null;
  videoSrc: string | null;
  videoName: string | null;
  videoObjectUrl: string | null;
  allowedModes: FillMode[];
  mode: FillMode;
  nativeValue?: { get: () => string; set: (next: string) => void };
  internalWrite: boolean;
};

const MODE_ORDER: FillMode[] = ['color', 'gradient', 'image', 'video'];
const MODE_LABELS: Record<FillMode, string> = {
  color: 'Color fill',
  gradient: 'Gradient fill',
  image: 'Image fill',
  video: 'Video fill',
};
const DEFAULT_GRADIENT = {
  angle: 135,
  stops: [
    { color: '#ff3b30', position: 0 },
    { color: '#007aff', position: 100 },
  ],
};

const states = new Map<HTMLElement, DropdownFillState>();

const hydrateHost = createDropdownHydrator({
  rootSelector: '.diet-dropdown-fill',
  triggerSelector: '.diet-dropdown-fill__control',
});

export function hydrateDropdownFill(scope: Element | DocumentFragment): void {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>('.diet-dropdown-fill'));
  if (!roots.length) return;

  roots.forEach((root) => {
    if (states.has(root)) return;
    const state = createState(root);
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

let gradientStopIdCounter = 0;

function createGradientStopId(): string {
  gradientStopIdCounter += 1;
  return `gradient-stop-${gradientStopIdCounter}`;
}

function createGradientStopState(root: HTMLElement, stop: GradientStop): GradientStopState {
  const parsed = parseColor(stop.color, root);
  const safeColor = parsed ? stop.color : DEFAULT_GRADIENT.stops[0].color;
  const hsv = parsed || parseColor(safeColor, root) || { h: 0, s: 0, v: 0, a: 1 };
  return {
    id: createGradientStopId(),
    color: safeColor,
    position: clampNumber(stop.position, 0, 100),
    hsv,
  };
}

function createDefaultGradientStops(root: HTMLElement): GradientStopState[] {
  return DEFAULT_GRADIENT.stops.map((stop) => createGradientStopState(root, stop));
}

function createState(root: HTMLElement): DropdownFillState | null {
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
  const uploadButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__upload-btn');
  const replaceButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__replace-btn');
  const removeButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__remove-btn');
  const fileInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__file-input');
  const videoPanel = root.querySelector<HTMLElement>('.diet-dropdown-fill__panel--video');
  const videoPreview = root.querySelector<HTMLVideoElement>('.diet-dropdown-fill__video-preview');
  const videoUploadButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__video-upload-btn');
  const videoReplaceButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__video-replace-btn');
  const videoRemoveButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__video-remove-btn');
  const videoFileInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__video-file-input');

  if (!input || !hueInput || !alphaInput || !hexField || !alphaField || !svCanvas || !svThumb) {
    return null;
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
    uploadButton,
    replaceButton,
    removeButton,
    fileInput,
    imageSrc: null,
    imageName: null,
    imageObjectUrl: null,
    videoPanel,
    videoPreview,
    videoUploadButton,
    videoReplaceButton,
    videoRemoveButton,
    videoFileInput,
    videoSrc: null,
    videoName: null,
    videoObjectUrl: null,
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
  installGradientHandlers(state);
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

function installGradientHandlers(state: DropdownFillState) {
  if (state.gradientAngleInput) {
    state.gradientAngleInput.addEventListener('input', () => {
      const angle = clampNumber(Number(state.gradientAngleInput?.value), 0, 360);
      state.gradientCss = null;
      state.gradient.angle = angle;
      syncGradientUI(state, { commit: true });
    });
  }
  installGradientStopBarHandlers(state);
  installGradientEditorHandlers(state);
}

function ensureGradientStops(state: DropdownFillState) {
  if (state.gradientStops.length >= 2) return;
  state.gradientStops = createDefaultGradientStops(state.root);
  state.gradientActiveStopId = state.gradientStops[0]?.id ?? '';
}

function getSortedGradientStops(stops: GradientStopState[]): GradientStopState[] {
  return [...stops].sort((a, b) => a.position - b.position);
}

function getActiveGradientStop(state: DropdownFillState): GradientStopState {
  let active = state.gradientStops.find((stop) => stop.id === state.gradientActiveStopId);
  if (!active) {
    ensureGradientStops(state);
    active = state.gradientStops[0];
    state.gradientActiveStopId = active?.id ?? '';
  }
  return active as GradientStopState;
}

function getGradientStopMetrics(state: DropdownFillState): { rect: DOMRect; minX: number; maxX: number } | null {
  const bar = state.gradientStopBar;
  if (!bar) return null;
  const rect = bar.getBoundingClientRect();
  if (!rect.width) return null;
  const sampleButton = state.gradientStopButtons.values().next().value as HTMLButtonElement | undefined;
  const sampleRect = sampleButton?.getBoundingClientRect();
  const sizeFallback = parseFloat(getComputedStyle(bar).getPropertyValue('--control-size-md')) || 24;
  const stopSize = sampleRect?.width || sizeFallback;
  const half = stopSize / 2;
  const minX = half;
  const maxX = Math.max(half, rect.width - half);
  return { rect, minX, maxX };
}

function gradientPercentToPx(state: DropdownFillState, position: number): number | null {
  const metrics = getGradientStopMetrics(state);
  if (!metrics) return null;
  const percent = clampNumber(position, 0, 100);
  const span = metrics.maxX - metrics.minX;
  if (span <= 0) return metrics.minX;
  return metrics.minX + (span * percent) / 100;
}

function gradientPxToPercent(state: DropdownFillState, clientX: number): number {
  const metrics = getGradientStopMetrics(state);
  if (!metrics) return 0;
  const x = clampNumber(clientX - metrics.rect.left, metrics.minX, metrics.maxX);
  const span = metrics.maxX - metrics.minX;
  if (span <= 0) return 0;
  return clampNumber(((x - metrics.minX) / span) * 100, 0, 100);
}

function getActiveGradientStopIndex(state: DropdownFillState): { sorted: GradientStopState[]; index: number } {
  const sorted = getSortedGradientStops(state.gradientStops);
  const index = sorted.findIndex((stop) => stop.id === state.gradientActiveStopId);
  return { sorted, index };
}

function updateGradientAddButton(state: DropdownFillState) {
  const button = state.gradientStopAdd;
  if (!button) return;
  const { sorted, index } = getActiveGradientStopIndex(state);
  const removable = index > 0 && index < sorted.length - 1;
  button.textContent = removable ? '-' : '+';
  button.classList.toggle('is-remove', removable);
  button.setAttribute('aria-label', removable ? 'Remove color stop' : 'Add color stop');
}

function syncGradientStopButtons(state: DropdownFillState) {
  const bar = state.gradientStopBar;
  if (!bar) return;
  const sorted = getSortedGradientStops(state.gradientStops);
  const existing = state.gradientStopButtons;
  const keep = new Set(sorted.map((stop) => stop.id));

  Array.from(existing.entries()).forEach(([id, btn]) => {
    if (!keep.has(id)) {
      btn.remove();
      existing.delete(id);
    }
  });

  sorted.forEach((stop) => {
    let btn = existing.get(stop.id);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'diet-dropdown-fill__gradient-stop-btn';
      btn.dataset.stopId = stop.id;
      btn.setAttribute('aria-label', 'Edit gradient stop');
      bindGradientStopButton(state, btn, stop.id);
      existing.set(stop.id, btn);
      bar.appendChild(btn);
    }
    const leftPx = gradientPercentToPx(state, stop.position);
    btn.style.left = leftPx == null ? `${stop.position}%` : `${leftPx}px`;
    btn.style.setProperty('--stop-color', stop.color);
    const isActive = stop.id === state.gradientActiveStopId;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function syncActiveGradientStopUI(state: DropdownFillState) {
  const stop = getActiveGradientStop(state);
  const hsv = stop.hsv;
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const hex = formatHex({ h: hsv.h, s: hsv.s, v: hsv.v, a: 1 });
  const alphaPercent = Math.round(hsv.a * 100);

  if (state.gradientEditor) {
    state.gradientEditor.style.setProperty('--picker-hue', hsv.h.toString());
    state.gradientEditor.style.setProperty('--picker-rgb', `${rgb.r} ${rgb.g} ${rgb.b}`);
  }

  if (state.gradientStopHueInput) {
    state.gradientStopHueInput.value = hsv.h.toString();
    state.gradientStopHueInput.style.setProperty('--value', state.gradientStopHueInput.value);
    state.gradientStopHueInput.style.setProperty('--min', '0');
    state.gradientStopHueInput.style.setProperty('--max', '360');
  }
  if (state.gradientStopAlphaInput) {
    state.gradientStopAlphaInput.value = alphaPercent.toString();
    state.gradientStopAlphaInput.style.setProperty('--value', state.gradientStopAlphaInput.value);
    state.gradientStopAlphaInput.style.setProperty('--min', '0');
    state.gradientStopAlphaInput.style.setProperty('--max', '100');
  }
  if (state.gradientStopHexInput) {
    state.gradientStopHexInput.value = hex;
  }
  if (state.gradientStopAlphaField) {
    state.gradientStopAlphaField.value = `${alphaPercent}%`;
  }
  if (state.gradientStopSvThumb) {
    const left = `${hsv.s * 100}%`;
    const top = `${(1 - hsv.v) * 100}%`;
    state.gradientStopSvThumb.style.left = left;
    state.gradientStopSvThumb.style.top = top;
  }

  const normalizedCurrent = normalizeHex(hex);
  state.swatches.forEach((swatch) => {
    if (getSwatchTarget(swatch) !== 'gradient') return;
    const swatchHex = normalizeHex(swatch.dataset.color || '');
    const match = Boolean(normalizedCurrent && swatchHex && swatchHex === normalizedCurrent);
    swatch.classList.toggle('is-selected', match);
    swatch.setAttribute('aria-pressed', match ? 'true' : 'false');
  });
}

function setActiveGradientStop(state: DropdownFillState, stopId: string) {
  state.gradientActiveStopId = stopId;
  syncGradientStopButtons(state);
  syncActiveGradientStopUI(state);
  updateGradientAddButton(state);
}

function updateGradientPreview(state: DropdownFillState, opts: { commit: boolean; updateHeader?: boolean; updateRemove?: boolean }) {
  const shouldUpdateHeader = opts.updateHeader !== false;
  const shouldUpdateRemove = opts.updateRemove !== false;
  const css = state.gradientCss || buildGradientCss(state);
  if (state.gradientPreview) state.gradientPreview.style.backgroundImage = css;
  if (opts.commit) {
    setInputValue(state, buildGradientFill(state), true);
  }
  if (shouldUpdateHeader) {
    updateHeader(state, { text: '', muted: false, chipColor: css });
  }
  if (shouldUpdateRemove) {
    setRemoveFillState(state, false);
  }
}

function addGradientStop(state: DropdownFillState) {
  ensureGradientStops(state);
  const sorted = getSortedGradientStops(state.gradientStops);
  const active = getActiveGradientStop(state);
  const activeIndex = sorted.findIndex((stop) => stop.id === active.id);
  const right = sorted[activeIndex + 1] ?? null;
  const left = sorted[activeIndex - 1] ?? null;
  let position = 50;
  if (right) {
    position = (active.position + right.position) / 2;
  } else if (left) {
    position = (left.position + active.position) / 2;
  }
  const stop = createGradientStopState(state.root, { color: active.color, position });
  stop.hsv = { ...active.hsv };
  state.gradientStops.push(stop);
  state.gradientActiveStopId = stop.id;
  state.gradientCss = null;
  syncGradientUI(state, { commit: true });
}

function removeGradientStop(state: DropdownFillState, stopId: string) {
  if (state.gradientStops.length <= 2) return;
  const idx = state.gradientStops.findIndex((stop) => stop.id === stopId);
  if (idx === -1) return;
  const removed = state.gradientStops[idx];
  state.gradientStops.splice(idx, 1);
  if (state.gradientActiveStopId === stopId) {
    const sorted = getSortedGradientStops(state.gradientStops);
    let nearest = sorted[0];
    let dist = Math.abs((nearest?.position ?? 0) - removed.position);
    sorted.forEach((stop) => {
      const nextDist = Math.abs(stop.position - removed.position);
      if (nextDist < dist) {
        dist = nextDist;
        nearest = stop;
      }
    });
    state.gradientActiveStopId = nearest?.id ?? '';
  }
  state.gradientCss = null;
  syncGradientUI(state, { commit: true });
}

function bindGradientStopButton(state: DropdownFillState, button: HTMLButtonElement, stopId: string) {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    setActiveGradientStop(state, stopId);
  });
}

function commitGradientStopFromHsv(state: DropdownFillState) {
  const stop = getActiveGradientStop(state);
  stop.color = colorStringFromHsv(stop.hsv);
  state.gradientCss = null;
  syncGradientUI(state, { commit: true });
}

function handleGradientStopHexInput(state: DropdownFillState) {
  if (!state.gradientStopHexInput) return;
  const stop = getActiveGradientStop(state);
  const hsv = stop.hsv;
  const raw = state.gradientStopHexInput.value.trim();
  if (!raw) {
    state.gradientStopHexInput.value = formatHex(hsv);
    return;
  }
  const normalized = raw.startsWith('#') ? raw : `#${raw}`;
  const rgba = hexToRgba(normalized);
  if (!rgba) {
    state.gradientStopHexInput.value = formatHex(hsv);
    return;
  }
  const next = rgbToHsv(rgba.r, rgba.g, rgba.b, 1);
  hsv.h = next.h;
  hsv.s = next.s;
  hsv.v = next.v;
  commitGradientStopFromHsv(state);
}

function handleGradientStopAlphaField(state: DropdownFillState) {
  if (!state.gradientStopAlphaField) return;
  const stop = getActiveGradientStop(state);
  const hsv = stop.hsv;
  const raw = state.gradientStopAlphaField.value.trim().replace('%', '');
  if (!raw) {
    state.gradientStopAlphaField.value = `${Math.round(hsv.a * 100)}%`;
    return;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    state.gradientStopAlphaField.value = `${Math.round(hsv.a * 100)}%`;
    return;
  }
  const percent = clampNumber(parsed, 0, 100);
  hsv.a = percent / 100;
  commitGradientStopFromHsv(state);
}

function installGradientStopBarHandlers(state: DropdownFillState) {
  if (state.gradientStopAdd) {
    state.gradientStopAdd.addEventListener('click', (event) => {
      event.preventDefault();
      const { sorted, index } = getActiveGradientStopIndex(state);
      const removable = index > 0 && index < sorted.length - 1;
      if (removable) {
        removeGradientStop(state, state.gradientActiveStopId);
        return;
      }
      addGradientStop(state);
    });
  }

  const bar = state.gradientStopBar;
  if (!bar) return;

  const getStopIdFromTarget = (target: EventTarget | null): string | null => {
    if (!(target instanceof HTMLElement)) return null;
    const btn = target.closest<HTMLButtonElement>('.diet-dropdown-fill__gradient-stop-btn');
    return btn?.dataset.stopId ?? null;
  };

  const findNearestStopId = (clientX: number): string | null => {
    if (!state.gradientStops.length) return null;
    const percent = gradientPxToPercent(state, clientX);
    const sorted = getSortedGradientStops(state.gradientStops);
    let nearest = sorted[0];
    let dist = Math.abs(nearest.position - percent);
    sorted.forEach((stop) => {
      const nextDist = Math.abs(stop.position - percent);
      if (nextDist < dist) {
        dist = nextDist;
        nearest = stop;
      }
    });
    return nearest?.id ?? null;
  };

  const moveStop = (stopId: string, event: PointerEvent) => {
    const stop = state.gradientStops.find((entry) => entry.id === stopId);
    if (!stop) return;
    stop.position = gradientPxToPercent(state, event.clientX);
    state.gradientCss = null;
    syncGradientStopButtons(state);
    updateGradientPreview(state, { commit: true, updateHeader: true, updateRemove: false });
  };

  const finishDrag = (stopId: string, event: PointerEvent) => {
    const rect = bar.getBoundingClientRect();
    const outside = event.clientY < rect.top - 24 || event.clientY > rect.bottom + 24;
    state.gradientDrag = undefined;
    if (outside) {
      removeGradientStop(state, stopId);
      return;
    }
    syncGradientStopButtons(state);
    updateGradientPreview(state, { commit: true, updateHeader: true });
  };

  bar.addEventListener('pointerdown', (event) => {
    const stopId = getStopIdFromTarget(event.target) || findNearestStopId(event.clientX);
    if (!stopId) return;
    event.preventDefault();
    setActiveGradientStop(state, stopId);
    state.gradientDrag = { id: stopId, pointerId: event.pointerId };
    bar.setPointerCapture(event.pointerId);
  });

  bar.addEventListener('pointermove', (event) => {
    if (!state.gradientDrag) return;
    if (state.gradientDrag.pointerId !== event.pointerId) return;
    if (event.pressure === 0 && event.buttons === 0) return;
    moveStop(state.gradientDrag.id, event);
  });

  bar.addEventListener('pointerup', (event) => {
    if (!state.gradientDrag) return;
    if (state.gradientDrag.pointerId !== event.pointerId) return;
    finishDrag(state.gradientDrag.id, event);
  });

  bar.addEventListener('pointercancel', (event) => {
    if (!state.gradientDrag) return;
    if (state.gradientDrag.pointerId !== event.pointerId) return;
    finishDrag(state.gradientDrag.id, event);
  });
}

function installGradientEditorHandlers(state: DropdownFillState) {
  if (state.gradientStopSv) {
    const move = (event: PointerEvent | MouseEvent) => {
      const rect = state.gradientStopSv?.getBoundingClientRect();
      if (!rect) return;
      const x = clampNumber(event.clientX - rect.left, 0, rect.width);
      const y = clampNumber(event.clientY - rect.top, 0, rect.height);
      const s = rect.width ? x / rect.width : 0;
      const v = rect.height ? 1 - y / rect.height : 0;
      const stop = getActiveGradientStop(state);
      stop.hsv.s = clampNumber(s, 0, 1);
      stop.hsv.v = clampNumber(v, 0, 1);
      if (stop.hsv.a === 0) stop.hsv.a = 1;
      commitGradientStopFromHsv(state);
    };

    const handlePointerDown = (event: PointerEvent) => {
      event.preventDefault();
      state.gradientStopSv?.setPointerCapture(event.pointerId);
      move(event);
    };

    state.gradientStopSv.addEventListener('pointerdown', handlePointerDown);
    state.gradientStopSv.addEventListener('pointermove', (event) => {
      if (event.pressure === 0 && event.buttons === 0) return;
      move(event);
    });
    state.gradientStopSv.addEventListener('click', (event) => {
      move(event);
    });
  }

  if (state.gradientStopHueInput) {
    state.gradientStopHueInput.addEventListener('input', () => {
      const hue = clampNumber(Number(state.gradientStopHueInput?.value), 0, 360);
      const stop = getActiveGradientStop(state);
      stop.hsv.h = hue;
      if (stop.hsv.a === 0) stop.hsv.a = 1;
      commitGradientStopFromHsv(state);
    });
  }

  if (state.gradientStopAlphaInput) {
    state.gradientStopAlphaInput.addEventListener('input', () => {
      const alpha = clampNumber(Number(state.gradientStopAlphaInput?.value) / 100, 0, 1);
      const stop = getActiveGradientStop(state);
      stop.hsv.a = alpha;
      commitGradientStopFromHsv(state);
    });
  }

  if (state.gradientStopHexInput) {
    const handler = () => handleGradientStopHexInput(state);
    state.gradientStopHexInput.addEventListener('change', handler);
    state.gradientStopHexInput.addEventListener('blur', handler);
  }

  if (state.gradientStopAlphaField) {
    const handler = () => handleGradientStopAlphaField(state);
    state.gradientStopAlphaField.addEventListener('change', handler);
    state.gradientStopAlphaField.addEventListener('blur', handler);
  }
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

function installImageHandlers(state: DropdownFillState) {
  const { uploadButton, replaceButton, removeButton, fileInput } = state;
  if (uploadButton && fileInput) {
    uploadButton.addEventListener('click', (event) => {
      event.preventDefault();
      fileInput.value = '';
      fileInput.click();
    });
  }
  if (replaceButton && fileInput) {
    replaceButton.addEventListener('click', (event) => {
      event.preventDefault();
      fileInput.value = '';
      fileInput.click();
    });
  }
  if (removeButton) {
    removeButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (state.imageObjectUrl) {
        URL.revokeObjectURL(state.imageObjectUrl);
        state.imageObjectUrl = null;
      }
      setImageSrc(state, null, { commit: true });
    });
  }
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      state.imageName = file.name || null;
      setFillUploadingState(state, true);
      updateHeader(state, { text: `Uploading ${file.name}...`, muted: true, chipColor: null });
      try {
        const uploadedUrl = await uploadEditorAsset({
          file,
          variant: 'original',
          source: 'api',
        });
        setImageSrc(state, uploadedUrl, { commit: true });
      } catch {
        updateHeader(state, { text: 'Upload failed', muted: true, chipColor: null, noneChip: true });
      } finally {
        setFillUploadingState(state, false);
        fileInput.value = '';
      }
    });
  }
}

function installVideoHandlers(state: DropdownFillState) {
  const { videoUploadButton, videoReplaceButton, videoRemoveButton, videoFileInput } = state;
  if (videoUploadButton && videoFileInput) {
    videoUploadButton.addEventListener('click', (event) => {
      event.preventDefault();
      videoFileInput.value = '';
      videoFileInput.click();
    });
  }
  if (videoReplaceButton && videoFileInput) {
    videoReplaceButton.addEventListener('click', (event) => {
      event.preventDefault();
      videoFileInput.value = '';
      videoFileInput.click();
    });
  }
  if (videoRemoveButton) {
    videoRemoveButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (state.videoObjectUrl) {
        URL.revokeObjectURL(state.videoObjectUrl);
        state.videoObjectUrl = null;
      }
      setVideoSrc(state, null, { commit: true });
    });
  }
  if (videoFileInput) {
    videoFileInput.addEventListener('change', async () => {
      const file = videoFileInput.files && videoFileInput.files[0];
      if (!file) return;
      state.videoName = file.name || null;
      setFillUploadingState(state, true);
      updateHeader(state, { text: `Uploading ${file.name}...`, muted: true, chipColor: null });
      try {
        const uploadedUrl = await uploadEditorAsset({
          file,
          variant: 'original',
          source: 'api',
        });
        setVideoSrc(state, uploadedUrl, { commit: true });
      } catch {
        updateHeader(state, { text: 'Upload failed', muted: true, chipColor: null, noneChip: true });
      } finally {
        setFillUploadingState(state, false);
        videoFileInput.value = '';
      }
    });
  }
}

function setFillUploadingState(state: DropdownFillState, uploading: boolean) {
  state.root.dataset.uploading = uploading ? 'true' : 'false';
  if (state.uploadButton) state.uploadButton.disabled = uploading;
  if (state.replaceButton) state.replaceButton.disabled = uploading;
  if (state.removeButton) state.removeButton.disabled = uploading;
  if (state.videoUploadButton) state.videoUploadButton.disabled = uploading;
  if (state.videoReplaceButton) state.videoReplaceButton.disabled = uploading;
  if (state.videoRemoveButton) state.videoRemoveButton.disabled = uploading;
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

function colorStringFromHsv(hsv: { h: number; s: number; v: number; a: number }): string {
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  return hsv.a < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${roundTo(hsv.a, 2)})` : formatHex({ ...hsv, a: 1 });
}

function resolveFallbackFromState(state: DropdownFillState): string {
  if (state.hsv.a <= 0) return 'var(--color-system-white)';
  return colorStringFromHsv(state.hsv);
}

function setImageSrc(
  state: DropdownFillState,
  src: string | null,
  opts: { commit: boolean; updateHeader?: boolean; updateRemove?: boolean },
) {
  const shouldUpdateHeader = opts.updateHeader !== false;
  const shouldUpdateRemove = opts.updateRemove !== false;
  const prev = state.imageSrc;
  if (state.imageObjectUrl && prev && prev === state.imageObjectUrl && src !== prev) {
    URL.revokeObjectURL(state.imageObjectUrl);
    state.imageObjectUrl = null;
  }
  state.imageSrc = src;
  if (!src) {
    state.imageName = null;
  } else if (!state.imageObjectUrl || src !== state.imageObjectUrl) {
    state.imageName = null;
  }
  if (opts.commit) {
    const fallback = resolveFallbackFromState(state);
    const fill: FillValue = src
      ? { type: 'image', image: { src, fit: 'cover', position: 'center', repeat: 'no-repeat', fallback } }
      : { type: 'none' };
    setInputValue(state, fill, true);
  }
  if (state.imagePanel) {
    state.imagePanel.dataset.hasImage = src ? 'true' : 'false';
  }
  if (state.imagePreview) {
    state.imagePreview.style.backgroundImage = src ? `url("${src}")` : 'none';
  }
  if (shouldUpdateHeader) {
    const placeholder = state.headerValue?.dataset.placeholder ?? '';
    if (src) {
      const label = state.imageName || extractFileName(src) || 'Image selected';
      updateHeader(state, { text: label, muted: false, chipColor: null });
    } else {
      updateHeader(state, { text: placeholder, muted: true, chipColor: null });
    }
  }
  if (shouldUpdateRemove) {
    setRemoveFillState(state, !src);
  }
}

function setVideoSrc(
  state: DropdownFillState,
  src: string | null,
  opts: { commit: boolean; updateHeader?: boolean; updateRemove?: boolean },
) {
  const shouldUpdateHeader = opts.updateHeader !== false;
  const shouldUpdateRemove = opts.updateRemove !== false;
  const prev = state.videoSrc;
  if (state.videoObjectUrl && prev && prev === state.videoObjectUrl && src !== prev) {
    URL.revokeObjectURL(state.videoObjectUrl);
    state.videoObjectUrl = null;
  }
  state.videoSrc = src;
  if (!src) {
    state.videoName = null;
  } else if (!state.videoObjectUrl || src !== state.videoObjectUrl) {
    state.videoName = null;
  }
  if (opts.commit) {
    const fallback = resolveFallbackFromState(state);
    const fill: FillValue = src
      ? {
          type: 'video',
          video: { src, fit: 'cover', position: 'center', loop: true, muted: true, autoplay: true, fallback },
        }
      : { type: 'none' };
    setInputValue(state, fill, true);
  }
  if (state.videoPanel) {
    state.videoPanel.dataset.hasVideo = src ? 'true' : 'false';
  }
  if (state.videoPreview) {
    state.videoPreview.src = src || '';
    if (src) state.videoPreview.load();
  }
  if (shouldUpdateHeader) {
    const placeholder = state.headerValue?.dataset.placeholder ?? '';
    if (src) {
      const label = state.videoName || extractFileName(src) || 'Video selected';
      updateHeader(state, { text: label, muted: false, chipColor: null });
    } else {
      updateHeader(state, { text: placeholder, muted: true, chipColor: null });
    }
  }
  if (shouldUpdateRemove) {
    setRemoveFillState(state, !src);
  }
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
        const stop = getActiveGradientStop(state);
        stop.hsv.h = parsed.h;
        stop.hsv.s = parsed.s;
        stop.hsv.v = parsed.v;
        stop.hsv.a = 1;
        commitGradientStopFromHsv(state);
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

function normalizeGradientColor(state: DropdownFillState, raw: string, fallback: string): string {
  let value = raw.trim();
  if (!value) return fallback;
  if (!value.startsWith('#') && /^[0-9a-f]{3,8}$/i.test(value)) {
    value = `#${value}`;
  }
  const parsed = parseColor(value, state.root);
  return parsed ? value : fallback;
}

function normalizeGradientStopsForOutput(state: DropdownFillState): GradientStop[] {
  const fallbackStops = DEFAULT_GRADIENT.stops;
  const sourceStops = state.gradientStops.length >= 2 ? getSortedGradientStops(state.gradientStops) : null;
  const stopsToUse = sourceStops ?? fallbackStops.map((stop) => ({ ...stop }));
  return stopsToUse.map((stop: GradientStop | GradientStopState, index) => {
    const fallback = fallbackStops[Math.min(index, fallbackStops.length - 1)]?.color || fallbackStops[0].color;
    return {
      color: normalizeGradientColor(state, stop.color, fallback),
      position: clampNumber(stop.position, 0, 100),
    };
  });
}

function buildGradientFill(state: DropdownFillState): FillValue {
  const angle = clampNumber(state.gradient.angle, 0, 360);
  const normalizedStops = normalizeGradientStopsForOutput(state);
  return {
    type: 'gradient',
    gradient: {
      kind: 'linear',
      angle,
      stops: normalizedStops,
    },
  };
}

function buildGradientCss(state: DropdownFillState): string {
  const angle = clampNumber(state.gradient.angle, 0, 360);
  const normalizedStops = normalizeGradientStopsForOutput(state);
  const stopList = normalizedStops.map((stop) => `${stop.color} ${clampNumber(stop.position, 0, 100)}%`).join(', ');
  return `linear-gradient(${angle}deg, ${stopList})`;
}

function syncGradientUI(state: DropdownFillState, opts: { commit: boolean; updateHeader?: boolean; updateRemove?: boolean }) {
  const shouldUpdateHeader = opts.updateHeader !== false;
  const shouldUpdateRemove = opts.updateRemove !== false;
  ensureGradientStops(state);
  if (state.gradientAngleInput) {
    state.gradientAngleInput.value = String(clampNumber(state.gradient.angle, 0, 360));
    state.gradientAngleInput.style.setProperty('--value', state.gradientAngleInput.value);
    state.gradientAngleInput.style.setProperty('--min', '0');
    state.gradientAngleInput.style.setProperty('--max', '360');
  }
  syncGradientStopButtons(state);
  syncActiveGradientStopUI(state);
  updateGradientAddButton(state);
  updateGradientPreview(state, { commit: opts.commit, updateHeader: shouldUpdateHeader, updateRemove: shouldUpdateRemove });
}

function normalizeImageValue(raw: unknown): ImageValue {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { src: '', fit: 'cover', position: 'center', repeat: 'no-repeat', fallback: '' };
  }
  const value = raw as Record<string, unknown>;
  const srcRaw = typeof value.src === 'string' ? value.src.trim() : '';
  const src = isPersistedAssetUrl(srcRaw) ? srcRaw : '';
  const fit = value.fit === 'contain' ? 'contain' : 'cover';
  const position = typeof value.position === 'string' && value.position.trim() ? value.position.trim() : 'center';
  const repeat = typeof value.repeat === 'string' && value.repeat.trim() ? value.repeat.trim() : 'no-repeat';
  const fallback = typeof value.fallback === 'string' ? value.fallback.trim() : '';
  return { src, fit, position, repeat, fallback };
}

function normalizeVideoValue(raw: unknown): VideoValue {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { src: '', poster: '', fit: 'cover', position: 'center', loop: true, muted: true, autoplay: true, fallback: '' };
  }
  const value = raw as Record<string, unknown>;
  const srcRaw = typeof value.src === 'string' ? value.src.trim() : '';
  const posterRaw = typeof value.poster === 'string' ? value.poster.trim() : '';
  const src = isPersistedAssetUrl(srcRaw) ? srcRaw : '';
  const poster = isPersistedAssetUrl(posterRaw) ? posterRaw : '';
  const fit = value.fit === 'contain' ? 'contain' : 'cover';
  const position = typeof value.position === 'string' && value.position.trim() ? value.position.trim() : 'center';
  const loop = typeof value.loop === 'boolean' ? value.loop : true;
  const muted = typeof value.muted === 'boolean' ? value.muted : true;
  const autoplay = typeof value.autoplay === 'boolean' ? value.autoplay : true;
  const fallback = typeof value.fallback === 'string' ? value.fallback.trim() : '';
  return { src, poster, fit, position, loop, muted, autoplay, fallback };
}

function normalizeGradientValue(raw: unknown): GradientValue | { css?: string } | undefined {
  if (typeof raw === 'string') {
    const css = raw.trim();
    return css ? { css } : undefined;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const value = raw as Record<string, unknown>;
  const css = typeof value.css === 'string' ? value.css.trim() : '';
  if (css) return { css };
  const kindRaw = typeof value.kind === 'string' ? value.kind.trim() : '';
  const kind: GradientValue['kind'] = kindRaw === 'radial' || kindRaw === 'conic' ? kindRaw : 'linear';
  const angle = clampNumber(typeof value.angle === 'number' ? value.angle : 0, 0, 360);
  const stopsRaw = Array.isArray(value.stops) ? value.stops : [];
  const stops = stopsRaw
    .map((stop) => {
      if (!stop || typeof stop !== 'object' || Array.isArray(stop)) return null;
      const entry = stop as Record<string, unknown>;
      const color = typeof entry.color === 'string' ? entry.color.trim() : '';
      if (!color) return null;
      const position = clampNumber(typeof entry.position === 'number' ? entry.position : 0, 0, 100);
      return { color, position };
    })
    .filter((stop): stop is GradientStop => Boolean(stop));
  return { kind, angle, stops };
}

function coerceFillValue(raw: Record<string, unknown>): FillValue | null {
  const typeRaw = typeof raw.type === 'string' ? raw.type.trim().toLowerCase() : '';
  if (!typeRaw) return { type: 'none' };
  if (typeRaw === 'none') return { type: 'none' };
  if (!MODE_ORDER.includes(typeRaw as FillMode)) return null;

  if (typeRaw === 'color') {
    const color = typeof raw.color === 'string' ? raw.color.trim() : '';
    const value = typeof raw.value === 'string' ? raw.value.trim() : '';
    return { type: 'color', color: color || value || 'transparent' };
  }
  if (typeRaw === 'gradient') {
    return { type: 'gradient', gradient: normalizeGradientValue(raw.gradient) };
  }
  if (typeRaw === 'image') {
    return { type: 'image', image: normalizeImageValue(raw.image) };
  }
  if (typeRaw === 'video') {
    return { type: 'video', video: normalizeVideoValue(raw.video) };
  }
  return { type: 'none' };
}

function isPersistedAssetUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith('/');
}

function parseFillString(value: string, root: HTMLElement): FillValue | null {
  if (!value) return { type: 'none' };
  const urlMatch = value.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  if (urlMatch && urlMatch[2]) {
    const src = urlMatch[2].trim();
    if (!isPersistedAssetUrl(src)) return null;
    return { type: 'image', image: { src, fit: 'cover', position: 'center', repeat: 'no-repeat', fallback: '' } };
  }
  if (isPersistedAssetUrl(value)) {
    return { type: 'image', image: { src: value, fit: 'cover', position: 'center', repeat: 'no-repeat', fallback: '' } };
  }
  if (/-gradient\(/i.test(value)) {
    return { type: 'gradient', gradient: { css: value } };
  }
  const parsed = parseColor(value, root);
  if (!parsed) return null;
  return { type: 'color', color: value };
}

function parseFillValue(raw: string, root: HTMLElement): FillValue | null {
  const value = String(raw ?? '').trim();
  if (!value) return { type: 'none' };
  if (value.startsWith('{') || value.startsWith('[') || value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      if (typeof parsed === 'string') return parseFillString(parsed, root);
      if (parsed == null) return { type: 'none' };
      if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return coerceFillValue(parsed as Record<string, unknown>);
    } catch {
      return parseFillString(value, root);
    }
  }
  return parseFillString(value, root);
}

function resolveModeFromFill(state: DropdownFillState, fill: FillValue): FillMode {
  const desired = fill.type === 'none' ? state.mode : fill.type;
  if (desired !== 'none' && state.allowedModes.includes(desired)) return desired;
  return state.allowedModes[0] || 'color';
}

function applyGradientFromFill(state: DropdownFillState, gradient: FillValue['gradient']) {
  state.gradient = { angle: DEFAULT_GRADIENT.angle };
  state.gradientStops = createDefaultGradientStops(state.root);
  state.gradientActiveStopId = state.gradientStops[0]?.id ?? '';
  state.gradientCss = null;
  if (!gradient || typeof gradient !== 'object' || Array.isArray(gradient)) return;
  if ('css' in gradient) {
    const css = typeof gradient.css === 'string' ? gradient.css.trim() : '';
    state.gradientCss = css || null;
    return;
  }
  const angle = typeof gradient.angle === 'number' ? gradient.angle : DEFAULT_GRADIENT.angle;
  state.gradient.angle = clampNumber(angle, 0, 360);
  if (Array.isArray(gradient.stops) && gradient.stops.length >= 2) {
    state.gradientStops = gradient.stops.map((stop) =>
      createGradientStopState(state.root, {
        color: typeof stop?.color === 'string' ? stop.color : DEFAULT_GRADIENT.stops[0].color,
        position: typeof stop?.position === 'number' ? stop.position : 0,
      }),
    );
    state.gradientActiveStopId = state.gradientStops[0]?.id ?? '';
  }
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
  const nextMode = resolveModeFromFill(state, fill);
  setMode(state, nextMode);

  if (fill.type === 'none') {
    if (nextMode === 'image') {
      setImageSrc(state, null, { commit: false });
      return;
    }
    if (nextMode === 'video') {
      setVideoSrc(state, null, { commit: false });
      return;
    }
    if (nextMode === 'gradient') {
      state.gradient = { angle: DEFAULT_GRADIENT.angle };
      state.gradientStops = createDefaultGradientStops(state.root);
      state.gradientActiveStopId = state.gradientStops[0]?.id ?? '';
      state.gradientCss = null;
      syncGradientUI(state, { commit: false });
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
    syncGradientUI(state, { commit: false });
    return;
  }

  if (fill.type === 'image') {
    setImageSrc(state, fill.image?.src || null, { commit: false });
    return;
  }

  if (fill.type === 'video') {
    setVideoSrc(state, fill.video?.src || null, { commit: false });
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
  const placeholder = state.headerValue?.dataset.placeholder ?? '';

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
  opts: { text: string; muted: boolean; chipColor: string | null; noneChip?: boolean },
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
    syncGradientUI(state, opts);
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

function parseColor(value: string, root: HTMLElement): { h: number; s: number; v: number; a: number } | null {
  const rgba = colorStringToRgba(value, root);
  if (!rgba) return null;
  return rgbToHsv(rgba.r, rgba.g, rgba.b, rgba.a);
}

function tryParseTransparentColorMix(value: string, root: HTMLElement): { r: number; g: number; b: number; a: number } | null {
  const trimmed = value.trim();
  if (!/^color-mix\(/i.test(trimmed)) return null;

  const parsePct = (raw: string): number | null => {
    const num = Number.parseFloat(raw);
    if (!Number.isFinite(num)) return null;
    if (num < 0 || num > 100) return null;
    return num / 100;
  };

  // Handle the common token pattern:
  //   color-mix(in oklab, <color>, transparent <pct>%)
  // and its symmetric form where transparent is first.
  const tailTransparent = trimmed.match(/^color-mix\(\s*in\s+oklab\s*,\s*(.+?)\s*,\s*transparent\s+([0-9.]+)%\s*\)$/i);
  const headTransparent = trimmed.match(/^color-mix\(\s*in\s+oklab\s*,\s*transparent\s+([0-9.]+)%\s*,\s*(.+?)\s*\)$/i);

  let colorExpr: string | null = null;
  let transparentWeight: number | null = null;
  if (tailTransparent) {
    colorExpr = tailTransparent[1]?.trim() ?? null;
    transparentWeight = parsePct(tailTransparent[2] ?? '');
  } else if (headTransparent) {
    transparentWeight = parsePct(headTransparent[1] ?? '');
    colorExpr = headTransparent[2]?.trim() ?? null;
  }

  if (!colorExpr || transparentWeight == null) return null;

  const base = colorStringToRgba(colorExpr, root);
  if (!base) return null;

  const baseWeight = 1 - transparentWeight;
  return { r: base.r, g: base.g, b: base.b, a: clampNumber(base.a * baseWeight, 0, 1) };
}

function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map((c) => c + c)
      .join('')}`;
  }
  if (/^[0-9a-f]{4}$/.test(hex)) {
    const expanded = hex
      .split('')
      .map((c) => c + c)
      .join('');
    return `#${expanded.slice(0, 6)}`;
  }
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  if (/^[0-9a-f]{8}$/.test(hex)) return `#${hex.slice(0, 6)}`;
  return null;
}

function extractFileName(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const urlMatch = raw.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  const source = urlMatch && urlMatch[2] ? urlMatch[2] : raw;
  const trimmed = source.split('#')[0]?.split('?')[0] ?? '';
  if (!trimmed) return null;
  const parts = trimmed.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

function hexToRgba(value: string): { r: number; g: number; b: number; a: number } | null {
  const raw = value.trim().replace(/^#/, '');
  if (!/^[0-9a-f]+$/i.test(raw)) return null;
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    return { r, g, b, a: 1 };
  }
  if (raw.length === 4) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    const a = parseInt(raw[3] + raw[3], 16) / 255;
    return { r, g, b, a };
  }
  if (raw.length === 6 || raw.length === 8) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    const a = raw.length === 8 ? parseInt(raw.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  return null;
}

function rgbToHsv(r: number, g: number, b: number, alpha = 1): { h: number; s: number; v: number; a: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    switch (max) {
      case rNorm:
        h = 60 * (((gNorm - bNorm) / delta) % 6);
        break;
      case gNorm:
        h = 60 * ((bNorm - rNorm) / delta + 2);
        break;
      case bNorm:
        h = 60 * ((rNorm - gNorm) / delta + 4);
        break;
      default:
        break;
    }
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v, a: clampNumber(alpha, 0, 1) };
}

function colorStringToRgba(
  value: string,
  root: HTMLElement,
): { r: number; g: number; b: number; a: number } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const transparentMix = tryParseTransparentColorMix(trimmed, root);
  if (transparentMix) return transparentMix;

  if (trimmed.startsWith('#')) {
    return hexToRgba(trimmed);
  }

  if (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    !/\bvar\(/i.test(trimmed) &&
    !CSS.supports('color', trimmed)
  ) {
    return null;
  }

  const computed = getComputedColor(trimmed, root);
  return parseCssColor(computed);
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

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function formatHex(hsv: { h: number; s: number; v: number; a: number }): string {
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(value: number): string {
  return clampNumber(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

function parseCssColor(computed: string): { r: number; g: number; b: number; a: number } | null {
  const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
  const clamp255 = (value: number) => Math.min(Math.max(value, 0), 255);

  const parseAlpha = (token: string | null | undefined): number => {
    if (!token) return 1;
    const raw = token.trim();
    if (!raw) return 1;
    if (raw.endsWith('%')) {
      const pct = Number.parseFloat(raw.slice(0, -1));
      return Number.isFinite(pct) ? clamp01(pct / 100) : 1;
    }
    const num = Number.parseFloat(raw);
    return Number.isFinite(num) ? clamp01(num) : 1;
  };

  const parseRgb255 = (token: string): number | null => {
    const raw = token.trim();
    if (!raw) return null;
    if (raw.endsWith('%')) {
      const pct = Number.parseFloat(raw.slice(0, -1));
      if (!Number.isFinite(pct)) return null;
      return clamp255(Math.round((pct / 100) * 255));
    }
    const num = Number.parseFloat(raw);
    if (!Number.isFinite(num)) return null;
    return clamp255(Math.round(num));
  };

  const parseSrgbChannel = (token: string): number | null => {
    const raw = token.trim();
    if (!raw) return null;
    if (raw.endsWith('%')) {
      const pct = Number.parseFloat(raw.slice(0, -1));
      if (!Number.isFinite(pct)) return null;
      return clamp255(Math.round((pct / 100) * 255));
    }
    const num = Number.parseFloat(raw);
    if (!Number.isFinite(num)) return null;
    // Spec uses 0..1 for srgb; tolerate 0..255 too.
    const normalized = num > 1 ? num / 255 : num;
    return clamp255(Math.round(clamp01(normalized) * 255));
  };

  const trimmed = computed.trim();
  const hexMatch = trimmed.match(/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch) return hexToRgba(trimmed);

  // Modern browsers may return `color(srgb r g b / a)` for computed colors.
  const srgbMatch = trimmed.match(/^color\(\s*srgb\s+(.+)\)$/i);
  if (srgbMatch) {
    const body = srgbMatch[1].trim().replace(/\)\s*$/, '');
    const [channelsPart, alphaPart] = body.split(/\s*\/\s*/);
    const channels = channelsPart.split(/\s+/).filter(Boolean);
    if (channels.length >= 3) {
      const r = parseSrgbChannel(channels[0]);
      const g = parseSrgbChannel(channels[1]);
      const b = parseSrgbChannel(channels[2]);
      if (r != null && g != null && b != null) return { r, g, b, a: parseAlpha(alphaPart) };
    }
  }

  // Handle rgb()/rgba() with commas or spaces and optional `/<alpha>` or 4th argument.
  const rgbMatch = trimmed.match(/^rgba?\(\s*(.+)\s*\)$/i);
  if (rgbMatch) {
    const body = rgbMatch[1];
    const hasSlash = body.includes('/');
    const [channelsPartRaw, alphaPartRaw] = hasSlash ? body.split(/\s*\/\s*/) : [body, null];
    const tokens = channelsPartRaw
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    let alphaToken: string | null = alphaPartRaw ? alphaPartRaw.trim() : null;
    if (!alphaToken && tokens.length >= 4) {
      alphaToken = tokens[3];
    }

    if (tokens.length >= 3) {
      const r = parseRgb255(tokens[0]);
      const g = parseRgb255(tokens[1]);
      const b = parseRgb255(tokens[2]);
      if (r != null && g != null && b != null) return { r, g, b, a: parseAlpha(alphaToken) };
    }
  }

  return null;
}

function getComputedColor(value: string, root: HTMLElement): string {
  const temp = document.createElement('div');
  temp.style.color = value;
  temp.style.display = 'none';
  root.appendChild(temp);
  const computed = getComputedStyle(temp).color;
  root.removeChild(temp);
  return computed;
}
