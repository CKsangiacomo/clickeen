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

  // components/dropdown-fill/dropdown-fill.ts
  var states = /* @__PURE__ */ new Map();
  var hydrateHost = createDropdownHydrator({
    rootSelector: ".diet-dropdown-fill",
    triggerSelector: ".diet-dropdown-fill__control"
  });
  function hydrateDropdownFill(scope) {
    const roots = Array.from(scope.querySelectorAll(".diet-dropdown-fill"));
    if (!roots.length) return;
    roots.forEach((root) => {
      if (states.has(root)) return;
      const state = createState(root);
      if (!state) return;
      wireModes(state);
      states.set(root, state);
      installHandlers(state);
      const initialValue = state.input.value || state.input.getAttribute("value") || "";
      syncFromValue(state, initialValue);
    });
    hydrateHost(scope);
  }
  function createState(root) {
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
    const removeFillAction = root.querySelector(".diet-dropdown-fill__remove-fill");
    const removeFillLabel = removeFillAction?.querySelector(".diet-btn-menuactions__label") ?? null;
    const swatches = Array.from(root.querySelectorAll(".diet-dropdown-fill__swatch"));
    const imagePanel = root.querySelector(".diet-dropdown-fill__panel--image");
    const imagePreview = root.querySelector(".diet-dropdown-fill__image-preview");
    const uploadButton = root.querySelector(".diet-dropdown-fill__upload-btn");
    const replaceButton = root.querySelector(".diet-dropdown-fill__replace-btn");
    const removeButton = root.querySelector(".diet-dropdown-fill__remove-btn");
    const fileInput = root.querySelector(".diet-dropdown-fill__file-input");
    if (!input || !hueInput || !alphaInput || !hexField || !alphaField || !svCanvas || !svThumb) {
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
      preview,
      nativeColorInput,
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
      hsv: { h: 0, s: 0, v: 0, a: 0 }
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
      const hue = clampNumber(Number(state.hueInput.value), 0, 360);
      state.hsv.h = hue;
      syncUI(state, { commit: true });
    });
    state.alphaInput.addEventListener("input", () => {
      const alpha = clampNumber(Number(state.alphaInput.value) / 100, 0, 1);
      state.hsv.a = alpha;
      syncUI(state, { commit: true });
    });
    state.hexField.addEventListener("change", () => handleHexInput(state));
    state.hexField.addEventListener("blur", () => handleHexInput(state));
    state.alphaField.addEventListener("change", () => handleAlphaField(state));
    state.alphaField.addEventListener("blur", () => handleAlphaField(state));
    installSvCanvasHandlers(state);
    installSwatchHandlers(state);
    installImageHandlers(state);
    installNativeColorPicker(state);
    if (state.removeFillAction) {
      state.removeFillAction.addEventListener("click", (event) => {
        event.preventDefault();
        if (state.removeFillAction?.disabled) return;
        state.hsv.a = 0;
        syncUI(state, { commit: true });
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
      state.hsv = { ...rgbToHsv(rgba.r, rgba.g, rgba.b, 1), a: state.hsv.a };
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
  function installImageHandlers(state) {
    const { uploadButton, replaceButton, removeButton, fileInput } = state;
    if (uploadButton && fileInput) {
      uploadButton.addEventListener("click", (event) => {
        event.preventDefault();
        fileInput.value = "";
        fileInput.click();
      });
    }
    if (replaceButton && fileInput) {
      replaceButton.addEventListener("click", (event) => {
        event.preventDefault();
        fileInput.value = "";
        fileInput.click();
      });
    }
    if (removeButton) {
      removeButton.addEventListener("click", (event) => {
        event.preventDefault();
        setImageSrc(state, null, { commit: true });
      });
    }
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        state.imageName = file.name || null;
        const reader = new FileReader();
        reader.onload = () => {
          const result = typeof reader.result === "string" ? reader.result : null;
          setImageSrc(state, result, { commit: true });
        };
        reader.readAsDataURL(file);
      });
    }
  }
  function setInputValue(state, value, emit) {
    state.internalWrite = true;
    state.input.value = value;
    state.internalWrite = false;
    if (emit) {
      state.input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  function setImageSrc(state, src, opts) {
    state.imageSrc = src;
    if (opts.commit) {
      const cssValue = src ? `url("${src}") center center / cover no-repeat` : "transparent";
      setInputValue(state, cssValue, true);
    }
    if (state.imagePanel) {
      state.imagePanel.dataset.hasImage = src ? "true" : "false";
    }
    if (state.imagePreview) {
      if (src) {
        state.imagePreview.style.backgroundImage = `url("${src}")`;
      } else {
        state.imagePreview.style.backgroundImage = "none";
      }
    }
    const placeholder = state.headerValue?.dataset.placeholder ?? "";
    if (src) {
      const label = state.imageName || extractFileName(state.input.value) || "Image selected";
      updateHeader(state, { text: label, muted: false, chipColor: null });
    } else {
      state.imageName = null;
      updateHeader(state, { text: placeholder, muted: true, chipColor: null });
    }
  }
  function installSwatchHandlers(state) {
    state.swatches.forEach((swatch) => {
      swatch.addEventListener("click", (event) => {
        event.preventDefault();
        const color = swatch.dataset.color || "";
        const parsed = parseColor(color, state.root);
        if (!parsed) return;
        state.hsv = { ...parsed, a: 1 };
        syncUI(state, { commit: true });
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
    state.hsv = { ...rgbToHsv(rgba.r, rgba.g, rgba.b, 1), a: state.hsv.a };
    syncUI(state, { commit: true });
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
    syncUI(state, { commit: true });
  }
  function syncFromValue(state, raw) {
    const value = String(raw ?? "").trim();
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
      state.root.dataset.invalid = "true";
      syncUI(state, { commit: false });
      return;
    }
    delete state.root.dataset.invalid;
    state.imageSrc = null;
    state.imageName = null;
    state.hsv = parsed;
    syncUI(state, { commit: false });
  }
  function syncUI(state, opts) {
    const { h, s, v, a } = state.hsv;
    const rgb = hsvToRgb(h, s, v);
    const hex = formatHex({ h, s, v, a: 1 });
    const alphaPercent = Math.round(a * 100);
    const colorString = a < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${roundTo(a, 2)})` : hex;
    const placeholder = state.headerValue?.dataset.placeholder ?? "";
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
      setInputValue(state, colorString, true);
    }
    const isInvalid = state.root.dataset.invalid === "true";
    if (isInvalid) {
      updateHeader(state, { text: "Invalid", muted: false, chipColor: null, noneChip: true });
    } else if (alphaPercent === 0) {
      updateHeader(state, { text: "", muted: true, chipColor: null, noneChip: true });
    } else {
      const label = alphaPercent < 100 ? `${alphaPercent}%` : "";
      updateHeader(state, { text: label, muted: false, chipColor: colorString });
    }
    if (state.colorPreview) {
      state.colorPreview.style.backgroundColor = colorString;
    }
    if (state.removeFillAction) {
      const isEmpty = alphaPercent === 0;
      state.removeFillAction.disabled = isEmpty;
      if (state.removeFillLabel) {
        state.removeFillLabel.textContent = isEmpty ? "No fill to remove" : "Remove fill";
      }
    }
    const normalizedCurrent = normalizeHex(hex);
    state.swatches.forEach((swatch) => {
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
  function wireModes(state) {
    const { root, headerLabel } = state;
    const buttons = Array.from(root.querySelectorAll(".diet-dropdown-fill__mode-btn"));
    if (!buttons.length) return;
    const setMode = (mode) => {
      root.dataset.mode = mode;
      buttons.forEach((btn) => {
        const isActive = btn.dataset.mode === mode;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      if (headerLabel) {
        headerLabel.textContent = mode === "image" ? "Photo/Video fill" : "Color fill";
      }
    };
    buttons.forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        const mode = btn.dataset.mode === "image" ? "image" : "color";
        setMode(mode);
      });
    });
    const initial = root.dataset.mode === "image" ? "image" : "color";
    setMode(initial);
  }
  function parseColor(value, root) {
    const rgba = colorStringToRgba(value, root);
    if (!rgba) return null;
    return rgbToHsv(rgba.r, rgba.g, rgba.b, rgba.a);
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
  function extractFileName(value) {
    const urlMatch = value.match(/url\\(['"]?(.*?)['"]?\\)/i);
    if (urlMatch && urlMatch[1]) {
      const raw = urlMatch[1];
      const parts = raw.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return last.split("?")[0];
    }
    return null;
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
  function formatHex(hsv) {
    const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  function toHex(value) {
    return clampNumber(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  }
  function clampNumber(value, min, max) {
    if (Number.isNaN(value)) return min;
    return Math.min(Math.max(value, min), max);
  }
  function roundTo(value, precision) {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
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
  function getComputedColor(value, root) {
    const temp = document.createElement("div");
    temp.style.color = value;
    temp.style.display = "none";
    root.appendChild(temp);
    const computed = getComputedStyle(temp).color;
    root.removeChild(temp);
    return computed;
  }
  return __toCommonJS(dropdown_fill_exports);
})();
window.Dieter = { ...__prevDieter, ...Dieter };
