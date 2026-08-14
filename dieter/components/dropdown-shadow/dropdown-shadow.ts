import { createDropdownHydrator } from '../shared/dropdownToggle';

type ShadowValue = {
  enabled: boolean;
  inset: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  alpha: number;
};

type Hsv = { h: number; s: number; v: number };

type DropdownShadowState = {
  root: HTMLElement;
  input: HTMLInputElement;
  headerValue: HTMLElement;
  headerValueLabel: HTMLElement;
  headerValueChip: HTMLElement;
  headerValueNoneIcon: HTMLElement;
  hueInput: HTMLInputElement;
  hexField: HTMLInputElement;
  svCanvas: HTMLElement;
  svThumb: HTMLElement;
  swatches: HTMLButtonElement[];
  enabledInput: HTMLInputElement;
  xInput: HTMLInputElement;
  yInput: HTMLInputElement;
  blurInput: HTMLInputElement;
  spreadInput: HTMLInputElement;
  opacityInput: HTMLInputElement;
  xValue: HTMLElement;
  yValue: HTMLElement;
  blurValue: HTMLElement;
  spreadValue: HTMLElement;
  opacityValue: HTMLElement;
  previewBox: HTMLElement;
  hsv: Hsv;
  shadow: ShadowValue;
  nativeValue: { get: () => string; set: (next: string) => void };
  internalWrite: boolean;
};

const states = new Map<HTMLElement, DropdownShadowState>();

const hydrateHost = createDropdownHydrator({
  rootSelector: '.diet-dropdown-shadow',
  triggerSelector: '.diet-dropdown-shadow__control',
});

export function hydrateDropdownShadow(scope: Element | DocumentFragment): void {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>('.diet-dropdown-shadow'));
  if (!roots.length) return;

  roots.forEach((root) => {
    if (states.has(root)) return;
    const state = createState(root);
    states.set(root, state);
    installHandlers(state);
    syncFromValue(state, state.input.value);
  });

  hydrateHost(scope);
}

export function destroyDropdownShadow(root: HTMLElement): void {
  states.delete(root);
  hydrateHost.destroy(root);
}

function createState(root: HTMLElement): DropdownShadowState {
  const input = root.querySelector<HTMLInputElement>('.diet-dropdown-shadow__value-field')!;
  const shadow = JSON.parse(input.value) as ShadowValue;
  const hsv = parseColor(shadow.color)!;
  const swatches = Array.from(root.querySelectorAll<HTMLButtonElement>('.diet-dropdown-shadow__swatch'));

  swatches.forEach((swatch) => {
    swatch.style.setProperty('--swatch-color', swatch.dataset.color!);
  });

  return {
    root,
    input,
    headerValue: root.querySelector<HTMLElement>('.diet-dropdown-header-value')!,
    headerValueLabel: root.querySelector<HTMLElement>('.diet-dropdown-shadow__label')!,
    headerValueChip: root.querySelector<HTMLElement>('.diet-dropdown-shadow__chip')!,
    headerValueNoneIcon: root.querySelector<HTMLElement>('.diet-dropdown-shadow__none-icon')!,
    hueInput: root.querySelector<HTMLInputElement>('.diet-dropdown-shadow__hue')!,
    hexField: root.querySelector<HTMLInputElement>('.diet-dropdown-shadow__hex')!,
    svCanvas: root.querySelector<HTMLElement>('.diet-dropdown-shadow__sv-canvas')!,
    svThumb: root.querySelector<HTMLElement>('.diet-dropdown-shadow__sv-thumb')!,
    swatches,
    enabledInput: root.querySelector<HTMLInputElement>('.diet-dropdown-shadow__enabled')!,
    xInput: root.querySelector<HTMLInputElement>('.diet-dropdown-shadow__x')!,
    yInput: root.querySelector<HTMLInputElement>('.diet-dropdown-shadow__y')!,
    blurInput: root.querySelector<HTMLInputElement>('.diet-dropdown-shadow__blur')!,
    spreadInput: root.querySelector<HTMLInputElement>('.diet-dropdown-shadow__spread')!,
    opacityInput: root.querySelector<HTMLInputElement>('.diet-dropdown-shadow__opacity')!,
    xValue: root.querySelector<HTMLElement>('.diet-dropdown-shadow__x-value')!,
    yValue: root.querySelector<HTMLElement>('.diet-dropdown-shadow__y-value')!,
    blurValue: root.querySelector<HTMLElement>('.diet-dropdown-shadow__blur-value')!,
    spreadValue: root.querySelector<HTMLElement>('.diet-dropdown-shadow__spread-value')!,
    opacityValue: root.querySelector<HTMLElement>('.diet-dropdown-shadow__opacity-value')!,
    previewBox: root.querySelector<HTMLElement>('.diet-dropdown-shadow__shadow-preview')!,
    hsv,
    shadow,
    nativeValue: captureNativeValue(input),
    internalWrite: false,
  };
}

