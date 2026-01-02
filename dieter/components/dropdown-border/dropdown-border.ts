import { createDropdownHydrator } from '../shared/dropdownToggle';

type BorderValue = {
  enabled: boolean;
  width: number;
  color: string;
};

type DropdownBorderState = {
  root: HTMLElement;
  input: HTMLInputElement;
  headerValue: HTMLElement | null;
  headerValueLabel: HTMLElement | null;
  headerValueChip: HTMLElement | null;
  headerLabel: HTMLElement | null;
  previewContainer: HTMLElement | null;
  nativeColorInput: HTMLInputElement | null;
  hueInput: HTMLInputElement;
  hexField: HTMLInputElement;
  svCanvas: HTMLElement;
  svThumb: HTMLElement;
  swatches: HTMLButtonElement[];
  enabledInput: HTMLInputElement;
  widthInput: HTMLInputElement;
  hsv: { h: number; s: number; v: number };
  border: BorderValue;
  nativeValue?: { get: () => string; set: (next: string) => void };
  internalWrite: boolean;
};

const DEFAULT_BORDER: BorderValue = {
  enabled: true,
  width: 1,
  color: '#c7c7cc',
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
    if (!state) return;
    states.set(root, state);
    installHandlers(state);
    const initialValue = state.input.value || state.input.getAttribute('value') || '';
    syncFromValue(state, initialValue);
  });

  hydrateHost(scope);
}

function createState(root: HTMLElement): DropdownBorderState | null {
  const input = root.querySelector<HTMLInputElement>('.diet-dropdown-border__value-field');
  const headerValue = root.querySelector<HTMLElement>('.diet-dropdown-header-value');
  const headerValueLabel = root.querySelector<HTMLElement>('.diet-dropdown-border__label');
  const headerValueChip = root.querySelector<HTMLElement>('.diet-dropdown-border__chip');
  const headerLabel = root.querySelector<HTMLElement>('.diet-popover__header-label');
  const previewContainer = root.querySelector<HTMLElement>('.diet-dropdown-border__preview');
  const nativeColorInput = root.querySelector<HTMLInputElement>('.diet-dropdown-border__native-color');
  const hueInput = root.querySelector<HTMLInputElement>('.diet-dropdown-border__hue');
  const hexField = root.querySelector<HTMLInputElement>('.diet-dropdown-border__hex');
  const svCanvas = root.querySelector<HTMLElement>('.diet-dropdown-border__sv-canvas');
  const svThumb = root.querySelector<HTMLElement>('.diet-dropdown-border__sv-thumb');
  const swatches = Array.from(root.querySelectorAll<HTMLButtonElement>('.diet-dropdown-border__swatch'));
  const enabledInput = root.querySelector<HTMLInputElement>('.diet-dropdown-border__enabled');
  const widthInput = root.querySelector<HTMLInputElement>('.diet-dropdown-border__width');

  if (!input || !hueInput || !hexField || !svCanvas || !svThumb || !enabledInput || !widthInput) {
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
    previewContainer,
    nativeColorInput,
    hueInput,
    hexField,
    svCanvas,
    svThumb,
    swatches,
    enabledInput,
    widthInput,
    hsv: { h: 0, s: 0, v: 0 },
    border: { ...DEFAULT_BORDER, enabled: false },
    nativeValue,
    internalWrite: false,
  };
}

function installHandlers(state: DropdownBorderState) {
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
    state.hsv.h = clampNumber(Number(state.hueInput.value), 0, 360);
    syncUI(state, { commit: true });
  });

  state.hexField.addEventListener('change', () => handleHexInput(state));
  state.hexField.addEventListener('blur', () => handleHexInput(state));

  installSvCanvasHandlers(state);
  installSwatchHandlers(state);
  installNativeColorPicker(state);

  state.enabledInput.addEventListener('input', () => {
    state.border.enabled = state.enabledInput.checked;
    if (state.border.enabled && (!state.border.color || state.root.dataset.invalid === 'true')) {
      delete state.root.dataset.invalid;
      state.border.color = DEFAULT_BORDER.color;
      state.border.width = DEFAULT_BORDER.width;
      const parsed = parseColor(state.border.color, document.documentElement);
      if (parsed) state.hsv = parsed;
    }
    syncUI(state, { commit: true });
  });

  state.widthInput.addEventListener('input', () => {
    const parsed = Number(state.widthInput.value);
    if (!Number.isFinite(parsed)) return;
    state.border.width = clampNumber(parsed, 0, 12);
    syncUI(state, { commit: true });
  });
}

