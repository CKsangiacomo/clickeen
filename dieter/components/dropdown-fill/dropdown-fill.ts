import { createDropdownHydrator } from '../shared/dropdownToggle';

type Mode = 'color' | 'image';

type DropdownFillState = {
  root: HTMLElement;
  input: HTMLInputElement;
  headerValue: HTMLElement | null;
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
    wireModes(root);
    if (states.has(root)) return;
    const state = createState(root);
    if (!state) return;
    states.set(root, state);
    installHandlers(state);
    syncUI(state);
  });

  hydrateHost(scope);
}

function createState(root: HTMLElement): DropdownFillState | null {
  const input = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__value-field');
  const headerValue = root.querySelector<HTMLElement>('.diet-dropdown-header-value');
  const hueInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__hue');
  const alphaInput = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__alpha');
  const hexField = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__hex');
  const alphaField = root.querySelector<HTMLInputElement>('.diet-dropdown-fill__alpha-input');
  const svCanvas = root.querySelector<HTMLElement>('.diet-dropdown-fill__sv-canvas');
  const svThumb = root.querySelector<HTMLElement>('.diet-dropdown-fill__sv-thumb');
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

  const initial = parseColor(input.value || input.getAttribute('value') || '#6B6BFF', root);
  swatches.forEach((swatch) => {
    const color = swatch.dataset.color || '';
    swatch.style.setProperty('--swatch-color', color);
    const resolved = resolveSwatchHex(color, root);
    if (resolved) swatch.dataset.resolvedHex = resolved;
    else delete swatch.dataset.resolvedHex;
  });

  return {
    root,
    input,
    headerValue,
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
    hsv: initial,
  };
}

function installHandlers(state: DropdownFillState) {
  state.hueInput.addEventListener('input', () => {
    const hue = clampNumber(Number(state.hueInput.value), 0, 360);
    state.hsv.h = hue;
    syncUI(state);
  });

  state.alphaInput.addEventListener('input', () => {
    const alpha = clampNumber(Number(state.alphaInput.value) / 100, 0, 1);
    state.hsv.a = alpha;
    syncUI(state);
  });

  state.hexField.addEventListener('change', () => handleHexInput(state));
  state.hexField.addEventListener('blur', () => handleHexInput(state));

  state.alphaField.addEventListener('change', () => handleAlphaField(state));
  state.alphaField.addEventListener('blur', () => handleAlphaField(state));

  installSvCanvasHandlers(state);
  installSwatchHandlers(state);
  installImageHandlers(state);
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
    syncUI(state);
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
      setImageSrc(state, null);
    });
  }
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : null;
        setImageSrc(state, result);
      };
      reader.readAsDataURL(file);
    });
  }
}

function setImageSrc(state: DropdownFillState, src: string | null) {
  state.imageSrc = src;
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
  if (state.headerValue) {
    if (src) {
      state.headerValue.textContent = 'Image selected';
      state.headerValue.dataset.muted = 'false';
    } else if (!state.input.value) {
      state.headerValue.textContent = state.headerValue.dataset.placeholder ?? '';
      state.headerValue.dataset.muted = 'true';
    }
  }
}

function installSwatchHandlers(state: DropdownFillState) {
  state.swatches.forEach((swatch) => {
    swatch.addEventListener('click', (event) => {
      event.preventDefault();
      const color = swatch.dataset.resolvedHex || swatch.dataset.color || '';
      const parsed = parseColor(color, state.root);
      state.hsv = { ...parsed, a: state.hsv.a };
      syncUI(state);
    });
  });
}

function handleHexInput(state: DropdownFillState) {
  const raw = state.hexField.value.trim();
  if (!raw) {
    state.hexField.value = formatHex(state.hsv);
    return;
  }
  const normalized = raw.startsWith('#') ? raw : `#${raw}`;
  const parsed = parseColor(normalized);
  state.hsv = { ...parsed, a: state.hsv.a };
  syncUI(state);
}

function handleAlphaField(state: DropdownFillState) {
  const raw = state.alphaField.value.trim().replace('%', '');
  if (!raw) {
    state.alphaField.value = `${Math.round(state.hsv.a * 100)}%`;
    return;
  }
  const percent = clampNumber(Number(raw), 0, 100);
  state.hsv.a = percent / 100;
  syncUI(state);
}