function installHandlers(state: DropdownShadowState): void {
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

  state.enabledInput.addEventListener('input', () => {
    state.shadow.enabled = state.enabledInput.checked;
    syncUI(state, true);
  });

  installNumberHandler(state, 'x', state.xInput);
  installNumberHandler(state, 'y', state.yInput);
  installNumberHandler(state, 'blur', state.blurInput);
  installNumberHandler(state, 'spread', state.spreadInput);
  installNumberHandler(state, 'alpha', state.opacityInput);

  state.hueInput.addEventListener('input', () => {
    state.hsv.h = Number(state.hueInput.value);
    state.shadow.color = formatHex(state.hsv);
    syncUI(state, true);
  });

  state.hexField.addEventListener('change', () => handleHexInput(state));
  state.hexField.addEventListener('blur', () => handleHexInput(state));
  installSvCanvasHandlers(state);
  installSwatchHandlers(state);
}

function installNumberHandler(
  state: DropdownShadowState,
  key: 'x' | 'y' | 'blur' | 'spread' | 'alpha',
  input: HTMLInputElement,
): void {
  input.addEventListener('input', () => {
    state.shadow[key] = Number(input.value);
    syncUI(state, true);
  });
}

function installSvCanvasHandlers(state: DropdownShadowState): void {
  const move = (event: PointerEvent) => {
    const rect = state.svCanvas.getBoundingClientRect();
    const x = clampPointer(event.clientX - rect.left, 0, rect.width);
    const y = clampPointer(event.clientY - rect.top, 0, rect.height);
    state.hsv.s = rect.width ? x / rect.width : 0;
    state.hsv.v = rect.height ? 1 - y / rect.height : 0;
    state.shadow.color = formatHex(state.hsv);
    syncUI(state, true);
  };

  state.svCanvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    state.svCanvas.setPointerCapture(event.pointerId);
    move(event);
  });

  state.svCanvas.addEventListener('pointermove', (event) => {
    if (event.pressure === 0 && event.buttons === 0) return;
    move(event);
  });
}

function installSwatchHandlers(state: DropdownShadowState): void {
  state.swatches.forEach((swatch) => {
    swatch.addEventListener('click', (event) => {
      event.preventDefault();
      const color = swatch.dataset.color!;
      state.hsv = parseColor(color)!;
      state.shadow.color = color;
      syncUI(state, true);
    });
  });
}

function syncFromValue(state: DropdownShadowState, raw: string): void {
  state.shadow = JSON.parse(raw) as ShadowValue;
  state.hsv = parseColor(state.shadow.color)!;
  syncUI(state, false);
}