function installNativeColorPicker(state: DropdownBorderState) {
  const { previewContainer, nativeColorInput } = state;
  if (!previewContainer || !nativeColorInput) return;

  previewContainer.addEventListener('click', (event) => {
    event.preventDefault();
    nativeColorInput.value = state.border.color || DEFAULT_BORDER.color;
    nativeColorInput.click();
  });

  nativeColorInput.addEventListener('input', () => {
    const next = String(nativeColorInput.value || '').trim();
    if (!next) return;
    const hsv = parseColor(next, document.documentElement);
    if (!hsv) return;
    state.hsv = hsv;
    state.border.color = next;
    syncUI(state, { commit: true });
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

function installSwatchHandlers(state: DropdownBorderState) {
  state.swatches.forEach((swatch) => {
    swatch.addEventListener('click', (event) => {
      event.preventDefault();
      const color = swatch.dataset.color || '';
      const parsed = parseColor(color, state.root);
      if (!parsed) return;
      state.hsv = parsed;
      state.border.color = color;
      syncUI(state, { commit: true });
    });
  });
}

function syncFromValue(state: DropdownBorderState, raw: string) {
  const value = String(raw ?? '').trim();
  if (!value) {
    delete state.root.dataset.invalid;
    state.border = { ...DEFAULT_BORDER, enabled: false };
    state.hsv = parseColor(DEFAULT_BORDER.color, document.documentElement) ?? { h: 0, s: 0, v: 0 };
    syncUI(state, { commit: false });
    return;
  }

  const parsed = parseBorderJson(value);
  if (!parsed) {
    state.root.dataset.invalid = 'true';
    syncUI(state, { commit: false });
    return;
  }

  delete state.root.dataset.invalid;
  state.border = parsed.border;
  state.hsv = parsed.hsv;
  syncUI(state, { commit: false });
}

function syncUI(state: DropdownBorderState, opts: { commit: boolean }) {
  const { h, s, v } = state.hsv;
  const rgb = hsvToRgb(h, s, v);
  const hex = formatHex({ h, s, v });
  const previewColor = state.border.enabled ? hex : `color-mix(in oklab, ${hex}, transparent 65%)`;

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

  if (state.previewContainer) {
    const preview = state.previewContainer.querySelector<HTMLElement>('.diet-dropdown-border__color-preview');
    if (preview) preview.style.background = previewColor;
  }

  const borderValue: BorderValue = {
    ...state.border,
    color: hex,
    width: clampNumber(state.border.width, 0, 12),
  };

  const hasBorder = borderValue.enabled && borderValue.width > 0;
  if (!hasBorder || state.root.dataset.invalid === 'true') {
    updateHeader(state, { text: '', muted: true, chipColor: null, noneChip: true });
  } else {
    updateHeader(state, { text: `${borderValue.width}px`, muted: false, chipColor: hex });
  }

  const normalizedCurrent = normalizeHex(hex);
  state.swatches.forEach((swatch) => {
    const swatchHex = normalizeHex(swatch.dataset.color || '');
    const match = Boolean(normalizedCurrent && swatchHex && swatchHex === normalizedCurrent);
    swatch.classList.toggle('is-selected', match);
    swatch.setAttribute('aria-pressed', match ? 'true' : 'false');
  });

  if (opts.commit) {
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

function updateHeader(
  state: DropdownBorderState,
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
      const normalized = opts.chipColor.trim().toLowerCase();
      headerValueChip.classList.toggle('is-white', normalized === '#ffffff' || normalized === 'white');
    } else {
      headerValueChip.style.background = 'transparent';
      headerValueChip.hidden = true;
      headerValueChip.classList.remove('is-none');
      headerValueChip.classList.remove('is-white');
    }
  }
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

function parseBorderJson(raw: string): { border: BorderValue; hsv: { h: number; s: number; v: number } } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const obj = parsed as Record<string, unknown>;
  const enabled = typeof obj.enabled === 'boolean' ? obj.enabled : null;
  const width = typeof obj.width === 'number' && Number.isFinite(obj.width) ? obj.width : null;
  const color = typeof obj.color === 'string' ? obj.color : null;
  if (enabled == null || width == null || color == null) return null;

  const hsv = parseColor(color, document.documentElement);
  if (!hsv) return null;

  const border: BorderValue = {
    enabled,
    width: clampNumber(width, 0, 12),
    color,
  };

  return { border, hsv };
}

function handleHexInput(state: DropdownBorderState) {
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
  state.hsv = rgbToHsv(rgba.r, rgba.g, rgba.b);
  state.border.color = normalized;
  syncUI(state, { commit: true });
}

function parseColor(value: string, root: HTMLElement): { h: number; s: number; v: number } | null {
  const rgba = colorStringToRgba(value, root);
  if (!rgba) return null;
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

function hexToRgba(value: string): { r: number; g: number; b: number } | null {
  const raw = value.trim().replace(/^#/, '');
  if (!/^[0-9a-f]+$/i.test(raw)) return null;
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    return { r, g, b };
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function captureNativeValue(input: HTMLInputElement): { get: () => string; set: (next: string) => void } | undefined {
  const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value');
  if (!desc || !desc.get || !desc.set) return undefined;
  return { get: () => desc.get?.call(input) ?? '', set: (next) => desc.set?.call(input, next) };
}

function colorStringToRgba(
  value: string,
  root: HTMLElement,
): { r: number; g: number; b: number; a: number } | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const probe = document.createElement('span');
  probe.style.color = raw;
  root.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  root.removeChild(probe);
  const match = computed.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1]
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  const a = parts.length >= 4 ? Number(parts[3]) : 1;
  if (![r, g, b, a].every((n) => Number.isFinite(n))) return null;
  return { r, g, b, a };
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

