import { createDropdownHydrator } from '../shared/dropdownToggle';

type BorderValue = {
  enabled: boolean;
  width: number;
  color: string;
};

type DropdownBorderState = {
  root: HTMLElement;
  input: HTMLInputElement;
  headerValue: HTMLElement;
  headerValueLabel: HTMLElement;
  headerValueChip: HTMLElement;
  headerValueNoneIcon: HTMLElement;
  previewContainer: HTMLElement;
  nativeColorInput: HTMLInputElement;
  hueInput: HTMLInputElement;
  hexField: HTMLInputElement;
  svCanvas: HTMLElement;
  svThumb: HTMLElement;
  swatches: HTMLButtonElement[];
  enabledInput: HTMLInputElement;
  widthInput: HTMLInputElement;
  hsv: { h: number; s: number; v: number };
  border: BorderValue;
  nativeValue: { get: () => string; set: (next: string) => void };
  internalWrite: boolean;
};

const states = new Map<HTMLElement, DropdownBorderState>();

const hydrateHost = createDropdownHydrator({
  rootSelector: '.diet-dropdown-border',
  triggerSelector: '.diet-dropdown-border__control',
});

export function hydrateDropdownBorder(scope: Element | DocumentFragment): void {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>('.diet-dropdown-border'));
  if (!roots.length) return;

  roots.forEach((root) => {
    if (states.has(root)) return;
    const state = createState(root);
    states.set(root, state);
    installHandlers(state);
    syncUI(state, false);
  });

  hydrateHost(scope);
}

function createState(root: HTMLElement): DropdownBorderState {
  const input = root.querySelector<HTMLInputElement>('.diet-dropdown-border__value-field')!;
  const headerValue = root.querySelector<HTMLElement>('.diet-dropdown-header-value')!;
  const headerValueLabel = root.querySelector<HTMLElement>('.diet-dropdown-border__label')!;
  const headerValueChip = root.querySelector<HTMLElement>('.diet-dropdown-border__chip')!;
  const headerValueNoneIcon = root.querySelector<HTMLElement>('.diet-dropdown-border__none-icon')!;
  const previewContainer = root.querySelector<HTMLElement>('.diet-dropdown-border__preview')!;
  const nativeColorInput = root.querySelector<HTMLInputElement>('.diet-dropdown-border__native-color')!;
  const hueInput = root.querySelector<HTMLInputElement>('.diet-dropdown-border__hue')!;
  const hexField = root.querySelector<HTMLInputElement>('.diet-dropdown-border__hex')!;
  const svCanvas = root.querySelector<HTMLElement>('.diet-dropdown-border__sv-canvas')!;
  const svThumb = root.querySelector<HTMLElement>('.diet-dropdown-border__sv-thumb')!;
  const swatches = Array.from(root.querySelectorAll<HTMLButtonElement>('.diet-dropdown-border__swatch'));
  const enabledInput = root.querySelector<HTMLInputElement>('.diet-dropdown-border__enabled')!;
  const widthInput = root.querySelector<HTMLInputElement>('.diet-dropdown-border__width')!;
  const border = JSON.parse(input.value) as BorderValue;

  const nativeValue = captureNativeValue(input);
  swatches.forEach((swatch) => {
    const color = swatch.dataset.color!;
    swatch.style.setProperty('--swatch-color', color);
  });

  return {
    root,
    input,
    headerValue,
    headerValueLabel,
    headerValueChip,
    headerValueNoneIcon,
    previewContainer,
    nativeColorInput,
    hueInput,
    hexField,
    svCanvas,
    svThumb,
    swatches,
    enabledInput,
    widthInput,
    hsv: colorToHsv(border.color),
    border,
    nativeValue,
    internalWrite: false,
  };
}

