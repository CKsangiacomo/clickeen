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
  const hsv = parseColor(stop.color, root)!;
  return {
    id: createGradientStopId(),
    color: stop.color,
    position: stop.position,
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

export function applyGradientFromFill(
  state: DropdownFillState,
  gradient: Extract<FillValue, { type: 'gradient' }>['gradient'],
): void {
  state.gradient = { kind: gradient.kind, angle: gradient.angle };
  state.gradientStops = gradient.stops.map((stop: GradientStop) =>
    createGradientStopState(state.root, stop),
  );
  state.gradientActiveStopId = state.gradientStops[0]!.id;
}

export function syncGradientUI(
  state: DropdownFillState,
  opts: { commit: boolean; updateHeader?: boolean },
  deps: DropdownFillUiDeps,
): void {
  const shouldUpdateHeader = opts.updateHeader !== false;
  if (state.gradientAngleInput) {
    state.gradientAngleInput.value = String(clampNumber(state.gradient.angle, 0, 360));
    state.gradientAngleInput.dispatchEvent(new CustomEvent('external-sync'));
  }
  syncGradientStopButtons(state);
  syncActiveGradientStopUI(state);
  updateGradientAddButton(state);
  updateGradientPreview(state, { commit: opts.commit, updateHeader: shouldUpdateHeader }, deps);
}

function getSortedGradientStops(stops: GradientStopState[]): GradientStopState[] {
  return [...stops].sort((a, b) => a.position - b.position);
}

function getActiveGradientStop(state: DropdownFillState): GradientStopState {
  return state.gradientStops.find((stop) => stop.id === state.gradientActiveStopId)!;
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
  const addIcon = button.querySelector<HTMLElement>('.diet-dropdown-fill__gradient-stop-add-icon')!;
  const removeIcon = button.querySelector<HTMLElement>('.diet-dropdown-fill__gradient-stop-remove-icon')!;
  addIcon.hidden = removable;
  removeIcon.hidden = !removable;
  button.classList.toggle('is-remove', removable);
  button.setAttribute(
    'aria-label',
    removable ? state.copy.removeGradientStop : state.copy.addGradientStop,
  );
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
      btn.setAttribute('aria-label', state.copy.editGradientStop);
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
    state.gradientStopHueInput.dispatchEvent(new CustomEvent('external-sync'));
  }
  if (state.gradientStopAlphaInput) {
    state.gradientStopAlphaInput.value = alphaPercent.toString();
    state.gradientStopAlphaInput.dispatchEvent(new CustomEvent('external-sync'));
  }
  if (state.gradientStopAlphaValue) {
    state.gradientStopAlphaValue.value = `${alphaPercent}%`;
  }
  if (state.gradientStopHexInput) {
    state.gradientStopHexInput.value = hex;
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
  opts: { commit: boolean; updateHeader?: boolean },
  deps: DropdownFillUiDeps,
): void {
  const shouldUpdateHeader = opts.updateHeader !== false;
  const css = buildGradientCss(state);
  if (state.gradientPreview) state.gradientPreview.style.backgroundImage = css;
  if (opts.commit) {
    deps.setInputValue(state, buildGradientFill(state), true);
  }
  if (shouldUpdateHeader) {
    deps.updateHeader(state, { text: '', muted: false, chipColor: css });
  }
}

function addGradientStop(state: DropdownFillState, deps: DropdownFillUiDeps): void {
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
  syncGradientUI(state, { commit: true }, deps);
}

function handleGradientStopHexInput(state: DropdownFillState, deps: DropdownFillUiDeps): void {
  if (!state.gradientStopHexInput) return;
  const stop = getActiveGradientStop(state);
  const hsv = stop.hsv;
  const raw = state.gradientStopHexInput.value.trim();
  if (!raw) return;
  const normalized = raw.startsWith('#') ? raw : `#${raw}`;
  const rgba = hexToRgba(normalized);
  if (!rgba) return;
  const next = rgbToHsv(rgba.r, rgba.g, rgba.b, 1);
  hsv.h = next.h;
  hsv.s = next.s;
  hsv.v = next.v;
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
    syncGradientStopButtons(state);
    updateGradientPreview(state, { commit: true, updateHeader: true }, deps);
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

}

function normalizeGradientStopsForOutput(state: DropdownFillState): GradientStop[] {
  return getSortedGradientStops(state.gradientStops).map((stop: GradientStopState) => ({
    color: stop.color,
    position: stop.position,
  }));
}

function buildGradientFill(state: DropdownFillState): FillValue {
  const normalizedStops = normalizeGradientStopsForOutput(state);
  return {
    type: 'gradient',
    gradient: {
      kind: state.gradient.kind,
      angle: state.gradient.angle,
      stops: normalizedStops,
    },
  };
}

function buildGradientCss(state: DropdownFillState): string {
  const normalizedStops = normalizeGradientStopsForOutput(state);
  const stopList = normalizedStops.map((stop) => `${stop.color} ${stop.position}%`).join(', ');
  if (state.gradient.kind === 'radial') return `radial-gradient(circle, ${stopList})`;
  if (state.gradient.kind === 'conic') return `conic-gradient(from ${state.gradient.angle}deg, ${stopList})`;
  return `linear-gradient(${state.gradient.angle}deg, ${stopList})`;
}

function colorStringFromHsv(hsv: { h: number; s: number; v: number; a: number }): string {
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  return hsv.a < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${roundTo(hsv.a, 2)})` : formatHex({ ...hsv, a: 1 });
}
