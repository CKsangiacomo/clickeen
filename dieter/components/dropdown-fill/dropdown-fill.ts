import { createDropdownHydrator } from '../shared/dropdownToggle';

type Mode = 'color' | 'image';

type DropdownFillState = {
  root: HTMLElement;
  input: HTMLInputElement;
  headerValue: HTMLElement | null;
  headerValueLabel: HTMLElement | null;
  headerValueChip: HTMLElement | null;
  headerLabel: HTMLElement | null;
  colorPreview: HTMLElement | null;
  removeFillAction: HTMLButtonElement | null;
  removeFillLabel: HTMLElement | null;
  hueInput: HTMLInputElement;
  alphaInput: HTMLInputElement;
  hexField: HTMLInputElement;
  alphaField: HTMLInputElement;
  svCanvas: HTMLElement;
  svThumb: HTMLElement;
  swatches: HTMLButtonElement[];
  hsv: { h: number; s: number; v: number; a: number };
  imagePanel: HTMLElement | null;
  imagePreview: HTMLElement | null;
  uploadButton: HTMLButtonElement | null;
  replaceButton: HTMLButtonElement | null;
  removeButton: HTMLButtonElement | null;
  fileInput: HTMLInputElement | null;
  imageSrc: string | null;
  imageName: string | null;
  nativeValue?: { get: () => string; set: (next: string) => void };
  internalWrite: boolean;
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
    const initialValue = state.input.value || state.input.getAttribute('value') || '';
    syncFromValue(state, initialValue);
  });

  hydrateHost(scope);
}

function createState(root: HTMLElement): DropdownFillState | null {
  const input = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__value-field');
  const headerValue = root.querySelector<HTMLElement>('.diet-dropdown-header-value');
  const headerValueLabel = root.querySelector<HTMLElement>('.diet-dropdown-fill__label');
  const headerValueChip = root.querySelector<HTMLElement>('.diet-dropdown-fill__chip');
  const headerLabel = root.querySelector<HTMLElement>('.diet-popover__header-label');
  const hueInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__hue');
  const alphaInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__alpha');
  const hexField = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__hex');
  const alphaField = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__alpha-input');
  const svCanvas = root.querySelector<HTMLElement>('.diet-dropdown-fill__sv-canvas');
  const svThumb = root.querySelector<HTMLElement>('.diet-dropdown-fill__sv-thumb');
  const colorPreview = root.querySelector<HTMLElement>('.diet-dropdown-fill__color-preview');
  const removeFillAction = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__remove-fill');
  const removeFillLabel = removeFillAction?.querySelector<HTMLElement>('.diet-btn-menuactions__label') ?? null;
  const swatches = Array.from(root.querySelectorAll<HTMLButtonElement>('.diet-dropdown-fill__swatch'));
  const imagePanel = root.querySelector<HTMLElement>(".diet-dropdown-fill__panel--image");
  const imagePreview = root.querySelector<HTMLElement>('.diet-dropdown-fill__image-preview');
  const uploadButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__upload-btn');
  const replaceButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__replace-btn');
  const removeButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__remove-btn');
  const fileInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__file-input');

  if (!input || !hueInput || !alphaInput || !hexField || !alphaField || !svCanvas || !svThumb) {
    return null;
  }

  const nativeValue = captureNativeValue(input);
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
    colorPreview,
    removeFillAction,
    removeFillLabel,
    hueInput,
    alphaInput,
    hexField,
    alphaField,
    svCanvas,
    svThumb,
    swatches,
    imagePanel,
    imagePreview,
    uploadButton,
    replaceButton,
    removeButton,
    fileInput,
    imageSrc: null,
    imageName: null,
    nativeValue,
    internalWrite: false,
    hsv: { h: 0, s: 0, v: 0, a: 0 },
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

  state.input.addEventListener('external-sync', () => syncFromValue(state, state.input.value));
  state.input.addEventListener('input', () => syncFromValue(state, state.input.value));

  state.hueInput.addEventListener('input', () => {
    const hue = clampNumber(Number(state.hueInput.value), 0, 360);
    state.hsv.h = hue;
    syncUI(state, { commit: true });
  });

  state.alphaInput.addEventListener('input', () => {
    const alpha = clampNumber(Number(state.alphaInput.value) / 100, 0, 1);
    state.hsv.a = alpha;
    syncUI(state, { commit: true });
  });

  state.hexField.addEventListener('change', () => handleHexInput(state));
  state.hexField.addEventListener('blur', () => handleHexInput(state));

  state.alphaField.addEventListener('change', () => handleAlphaField(state));
  state.alphaField.addEventListener('blur', () => handleAlphaField(state));

  installSvCanvasHandlers(state);
  installSwatchHandlers(state);
  installImageHandlers(state);

  if (state.removeFillAction) {
    state.removeFillAction.addEventListener('click', (event) => {
      event.preventDefault();
      if (state.removeFillAction?.disabled) return;
      state.hsv.a = 0;
      syncUI(state, { commit: true });
    });
  }
}

