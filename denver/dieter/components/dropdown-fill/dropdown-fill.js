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
      syncUI(state);
    });
    hydrateHost(scope);
  }
  function createState(root) {
    const input = root.querySelector(".diet-dropdown-fill__value-field");
    const headerValue = root.querySelector(".diet-dropdown-header-value");
    const headerValueLabel = root.querySelector(".diet-dropdown-fill__label");
    const headerValueChip = root.querySelector(".diet-dropdown-fill__chip");
    const headerLabel = root.querySelector(".diet-popover__header-label");
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
    const initial = parseColor(input.value || input.getAttribute("value") || "#6B6BFF", root);
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
      hsv: initial
    };
  }
  function installHandlers(state) {
    state.hueInput.addEventListener("input", () => {
      const hue = clampNumber(Number(state.hueInput.value), 0, 360);
      state.hsv.h = hue;
      syncUI(state);
    });
    state.alphaInput.addEventListener("input", () => {
      const alpha = clampNumber(Number(state.alphaInput.value) / 100, 0, 1);
      state.hsv.a = alpha;
      syncUI(state);
    });
    state.hexField.addEventListener("change", () => handleHexInput(state));
    state.hexField.addEventListener("blur", () => handleHexInput(state));
    state.alphaField.addEventListener("change", () => handleAlphaField(state));
    state.alphaField.addEventListener("blur", () => handleAlphaField(state));
    installSvCanvasHandlers(state);
    installSwatchHandlers(state);
    installImageHandlers(state);
    if (state.removeFillAction) {
      state.removeFillAction.addEventListener("click", (event) => {
        event.preventDefault();
        if (state.removeFillAction?.disabled) return;
        state.hsv.a = 0;
        syncUI(state);
      });
    }
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
      syncUI(state);
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
        setImageSrc(state, null);
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
          setImageSrc(state, result);
        };
        reader.readAsDataURL(file);
      });
    }
  }
  function setImageSrc(state, src) {
    state.imageSrc = src;
    if (state.input) {
      const cssValue = src ? `url("${src}") center center / cover no-repeat` : "";
      state.input.value = cssValue;
      state.input.dispatchEvent(new Event("input", { bubbles: true }));
      state.input.dispatchEvent(new Event("change", { bubbles: true }));
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
        state.hsv = { ...parsed, a: 1 };
        syncUI(state);
      });
    });
  }
  function handleHexInput(state) {
    const raw = state.hexField.value.trim();
    if (!raw) {
      state.hexField.value = formatHex(state.hsv);
      return;
    }
    const normalized = raw.startsWith("#") ? raw : `#${raw}`;
    const parsed = parseColor(normalized);
    state.hsv = { ...parsed, a: state.hsv.a };
    syncUI(state);
  }
  function handleAlphaField(state) {
    const raw = state.alphaField.value.trim().replace("%", "");
    if (!raw) {
      state.alphaField.value = `${Math.round(state.hsv.a * 100)}%`;
      return;
    }
    const percent = clampNumber(Number(raw), 0, 100);
    state.hsv.a = percent / 100;
    syncUI(state);
  }
  function syncUI(state) {
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
    state.input.value = colorString;
    state.input.dispatchEvent(new Event("change", { bubbles: true }));
    if (alphaPercent === 0) {
      updateHeader(state, { text: placeholder, muted: true, chipColor: null });
    } else {
      updateHeader(state, { text: "", muted: false, chipColor: colorString });
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
      const match = swatchHex === normalizedCurrent;
      swatch.classList.toggle("is-selected", match);
      swatch.setAttribute("aria-pressed", match ? "true" : "false");
    });
  }
  function updateHeader(state, opts) {
    const { headerValue, headerValueLabel, headerValueChip } = state;
    if (headerValueLabel) headerValueLabel.textContent = opts.text;
    if (headerValue) {
      headerValue.dataset.muted = opts.muted ? "true" : "false";
      headerValue.classList.toggle("has-chip", !!opts.chipColor);
    }
    if (headerValueChip) {
      if (opts.chipColor) {
        headerValueChip.style.background = opts.chipColor;
        headerValueChip.hidden = false;
      } else {
        headerValueChip.style.background = "transparent";
        headerValueChip.hidden = true;
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
    return rgbToHsv(rgba.r, rgba.g, rgba.b, rgba.a);
  }
  function normalizeHex(value) {
    const hex = value.trim().replace(/^#/, "").slice(0, 8).toLowerCase();
    if (hex.length === 3) {
      return `#${hex.split("").map((c) => c + c).join("")}`;
    }
    if (hex.length === 6 || hex.length === 8) {
      return `#${hex}`;
    }
    return "#6b6bff";
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
    const hex = normalizeHex(value).replace("#", "");
    const hasAlpha = hex.length === 8;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hasAlpha ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
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
    if (value.trim().startsWith("#")) {
      return hexToRgba(value);
    }
    const computed = getComputedColor(value, root);
    const parsed = parseCssColor(computed);
    if (parsed) return parsed;
    return hexToRgba("#6b6bff");
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
    const hexMatch = computed.trim().match(/^#([0-9a-f]{3,8})$/i);
    if (hexMatch) {
      return hexToRgba(`#${hexMatch[1]}`);
    }
    const rgbSpace = computed.match(/rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+))?\s*\)/i);
    if (rgbSpace) {
      const r = Number(rgbSpace[1]);
      const g = Number(rgbSpace[2]);
      const b = Number(rgbSpace[3]);
      const a = rgbSpace[4] !== void 0 ? Number(rgbSpace[4]) : 1;
      return { r, g, b, a };
    }
    const rgbComma = computed.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/i);
    if (rgbComma) {
      const r = Number(rgbComma[1]);
      const g = Number(rgbComma[2]);
      const b = Number(rgbComma[3]);
      const a = rgbComma[4] !== void 0 ? Number(rgbComma[4]) : 1;
      return { r, g, b, a };
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