function syncUI(state: DropdownFillState) {
  const { h, s, v, a } = state.hsv;
  const rgb = hsvToRgb(h, s, v);
  const hex = formatHex({ h, s, v, a: 1 });
  const alphaPercent = Math.round(a * 100);
  const colorString = a < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${roundTo(a, 2)})` : hex;
  const currentHex = resolveSwatchHex(colorString, state.root) ?? normalizeHex(hex);

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

  state.input.value = colorString;
  state.input.dispatchEvent(new Event('change', { bubbles: true }));

  if (state.headerValue) {
    state.headerValue.textContent = a < 1 ? `${hex} · ${alphaPercent}%` : hex;
    state.headerValue.dataset.muted = 'false';
  }

  state.swatches.forEach((swatch) => {
    const resolvedHex = swatch.dataset.resolvedHex || resolveSwatchHex(swatch.dataset.color || '', state.root);
    const match = resolvedHex ? normalizeHex(resolvedHex) === normalizeHex(currentHex) : false;
    if (resolvedHex) swatch.dataset.resolvedHex = resolvedHex;
    else delete swatch.dataset.resolvedHex;
    swatch.classList.toggle('is-selected', match);
    swatch.setAttribute('aria-pressed', match ? 'true' : 'false');
  });
}

function wireModes(root: HTMLElement) {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.diet-dropdown-fill__mode-btn'));
  if (!buttons.length) return;
  const setMode = (mode: Mode) => {
    root.dataset.mode = mode;
    buttons.forEach((btn) => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
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

function parseColor(value: string, root: HTMLElement): { h: number; s: number; v: number; a: number } {
  const rgba = colorStringToRgba(value, root);
  return rgbToHsv(rgba.r, rgba.g, rgba.b, rgba.a);
}

function normalizeHex(value: string): string {
  const hex = value.trim().replace(/^#/, '').slice(0, 8).toLowerCase();
  if (hex.length === 3) {
    return `#${hex
      .split('')
      .map((c) => c + c)
      .join('')}`;
  }
  if (hex.length === 6 || hex.length === 8) {
    return `#${hex}`;
  }
  return '#6b6bff';
}

function hexToRgba(value: string): { r: number; g: number; b: number; a: number } {
  const hex = normalizeHex(value).replace('#', '');
  const hasAlpha = hex.length === 8;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = hasAlpha ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
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

function colorStringToRgba(value: string, root: HTMLElement): { r: number; g: number; b: number; a: number } {
  if (value.trim().startsWith('#')) {
    return hexToRgba(value);
  }

  const temp = document.createElement('div');
  temp.style.color = value;
  temp.style.display = 'none';
  root.appendChild(temp);
  const computed = getComputedStyle(temp).color;
  root.removeChild(temp);

  const parsed = parseCssColor(computed);
  if (parsed) return parsed;

  return hexToRgba('#6b6bff');
}

function resolveSwatchHex(value: string, root: HTMLElement): string | null {
  const rgba = colorStringToRgbaOrNull(value, root);
  if (!rgba) return null;
  const hex = `#${toHex(rgba.r)}${toHex(rgba.g)}${toHex(rgba.b)}`;
  return hex;
}

function colorStringToRgbaOrNull(
  value: string,
  root: HTMLElement
): { r: number; g: number; b: number; a: number } | null {
  if (value.trim().startsWith('#')) {
    return hexToRgba(value);
  }

  const temp = document.createElement('div');
  temp.style.color = value;
  temp.style.display = 'none';
  root.appendChild(temp);
  const computed = getComputedStyle(temp).color;
  root.removeChild(temp);

  return parseCssColor(computed);
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
  // Handle space-separated rgb/rgba, optional slash alpha: rgb(255 82 71), rgba(255 82 71 / 0.8)
  const rgbSpace = computed.match(/rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+))?\s*\)/i);
  if (rgbSpace) {
    const r = Number(rgbSpace[1]);
    const g = Number(rgbSpace[2]);
    const b = Number(rgbSpace[3]);
    const a = rgbSpace[4] !== undefined ? Number(rgbSpace[4]) : 1;
    return { r, g, b, a };
  }

  // Handle comma-separated rgb/rgba: rgb(255, 82, 71), rgba(255, 82, 71, 0.8)
  const rgbComma = computed.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/i);
  if (rgbComma) {
    const r = Number(rgbComma[1]);
    const g = Number(rgbComma[2]);
    const b = Number(rgbComma[3]);
    const a = rgbComma[4] !== undefined ? Number(rgbComma[4]) : 1;
    return { r, g, b, a };
  }

  return null;
}