function installHandlers(state: DropdownBorderState) {
  Object.defineProperty(state.input, 'value', {
    configurable: true,
    get: () => state.nativeValue.get(),
    set: (next: string) => {
      state.nativeValue.set(next);
      if (!state.internalWrite) syncFromValue(state, next);
    },
  });

  state.input.addEventListener('external-sync', () => syncFromValue(state, state.input.value));
  state.input.addEventListener('input', () => syncFromValue(state, state.input.value));

  state.hueInput.addEventListener('input', () => {
    state.hsv.h = Number(state.hueInput.value);
    state.border.color = formatHex(state.hsv);
    syncUI(state, true);
  });

  state.hexField.addEventListener('change', () => handleHexInput(state));
  state.hexField.addEventListener('blur', () => handleHexInput(state));

  installSvCanvasHandlers(state);
  installSwatchHandlers(state);
  installNativeColorPicker(state);

  state.enabledInput.addEventListener('input', () => {
    state.border.enabled = state.enabledInput.checked;
    syncUI(state, true);
  });

  state.widthInput.addEventListener('input', () => {
    state.border.width = Number(state.widthInput.value);
    syncUI(state, true);
  });
}

function installNativeColorPicker(state: DropdownBorderState) {
  const { previewContainer, nativeColorInput } = state;

  previewContainer.addEventListener('click', (event) => {
    event.preventDefault();
    nativeColorInput.value = formatHex(state.hsv);
    nativeColorInput.click();
  });

  nativeColorInput.addEventListener('input', () => {
    const next = nativeColorInput.value;
    state.hsv = colorToHsv(next);
    state.border.color = next;
    syncUI(state, true);
  });
}