function installSvCanvasHandlers(state: DropdownFillState) {
  const move = (event: PointerEvent) => {
    const rect = state.svCanvas.getBoundingClientRect();
    const x = clampNumber(event.clientX - rect.left, 0, rect.width);
    const y = clampNumber(event.clientY - rect.top, 0, rect.height);
    const s = rect.width ? x / rect.width : 0;
    const v = rect.height ? 1 - y / rect.height : 0;
    state.hsv.s = clampNumber(s, 0, 1);
    state.hsv.v = clampNumber(v, 0, 1);
    syncUI(state, { commit: true });
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
      setImageSrc(state, null, { commit: true });
    });
  }
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      state.imageName = file.name || null;
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : null;
        setImageSrc(state, result, { commit: true });
      };
      reader.readAsDataURL(file);
    });
  }
}

function setInputValue(state: DropdownFillState, value: string, emit: boolean) {
  state.internalWrite = true;
  state.input.value = value;
  state.internalWrite = false;
  if (emit) {
    state.input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function setImageSrc(state: DropdownFillState, src: string | null, opts: { commit: boolean }) {
  state.imageSrc = src;
  if (opts.commit) {
    const cssValue = src ? `url("${src}") center center / cover no-repeat` : 'transparent';
    setInputValue(state, cssValue, true);
  }
  if (state.imagePanel) {
    state.imagePanel.dataset.hasImage = src ? 'true' : 'false';
  }
  if (state.imagePreview) {
    if (src) {
      state.imagePreview.style.backgroundImage = `url("${src}")`;
    } else {
      state.imagePreview.style.backgroundImage = 'none';
    }
  }
  const placeholder = state.headerValue?.dataset.placeholder ?? '';
  if (src) {
    const label = state.imageName || extractFileName(state.input.value) || 'Image selected';
    updateHeader(state, { text: label, muted: false, chipColor: null });
  } else {
    state.imageName = null;
    updateHeader(state, { text: placeholder, muted: true, chipColor: null });
  }
}

function installSwatchHandlers(state: DropdownFillState) {
  state.swatches.forEach((swatch) => {
    swatch.addEventListener('click', (event) => {
      event.preventDefault();
      const color = swatch.dataset.color || '';
      const parsed = parseColor(color, state.root);
      if (!parsed) return;
      // Swatches set a solid color with full opacity.
      state.hsv = { ...parsed, a: 1 };
      syncUI(state, { commit: true });
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
  state.hsv = { ...rgbToHsv(rgba.r, rgba.g, rgba.b, 1), a: state.hsv.a };
  syncUI(state, { commit: true });
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
  syncUI(state, { commit: true });
}

function syncFromValue(state: DropdownFillState, raw: string) {
  const value = String(raw ?? '').trim();

  const urlMatch = value.match(/url\\(['"]?(.*?)['"]?\\)/i);
  if (urlMatch && urlMatch[1]) {
    setImageSrc(state, urlMatch[1], { commit: false });
    return;
  }

  if (!value) {
    state.imageSrc = null;
    state.imageName = null;
    state.hsv = { h: 0, s: 0, v: 0, a: 0 };
    syncUI(state, { commit: false });
    return;
  }

  const parsed = parseColor(value, state.root);
  if (!parsed) {
    state.imageSrc = null;
    state.imageName = null;
    state.hsv = { h: 0, s: 0, v: 0, a: 0 };
    state.root.dataset.invalid = 'true';
    syncUI(state, { commit: false });
    return;
  }

  delete state.root.dataset.invalid;
  state.imageSrc = null;
  state.imageName = null;
  state.hsv = parsed;
  syncUI(state, { commit: false });
}

function syncUI(state: DropdownFillState, opts: { commit: boolean }) {
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
    setInputValue(state, colorString, true);
  }

  if (alphaPercent === 0) {
    updateHeader(state, { text: placeholder, muted: true, chipColor: null });
  } else {
    updateHeader(state, { text: '', muted: false, chipColor: colorString });
  }

  if (state.colorPreview) {
    state.colorPreview.style.backgroundColor = colorString;
  }

  if (state.removeFillAction) {
    const isEmpty = alphaPercent === 0;
    state.removeFillAction.disabled = isEmpty;
    if (state.removeFillLabel) {
      state.removeFillLabel.textContent = isEmpty ? 'No fill to remove' : 'Remove fill';
    }
  }

  const normalizedCurrent = normalizeHex(hex);
  state.swatches.forEach((swatch) => {
    const swatchHex = normalizeHex(swatch.dataset.color || '');
    const match = Boolean(normalizedCurrent && swatchHex && swatchHex === normalizedCurrent);
    swatch.classList.toggle('is-selected', match);
    swatch.setAttribute('aria-pressed', match ? 'true' : 'false');
  });
}

function updateHeader(
  state: DropdownFillState,
  opts: { text: string; muted: boolean; chipColor: string | null },
): void {
  const { headerValue, headerValueLabel, headerValueChip } = state;
  if (headerValueLabel) headerValueLabel.textContent = opts.text;
  if (headerValue) {
    headerValue.dataset.muted = opts.muted ? 'true' : 'false';
    headerValue.classList.toggle('has-chip', !!opts.chipColor);
  }
  if (headerValueChip) {
    if (opts.chipColor) {
      headerValueChip.style.background = opts.chipColor;
      headerValueChip.hidden = false;
      const parsed = parseCssColor(opts.chipColor.trim());
      const isWhite = Boolean(parsed && parsed.r === 255 && parsed.g === 255 && parsed.b === 255);
      headerValueChip.classList.toggle('is-white', isWhite);
    } else {
      headerValueChip.style.background = 'transparent';
      headerValueChip.hidden = true;
      headerValueChip.classList.remove('is-white');
    }
  }
}

function wireModes(state: DropdownFillState) {
  const { root, headerLabel } = state;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.diet-dropdown-fill__mode-btn'));
  if (!buttons.length) return;
  const setMode = (mode: Mode) => {
    root.dataset.mode = mode;
    buttons.forEach((btn) => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    if (headerLabel) {
      headerLabel.textContent = mode === 'image' ? 'Photo/Video fill' : 'Color fill';
    }
  };
  buttons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const mode = btn.dataset.mode === 'image' ? 'image' : 'color';
      setMode(mode);
    });
  });
  const initial = root.dataset.mode === 'image' ? 'image' : 'color';
  setMode(initial);
}

function parseColor(value: string, root: HTMLElement): { h: number; s: number; v: number; a: number } | null {
  const rgba = colorStringToRgba(value, root);
  if (!rgba) return null;
  return rgbToHsv(rgba.r, rgba.g, rgba.b, rgba.a);
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
  const urlMatch = value.match(/url\\(['"]?(.*?)['"]?\\)/i);
  if (urlMatch && urlMatch[1]) {
    const raw = urlMatch[1];
    const parts = raw.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last.split('?')[0];
  }
  return null;
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

  if (trimmed.startsWith('#')) {
    return hexToRgba(trimmed);
  }

  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    if (!CSS.supports('color', trimmed)) return null;
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
