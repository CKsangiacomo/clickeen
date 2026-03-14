import {
  clampNumber,
  formatHex,
  hexToRgba,
  hsvToRgb,
  normalizeHex,
  parseColor,
  roundTo,
  rgbToHsv,
} from './color-utils';
import type { GradientStop, FillValue } from './fill-types';
import { DEFAULT_GRADIENT } from './fill-types';
import type { DropdownFillState, DropdownFillUiDeps, GradientStopState } from './dropdown-fill-types';

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

export function createDefaultGradientStops(root: HTMLElement): GradientStopState[] {
  return DEFAULT_GRADIENT.stops.map((stop) => createGradientStopState(root, stop));
}

export function installGradientHandlers(state: DropdownFillState, deps: DropdownFillUiDeps): void {
  if (state.gradientAngleInput) {
    state.gradientAngleInput.addEventListener('input', () => {
      const angle = clampNumber(Number(state.gradientAngleInput?.value), 0, 360);
      state.gradientCss = null;
      state.gradient.angle = angle;
      syncGradientUI(state, { commit: true }, deps);
    });
  }
  installGradientStopBarHandlers(state, deps);
  installGradientEditorHandlers(state, deps);
}

export function applyGradientSwatch(
  state: DropdownFillState,
  parsed: { h: number; s: number; v: number; a: number },
  deps: DropdownFillUiDeps,
): void {
  const stop = getActiveGradientStop(state);
  stop.hsv.h = parsed.h;
  stop.hsv.s = parsed.s;
  stop.hsv.v = parsed.v;
  stop.hsv.a = 1;
  commitGradientStopFromHsv(state, deps);
}

export function applyGradientFromFill(state: DropdownFillState, gradient: FillValue['gradient']): void {
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
  if (!('kind' in gradient)) return;
  const angle = typeof gradient.angle === 'number' ? gradient.angle : DEFAULT_GRADIENT.angle;
  state.gradient.angle = clampNumber(angle, 0, 360);
  if (Array.isArray(gradient.stops) && gradient.stops.length >= 2) {
    state.gradientStops = gradient.stops.map((stop: GradientStop) =>
      createGradientStopState(state.root, {
        color: typeof stop?.color === 'string' ? stop.color : DEFAULT_GRADIENT.stops[0].color,
        position: typeof stop?.position === 'number' ? stop.position : 0,
      }),
    );
    state.gradientActiveStopId = state.gradientStops[0]?.id ?? '';
  }
}

export function syncGradientUI(
  state: DropdownFillState,
  opts: { commit: boolean; updateHeader?: boolean; updateRemove?: boolean },
  deps: DropdownFillUiDeps,
): void {
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
  updateGradientPreview(state, { commit: opts.commit, updateHeader: shouldUpdateHeader, updateRemove: shouldUpdateRemove }, deps);
}