function syncUI(state: DropdownShadowState, commit: boolean): void {
  const { h, s, v } = state.hsv;
  const rgb = hsvToRgb(h, s, v);

  state.root.style.setProperty('--picker-hue', String(h));
  state.root.style.setProperty('--picker-rgb', `${rgb.r} ${rgb.g} ${rgb.b}`);
  state.hueInput.value = String(h);
  state.hueInput.dispatchEvent(new CustomEvent('external-sync'));
  state.hexField.value = formatHex(state.hsv).replace(/^#/, '');
  state.svThumb.style.left = `${s * 100}%`;
  state.svThumb.style.top = `${(1 - v) * 100}%`;

  state.enabledInput.checked = state.shadow.enabled;
  state.root.dataset.shadowEnabled = state.shadow.enabled ? 'true' : 'false';

  setRangeValue(state.xInput, state.xValue, state.shadow.x, 'px');
  setRangeValue(state.yInput, state.yValue, state.shadow.y, 'px');
  setRangeValue(state.blurInput, state.blurValue, state.shadow.blur, 'px');
  setRangeValue(state.spreadInput, state.spreadValue, state.shadow.spread, 'px');
  setRangeValue(state.opacityInput, state.opacityValue, state.shadow.alpha, '%');

  state.previewBox.style.boxShadow = computeBoxShadow(state.shadow);

  if (commit) setInputValue(state, state.shadow);

  if (state.shadow.enabled) {
    state.headerValueLabel.textContent = `${state.shadow.alpha}%`;
    state.headerValue.dataset.muted = 'false';
    state.headerValueChip.hidden = false;
    state.headerValueNoneIcon.hidden = true;
    state.headerValueChip.style.background = state.shadow.color;
    state.headerValueChip.classList.toggle('is-white', normalizeHex(state.shadow.color) === '#ffffff');
  } else {
    state.headerValueLabel.textContent = '';
    state.headerValue.dataset.muted = 'true';
    state.headerValueChip.hidden = true;
    state.headerValueChip.classList.remove('is-white');
    state.headerValueNoneIcon.hidden = false;
  }

  const normalizedCurrent = normalizeHex(state.shadow.color);
  state.swatches.forEach((swatch) => {
    const selected = normalizeHex(swatch.dataset.color!) === normalizedCurrent;
    swatch.classList.toggle('is-selected', selected);
    swatch.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

function setRangeValue(input: HTMLInputElement, output: HTMLElement, value: number, unit: 'px' | '%'): void {
  input.value = String(value);
  input.dispatchEvent(new CustomEvent('external-sync'));
  output.textContent = `${value}${unit}`;
}

function setInputValue(state: DropdownShadowState, value: ShadowValue): void {
  const json = JSON.stringify(value);
  state.internalWrite = true;
  state.input.value = json;
  state.input.setAttribute('data-dieter-json', json);
  state.internalWrite = false;
  state.input.dispatchEvent(new Event('input', { bubbles: true }));
}

function computeBoxShadow(shadow: ShadowValue): string {
  if (!shadow.enabled || shadow.alpha === 0) return 'none';
  const shadowColor = colorWithAlpha(shadow.color, shadow.alpha);
  return `${shadow.inset ? 'inset ' : ''}${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadowColor}`;
}

function colorWithAlpha(color: string, alpha: number): string {
  return alpha === 100 ? color : `color-mix(in oklab, ${color}, transparent ${100 - alpha}%)`;
}

function handleHexInput(state: DropdownShadowState): void {
  const normalized = normalizeHex(state.hexField.value);
  if (!normalized) return;
  state.hsv = parseColor(normalized)!;
  state.shadow.color = normalized;
  syncUI(state, true);
}

function parseColor(value: string): Hsv | null {
  const rgba = colorStringToRgba(value);
  if (!rgba) return null;
  return rgbToHsv(rgba.r, rgba.g, rgba.b);
}

function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return `#${hex.split('').map((character) => character + character).join('')}`;
  }
  return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : null;
}

function clampPointer(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function captureNativeValue(input: HTMLInputElement): { get: () => string; set: (next: string) => void } {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!;
  return {
    get: () => descriptor.get!.call(input),
    set: (next) => descriptor.set!.call(input, next),
  };
}

function colorStringToRgba(value: string): { r: number; g: number; b: number; a: number } | null {
  const probe = document.createElement('span');
  probe.style.color = value;
  document.documentElement.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const match = computed.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].split(',').map((part) => Number(part.trim()));
  if (parts.length < 3 || !parts.every(Number.isFinite)) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const difference = max - min;
  let h = 0;
  if (difference !== 0) {
    if (max === rn) h = ((gn - bn) / difference) % 6;
    else if (max === gn) h = (bn - rn) / difference + 2;
    else h = (rn - gn) / difference + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : difference / max, v: max };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const chroma = v * s;
  const hue = (h % 360) / 60;
  const secondary = chroma * (1 - Math.abs((hue % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;
  if (hue < 1) [red, green] = [chroma, secondary];
  else if (hue < 2) [red, green] = [secondary, chroma];
  else if (hue < 3) [green, blue] = [chroma, secondary];
  else if (hue < 4) [green, blue] = [secondary, chroma];
  else if (hue < 5) [red, blue] = [secondary, chroma];
  else [red, blue] = [chroma, secondary];
  const match = v - chroma;
  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255),
  };
}

function formatHex(hsv: Hsv): string {
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const toHex = (value: number) => value.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
