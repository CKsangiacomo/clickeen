var __prevDieter = window.Dieter ? { ...window.Dieter } : {};
"use strict";
var Dieter = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // components/dropdown-fill/dropdown-fill.ts
  var dropdown_fill_exports = {};
  __export(dropdown_fill_exports, {
    hydrateDropdownFill: () => hydrateDropdownFill
  });

  // components/shared/dropdownToggle.ts
  function createDropdownHydrator(config) {
    const {
      rootSelector,
      triggerSelector,
      popoverSelector = ".diet-popover",
      onOpen,
      onClose,
      initialState = "closed",
      isInsideTarget
    } = config;
    const hostRegistry = /* @__PURE__ */ new Map();
    let globalHandlersBound = false;
    const setOpen = (record, open) => {
      const { root, trigger, popover } = record;
      const next = open ? "open" : "closed";
      if (root.dataset.state === next) return;
      root.dataset.state = next;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        record.onOpen?.(root, popover, trigger);
      } else {
        record.onClose?.(root, popover, trigger);
      }
    };
    return function hydrate(scope) {
      const roots = Array.from(scope.querySelectorAll(rootSelector));
      if (!roots.length) return;
      roots.forEach((root) => {
        if (hostRegistry.has(root)) return;
        const trigger = root.querySelector(triggerSelector);
        const popover = root.querySelector(popoverSelector);
        if (!trigger || !popover) return;
        const record = { root, trigger, popover, onOpen, onClose };
        hostRegistry.set(root, record);
        trigger.addEventListener("click", (event) => {
          event.stopPropagation();
          setOpen(record, root.dataset.state !== "open");
        });
        const requestedState = root.dataset.state || initialState;
        setOpen(record, requestedState === "open");
      });
      if (!globalHandlersBound) {
        globalHandlersBound = true;
        document.addEventListener(
          "pointerdown",
          (event) => {
            const target = event.target;
            if (!target) return;
            hostRegistry.forEach((record) => {
              const { root } = record;
              const insideRoot = root.contains(target);
              const insideExtraTarget = isInsideTarget?.(root, target) ?? false;
              if (!insideRoot && !insideExtraTarget && root.dataset.state === "open") {
                setOpen(record, false);
              }
            });
          },
          true
        );
        document.addEventListener("keydown", (event) => {
          if (event.key !== "Escape") return;
          hostRegistry.forEach((record) => {
            const { root } = record;
            if (root.dataset.state === "open") setOpen(record, false);
          });
        });
      }
    };
  }

  // components/dropdown-fill/fill-types.ts
  var MODE_ORDER = ["color", "gradient", "image", "video"];
  var DEFAULT_GRADIENT = {
    angle: 135,
    stops: [
      { color: "#ff3b30", position: 0 },
      { color: "#007aff", position: 100 }
    ]
  };

  // components/dropdown-fill/color-utils.ts
  function clampNumber(value, min, max) {
    if (Number.isNaN(value)) return min;
    return Math.min(Math.max(value, min), max);
  }
  function roundTo(value, precision) {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }
  function normalizeHex(value) {
    const hex = value.trim().replace(/^#/, "").toLowerCase();
    if (/^[0-9a-f]{3}$/.test(hex)) {
      return `#${hex.split("").map((c) => c + c).join("")}`;
    }
    if (/^[0-9a-f]{4}$/.test(hex)) {
      const expanded = hex.split("").map((c) => c + c).join("");
      return `#${expanded.slice(0, 6)}`;
    }
    if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
    if (/^[0-9a-f]{8}$/.test(hex)) return `#${hex.slice(0, 6)}`;
    return null;
  }
  function normalizeAssetReferenceUrl(value) {
    const trimmed = value.trim();
    if (!trimmed) return "";
    try {
      const baseHref = typeof window !== "undefined" ? window.location.href : "http://localhost/";
      return new URL(trimmed, baseHref).toString();
    } catch {
      return trimmed;
    }
  }
  function sameAssetReferenceUrl(left, right) {
    const leftNormalized = normalizeAssetReferenceUrl(left);
    const rightNormalized = normalizeAssetReferenceUrl(right);
    if (!leftNormalized || !rightNormalized) return false;
    return leftNormalized === rightNormalized;
  }
  function hexToRgba(value) {
    const raw = value.trim().replace(/^#/, "");
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
  function rgbToHsv(r, g, b, alpha = 1) {
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
          h = 60 * ((gNorm - bNorm) / delta % 6);
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
  function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(h / 60 % 2 - 1));
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
      b: Math.round((b + m) * 255)
    };
  }
  function toHex(value) {
    return clampNumber(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  }
  function formatHex(hsv) {
    const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  function getComputedColor(value, root) {
    const temp = document.createElement("div");
    temp.style.color = value;
    temp.style.display = "none";
    root.appendChild(temp);
    const computed = getComputedStyle(temp).color;
    root.removeChild(temp);
    return computed;
  }
  function tryParseTransparentColorMix(value, root) {
    const trimmed = value.trim();
    if (!/^color-mix\(/i.test(trimmed)) return null;
    const parsePct = (raw) => {
      const num = Number.parseFloat(raw);
      if (!Number.isFinite(num)) return null;
      if (num < 0 || num > 100) return null;
      return num / 100;
    };
    const tailTransparent = trimmed.match(/^color-mix\(\s*in\s+oklab\s*,\s*(.+?)\s*,\s*transparent\s+([0-9.]+)%\s*\)$/i);
    const headTransparent = trimmed.match(/^color-mix\(\s*in\s+oklab\s*,\s*transparent\s+([0-9.]+)%\s*,\s*(.+?)\s*\)$/i);
    let colorExpr = null;
    let transparentWeight = null;
    if (tailTransparent) {
      colorExpr = tailTransparent[1]?.trim() ?? null;
      transparentWeight = parsePct(tailTransparent[2] ?? "");
    } else if (headTransparent) {
      transparentWeight = parsePct(headTransparent[1] ?? "");
      colorExpr = headTransparent[2]?.trim() ?? null;
    }
    if (!colorExpr || transparentWeight == null) return null;
    const base = colorStringToRgba(colorExpr, root);
    if (!base) return null;
    const baseWeight = 1 - transparentWeight;
    return { r: base.r, g: base.g, b: base.b, a: clampNumber(base.a * baseWeight, 0, 1) };
  }
  function colorStringToRgba(value, root) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const transparentMix = tryParseTransparentColorMix(trimmed, root);
    if (transparentMix) return transparentMix;
    if (trimmed.startsWith("#")) {
      return hexToRgba(trimmed);
    }
    if (typeof CSS !== "undefined" && typeof CSS.supports === "function" && !/\bvar\(/i.test(trimmed) && !CSS.supports("color", trimmed)) {
      return null;
    }
    const computed = getComputedColor(trimmed, root);
    return parseCssColor(computed);
  }
  function parseColor(value, root) {
    const rgba = colorStringToRgba(value, root);
    if (!rgba) return null;
    return rgbToHsv(rgba.r, rgba.g, rgba.b, rgba.a);
  }
  function parseCssColor(computed) {
    const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
    const clamp255 = (value) => Math.min(Math.max(value, 0), 255);
    const parseAlpha = (token) => {
      if (!token) return 1;
      const raw = token.trim();
      if (!raw) return 1;
      if (raw.endsWith("%")) {
        const pct = Number.parseFloat(raw.slice(0, -1));
        return Number.isFinite(pct) ? clamp01(pct / 100) : 1;
      }
      const num = Number.parseFloat(raw);
      return Number.isFinite(num) ? clamp01(num) : 1;
    };
    const parseRgb255 = (token) => {
      const raw = token.trim();
      if (!raw) return null;
      if (raw.endsWith("%")) {
        const pct = Number.parseFloat(raw.slice(0, -1));
        if (!Number.isFinite(pct)) return null;
        return clamp255(Math.round(pct / 100 * 255));
      }
      const num = Number.parseFloat(raw);
      if (!Number.isFinite(num)) return null;
      return clamp255(Math.round(num));
    };
    const parseSrgbChannel = (token) => {
      const raw = token.trim();
      if (!raw) return null;
      if (raw.endsWith("%")) {
        const pct = Number.parseFloat(raw.slice(0, -1));
        if (!Number.isFinite(pct)) return null;
        return clamp255(Math.round(pct / 100 * 255));
      }
      const num = Number.parseFloat(raw);
      if (!Number.isFinite(num)) return null;
      const normalized = num > 1 ? num / 255 : num;
      return clamp255(Math.round(clamp01(normalized) * 255));
    };
    const trimmed = computed.trim();
    const hexMatch = trimmed.match(/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hexMatch) return hexToRgba(trimmed);
    const srgbMatch = trimmed.match(/^color\(\s*srgb\s+(.+)\)$/i);
    if (srgbMatch) {
      const body = srgbMatch[1].trim().replace(/\)\s*$/, "");
      const [channelsPart, alphaPart] = body.split(/\s*\/\s*/);
      const channels = channelsPart.split(/\s+/).filter(Boolean);
      if (channels.length >= 3) {
        const r = parseSrgbChannel(channels[0]);
        const g = parseSrgbChannel(channels[1]);
        const b = parseSrgbChannel(channels[2]);
        if (r != null && g != null && b != null) return { r, g, b, a: parseAlpha(alphaPart) };
      }
    }
    const rgbMatch = trimmed.match(/^rgba?\(\s*(.+)\s*\)$/i);
    if (rgbMatch) {
      const body = rgbMatch[1];
      const hasSlash = body.includes("/");
      const [channelsPartRaw, alphaPartRaw] = hasSlash ? body.split(/\s*\/\s*/) : [body, null];
      const tokens = channelsPartRaw.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
      let alphaToken = alphaPartRaw ? alphaPartRaw.trim() : null;
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

  // components/dropdown-fill/fill-parser.ts
  function readAssetRef(raw) {
    return typeof raw === "string" ? raw : "";
  }
  function normalizeImageValue(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { fit: "cover", position: "center", repeat: "no-repeat" };
    }
    const value = raw;
    const assetRef = readAssetRef(value.assetRef);
    const name = typeof value.name === "string" ? value.name.trim() : "";
    const fit = value.fit === "contain" ? "contain" : "cover";
    const position = typeof value.position === "string" && value.position.trim() ? value.position.trim() : "center";
    const repeat = typeof value.repeat === "string" && value.repeat.trim() ? value.repeat.trim() : "no-repeat";
    return {
      ...assetRef ? { assetRef } : {},
      ...name ? { name } : {},
      fit,
      position,
      repeat
    };
  }
  function normalizeVideoValue(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { fit: "cover", position: "center", loop: true, muted: true, autoplay: true };
    }
    const value = raw;
    const assetRef = readAssetRef(value.assetRef);
    const posterAssetRef = readAssetRef(value.posterAssetRef);
    const name = typeof value.name === "string" ? value.name.trim() : "";
    const fit = value.fit === "contain" ? "contain" : "cover";
    const position = typeof value.position === "string" && value.position.trim() ? value.position.trim() : "center";
    const loop = typeof value.loop === "boolean" ? value.loop : true;
    const muted = typeof value.muted === "boolean" ? value.muted : true;
    const autoplay = typeof value.autoplay === "boolean" ? value.autoplay : true;
    return {
      ...assetRef ? { assetRef } : {},
      ...posterAssetRef ? { posterAssetRef } : {},
      ...name ? { name } : {},
      fit,
      position,
      loop,
      muted,
      autoplay
    };
  }
  function normalizeGradientValue(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const value = raw;
    if (value.kind !== "linear" || typeof value.angle !== "number" || !Number.isFinite(value.angle) || value.angle < 0 || value.angle > 360) return null;
    const stopsRaw = Array.isArray(value.stops) ? value.stops : [];
    const stops = stopsRaw.map((stop) => {
      if (!stop || typeof stop !== "object" || Array.isArray(stop)) return null;
      const entry = stop;
      const color = typeof entry.color === "string" ? entry.color : "";
      if (!color) return null;
      if (typeof entry.position !== "number" || !Number.isFinite(entry.position) || entry.position < 0 || entry.position > 100) return null;
      return { color, position: entry.position };
    }).filter((stop) => Boolean(stop));
    return stops.length === stopsRaw.length && stops.length >= 2 ? { kind: "linear", angle: value.angle, stops } : null;
  }
  function coerceFillValue(raw) {
    const typeRaw = typeof raw.type === "string" ? raw.type.trim().toLowerCase() : "";
    if (!typeRaw) return { type: "none" };
    if (typeRaw === "none") return { type: "none" };
    if (!MODE_ORDER.includes(typeRaw)) return null;
    if (typeRaw === "color") {
      const color = typeof raw.color === "string" ? raw.color.trim() : "";
      const value = typeof raw.value === "string" ? raw.value.trim() : "";
      return { type: "color", color: color || value || "transparent" };
    }
    if (typeRaw === "gradient") {
      const gradient = normalizeGradientValue(raw.gradient);
      return gradient ? { type: "gradient", gradient } : null;
    }
    if (typeRaw === "image") {
      return { type: "image", image: normalizeImageValue(raw.image) };
    }
    if (typeRaw === "video") {
      return { type: "video", video: normalizeVideoValue(raw.video) };
    }
    return { type: "none" };
  }
  function parseFillString(value, root) {
    if (!value) return { type: "none" };
    const parsed = parseColor(value, root);
    if (!parsed) return null;
    return { type: "color", color: value };
  }
  function parseFillValue(raw, root) {
    const value = String(raw ?? "").trim();
    if (!value) return { type: "none" };
    if (value.startsWith("{") || value.startsWith("[") || value.startsWith('"')) {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === "string") return parseFillString(parsed, root);
        if (parsed == null) return { type: "none" };
        if (typeof parsed !== "object" || Array.isArray(parsed)) return null;
        return coerceFillValue(parsed);
      } catch {
        return parseFillString(value, root);
      }
    }
    return parseFillString(value, root);
  }
  function resolveModeFromFill(currentMode, allowedModes, fill) {
    const desired = fill.type === "none" ? currentMode : fill.type;
    if (allowedModes.includes(desired)) return desired;
    return allowedModes[0] || "color";
  }
  function readImageName(fill) {
    return typeof fill.image?.name === "string" && fill.image.name.trim() ? fill.image.name.trim() : null;
  }
  function readVideoName(fill) {
    return typeof fill.video?.name === "string" && fill.video.name.trim() ? fill.video.name.trim() : null;
  }
  function readImageAssetRef(fill) {
    return typeof fill.image?.assetRef === "string" && fill.image.assetRef ? fill.image.assetRef : null;
  }
  function readVideoAssetRef(fill) {
    return typeof fill.video?.assetRef === "string" && fill.video.assetRef ? fill.video.assetRef : null;
  }
  function readVideoPosterAssetRef(fill) {
    return typeof fill.video?.posterAssetRef === "string" && fill.video.posterAssetRef ? fill.video.posterAssetRef : null;
  }

  // components/dropdown-fill/dropdown-fill-gradient.ts
  var gradientStopIdCounter = 0;
  function createGradientStopId() {
    gradientStopIdCounter += 1;
    return `gradient-stop-${gradientStopIdCounter}`;
  }
  function createGradientStopState(root, stop) {
    const parsed = parseColor(stop.color, root);
    const safeColor = parsed ? stop.color : DEFAULT_GRADIENT.stops[0].color;
    const hsv = parsed || parseColor(safeColor, root) || { h: 0, s: 0, v: 0, a: 1 };
    return {
      id: createGradientStopId(),
      color: safeColor,
      position: clampNumber(stop.position, 0, 100),
      hsv
    };
  }
  function createDefaultGradientStops(root) {
    return DEFAULT_GRADIENT.stops.map((stop) => createGradientStopState(root, stop));
  }
  function installGradientHandlers(state, deps) {
    if (state.gradientAngleInput) {
      state.gradientAngleInput.addEventListener("input", () => {
        const angle = clampNumber(Number(state.gradientAngleInput?.value), 0, 360);
        state.gradient.angle = angle;
        syncGradientUI(state, { commit: true }, deps);
      });
    }
    installGradientStopBarHandlers(state, deps);
    installGradientEditorHandlers(state, deps);
  }
  function applyGradientSwatch(state, parsed, deps) {
    const stop = getActiveGradientStop(state);
    stop.hsv.h = parsed.h;
    stop.hsv.s = parsed.s;
    stop.hsv.v = parsed.v;
    stop.hsv.a = 1;
    commitGradientStopFromHsv(state, deps);
  }
  function applyGradientFromFill(state, gradient) {
    state.gradient = { angle: DEFAULT_GRADIENT.angle };
    state.gradientStops = createDefaultGradientStops(state.root);
    state.gradientActiveStopId = state.gradientStops[0]?.id ?? "";
    if (!gradient || typeof gradient !== "object" || Array.isArray(gradient) || !("kind" in gradient) || gradient.kind !== "linear") return;
    state.gradient.angle = clampNumber(gradient.angle, 0, 360);
    if (Array.isArray(gradient.stops) && gradient.stops.length >= 2) {
      state.gradientStops = gradient.stops.map((stop) => createGradientStopState(state.root, stop));
      state.gradientActiveStopId = state.gradientStops[0]?.id ?? "";
    }
  }
  function syncGradientUI(state, opts, deps) {
    const shouldUpdateHeader = opts.updateHeader !== false;
    const shouldUpdateRemove = opts.updateRemove !== false;
    ensureGradientStops(state);
    if (state.gradientAngleInput) {
      state.gradientAngleInput.value = String(clampNumber(state.gradient.angle, 0, 360));
      state.gradientAngleInput.style.setProperty("--value", state.gradientAngleInput.value);
      state.gradientAngleInput.style.setProperty("--min", "0");
      state.gradientAngleInput.style.setProperty("--max", "360");
    }
    syncGradientStopButtons(state);
    syncActiveGradientStopUI(state);
    updateGradientAddButton(state);
    updateGradientPreview(state, { commit: opts.commit, updateHeader: shouldUpdateHeader, updateRemove: shouldUpdateRemove }, deps);
  }
  function ensureGradientStops(state) {
    if (state.gradientStops.length >= 2) return;
    state.gradientStops = createDefaultGradientStops(state.root);
    state.gradientActiveStopId = state.gradientStops[0]?.id ?? "";
  }
  function getSortedGradientStops(stops) {
    return [...stops].sort((a, b) => a.position - b.position);
  }
  function getActiveGradientStop(state) {
    let active = state.gradientStops.find((stop) => stop.id === state.gradientActiveStopId);
    if (!active) {
      ensureGradientStops(state);
      active = state.gradientStops[0];
      state.gradientActiveStopId = active?.id ?? "";
    }
    return active;
  }
  function getGradientStopMetrics(state) {
    const bar = state.gradientStopBar;
    if (!bar) return null;
    const rect = bar.getBoundingClientRect();
    if (!rect.width) return null;
    const sampleButton = state.gradientStopButtons.values().next().value;
    const sampleRect = sampleButton?.getBoundingClientRect();
    const sizeFallback = parseFloat(getComputedStyle(bar).getPropertyValue("--control-size-md")) || 24;
    const stopSize = sampleRect?.width || sizeFallback;
    const half = stopSize / 2;
    const minX = half;
    const maxX = Math.max(half, rect.width - half);
    return { rect, minX, maxX };
  }
  function gradientPercentToPx(state, position) {
    const metrics = getGradientStopMetrics(state);
    if (!metrics) return null;
    const percent = clampNumber(position, 0, 100);
    const span = metrics.maxX - metrics.minX;
    if (span <= 0) return metrics.minX;
    return metrics.minX + span * percent / 100;
  }
  function gradientPxToPercent(state, clientX) {
    const metrics = getGradientStopMetrics(state);
    if (!metrics) return 0;
    const x = clampNumber(clientX - metrics.rect.left, metrics.minX, metrics.maxX);
    const span = metrics.maxX - metrics.minX;
    if (span <= 0) return 0;
    return clampNumber((x - metrics.minX) / span * 100, 0, 100);
  }
  function getActiveGradientStopIndex(state) {
    const sorted = getSortedGradientStops(state.gradientStops);
    const index = sorted.findIndex((stop) => stop.id === state.gradientActiveStopId);
    return { sorted, index };
  }
  function updateGradientAddButton(state) {
    const button = state.gradientStopAdd;
    if (!button) return;
    const { sorted, index } = getActiveGradientStopIndex(state);
    const removable = index > 0 && index < sorted.length - 1;
    button.textContent = removable ? "-" : "+";
    button.classList.toggle("is-remove", removable);
    button.setAttribute("aria-label", removable ? "Remove color stop" : "Add color stop");
  }
  function syncGradientStopButtons(state) {
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
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "diet-dropdown-fill__gradient-stop-btn";
        btn.dataset.stopId = stop.id;
        btn.setAttribute("aria-label", "Edit gradient stop");
        bindGradientStopButton(state, btn, stop.id);
        existing.set(stop.id, btn);
        bar.appendChild(btn);
      }
      const leftPx = gradientPercentToPx(state, stop.position);
      btn.style.left = leftPx == null ? `${stop.position}%` : `${leftPx}px`;
      btn.style.setProperty("--stop-color", stop.color);
      const isActive = stop.id === state.gradientActiveStopId;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }
  function getSwatchTarget(swatch) {
    const container = swatch.closest(".diet-dropdown-fill__swatches");
    return container?.dataset.swatchTarget === "gradient" ? "gradient" : "color";
  }
  function syncActiveGradientStopUI(state) {
    const stop = getActiveGradientStop(state);
    const hsv = stop.hsv;
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
    const hex = formatHex({ h: hsv.h, s: hsv.s, v: hsv.v, a: 1 });
    const alphaPercent = Math.round(hsv.a * 100);
    if (state.gradientEditor) {
      state.gradientEditor.style.setProperty("--picker-hue", hsv.h.toString());
      state.gradientEditor.style.setProperty("--picker-rgb", `${rgb.r} ${rgb.g} ${rgb.b}`);
    }
    if (state.gradientStopHueInput) {
      state.gradientStopHueInput.value = hsv.h.toString();
      state.gradientStopHueInput.style.setProperty("--value", state.gradientStopHueInput.value);
      state.gradientStopHueInput.style.setProperty("--min", "0");
      state.gradientStopHueInput.style.setProperty("--max", "360");
    }
    if (state.gradientStopAlphaInput) {
      state.gradientStopAlphaInput.value = alphaPercent.toString();
      state.gradientStopAlphaInput.style.setProperty("--value", state.gradientStopAlphaInput.value);
      state.gradientStopAlphaInput.style.setProperty("--min", "0");
      state.gradientStopAlphaInput.style.setProperty("--max", "100");
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
      if (getSwatchTarget(swatch) !== "gradient") return;
      const swatchHex = normalizeHex(swatch.dataset.color || "");
      const match = Boolean(normalizedCurrent && swatchHex && swatchHex === normalizedCurrent);
      swatch.classList.toggle("is-selected", match);
      swatch.setAttribute("aria-pressed", match ? "true" : "false");
    });
  }
  function setActiveGradientStop(state, stopId) {
    state.gradientActiveStopId = stopId;
    syncGradientStopButtons(state);
    syncActiveGradientStopUI(state);
    updateGradientAddButton(state);
  }
  function updateGradientPreview(state, opts, deps) {
    const shouldUpdateHeader = opts.updateHeader !== false;
    const shouldUpdateRemove = opts.updateRemove !== false;
    const css = buildGradientCss(state);
    if (state.gradientPreview) state.gradientPreview.style.backgroundImage = css;
    if (opts.commit) {
      deps.setInputValue(state, buildGradientFill(state), true);
    }
    if (shouldUpdateHeader) {
      deps.updateHeader(state, { text: "", muted: false, chipColor: css });
    }
    if (shouldUpdateRemove) {
      deps.setRemoveFillState(state, false);
    }
  }
  function addGradientStop(state, deps) {
    ensureGradientStops(state);
    const sorted = getSortedGradientStops(state.gradientStops);
    const active = getActiveGradientStop(state);
    const activeIndex = sorted.findIndex((stop2) => stop2.id === active.id);
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
  function removeGradientStop(state, stopId, deps) {
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
      state.gradientActiveStopId = nearest?.id ?? "";
    }
    syncGradientUI(state, { commit: true }, deps);
  }
  function bindGradientStopButton(state, button, stopId) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      setActiveGradientStop(state, stopId);
    });
  }
  function commitGradientStopFromHsv(state, deps) {
    const stop = getActiveGradientStop(state);
    stop.color = colorStringFromHsv(stop.hsv);
    syncGradientUI(state, { commit: true }, deps);
  }
  function handleGradientStopHexInput(state, deps) {
    if (!state.gradientStopHexInput) return;
    const stop = getActiveGradientStop(state);
    const hsv = stop.hsv;
    const raw = state.gradientStopHexInput.value.trim();
    if (!raw) {
      state.gradientStopHexInput.value = formatHex(hsv);
      return;
    }
    const normalized = raw.startsWith("#") ? raw : `#${raw}`;
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
  function handleGradientStopAlphaField(state, deps) {
    if (!state.gradientStopAlphaField) return;
    const stop = getActiveGradientStop(state);
    const hsv = stop.hsv;
    const raw = state.gradientStopAlphaField.value.trim().replace("%", "");
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
  function installGradientStopBarHandlers(state, deps) {
    if (state.gradientStopAdd) {
      state.gradientStopAdd.addEventListener("click", (event) => {
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
    const getStopIdFromTarget = (target) => {
      if (!(target instanceof HTMLElement)) return null;
      const btn = target.closest(".diet-dropdown-fill__gradient-stop-btn");
      return btn?.dataset.stopId ?? null;
    };
    const findNearestStopId = (clientX) => {
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
    const moveStop = (stopId, event) => {
      const stop = state.gradientStops.find((entry) => entry.id === stopId);
      if (!stop) return;
      stop.position = gradientPxToPercent(state, event.clientX);
      syncGradientStopButtons(state);
      updateGradientPreview(state, { commit: true, updateHeader: true, updateRemove: false }, deps);
    };
    const finishDrag = (stopId, event) => {
      const rect = bar.getBoundingClientRect();
      const outside = event.clientY < rect.top - 24 || event.clientY > rect.bottom + 24;
      state.gradientDrag = void 0;
      if (outside) {
        removeGradientStop(state, stopId, deps);
        return;
      }
      syncGradientStopButtons(state);
      updateGradientPreview(state, { commit: true, updateHeader: true }, deps);
    };
    bar.addEventListener("pointerdown", (event) => {
      const stopId = getStopIdFromTarget(event.target) || findNearestStopId(event.clientX);
      if (!stopId) return;
      event.preventDefault();
      setActiveGradientStop(state, stopId);
      state.gradientDrag = { id: stopId, pointerId: event.pointerId };
      bar.setPointerCapture(event.pointerId);
    });
    bar.addEventListener("pointermove", (event) => {
      if (!state.gradientDrag) return;
      if (state.gradientDrag.pointerId !== event.pointerId) return;
      if (event.pressure === 0 && event.buttons === 0) return;
      moveStop(state.gradientDrag.id, event);
    });
    bar.addEventListener("pointerup", (event) => {
      if (!state.gradientDrag) return;
      if (state.gradientDrag.pointerId !== event.pointerId) return;
      finishDrag(state.gradientDrag.id, event);
    });
    bar.addEventListener("pointercancel", (event) => {
      if (!state.gradientDrag) return;
      if (state.gradientDrag.pointerId !== event.pointerId) return;
      finishDrag(state.gradientDrag.id, event);
    });
  }
  function installGradientEditorHandlers(state, deps) {
    if (state.gradientStopSv) {
      const move = (event) => {
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
      const handlePointerDown = (event) => {
        event.preventDefault();
        state.gradientStopSv?.setPointerCapture(event.pointerId);
        move(event);
      };
      state.gradientStopSv.addEventListener("pointerdown", handlePointerDown);
      state.gradientStopSv.addEventListener("pointermove", (event) => {
        if (event.pressure === 0 && event.buttons === 0) return;
        move(event);
      });
      state.gradientStopSv.addEventListener("click", (event) => {
        move(event);
      });
    }
    if (state.gradientStopHueInput) {
      state.gradientStopHueInput.addEventListener("input", () => {
        const hue = clampNumber(Number(state.gradientStopHueInput?.value), 0, 360);
        const stop = getActiveGradientStop(state);
        stop.hsv.h = hue;
        if (stop.hsv.a === 0) stop.hsv.a = 1;
        commitGradientStopFromHsv(state, deps);
      });
    }
    if (state.gradientStopAlphaInput) {
      state.gradientStopAlphaInput.addEventListener("input", () => {
        const alpha = clampNumber(Number(state.gradientStopAlphaInput?.value) / 100, 0, 1);
        const stop = getActiveGradientStop(state);
        stop.hsv.a = alpha;
        commitGradientStopFromHsv(state, deps);
      });
    }
    if (state.gradientStopHexInput) {
      const handler = () => handleGradientStopHexInput(state, deps);
      state.gradientStopHexInput.addEventListener("change", handler);
      state.gradientStopHexInput.addEventListener("blur", handler);
    }
    if (state.gradientStopAlphaField) {
      const handler = () => handleGradientStopAlphaField(state, deps);
      state.gradientStopAlphaField.addEventListener("change", handler);
      state.gradientStopAlphaField.addEventListener("blur", handler);
    }
  }
  function normalizeGradientStopsForOutput(state) {
    return getSortedGradientStops(state.gradientStops).map((stop) => ({
      color: stop.color,
      position: clampNumber(stop.position, 0, 100)
    }));
  }
  function buildGradientFill(state) {
    const angle = clampNumber(state.gradient.angle, 0, 360);
    const normalizedStops = normalizeGradientStopsForOutput(state);
    return {
      type: "gradient",
      gradient: {
        kind: "linear",
        angle,
        stops: normalizedStops
      }
    };
  }
  function buildGradientCss(state) {
    const angle = clampNumber(state.gradient.angle, 0, 360);
    const normalizedStops = normalizeGradientStopsForOutput(state);
    const stopList = normalizedStops.map((stop) => `${stop.color} ${clampNumber(stop.position, 0, 100)}%`).join(", ");
    return `linear-gradient(${angle}deg, ${stopList})`;
  }
  function colorStringFromHsv(hsv) {
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
    return hsv.a < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${roundTo(hsv.a, 2)})` : formatHex({ ...hsv, a: 1 });
  }

  // components/shared/account-assets.ts
  var ACCOUNT_ASSET_UPSELL_REASONS = /* @__PURE__ */ new Set([
    "coreui.upsell.reason.limitReached",
    "coreui.upsell.reason.platform.uploads"
  ]);
  function dispatchAccountAssetUpsell(root, reasonKey) {
    const normalizedReasonKey = typeof reasonKey === "string" ? reasonKey : "";
    if (!ACCOUNT_ASSET_UPSELL_REASONS.has(normalizedReasonKey)) return false;
    root.dispatchEvent(
      new CustomEvent("bob-upsell", {
        detail: { reasonKey: normalizedReasonKey },
        bubbles: true
      })
    );
    return true;
  }

  // components/shared/account-asset-resolve.ts
  async function resolveSingleAccountAsset(args) {
    const assetRef = args.getAssetRef();
    const requestId = args.beginRequest();
    args.onStart?.();
    if (!assetRef) return;
    try {
      const resolved = await args.accountAssets.resolveAssets([assetRef]);
      if (!args.isCurrent(requestId, assetRef)) return;
      const asset = resolved.assetsByRef.get(assetRef);
      if (!asset) throw new Error("coreui.errors.assets.payloadInvalid");
      args.onResolved(asset);
    } catch (error) {
      if (!args.isCurrent(requestId, assetRef)) return;
      args.onError(error instanceof Error ? error.message : "coreui.errors.db.readFailed");
    }
  }

  // components/dropdown-fill/media-controller.ts
  var VIDEO_PREVIEW_FAILED_MESSAGE = "Preview failed to load.";
  function setFillUploadingState(state, uploading) {
    state.root.dataset.uploading = uploading ? "true" : "false";
    if (state.uploadButton) state.uploadButton.disabled = uploading;
    if (state.chooseButton) state.chooseButton.disabled = uploading;
    if (state.removeButton) state.removeButton.disabled = uploading;
    if (state.videoUploadButton) state.videoUploadButton.disabled = uploading;
    if (state.videoChooseButton) state.videoChooseButton.disabled = uploading;
    if (state.videoRemoveButton) state.videoRemoveButton.disabled = uploading;
  }
  function formatSizeBytes(sizeBytes) {
    const size = Number.isFinite(sizeBytes) ? Math.max(0, Math.trunc(sizeBytes)) : 0;
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    if (size >= 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${size} B`;
  }
  function setBrowserOpen(browser, button, open) {
    if (browser) browser.hidden = !open;
    if (button) button.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function setAssetPanelMessage(target, message) {
    if (!target) return;
    target.textContent = message;
    target.hidden = !message;
  }
  function clearAssetBrowser(browserList) {
    if (!browserList) return;
    browserList.innerHTML = "";
  }
  function filterAssetsForKind(assets, kind) {
    if (kind === "image") {
      return assets.filter((asset) => asset.assetType === "image" || asset.assetType === "vector");
    }
    return assets.filter((asset) => asset.assetType === "video");
  }
  function syncImageHeader(state, deps) {
    if (state.imageSrc) {
      const label = state.imageName || "Image selected";
      deps.updateHeader(state, { text: label, muted: false, chipColor: null });
      return;
    }
    deps.updateHeader(state, { text: "", muted: true, chipColor: null, noneChip: true });
  }
  function syncVideoHeader(state, deps) {
    if (state.videoSrc) {
      const label = state.videoName || "Video selected";
      deps.updateHeader(state, { text: label, muted: false, chipColor: null });
      return;
    }
    deps.updateHeader(state, { text: "", muted: true, chipColor: null, noneChip: true });
  }
  function hasAvailableImage(state) {
    return Boolean(state.imageSrc);
  }
  function hasAvailableVideo(state) {
    return Boolean(state.videoSrc);
  }
  function syncImageMediaState(state, opts, deps) {
    const hasImage = hasAvailableImage(state);
    if (state.imagePanel) {
      state.imagePanel.dataset.hasImage = hasImage ? "true" : "false";
    }
    if (state.removeButton) {
      state.removeButton.hidden = !hasImage;
      state.removeButton.disabled = !hasImage;
    }
    if (state.imagePreview) {
      state.imagePreview.style.backgroundImage = hasImage ? `url("${state.imageSrc}")` : "none";
    }
    if (opts.updateHeader !== false) {
      syncImageHeader(state, deps);
    }
    if (opts.updateRemove !== false) {
      deps.setRemoveFillState(state, !hasImage);
    }
  }
  function syncVideoMediaState(state, opts, deps) {
    const hasVideo = hasAvailableVideo(state);
    if (state.videoPanel) {
      state.videoPanel.dataset.hasVideo = hasVideo ? "true" : "false";
    }
    if (state.videoRemoveButton) {
      state.videoRemoveButton.hidden = !hasVideo;
      state.videoRemoveButton.disabled = !hasVideo;
    }
    if (opts.updateHeader !== false) {
      syncVideoHeader(state, deps);
    }
    if (opts.updateRemove !== false) {
      deps.setRemoveFillState(state, !hasVideo);
    }
  }
  function setImageSrc(state, src, opts, deps) {
    const shouldUpdateHeader = opts.updateHeader !== false;
    const shouldUpdateRemove = opts.updateRemove !== false;
    const previousSrc = state.imageSrc;
    if (state.imageObjectUrl && previousSrc && previousSrc === state.imageObjectUrl && src !== previousSrc) {
      URL.revokeObjectURL(state.imageObjectUrl);
      state.imageObjectUrl = null;
    }
    state.imageSrc = src;
    if (opts.commit) {
      const assetRef = state.imageAssetRef || "";
      const fill = assetRef ? {
        type: "image",
        image: {
          assetRef,
          ...state.imageName ? { name: state.imageName } : {},
          fit: "cover",
          position: "center",
          repeat: "no-repeat"
        }
      } : { type: "none" };
      deps.setInputValue(state, fill, true);
    }
    syncImageMediaState(state, { updateHeader: shouldUpdateHeader, updateRemove: shouldUpdateRemove }, deps);
  }
  function setVideoSrc(state, src, opts, deps) {
    const shouldUpdateHeader = opts.updateHeader !== false;
    const shouldUpdateRemove = opts.updateRemove !== false;
    const previousSrc = state.videoSrc;
    if (state.videoObjectUrl && previousSrc && previousSrc === state.videoObjectUrl && src !== previousSrc) {
      URL.revokeObjectURL(state.videoObjectUrl);
      state.videoObjectUrl = null;
    }
    state.videoSrc = src;
    if (opts.commit) {
      const assetRef = state.videoAssetRef || "";
      const fill = assetRef ? {
        type: "video",
        video: {
          assetRef,
          ...state.videoName ? { name: state.videoName } : {},
          ...state.videoPosterAssetRef ? { posterAssetRef: state.videoPosterAssetRef } : {},
          fit: "cover",
          position: "center",
          loop: true,
          muted: true,
          autoplay: true
        }
      } : { type: "none" };
      deps.setInputValue(state, fill, true);
    }
    if (state.videoPreview) {
      state.videoPreview.src = src || "";
      if (src) state.videoPreview.load();
    }
    syncVideoMediaState(state, { updateHeader: shouldUpdateHeader, updateRemove: shouldUpdateRemove }, deps);
  }
  function renderAssetBrowserRows(args) {
    const browserList = args.kind === "image" ? args.state.imageBrowserList : args.state.videoBrowserList;
    if (!browserList) return;
    browserList.innerHTML = "";
    if (!args.assets.length) {
      const empty = document.createElement("div");
      empty.className = "diet-dropdown-fill__asset-browser-empty body-s";
      empty.textContent = "No assets found.";
      browserList.appendChild(empty);
      return;
    }
    args.assets.forEach((asset) => {
      const row = document.createElement("div");
      row.className = "diet-dropdown-fill__asset-browser-row";
      const meta = document.createElement("div");
      meta.className = "diet-dropdown-fill__asset-browser-meta";
      const name = document.createElement("div");
      name.className = "diet-dropdown-fill__asset-browser-name label-s";
      name.textContent = asset.filename;
      meta.appendChild(name);
      const subline = document.createElement("div");
      subline.className = "diet-dropdown-fill__asset-browser-subline body-xs";
      subline.textContent = `${asset.assetType} \u2022 ${formatSizeBytes(asset.sizeBytes)}`;
      meta.appendChild(subline);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "diet-btn-txt diet-dropdown-fill__asset-browser-use";
      button.setAttribute("data-size", "sm");
      button.setAttribute("data-variant", "line1");
      button.innerHTML = '<span class="diet-btn-txt__label body-s">Use</span>';
      button.addEventListener("click", (event) => {
        event.preventDefault();
        if (args.kind === "image") {
          commitImageAssetSelection(args.state, asset.assetRef, asset.filename, true, args.deps);
          setBrowserOpen(args.state.imageBrowser, args.state.chooseButton, false);
          return;
        }
        commitVideoAssetSelection(args.state, asset.assetRef, asset.filename, true, args.deps);
        setBrowserOpen(args.state.videoBrowser, args.state.videoChooseButton, false);
      });
      row.appendChild(meta);
      row.appendChild(button);
      browserList.appendChild(row);
    });
  }
  async function openAssetBrowser(args) {
    const browser = args.kind === "image" ? args.state.imageBrowser : args.state.videoBrowser;
    const browserMessage = args.kind === "image" ? args.state.imageBrowserMessage : args.state.videoBrowserMessage;
    const browserList = args.kind === "image" ? args.state.imageBrowserList : args.state.videoBrowserList;
    const button = args.kind === "image" ? args.state.chooseButton : args.state.videoChooseButton;
    const oppositeBrowser = args.kind === "image" ? args.state.videoBrowser : args.state.imageBrowser;
    const oppositeButton = args.kind === "image" ? args.state.videoChooseButton : args.state.chooseButton;
    if (!browser || !button) return;
    if (!browser.hidden) {
      setBrowserOpen(browser, button, false);
      return;
    }
    setBrowserOpen(oppositeBrowser, oppositeButton, false);
    setBrowserOpen(browser, button, true);
    setFillUploadingState(args.state, true);
    setAssetPanelMessage(browserMessage, "Loading assets\u2026");
    clearAssetBrowser(browserList);
    try {
      const assets = filterAssetsForKind(await args.state.accountAssets.listAssets(), args.kind);
      setAssetPanelMessage(browserMessage, assets.length ? "" : "No assets available yet.");
      renderAssetBrowserRows({
        state: args.state,
        kind: args.kind,
        assets,
        deps: args.deps
      });
    } catch (error) {
      setAssetPanelMessage(
        browserMessage,
        error instanceof Error ? error.message : "coreui.errors.db.readFailed"
      );
      clearAssetBrowser(browserList);
    } finally {
      setFillUploadingState(args.state, false);
    }
  }
  async function handleAssetUpload(args) {
    setFillUploadingState(args.state, true);
    setAssetPanelMessage(args.kind === "image" ? args.state.imageMessage : args.state.videoMessage, "");
    try {
      const asset = await args.state.accountAssets.uploadAsset(args.file, "api");
      if (args.kind === "image") {
        commitImageAssetSelection(args.state, asset.assetRef, asset.filename, true, args.deps);
        setBrowserOpen(args.state.imageBrowser, args.state.chooseButton, false);
        return;
      }
      commitVideoAssetSelection(args.state, asset.assetRef, asset.filename, true, args.deps);
      setBrowserOpen(args.state.videoBrowser, args.state.videoChooseButton, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "coreui.errors.assets.uploadFailed";
      if (dispatchAccountAssetUpsell(args.state.root, message)) {
        return;
      }
      setAssetPanelMessage(args.kind === "image" ? args.state.imageMessage : args.state.videoMessage, message);
    } finally {
      setFillUploadingState(args.state, false);
    }
  }
  function commitImageAssetSelection(state, assetRef, filename, commit, deps) {
    state.imageAssetRef = assetRef;
    state.imageName = filename;
    setAssetPanelMessage(state.imageMessage, "");
    setImageSrc(state, null, { commit }, deps);
    void resolveImageAsset(state, deps);
  }
  function commitVideoAssetSelection(state, assetRef, filename, commit, deps) {
    state.videoAssetRef = assetRef;
    state.videoName = filename;
    setAssetPanelMessage(state.videoMessage, "");
    setVideoSrc(state, null, { commit }, deps);
    void resolveVideoAsset(state, deps);
  }
  async function resolveImageAsset(state, deps) {
    return resolveSingleAccountAsset({
      accountAssets: state.accountAssets,
      getAssetRef: () => state.imageAssetRef || "",
      beginRequest: () => {
        state.imageResolveRequestId += 1;
        return state.imageResolveRequestId;
      },
      isCurrent: (requestId, assetRef) => state.imageResolveRequestId === requestId && state.imageAssetRef === assetRef,
      onStart: () => setAssetPanelMessage(state.imageMessage, ""),
      onResolved: (asset) => {
        setImageSrc(state, asset.url, { commit: false }, deps);
      },
      onError: (message) => {
        setAssetPanelMessage(state.imageMessage, message);
      }
    });
  }
  async function resolveVideoAsset(state, deps) {
    return resolveSingleAccountAsset({
      accountAssets: state.accountAssets,
      getAssetRef: () => state.videoAssetRef || "",
      beginRequest: () => {
        state.videoResolveRequestId += 1;
        return state.videoResolveRequestId;
      },
      isCurrent: (requestId, assetRef) => state.videoResolveRequestId === requestId && state.videoAssetRef === assetRef,
      onStart: () => setAssetPanelMessage(state.videoMessage, ""),
      onResolved: (asset) => {
        setVideoSrc(state, asset.url, { commit: false }, deps);
      },
      onError: (message) => {
        setAssetPanelMessage(state.videoMessage, message);
      }
    });
  }
  function installImageHandlers(state, deps) {
    const { uploadButton, chooseButton, removeButton, fileInput } = state;
    if (uploadButton && fileInput) {
      uploadButton.disabled = false;
      uploadButton.hidden = false;
      fileInput.disabled = false;
      uploadButton.addEventListener("click", (event) => {
        event.preventDefault();
        fileInput.value = "";
        fileInput.click();
      });
      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        void handleAssetUpload({ state, kind: "image", file, deps });
      });
    }
    if (chooseButton) {
      chooseButton.disabled = false;
      chooseButton.hidden = false;
      chooseButton.addEventListener("click", (event) => {
        event.preventDefault();
        void openAssetBrowser({ state, kind: "image", deps });
      });
    }
    if (removeButton) {
      removeButton.addEventListener("click", (event) => {
        event.preventDefault();
        if (state.imageObjectUrl) {
          URL.revokeObjectURL(state.imageObjectUrl);
          state.imageObjectUrl = null;
        }
        state.imageAssetRef = null;
        state.imageName = null;
        setAssetPanelMessage(state.imageMessage, "");
        setBrowserOpen(state.imageBrowser, state.chooseButton, false);
        setImageSrc(state, null, { commit: true }, deps);
      });
    }
  }
  function installVideoHandlers(state, deps) {
    const { videoUploadButton, videoChooseButton, videoRemoveButton, videoFileInput } = state;
    if (state.videoPreview) {
      state.videoPreview.addEventListener("error", () => {
        const currentSrc = state.videoPreview?.currentSrc || state.videoPreview?.src || "";
        if (!state.videoSrc || !sameAssetReferenceUrl(currentSrc, state.videoSrc)) return;
        setAssetPanelMessage(state.videoMessage, VIDEO_PREVIEW_FAILED_MESSAGE);
      });
      state.videoPreview.addEventListener("loadeddata", () => {
        const currentSrc = state.videoPreview?.currentSrc || state.videoPreview?.src || "";
        if (!state.videoSrc || !sameAssetReferenceUrl(currentSrc, state.videoSrc)) return;
        if ((state.videoMessage?.textContent || "").trim() !== VIDEO_PREVIEW_FAILED_MESSAGE) return;
        setAssetPanelMessage(state.videoMessage, "");
      });
    }
    if (videoUploadButton && videoFileInput) {
      videoUploadButton.disabled = false;
      videoUploadButton.hidden = false;
      videoFileInput.disabled = false;
      videoUploadButton.addEventListener("click", (event) => {
        event.preventDefault();
        videoFileInput.value = "";
        videoFileInput.click();
      });
      videoFileInput.addEventListener("change", () => {
        const file = videoFileInput.files?.[0];
        if (!file) return;
        void handleAssetUpload({ state, kind: "video", file, deps });
      });
    }
    if (videoChooseButton) {
      videoChooseButton.disabled = false;
      videoChooseButton.hidden = false;
      videoChooseButton.addEventListener("click", (event) => {
        event.preventDefault();
        void openAssetBrowser({ state, kind: "video", deps });
      });
    }
    if (videoRemoveButton) {
      videoRemoveButton.addEventListener("click", (event) => {
        event.preventDefault();
        if (state.videoObjectUrl) {
          URL.revokeObjectURL(state.videoObjectUrl);
          state.videoObjectUrl = null;
        }
        state.videoAssetRef = null;
        state.videoPosterAssetRef = null;
        state.videoName = null;
        setAssetPanelMessage(state.videoMessage, "");
        setBrowserOpen(state.videoBrowser, state.videoChooseButton, false);
        setVideoSrc(state, null, { commit: true }, deps);
      });
    }
  }

  // components/dropdown-fill/dropdown-fill.ts
  var MODE_LABELS = {
    color: "Color fill",
    gradient: "Gradient fill",
    image: "Image fill",
    video: "Video fill"
  };
  var states = /* @__PURE__ */ new Map();
  var hydrateHost = createDropdownHydrator({
    rootSelector: ".diet-dropdown-fill",
    triggerSelector: ".diet-dropdown-fill__control",
    isInsideTarget: () => false
  });
  function hydrateDropdownFill(scope, options) {
    const roots = Array.from(scope.querySelectorAll(".diet-dropdown-fill"));
    if (!roots.length) return;
    roots.forEach((root) => {
      if (states.has(root)) return;
      const state = createState(root, options.accountAssets);
      if (!state) return;
      wireModes(state);
      states.set(root, state);
      installHandlers(state);
      const initialValue = state.input.value || state.input.getAttribute("data-bob-json") || state.input.getAttribute("value") || "";
      syncFromValue(state, initialValue);
    });
    hydrateHost(scope);
  }
  function parseAllowedModes(root) {
    const raw = (root.dataset.fillModes || "").trim();
    if (raw) {
      const modes = raw.split(",").map((mode) => mode.trim().toLowerCase()).filter((mode) => MODE_ORDER.includes(mode));
      return modes.length ? modes : ["color"];
    }
    const allowImageAttr = (root.dataset.allowImage || "").trim().toLowerCase();
    const allowImage = allowImageAttr === "" || allowImageAttr === "true" || allowImageAttr === "1" || allowImageAttr === "yes";
    if (!allowImage) return ["color"];
    return ["color", "gradient", "image"];
  }
  function createState(root, accountAssets) {
    const input = root.querySelector(".diet-dropdown-fill__value-field");
    const headerValue = root.querySelector(".diet-dropdown-header-value");
    const headerValueLabel = root.querySelector(".diet-dropdown-fill__label");
    const headerValueChip = root.querySelector(".diet-dropdown-fill__chip");
    const headerLabel = root.querySelector(".diet-popover__header-label");
    const preview = root.querySelector(".diet-dropdown-fill__preview");
    const nativeColorInput = root.querySelector(".diet-dropdown-fill__native-color");
    const hueInput = root.querySelector(".diet-dropdown-fill__hue");
    const alphaInput = root.querySelector(".diet-dropdown-fill__alpha");
    const hexField = root.querySelector(".diet-dropdown-fill__hex");
    const alphaField = root.querySelector(".diet-dropdown-fill__alpha-input");
    const svCanvas = root.querySelector(".diet-dropdown-fill__sv-canvas");
    const svThumb = root.querySelector(".diet-dropdown-fill__sv-thumb");
    const colorPreview = root.querySelector(".diet-dropdown-fill__color-preview");
    const removeFillActions = Array.from(root.querySelectorAll(".diet-dropdown-fill__remove-fill"));
    const removeFillLabels = removeFillActions.map(
      (action) => action.querySelector(".diet-btn-menuactions__label") ?? null
    );
    const swatches = Array.from(root.querySelectorAll(".diet-dropdown-fill__swatch"));
    const gradientPreview = root.querySelector(".diet-dropdown-fill__gradient-preview");
    const gradientAngleInput = root.querySelector(".diet-dropdown-fill__gradient-angle");
    const gradientEditor = root.querySelector(".diet-dropdown-fill__gradient-editor");
    const gradientStopBar = root.querySelector(".diet-dropdown-fill__gradient-stop-track");
    const gradientStopAdd = root.querySelector(".diet-dropdown-fill__gradient-stop-add");
    const gradientStopSv = root.querySelector(".diet-dropdown-fill__gradient-sv");
    const gradientStopSvThumb = root.querySelector(".diet-dropdown-fill__gradient-sv-thumb");
    const gradientStopHueInput = root.querySelector(".diet-dropdown-fill__gradient-hue");
    const gradientStopAlphaInput = root.querySelector(".diet-dropdown-fill__gradient-alpha");
    const gradientStopHexInput = root.querySelector(".diet-dropdown-fill__gradient-hex");
    const gradientStopAlphaField = root.querySelector(".diet-dropdown-fill__gradient-alpha-field");
    const gradientStops = createDefaultGradientStops(root);
    const gradientActiveStopId = gradientStops[0]?.id ?? "";
    const imagePanel = root.querySelector(".diet-dropdown-fill__panel--image");
    const imagePreview = root.querySelector(".diet-dropdown-fill__image-preview");
    const imageBrowser = root.querySelector(".diet-dropdown-fill__asset-browser--image");
    const imageBrowserMessage = imageBrowser?.querySelector(".diet-dropdown-fill__asset-browser-message") ?? null;
    const imageBrowserList = imageBrowser?.querySelector(".diet-dropdown-fill__asset-browser-list") ?? null;
    const imageMessage = imagePanel?.querySelector(".diet-dropdown-fill__asset-message") ?? null;
    const uploadButton = root.querySelector(".diet-dropdown-fill__upload-btn");
    const chooseButton = root.querySelector(".diet-dropdown-fill__choose-btn");
    const removeButton = root.querySelector(".diet-dropdown-fill__remove-btn");
    const fileInput = root.querySelector(".diet-dropdown-fill__file-input");
    const videoPanel = root.querySelector(".diet-dropdown-fill__panel--video");
    const videoPreview = root.querySelector(".diet-dropdown-fill__video-preview");
    const videoBrowser = root.querySelector(".diet-dropdown-fill__asset-browser--video");
    const videoBrowserMessage = videoBrowser?.querySelector(".diet-dropdown-fill__asset-browser-message") ?? null;
    const videoBrowserList = videoBrowser?.querySelector(".diet-dropdown-fill__asset-browser-list") ?? null;
    const videoMessage = videoPanel?.querySelector(".diet-dropdown-fill__asset-message") ?? null;
    const videoUploadButton = root.querySelector(".diet-dropdown-fill__video-upload-btn");
    const videoChooseButton = root.querySelector(".diet-dropdown-fill__video-choose-btn");
    const videoRemoveButton = root.querySelector(".diet-dropdown-fill__video-remove-btn");
    const videoFileInput = root.querySelector(".diet-dropdown-fill__video-file-input");
    if (!input || !hueInput || !alphaInput || !hexField || !alphaField || !svCanvas || !svThumb) {
      return null;
    }
    if (chooseButton) {
      chooseButton.setAttribute("aria-expanded", "false");
    }
    if (videoChooseButton) {
      videoChooseButton.setAttribute("aria-expanded", "false");
    }
    const nativeValue = captureNativeValue(input);
    const allowedModes = parseAllowedModes(root);
    const mode = allowedModes[0] || "color";
    swatches.forEach((swatch) => {
      const color = swatch.dataset.color || "";
      swatch.style.setProperty("--swatch-color", color);
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
      gradientStopButtons: /* @__PURE__ */ new Map(),
      gradientStopSv,
      gradientStopSvThumb,
      gradientStopHueInput,
      gradientStopAlphaInput,
      gradientStopHexInput,
      gradientStopAlphaField,
      gradientActiveStopId,
      gradientStops,
      gradient: { angle: DEFAULT_GRADIENT.angle },
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
      videoAssetRef: null,
      videoPosterAssetRef: null,
      videoName: null,
      videoObjectUrl: null,
      videoResolveRequestId: 0,
      allowedModes,
      mode,
      nativeValue,
      internalWrite: false
    };
  }
  function installHandlers(state) {
    if (state.nativeValue) {
      Object.defineProperty(state.input, "value", {
        configurable: true,
        get: () => state.nativeValue?.get() ?? "",
        set: (next) => {
          state.nativeValue?.set(String(next ?? ""));
          if (!state.internalWrite) syncFromValue(state, String(next ?? ""));
        }
      });
    }
    const readValue = () => state.input.value || state.input.getAttribute("data-bob-json") || "";
    state.input.addEventListener("external-sync", () => syncFromValue(state, readValue()));
    state.input.addEventListener("input", () => {
      if (state.internalWrite) return;
      syncFromValue(state, readValue());
    });
    state.hueInput.addEventListener("input", () => {
      const hue = clampNumber(Number(state.hueInput.value), 0, 360);
      state.hsv.h = hue;
      if (state.hsv.a === 0) state.hsv.a = 1;
      syncColorUI(state, { commit: true });
    });
    state.alphaInput.addEventListener("input", () => {
      const alpha = clampNumber(Number(state.alphaInput.value) / 100, 0, 1);
      state.hsv.a = alpha;
      syncColorUI(state, { commit: true });
    });
    state.hexField.addEventListener("change", () => handleHexInput(state));
    state.hexField.addEventListener("blur", () => handleHexInput(state));
    state.alphaField.addEventListener("change", () => handleAlphaField(state));
    state.alphaField.addEventListener("blur", () => handleAlphaField(state));
    installSvCanvasHandlers(state);
    installSwatchHandlers(state);
    installGradientHandlers(state, mediaDeps());
    installImageHandlers2(state);
    installVideoHandlers2(state);
    installNativeColorPicker(state);
    if (state.removeFillActions.length) {
      state.removeFillActions.forEach((action) => {
        action.addEventListener("click", (event) => {
          event.preventDefault();
          if (action.disabled) return;
          setInputValue(state, { type: "none" }, true);
        });
      });
    }
  }
  function installNativeColorPicker(state) {
    const { preview, nativeColorInput } = state;
    if (!preview || !nativeColorInput) return;
    preview.addEventListener("click", (event) => {
      event.preventDefault();
      const hex = formatHex({ ...state.hsv, a: 1 });
      nativeColorInput.value = hex;
      nativeColorInput.click();
    });
    nativeColorInput.addEventListener("input", () => {
      const rgba = hexToRgba(nativeColorInput.value);
      if (!rgba) return;
      state.hsv = { ...rgbToHsv(rgba.r, rgba.g, rgba.b, 1), a: state.hsv.a || 1 };
      syncColorUI(state, { commit: true });
    });
  }
  function installSvCanvasHandlers(state) {
    const move = (event) => {
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
    const handlePointerDown = (event) => {
      event.preventDefault();
      state.svCanvas.setPointerCapture(event.pointerId);
      move(event);
    };
    state.svCanvas.addEventListener("pointerdown", handlePointerDown);
    state.svCanvas.addEventListener("pointermove", (event) => {
      if (event.pressure === 0 && event.buttons === 0) return;
      move(event);
    });
    state.svCanvas.addEventListener("click", (event) => {
      move(event);
    });
  }
  function mediaDeps() {
    return {
      setInputValue,
      updateHeader,
      setRemoveFillState
    };
  }
  function installImageHandlers2(state) {
    installImageHandlers(state, mediaDeps());
  }
  function installVideoHandlers2(state) {
    installVideoHandlers(state, mediaDeps());
  }
  function setImageSrc2(state, src, opts) {
    setImageSrc(state, src, opts, mediaDeps());
  }
  function setVideoSrc2(state, src, opts) {
    setVideoSrc(state, src, opts, mediaDeps());
  }
  function setInputValue(state, value, emit) {
    const json = JSON.stringify(value);
    state.internalWrite = true;
    state.input.value = json;
    state.input.setAttribute("data-bob-json", json);
    if (emit) {
      state.input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    state.internalWrite = false;
  }
  function setRemoveFillState(state, isEmpty) {
    if (!state.removeFillActions.length) return;
    state.removeFillActions.forEach((action, index) => {
      action.disabled = isEmpty;
      const label = state.removeFillLabels[index];
      if (label) {
        label.textContent = isEmpty ? "No fill to remove" : "Remove fill";
      }
    });
  }
  function getSwatchTarget2(swatch) {
    const container = swatch.closest(".diet-dropdown-fill__swatches");
    return container?.dataset.swatchTarget === "gradient" ? "gradient" : "color";
  }
  function installSwatchHandlers(state) {
    state.swatches.forEach((swatch) => {
      swatch.addEventListener("click", (event) => {
        event.preventDefault();
        const color = swatch.dataset.color || "";
        const parsed = parseColor(color, state.root);
        if (!parsed) return;
        const target = getSwatchTarget2(swatch);
        if (target === "gradient") {
          applyGradientSwatch(state, parsed, mediaDeps());
          return;
        }
        state.hsv = { ...parsed, a: 1 };
        syncColorUI(state, { commit: true });
      });
    });
  }
  function handleHexInput(state) {
    const raw = state.hexField.value.trim();
    if (!raw) {
      state.hexField.value = formatHex(state.hsv).replace(/^#/, "");
      return;
    }
    const normalized = raw.startsWith("#") ? raw : `#${raw}`;
    const rgba = hexToRgba(normalized);
    if (!rgba) {
      state.hexField.value = formatHex(state.hsv).replace(/^#/, "");
      return;
    }
    state.hsv = { ...rgbToHsv(rgba.r, rgba.g, rgba.b, 1), a: state.hsv.a || 1 };
    syncColorUI(state, { commit: true });
  }
  function handleAlphaField(state) {
    const raw = state.alphaField.value.trim().replace("%", "");
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
  function syncFromValue(state, raw) {
    const fill = parseFillValue(raw, state.root);
    if (!fill) {
      state.root.dataset.invalid = "true";
      updateHeader(state, { text: "Invalid", muted: false, chipColor: null, noneChip: true });
      setRemoveFillState(state, true);
      return;
    }
    delete state.root.dataset.invalid;
    const nextMode = resolveModeFromFill(state.mode, state.allowedModes, fill);
    setMode(state, nextMode);
    if (fill.type === "none") {
      if (nextMode === "image") {
        state.imageResolveRequestId += 1;
        state.imageAssetRef = null;
        state.imageName = null;
        setImageSrc2(state, null, { commit: false });
        return;
      }
      if (nextMode === "video") {
        state.videoResolveRequestId += 1;
        state.videoAssetRef = null;
        state.videoPosterAssetRef = null;
        state.videoName = null;
        setVideoSrc2(state, null, { commit: false });
        return;
      }
      if (nextMode === "gradient") {
        state.gradient = { angle: DEFAULT_GRADIENT.angle };
        state.gradientStops = createDefaultGradientStops(state.root);
        state.gradientActiveStopId = state.gradientStops[0]?.id ?? "";
        syncGradientUI(state, { commit: false }, mediaDeps());
        return;
      }
      state.hsv = { h: 0, s: 0, v: 0, a: 0 };
      syncColorUI(state, { commit: false });
      return;
    }
    if (fill.type === "color") {
      const parsed = parseColor(fill.color || "", state.root);
      if (!parsed) {
        state.root.dataset.invalid = "true";
        state.hsv = { h: 0, s: 0, v: 0, a: 0 };
        syncColorUI(state, { commit: false });
        return;
      }
      state.hsv = parsed;
      syncColorUI(state, { commit: false });
      return;
    }
    if (fill.type === "gradient") {
      applyGradientFromFill(state, fill.gradient);
      syncGradientUI(state, { commit: false }, mediaDeps());
      return;
    }
    if (fill.type === "image") {
      state.imageAssetRef = readImageAssetRef(fill);
      state.imageName = readImageName(fill);
      setImageSrc2(state, null, { commit: false });
      void resolveImageAsset(state, mediaDeps());
      return;
    }
    if (fill.type === "video") {
      state.videoAssetRef = readVideoAssetRef(fill);
      state.videoPosterAssetRef = readVideoPosterAssetRef(fill);
      state.videoName = readVideoName(fill);
      setVideoSrc2(state, null, { commit: false });
      void resolveVideoAsset(state, mediaDeps());
      return;
    }
  }
  function syncColorUI(state, opts) {
    const shouldUpdateHeader = opts.updateHeader !== false;
    const shouldUpdateRemove = opts.updateRemove !== false;
    const { h, s, v, a } = state.hsv;
    const rgb = hsvToRgb(h, s, v);
    const hex = formatHex({ h, s, v, a: 1 });
    const alphaPercent = Math.round(a * 100);
    const colorString = a < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${roundTo(a, 2)})` : hex;
    state.root.style.setProperty("--picker-hue", h.toString());
    state.root.style.setProperty("--picker-rgb", `${rgb.r} ${rgb.g} ${rgb.b}`);
    state.hueInput.value = h.toString();
    state.hueInput.style.setProperty("--value", state.hueInput.value);
    state.hueInput.style.setProperty("--min", "0");
    state.hueInput.style.setProperty("--max", "360");
    state.alphaInput.value = alphaPercent.toString();
    state.alphaInput.style.setProperty("--value", state.alphaInput.value);
    state.alphaInput.style.setProperty("--min", "0");
    state.alphaInput.style.setProperty("--max", "100");
    state.hexField.value = hex.replace(/^#/, "");
    state.alphaField.value = `${alphaPercent}%`;
    const left = `${s * 100}%`;
    const top = `${(1 - v) * 100}%`;
    state.svThumb.style.left = left;
    state.svThumb.style.top = top;
    if (opts.commit) {
      const fill = alphaPercent === 0 ? { type: "none" } : { type: "color", color: colorString };
      setInputValue(state, fill, true);
    }
    if (shouldUpdateHeader) {
      const isInvalid = state.root.dataset.invalid === "true";
      if (isInvalid) {
        updateHeader(state, { text: "Invalid", muted: false, chipColor: null, noneChip: true });
      } else if (alphaPercent === 0) {
        updateHeader(state, { text: "", muted: true, chipColor: null, noneChip: true });
      } else {
        const label = alphaPercent < 100 ? `${alphaPercent}%` : "";
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
      if (getSwatchTarget2(swatch) !== "color") return;
      const swatchHex = normalizeHex(swatch.dataset.color || "");
      const match = Boolean(normalizedCurrent && swatchHex && swatchHex === normalizedCurrent);
      swatch.classList.toggle("is-selected", match);
      swatch.setAttribute("aria-pressed", match ? "true" : "false");
    });
  }
  function updateHeader(state, opts) {
    const { headerValue, headerValueLabel, headerValueChip } = state;
    if (headerValueLabel) headerValueLabel.textContent = opts.text;
    if (headerValue) {
      headerValue.dataset.muted = opts.muted ? "true" : "false";
      headerValue.classList.toggle("has-chip", !!opts.chipColor || opts.noneChip === true);
    }
    if (headerValueChip) {
      if (opts.noneChip === true) {
        headerValueChip.style.removeProperty("background");
        headerValueChip.hidden = false;
        headerValueChip.classList.add("is-none");
        headerValueChip.classList.remove("is-white");
      } else if (opts.chipColor) {
        headerValueChip.style.background = opts.chipColor;
        headerValueChip.hidden = false;
        headerValueChip.classList.remove("is-none");
        const parsed = parseCssColor(opts.chipColor.trim());
        const isWhite = Boolean(parsed && parsed.r === 255 && parsed.g === 255 && parsed.b === 255);
        headerValueChip.classList.toggle("is-white", isWhite);
      } else {
        headerValueChip.style.background = "transparent";
        headerValueChip.hidden = true;
        headerValueChip.classList.remove("is-none");
        headerValueChip.classList.remove("is-white");
      }
    }
  }
  function setMode(state, mode) {
    const next = state.allowedModes.includes(mode) ? mode : state.allowedModes[0] || "color";
    state.mode = next;
    state.root.dataset.mode = next;
    state.root.dataset.hasModes = state.allowedModes.length > 1 ? "true" : "false";
    const buttons = Array.from(state.root.querySelectorAll(".diet-dropdown-fill__mode-btn"));
    buttons.forEach((btn) => {
      const btnMode = btn.dataset.mode || "";
      const isAllowed = state.allowedModes.includes(btnMode);
      btn.hidden = !isAllowed;
      btn.disabled = !isAllowed;
      const isActive = isAllowed && btnMode === next;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    if (state.headerLabel) {
      state.headerLabel.textContent = MODE_LABELS[next] || state.headerLabel.textContent;
    }
  }
  function syncModeUI(state, opts) {
    if (state.mode === "gradient") {
      syncGradientUI(state, opts, mediaDeps());
      return;
    }
    if (state.mode === "image") {
      const shouldCommit = opts.commit && Boolean(state.imageSrc);
      setImageSrc2(state, state.imageSrc, {
        commit: shouldCommit,
        updateHeader: opts.updateHeader,
        updateRemove: opts.updateRemove
      });
      return;
    }
    if (state.mode === "video") {
      const shouldCommit = opts.commit && Boolean(state.videoSrc);
      setVideoSrc2(state, state.videoSrc, {
        commit: shouldCommit,
        updateHeader: opts.updateHeader,
        updateRemove: opts.updateRemove
      });
      return;
    }
    syncColorUI(state, opts);
  }
  function wireModes(state) {
    const buttons = Array.from(state.root.querySelectorAll(".diet-dropdown-fill__mode-btn"));
    if (!buttons.length) return;
    buttons.forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        const mode = btn.dataset.mode || "color";
        setMode(state, mode);
        syncModeUI(state, { commit: true });
      });
    });
    const initial = state.root.dataset.mode || state.mode;
    setMode(state, initial);
  }
  function captureNativeValue(input) {
    const proto = Object.getPrototypeOf(input);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (!desc?.get || !desc?.set) return void 0;
    return {
      get: () => String(desc.get?.call(input) ?? ""),
      set: (next) => {
        desc.set?.call(input, next);
      }
    };
  }
  return __toCommonJS(dropdown_fill_exports);
})();
window.Dieter = { ...__prevDieter, ...Dieter };