function ensureGradientStops(state: DropdownFillState): void {
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

function updateGradientAddButton(state: DropdownFillState): void {
  const button = state.gradientStopAdd;
  if (!button) return;
  const { sorted, index } = getActiveGradientStopIndex(state);
  const removable = index > 0 && index < sorted.length - 1;
  button.textContent = removable ? '-' : '+';
  button.classList.toggle('is-remove', removable);
  button.setAttribute('aria-label', removable ? 'Remove color stop' : 'Add color stop');
}

function syncGradientStopButtons(state: DropdownFillState): void {
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

function getSwatchTarget(swatch: HTMLButtonElement): 'color' | 'gradient' {
  const container = swatch.closest<HTMLElement>('.diet-dropdown-fill__swatches');
  return container?.dataset.swatchTarget === 'gradient' ? 'gradient' : 'color';
}

function syncActiveGradientStopUI(state: DropdownFillState): void {
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

function setActiveGradientStop(state: DropdownFillState, stopId: string): void {
  state.gradientActiveStopId = stopId;
  syncGradientStopButtons(state);
  syncActiveGradientStopUI(state);
  updateGradientAddButton(state);
}

function updateGradientPreview(
  state: DropdownFillState,
  opts: { commit: boolean; updateHeader?: boolean; updateRemove?: boolean },
  deps: DropdownFillUiDeps,
): void {
  const shouldUpdateHeader = opts.updateHeader !== false;
  const shouldUpdateRemove = opts.updateRemove !== false;
  const css = state.gradientCss || buildGradientCss(state);
  if (state.gradientPreview) state.gradientPreview.style.backgroundImage = css;
  if (opts.commit) {
    deps.setInputValue(state, buildGradientFill(state), true);
  }
  if (shouldUpdateHeader) {
    deps.updateHeader(state, { text: '', muted: false, chipColor: css });
  }
  if (shouldUpdateRemove) {
    deps.setRemoveFillState(state, false);
  }
}

function addGradientStop(state: DropdownFillState, deps: DropdownFillUiDeps): void {
  ensureGradientStops(state);
  const sorted = getSortedGradientStops(state.gradientStops);
  const active = getActiveGradientStop(state);
  const activeIndex = sorted.findIndex((stop) => stop.id === active.id);
  const right = sorted[activeIndex + 1] ?? null;
  const left = sorted[activeIndex - 1] ?? null;
  let position = 50;
  if (right) position = (active.position + right.position) / 2;
  else if (left) position = (left.position + active.position) / 2;
  const stop = createGradientStopState(state.root, { color: active.color, position });
  stop.hsv = { ...active.hsv };
  state.gradientStops.push(stop);
  state.gradientActiveStopId = stop.id;
  state.gradientCss = null;
  syncGradientUI(state, { commit: true }, deps);
}

function removeGradientStop(state: DropdownFillState, stopId: string, deps: DropdownFillUiDeps): void {
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
  syncGradientUI(state, { commit: true }, deps);
}

function bindGradientStopButton(state: DropdownFillState, button: HTMLButtonElement, stopId: string): void {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    setActiveGradientStop(state, stopId);
  });
}

function commitGradientStopFromHsv(state: DropdownFillState, deps: DropdownFillUiDeps): void {
  const stop = getActiveGradientStop(state);
  stop.color = colorStringFromHsv(stop.hsv);
  state.gradientCss = null;
  syncGradientUI(state, { commit: true }, deps);
}

function handleGradientStopHexInput(state: DropdownFillState, deps: DropdownFillUiDeps): void {
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
  commitGradientStopFromHsv(state, deps);
}

function handleGradientStopAlphaField(state: DropdownFillState, deps: DropdownFillUiDeps): void {
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
  commitGradientStopFromHsv(state, deps);
}

function installGradientStopBarHandlers(state: DropdownFillState, deps: DropdownFillUiDeps): void {
  if (state.gradientStopAdd) {
    state.gradientStopAdd.addEventListener('click', (event) => {
      event.preventDefault();
      const { sorted, index } = getActiveGradientStopIndex(state);
      const removable = index > 0 && index < sorted.length - 1;
      if (removable) {
        removeGradientStop(state, state.gradientActiveStopId, deps);
        return;
      }
      addGradientStop(state, deps);
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
    updateGradientPreview(state, { commit: true, updateHeader: true, updateRemove: false }, deps);
  };

  const finishDrag = (stopId: string, event: PointerEvent) => {
    const rect = bar.getBoundingClientRect();
    const outside = event.clientY < rect.top - 24 || event.clientY > rect.bottom + 24;
    state.gradientDrag = undefined;
    if (outside) {
      removeGradientStop(state, stopId, deps);
      return;
    }
    syncGradientStopButtons(state);
    updateGradientPreview(state, { commit: true, updateHeader: true }, deps);
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

function installGradientEditorHandlers(state: DropdownFillState, deps: DropdownFillUiDeps): void {
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
      commitGradientStopFromHsv(state, deps);
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
      commitGradientStopFromHsv(state, deps);
    });
  }

  if (state.gradientStopAlphaInput) {
    state.gradientStopAlphaInput.addEventListener('input', () => {
      const alpha = clampNumber(Number(state.gradientStopAlphaInput?.value) / 100, 0, 1);
      const stop = getActiveGradientStop(state);
      stop.hsv.a = alpha;
      commitGradientStopFromHsv(state, deps);
    });
  }

  if (state.gradientStopHexInput) {
    const handler = () => handleGradientStopHexInput(state, deps);
    state.gradientStopHexInput.addEventListener('change', handler);
    state.gradientStopHexInput.addEventListener('blur', handler);
  }

  if (state.gradientStopAlphaField) {
    const handler = () => handleGradientStopAlphaField(state, deps);
    state.gradientStopAlphaField.addEventListener('change', handler);
    state.gradientStopAlphaField.addEventListener('blur', handler);
  }
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

function colorStringFromHsv(hsv: { h: number; s: number; v: number; a: number }): string {
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  return hsv.a < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${roundTo(hsv.a, 2)})` : formatHex({ ...hsv, a: 1 });
}