function installSvCanvasHandlers(state: DropdownBorderState) {
  const move = (event: PointerEvent) => {
    const rect = state.svCanvas.getBoundingClientRect();
    const x = clampNumber(event.clientX - rect.left, 0, rect.width);
    const y = clampNumber(event.clientY - rect.top, 0, rect.height);
    const s = rect.width ? x / rect.width : 0;
    const v = rect.height ? 1 - y / rect.height : 0;
    state.hsv.s = clampNumber(s, 0, 1);
    state.hsv.v = clampNumber(v, 0, 1);
    state.border.color = formatHex(state.hsv);
    syncUI(state, true);
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

function installSwatchHandlers(state: DropdownBorderState) {
  state.swatches.forEach((swatch) => {
    swatch.addEventListener('click', (event) => {
      event.preventDefault();
      const color = swatch.dataset.color!;
      state.hsv = colorToHsv(color);
      state.border.color = color;
      syncUI(state, true);
    });
  });
}

function syncFromValue(state: DropdownBorderState, raw: string) {
  state.border = JSON.parse(raw) as BorderValue;
  state.hsv = colorToHsv(state.border.color);
  syncUI(state, false);
}

function syncUI(state: DropdownBorderState, commit: boolean) {
  const { h, s, v } = state.hsv;
  const rgb = hsvToRgb(h, s, v);
  const hex = formatHex({ h, s, v });
  const previewColor = state.border.enabled
    ? state.border.color
    : `color-mix(in oklab, ${state.border.color}, transparent 65%)`;

  state.root.style.setProperty('--picker-hue', h.toString());
  state.root.style.setProperty('--picker-rgb', `${rgb.r} ${rgb.g} ${rgb.b}`);

  state.hueInput.value = h.toString();
  state.hueInput.style.setProperty('--value', state.hueInput.value);
  state.hueInput.style.setProperty('--min', '0');
  state.hueInput.style.setProperty('--max', '360');

  state.hexField.value = hex.replace(/^#/, '');

  const left = `${s * 100}%`;
  const top = `${(1 - v) * 100}%`;
  state.svThumb.style.left = left;
  state.svThumb.style.top = top;

  state.enabledInput.checked = state.border.enabled;
  applyEnabledState(state);

  setRangeValue(state.widthInput, state.border.width);

  const preview = state.previewContainer.querySelector<HTMLElement>('.diet-dropdown-border__color-preview')!;
  preview.style.background = previewColor;

  const borderValue: BorderValue = { ...state.border };

  const hasBorder = borderValue.enabled && borderValue.width > 0;
  if (!hasBorder) {
    updateHeader(state, 'none');
  } else {
    updateHeader(state, 'border');
  }

  const normalizedCurrent = normalizeHex(hex);
  state.swatches.forEach((swatch) => {
    const swatchHex = normalizeHex(swatch.dataset.color!);
    const match = Boolean(normalizedCurrent && swatchHex && swatchHex === normalizedCurrent);
    swatch.classList.toggle('is-selected', match);
    swatch.setAttribute('aria-pressed', match ? 'true' : 'false');
  });

  if (commit) {
    setInputValue(state, borderValue, true);
  }
}

function applyEnabledState(state: DropdownBorderState): void {
  const enabled = Boolean(state.border.enabled);
  state.root.dataset.borderEnabled = enabled ? 'true' : 'false';
  state.widthInput.disabled = !enabled;
}

function setRangeValue(input: HTMLInputElement, value: number) {
  input.value = String(value);
  input.style.setProperty('--value', String(value));
}

function updateHeader(state: DropdownBorderState, mode: 'border' | 'none'): void {
  const { headerValue, headerValueLabel, headerValueChip, headerValueNoneIcon } = state;
  const showBorder = mode === 'border';
  headerValueLabel.textContent = showBorder ? `${state.border.width}px` : '';
  headerValue.dataset.muted = showBorder ? 'false' : 'true';
  headerValueChip.hidden = !showBorder;
  headerValueChip.style.background = showBorder ? state.border.color : 'transparent';
  const normalized = state.border.color.trim().toLowerCase();
  headerValueChip.classList.toggle(
    'is-white',
    showBorder && (normalized === '#ffffff' || normalized === 'white'),
  );
  headerValueNoneIcon.hidden = showBorder;
}

function setInputValue(state: DropdownBorderState, value: BorderValue, emit: boolean) {
  const json = JSON.stringify(value);
  state.internalWrite = true;
  state.input.value = json;
  state.input.setAttribute('data-bob-json', json);
  state.internalWrite = false;
  if (emit) {
    state.input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function handleHexInput(state: DropdownBorderState) {
  const raw = state.hexField.value.trim();
  const normalized = normalizeHex(raw);
  if (!normalized) return;
  const rgb = hexToRgb(normalized);
  state.hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  state.border.color = raw.startsWith('#') ? raw : `#${raw}`;
  syncUI(state, true);
}

function colorToHsv(value: string): { h: number; s: number; v: number } {
  const rgba = colorStringToRgba(value);
  return rgbToHsv(rgba.r, rgba.g, rgba.b);
}

function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map((c) => c + c)
      .join('')}`;
  }
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  return null;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(value: string): { r: number; g: number; b: number } {
  const raw = value.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function captureNativeValue(input: HTMLInputElement): { get: () => string; set: (next: string) => void } {
  const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!;
  return { get: () => desc.get!.call(input), set: (next) => desc.set!.call(input, next) };
}

function colorStringToRgba(value: string): { r: number; g: number; b: number; a: number } {
  const probe = document.createElement('span');
  probe.style.color = value;
  document.documentElement.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d')!;
  context.fillStyle = computed;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: alpha / 255 };
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hh >= 0 && hh < 1) [r1, g1, b1] = [c, x, 0];
  else if (hh >= 1 && hh < 2) [r1, g1, b1] = [x, c, 0];
  else if (hh >= 2 && hh < 3) [r1, g1, b1] = [0, c, x];
  else if (hh >= 3 && hh < 4) [r1, g1, b1] = [0, x, c];
  else if (hh >= 4 && hh < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = v - c;
  return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
}

function formatHex(hsv: { h: number; s: number; v: number }): string {
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
