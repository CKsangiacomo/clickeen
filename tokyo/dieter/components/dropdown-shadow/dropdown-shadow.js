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

  // components/dropdown-shadow/dropdown-shadow.ts
  var dropdown_shadow_exports = {};
  __export(dropdown_shadow_exports, {
    hydrateDropdownShadow: () => hydrateDropdownShadow
  });

  // components/shared/dropdownToggle.ts
  function createDropdownHydrator(config) {
    const {
      rootSelector,
      triggerSelector,
      popoverSelector = ".diet-popover",
      onOpen,
      onClose,
      initialState = "closed"
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
              if (!root.contains(target) && root.dataset.state === "open") {
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

  // components/dropdown-shadow/dropdown-shadow.ts
  var DEFAULT_SHADOW = {
    enabled: true,
    inset: false,
    x: 0,
    y: 8,
    blur: 24,
    spread: 0,
    color: "#000000",
    alpha: 18
  };
  var states = /* @__PURE__ */ new Map();
  var hydrateHost = createDropdownHydrator({
    rootSelector: ".diet-dropdown-shadow",
    triggerSelector: ".diet-dropdown-shadow__control"
  });
  function hydrateDropdownShadow(scope) {
    const roots = Array.from(scope.querySelectorAll(".diet-dropdown-shadow"));
    if (!roots.length) return;
    roots.forEach((root) => {
      if (states.has(root)) return;
      const state = createState(root);
      if (!state) return;
      states.set(root, state);
      installHandlers(state);
      const initialValue = state.input.value || state.input.getAttribute("value") || "";
      syncFromValue(state, initialValue);
    });
    hydrateHost(scope);
  }
  function createState(root) {
    const input = root.querySelector(".diet-dropdown-shadow__value-field");
    const headerValue = root.querySelector(".diet-dropdown-header-value");
    const headerValueLabel = root.querySelector(".diet-dropdown-shadow__label");
    const headerValueChip = root.querySelector(".diet-dropdown-shadow__chip");
    const headerLabel = root.querySelector(".diet-popover__header-label");
    const previewContainer = root.querySelector(".diet-dropdown-shadow__preview");
    const nativeColorInput = root.querySelector(".diet-dropdown-shadow__native-color");
    const hueInput = root.querySelector(".diet-dropdown-shadow__hue");
    const hexField = root.querySelector(".diet-dropdown-shadow__hex");
    const svCanvas = root.querySelector(".diet-dropdown-shadow__sv-canvas");
    const svThumb = root.querySelector(".diet-dropdown-shadow__sv-thumb");
    const swatches = Array.from(root.querySelectorAll(".diet-dropdown-shadow__swatch"));
    const enabledInput = root.querySelector(".diet-dropdown-shadow__enabled");
    const insetInput = root.querySelector(".diet-dropdown-shadow__inset");
    const xInput = root.querySelector(".diet-dropdown-shadow__x");
    const yInput = root.querySelector(".diet-dropdown-shadow__y");
    const blurInput = root.querySelector(".diet-dropdown-shadow__blur");
    const spreadInput = root.querySelector(".diet-dropdown-shadow__spread");
    const opacityInput = root.querySelector(".diet-dropdown-shadow__opacity");
    const previewBox = root.querySelector(".diet-dropdown-shadow__shadow-preview");
    const removeShadowAction = root.querySelector(".diet-dropdown-shadow__remove-shadow");
    const removeShadowLabel = removeShadowAction?.querySelector(".diet-btn-menuactions__label") ?? null;
    if (!input || !hueInput || !hexField || !svCanvas || !svThumb || !enabledInput || !insetInput || !xInput || !yInput || !blurInput || !spreadInput || !opacityInput || !previewBox || !removeShadowAction) {
      return null;
    }
    const nativeValue = captureNativeValue(input);
    swatches.forEach((swatch) => {
      const color = swatch.dataset.color || "";
      swatch.style.setProperty("--swatch-color", color);
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
      insetInput,
      xInput,
      yInput,
      blurInput,
      spreadInput,
      opacityInput,
      previewBox,
      removeShadowAction,
      removeShadowLabel,
      hsv: { h: 0, s: 0, v: 0 },
      shadow: { ...DEFAULT_SHADOW },
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
    state.input.addEventListener("external-sync", () => syncFromValue(state, state.input.value));
    state.input.addEventListener("input", () => syncFromValue(state, state.input.value));
    state.hueInput.addEventListener("input", () => {
      state.hsv.h = clampNumber(Number(state.hueInput.value), 0, 360);
      syncUI(state, { commit: true });
    });
    state.hexField.addEventListener("change", () => handleHexInput(state));
    state.hexField.addEventListener("blur", () => handleHexInput(state));
    installSvCanvasHandlers(state);
    installSwatchHandlers(state);
    installNativeColorPicker(state);
    state.enabledInput.addEventListener("input", () => {
      state.shadow.enabled = state.enabledInput.checked;
      syncUI(state, { commit: true });
    });
    state.insetInput.addEventListener("input", () => {
      state.shadow.inset = state.insetInput.checked;
      syncUI(state, { commit: true });
    });
    const onRange = (key, input) => () => {
      const parsed = Number(input.value);
      if (!Number.isFinite(parsed)) return;
      if (key === "alpha") {
        state.shadow.alpha = clampNumber(parsed, 0, 100);
      } else if (key === "blur") {
        state.shadow.blur = clampNumber(parsed, 0, 120);
      } else if (key === "spread") {
        state.shadow.spread = clampNumber(parsed, -40, 40);
      } else if (key === "x") {
        state.shadow.x = clampNumber(parsed, -50, 50);
      } else if (key === "y") {
        state.shadow.y = clampNumber(parsed, -50, 50);
      }
      syncUI(state, { commit: true });
    };
    state.xInput.addEventListener("input", onRange("x", state.xInput));
    state.yInput.addEventListener("input", onRange("y", state.yInput));
    state.blurInput.addEventListener("input", onRange("blur", state.blurInput));
    state.spreadInput.addEventListener("input", onRange("spread", state.spreadInput));
    state.opacityInput.addEventListener("input", onRange("alpha", state.opacityInput));
    state.removeShadowAction.addEventListener("click", (event) => {
      event.preventDefault();
      if (state.removeShadowAction.disabled) return;
      state.shadow.enabled = false;
      syncUI(state, { commit: true });
    });
  }
  function installNativeColorPicker(state) {
    const { previewContainer, nativeColorInput } = state;
    if (!previewContainer || !nativeColorInput) return;
    previewContainer.addEventListener("click", (event) => {
      event.preventDefault();
      nativeColorInput.value = state.shadow.color || "#000000";
      nativeColorInput.click();
    });
    nativeColorInput.addEventListener("input", () => {
      const next = String(nativeColorInput.value || "").trim();
      if (!next) return;
      const hsv = parseColor(next, document.documentElement);
      if (!hsv) return;
      state.hsv = hsv;
      state.shadow.color = next;
      syncUI(state, { commit: true });
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
      syncUI(state, { commit: true });
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
  }
  function installSwatchHandlers(state) {
    state.swatches.forEach((swatch) => {
      swatch.addEventListener("click", (event) => {
        event.preventDefault();
        const color = swatch.dataset.color || "";
        const parsed = parseColor(color, state.root);
        if (!parsed) return;
        state.hsv = parsed;
        syncUI(state, { commit: true });
      });
    });
  }
  function syncFromValue(state, raw) {
    const value = String(raw ?? "").trim();
    if (!value) {
      state.root.dataset.invalid = "true";
      state.shadow = { ...DEFAULT_SHADOW, enabled: false };
      state.hsv = { h: 0, s: 0, v: 0 };
      syncUI(state, { commit: false });
      return;
    }
    const parsed = parseShadowJson(value);
    if (!parsed) {
      state.root.dataset.invalid = "true";
      syncUI(state, { commit: false });
      return;
    }
    delete state.root.dataset.invalid;
    state.shadow = parsed.shadow;
    state.hsv = parsed.hsv;
    syncUI(state, { commit: false });
  }
  function syncUI(state, opts) {
    const { h, s, v } = state.hsv;
    const rgb = hsvToRgb(h, s, v);
    const hex = formatHex({ h, s, v });
    const placeholder = state.headerValue?.dataset.placeholder ?? "";
    state.root.style.setProperty("--picker-hue", h.toString());
    state.root.style.setProperty("--picker-rgb", `${rgb.r} ${rgb.g} ${rgb.b}`);
    state.hueInput.value = h.toString();
    state.hueInput.style.setProperty("--value", state.hueInput.value);
    state.hueInput.style.setProperty("--min", "0");
    state.hueInput.style.setProperty("--max", "360");
    state.hexField.value = hex.replace(/^#/, "");
    const left = `${s * 100}%`;
    const top = `${(1 - v) * 100}%`;
    state.svThumb.style.left = left;
    state.svThumb.style.top = top;
    state.enabledInput.checked = state.shadow.enabled;
    state.insetInput.checked = state.shadow.inset;
    setRangeValue(state.xInput, state.shadow.x);
    setRangeValue(state.yInput, state.shadow.y);
    setRangeValue(state.blurInput, state.shadow.blur);
    setRangeValue(state.spreadInput, state.shadow.spread);
    setRangeValue(state.opacityInput, state.shadow.alpha);
    const shadowValue = {
      ...state.shadow,
      color: hex
    };
    const boxShadow = computeBoxShadow(shadowValue);
    state.previewBox.style.boxShadow = boxShadow === "none" ? "none" : boxShadow;
    if (opts.commit) {
      setInputValue(state, shadowValue, true);
    }
    const hasShadow = shadowValue.enabled && shadowValue.alpha > 0;
    if (!hasShadow || state.root.dataset.invalid === "true") {
      updateHeader(state, { text: placeholder, muted: true, chipShadow: null });
    } else {
      updateHeader(state, { text: "", muted: false, chipShadow: boxShadow });
    }
    const canRemove = hasShadow && state.root.dataset.invalid !== "true";
    state.removeShadowAction.disabled = !canRemove;
    if (state.removeShadowLabel) {
      state.removeShadowLabel.textContent = canRemove ? "Disable shadow" : "No shadow to remove";
    }
    const normalizedCurrent = normalizeHex(hex);
    state.swatches.forEach((swatch) => {
      const swatchHex = normalizeHex(swatch.dataset.color || "");
      const match = Boolean(normalizedCurrent && swatchHex && swatchHex === normalizedCurrent);
      swatch.classList.toggle("is-selected", match);
      swatch.setAttribute("aria-pressed", match ? "true" : "false");
    });
  }
  function setRangeValue(input, value) {
    input.value = String(value);
    input.style.setProperty("--value", String(value));
  }
  function updateHeader(state, opts) {
    const { headerValue, headerValueLabel, headerValueChip } = state;
    if (headerValueLabel) headerValueLabel.textContent = opts.text;
    if (headerValue) headerValue.dataset.muted = opts.muted ? "true" : "false";
    if (headerValueChip) {
      if (opts.chipShadow) {
        headerValueChip.style.boxShadow = opts.chipShadow === "none" ? "none" : opts.chipShadow;
        headerValueChip.hidden = false;
      } else {
        headerValueChip.style.boxShadow = "none";
        headerValueChip.hidden = true;
      }
    }
  }
  function setInputValue(state, value, emit) {
    const json = JSON.stringify(value);
    state.internalWrite = true;
    state.input.value = json;
    state.input.setAttribute("data-bob-json", json);
    state.internalWrite = false;
    if (emit) {
      state.input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  function parseShadowJson(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const obj = parsed;
    const enabled = typeof obj.enabled === "boolean" ? obj.enabled : null;
    const inset = typeof obj.inset === "boolean" ? obj.inset : null;
    const x = typeof obj.x === "number" && Number.isFinite(obj.x) ? obj.x : null;
    const y = typeof obj.y === "number" && Number.isFinite(obj.y) ? obj.y : null;
    const blur = typeof obj.blur === "number" && Number.isFinite(obj.blur) ? obj.blur : null;
    const spread = typeof obj.spread === "number" && Number.isFinite(obj.spread) ? obj.spread : null;
    const alpha = typeof obj.alpha === "number" && Number.isFinite(obj.alpha) ? obj.alpha : null;
    const color = typeof obj.color === "string" ? obj.color : null;
    if (enabled == null || inset == null || x == null || y == null || blur == null || spread == null || alpha == null || color == null) {
      return null;
    }
    const hsv = parseColor(color, document.documentElement);
    if (!hsv) return null;
    const shadow = {
      enabled,
      inset,
      x: clampNumber(x, -50, 50),
      y: clampNumber(y, -50, 50),
      blur: clampNumber(blur, 0, 120),
      spread: clampNumber(spread, -40, 40),
      color,
      alpha: clampNumber(alpha, 0, 100)
    };
    return { shadow, hsv };
  }
  function computeBoxShadow(shadow) {
    if (!shadow.enabled || shadow.alpha <= 0) return "none";
    const alphaMix = clampNumber(100 - shadow.alpha, 0, 100);
    const shadowColor = `color-mix(in oklab, ${shadow.color}, transparent ${alphaMix}%)`;
    return `${shadow.inset ? "inset " : ""}${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadowColor}`;
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
    state.hsv = rgbToHsv(rgba.r, rgba.g, rgba.b);
    syncUI(state, { commit: true });
  }
  function parseColor(value, root) {
    const rgba = colorStringToRgba(value, root);
    if (!rgba) return null;
    return rgbToHsv(rgba.r, rgba.g, rgba.b);
  }
  function normalizeHex(value) {
    const hex = value.trim().replace(/^#/, "").toLowerCase();
    if (/^[0-9a-f]{3}$/.test(hex)) {
      return `#${hex.split("").map((c) => c + c).join("")}`;
    }
    if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
    return null;
  }
  function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }
  function hexToRgba(value) {
    const raw = value.trim().replace(/^#/, "");
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
  function captureNativeValue(input) {
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value");
    if (!desc || !desc.get || !desc.set) return void 0;
    return { get: () => desc.get?.call(input) ?? "", set: (next) => desc.set?.call(input, next) };
  }
  function colorStringToRgba(value, root) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const probe = document.createElement("span");
    probe.style.color = raw;
    root.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    root.removeChild(probe);
    const match = computed.match(/rgba?\(([^)]+)\)/i);
    if (!match) return null;
    const parts = match[1].split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 3) return null;
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    const a = parts.length >= 4 ? Number(parts[3]) : 1;
    if (![r, g, b, a].every((n) => Number.isFinite(n))) return null;
    return { r, g, b, a };
  }
  function rgbToHsv(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === rn) h = (gn - bn) / d % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    const v = max;
    return { h, s, v };
  }
  function hsvToRgb(h, s, v) {
    const c = v * s;
    const hh = h % 360 / 60;
    const x = c * (1 - Math.abs(hh % 2 - 1));
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
  function formatHex(hsv) {
    const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
    const toHex = (n) => n.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  return __toCommonJS(dropdown_shadow_exports);
})();
window.Dieter = { ...__prevDieter, ...Dieter };
