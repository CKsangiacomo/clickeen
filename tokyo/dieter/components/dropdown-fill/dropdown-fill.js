var __prevDieter = window.Dieter ? { ...window.Dieter } : {};
"use strict";
var Dieter = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

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

  // components/dropdown-fill/asset-picker-overlay.ts
  function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }
  var AssetPickerOverlay = class {
    constructor(callbacks) {
      __publicField(this, "root");
      __publicField(this, "closeButton");
      __publicField(this, "messageEl");
      __publicField(this, "rowsEl");
      __publicField(this, "callbacks");
      __publicField(this, "anchor", null);
      __publicField(this, "openState", false);
      __publicField(this, "handleDocumentPointerDown");
      __publicField(this, "handleDocumentKeydown");
      __publicField(this, "handleViewportChange");
      this.callbacks = callbacks;
      this.root = document.createElement("div");
      this.root.className = "diet-popover diet-dropdown-fill__asset-picker diet-dropdown-fill__asset-picker-portal";
      this.root.setAttribute("role", "dialog");
      this.root.setAttribute("aria-label", "Choose from assets");
      this.root.hidden = true;
      this.root.innerHTML = `
      <div class="diet-popover__header">
        <span class="diet-popover__header-label label-s">Choose from assets</span>
        <button
          type="button"
          class="diet-btn-ic diet-popover__header-trigger diet-dropdown-fill__asset-picker-close"
          data-size="sm"
          data-variant="neutral"
          aria-label="Close assets list"
        >
          <span class="diet-btn-ic__icon" aria-hidden="true" data-icon="multiply"></span>
        </button>
      </div>
      <div class="diet-popover__body">
        <p class="diet-dropdown-fill__asset-picker-message body-s" data-role="asset-picker-message"></p>
        <div class="diet-dropdown-fill__asset-picker-tablewrap">
          <table class="diet-dropdown-fill__asset-picker-table">
            <thead>
              <tr>
                <th class="label-s">Asset</th>
                <th class="label-s">Type</th>
                <th class="label-s">Size</th>
                <th class="label-s">Usage</th>
                <th class="label-s">Action</th>
              </tr>
            </thead>
            <tbody data-role="asset-picker-rows"></tbody>
          </table>
        </div>
      </div>
    `;
      const closeButton = this.root.querySelector(".diet-dropdown-fill__asset-picker-close");
      const messageEl = this.root.querySelector('[data-role="asset-picker-message"]');
      const rowsEl = this.root.querySelector('[data-role="asset-picker-rows"]');
      if (!closeButton || !messageEl || !rowsEl) {
        throw new Error("[dropdown-fill] asset picker overlay missing DOM nodes");
      }
      this.closeButton = closeButton;
      this.messageEl = messageEl;
      this.rowsEl = rowsEl;
      this.handleDocumentPointerDown = (event) => {
        if (!this.openState) return;
        const target = event.target;
        if (!target) return;
        if (this.root.contains(target)) return;
        if (this.anchor?.contains(target)) return;
        this.close();
      };
      this.handleDocumentKeydown = (event) => {
        if (!this.openState) return;
        if (event.key !== "Escape") return;
        this.close();
      };
      this.handleViewportChange = () => {
        if (!this.openState) return;
        this.position();
      };
      document.body.appendChild(this.root);
      this.bindStaticHandlers();
    }
    bindStaticHandlers() {
      this.closeButton.addEventListener("click", (event) => {
        event.preventDefault();
        this.close();
      });
    }
    bindOpenHandlers() {
      document.addEventListener("pointerdown", this.handleDocumentPointerDown, true);
      document.addEventListener("keydown", this.handleDocumentKeydown);
      window.addEventListener("resize", this.handleViewportChange);
      window.addEventListener("scroll", this.handleViewportChange, true);
    }
    unbindOpenHandlers() {
      document.removeEventListener("pointerdown", this.handleDocumentPointerDown, true);
      document.removeEventListener("keydown", this.handleDocumentKeydown);
      window.removeEventListener("resize", this.handleViewportChange);
      window.removeEventListener("scroll", this.handleViewportChange, true);
    }
    position() {
      if (!this.openState) return;
      if (!this.anchor?.isConnected) {
        this.close();
        return;
      }
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 12;
      const gap = 8;
      const maxWidth = Math.max(260, viewportWidth - margin * 2);
      const width = Math.min(480, maxWidth);
      this.root.style.inlineSize = `${Math.round(width)}px`;
      const anchorRect = this.anchor.getBoundingClientRect();
      let left = anchorRect.left;
      left = clampNumber(left, margin, Math.max(margin, viewportWidth - width - margin));
      let top = anchorRect.bottom + gap;
      const currentHeight = this.root.getBoundingClientRect().height || 320;
      const minBelowSpace = 220;
      if (viewportHeight - top - margin < minBelowSpace) {
        top = Math.max(margin, anchorRect.top - gap - currentHeight);
      }
      const maxBlockSize = Math.max(180, viewportHeight - top - margin);
      this.root.style.insetInlineStart = `${Math.round(left)}px`;
      this.root.style.insetBlockStart = `${Math.round(top)}px`;
      this.root.style.maxBlockSize = `${Math.round(maxBlockSize)}px`;
    }
    isOpen() {
      return this.openState;
    }
    open(anchor) {
      this.anchor = anchor;
      if (this.openState) {
        this.position();
        return;
      }
      this.openState = true;
      this.bindOpenHandlers();
      this.root.hidden = false;
      this.callbacks.onOpenChange?.(true);
      this.position();
      requestAnimationFrame(() => this.position());
    }
    close() {
      if (!this.openState) return;
      this.openState = false;
      this.unbindOpenHandlers();
      this.root.hidden = true;
      this.callbacks.onOpenChange?.(false);
    }
    contains(target) {
      return this.root.contains(target);
    }
    setMessage(message) {
      this.messageEl.textContent = message;
    }
    setRows(items) {
      this.rowsEl.innerHTML = "";
      if (!items.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 5;
        td.className = "body-s";
        td.textContent = "No image assets found.";
        tr.appendChild(td);
        this.rowsEl.appendChild(tr);
        return;
      }
      items.forEach((item) => {
        const tr = document.createElement("tr");
        const nameCell = document.createElement("td");
        nameCell.className = "body-s";
        nameCell.textContent = item.normalizedFilename;
        tr.appendChild(nameCell);
        const typeCell = document.createElement("td");
        typeCell.className = "body-s";
        typeCell.textContent = item.contentType;
        tr.appendChild(typeCell);
        const sizeCell = document.createElement("td");
        sizeCell.className = "body-s";
        sizeCell.textContent = item.sizeLabel;
        tr.appendChild(sizeCell);
        const usageCell = document.createElement("td");
        usageCell.className = "body-s";
        usageCell.textContent = String(item.usageCount);
        tr.appendChild(usageCell);
        const actionCell = document.createElement("td");
        const useButton = document.createElement("button");
        useButton.type = "button";
        useButton.className = "diet-btn-txt diet-dropdown-fill__asset-picker-use";
        useButton.setAttribute("data-size", "sm");
        useButton.setAttribute("data-variant", "line1");
        useButton.innerHTML = '<span class="diet-btn-txt__label body-s">Use</span>';
        useButton.addEventListener("click", (event) => {
          event.preventDefault();
          this.callbacks.onUse(item);
          this.close();
        });
        actionCell.appendChild(useButton);
        tr.appendChild(actionCell);
        this.rowsEl.appendChild(tr);
      });
    }
    destroy() {
      this.unbindOpenHandlers();
      this.close();
      this.root.remove();
    }
  };

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
  function clampNumber2(value, min, max) {
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
    return { h, s, v, a: clampNumber2(alpha, 0, 1) };
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
    return clampNumber2(Math.round(value), 0, 255).toString(16).padStart(2, "0");
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
    return { r: base.r, g: base.g, b: base.b, a: clampNumber2(base.a * baseWeight, 0, 1) };
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
  function isPersistedAssetUrl(value) {
    return /^https?:\/\//i.test(value) || value.startsWith("/");
  }
  function normalizeImageValue(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { src: "", fit: "cover", position: "center", repeat: "no-repeat" };
    }
    const value = raw;
    const srcRaw = typeof value.src === "string" ? value.src.trim() : "";
    const src = isPersistedAssetUrl(srcRaw) ? srcRaw : "";
    const name = typeof value.name === "string" ? value.name.trim() : "";
    const fit = value.fit === "contain" ? "contain" : "cover";
    const position = typeof value.position === "string" && value.position.trim() ? value.position.trim() : "center";
    const repeat = typeof value.repeat === "string" && value.repeat.trim() ? value.repeat.trim() : "no-repeat";
    return { src, ...name ? { name } : {}, fit, position, repeat };
  }
  function normalizeVideoValue(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { src: "", poster: "", fit: "cover", position: "center", loop: true, muted: true, autoplay: true };
    }
    const value = raw;
    const srcRaw = typeof value.src === "string" ? value.src.trim() : "";
    const posterRaw = typeof value.poster === "string" ? value.poster.trim() : "";
    const src = isPersistedAssetUrl(srcRaw) ? srcRaw : "";
    const name = typeof value.name === "string" ? value.name.trim() : "";
    const poster = isPersistedAssetUrl(posterRaw) ? posterRaw : "";
    const fit = value.fit === "contain" ? "contain" : "cover";
    const position = typeof value.position === "string" && value.position.trim() ? value.position.trim() : "center";
    const loop = typeof value.loop === "boolean" ? value.loop : true;
    const muted = typeof value.muted === "boolean" ? value.muted : true;
    const autoplay = typeof value.autoplay === "boolean" ? value.autoplay : true;
    return { src, ...name ? { name } : {}, poster, fit, position, loop, muted, autoplay };
  }
  function normalizeGradientValue(raw) {
    if (typeof raw === "string") {
      const css2 = raw.trim();
      return css2 ? { css: css2 } : void 0;
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return void 0;
    const value = raw;
    const css = typeof value.css === "string" ? value.css.trim() : "";
    if (css) return { css };
    const kindRaw = typeof value.kind === "string" ? value.kind.trim() : "";
    const kind = kindRaw === "radial" || kindRaw === "conic" ? kindRaw : "linear";
    const angle = clampNumber2(typeof value.angle === "number" ? value.angle : 0, 0, 360);
    const stopsRaw = Array.isArray(value.stops) ? value.stops : [];
    const stops = stopsRaw.map((stop) => {
      if (!stop || typeof stop !== "object" || Array.isArray(stop)) return null;
      const entry = stop;
      const color = typeof entry.color === "string" ? entry.color.trim() : "";
      if (!color) return null;
      const position = clampNumber2(typeof entry.position === "number" ? entry.position : 0, 0, 100);
      return { color, position };
    }).filter((stop) => Boolean(stop));
    return { kind, angle, stops };
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
      return { type: "gradient", gradient: normalizeGradientValue(raw.gradient) };
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
    const urlMatch = value.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
    if (urlMatch && urlMatch[2]) {
      const src = urlMatch[2].trim();
      if (!isPersistedAssetUrl(src)) return null;
      return { type: "image", image: { src, fit: "cover", position: "center", repeat: "no-repeat" } };
    }
    if (isPersistedAssetUrl(value)) {
      return { type: "image", image: { src: value, fit: "cover", position: "center", repeat: "no-repeat" } };
    }
    if (/-gradient\(/i.test(value)) {
      return { type: "gradient", gradient: { css: value } };
    }
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
    if (desired !== "none" && allowedModes.includes(desired)) return desired;
    return allowedModes[0] || "color";
  }
  function readImageName(fill) {
    return typeof fill.image?.name === "string" && fill.image.name.trim() ? fill.image.name.trim() : null;
  }
  function readVideoName(fill) {
    return typeof fill.video?.name === "string" && fill.video.name.trim() ? fill.video.name.trim() : null;
  }

  // ../tooling/ck-contracts/src/index.js
  var WIDGET_PUBLIC_ID_RE = /^(?:wgt_main_[a-z0-9][a-z0-9_-]*|wgt_curated_[a-z0-9][a-z0-9_-]*|wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*)$/i;
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var ASSET_POINTER_PATH_RE = /^\/arsenale\/a\/([^/]+)\/([^/]+)$/;
  var ASSET_OBJECT_PATH_RE = /^\/arsenale\/o\/([^/]+)\/([^/]+)\/(?:[^/]+\/)?[^/]+$/;
  var CK_ERROR_CODE = Object.freeze({
    VALIDATION: "VALIDATION",
    NOT_FOUND: "NOT_FOUND",
    DENY: "DENY",
    INTERNAL: "INTERNAL"
  });
  var INSTANCE_PUBLISH_STATUS = Object.freeze({
    PUBLISHED: "published",
    UNPUBLISHED: "unpublished"
  });
  var RENDER_SNAPSHOT_ACTION = Object.freeze({
    UPSERT: "upsert",
    DELETE: "delete"
  });
  function normalizeWidgetPublicId(raw) {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return null;
    return WIDGET_PUBLIC_ID_RE.test(value) ? value : null;
  }
  function isWidgetPublicId(raw) {
    return normalizeWidgetPublicId(raw) != null;
  }
  function decodePathPart(raw) {
    try {
      return decodeURIComponent(String(raw || "")).trim();
    } catch {
      return "";
    }
  }
  function pathnameFromRawAssetRef(raw) {
    const value = String(raw || "").trim();
    if (!value) return null;
    if (value.startsWith("/")) return value;
    if (!/^https?:\/\//i.test(value)) return null;
    try {
      return new URL(value).pathname || "/";
    } catch {
      return null;
    }
  }
  function isUuid(raw) {
    const value = typeof raw === "string" ? raw.trim() : "";
    return Boolean(value && UUID_RE.test(value));
  }
  function parseCanonicalAssetRef(raw) {
    const pathname = pathnameFromRawAssetRef(raw);
    if (!pathname) return null;
    const pointer = pathname.match(ASSET_POINTER_PATH_RE);
    if (pointer) {
      const accountId2 = decodePathPart(pointer[1]);
      const assetId2 = decodePathPart(pointer[2]);
      if (!isUuid(accountId2) || !isUuid(assetId2)) return null;
      return { accountId: accountId2, assetId: assetId2, kind: "pointer", pathname };
    }
    const object = pathname.match(ASSET_OBJECT_PATH_RE);
    if (!object) return null;
    const accountId = decodePathPart(object[1]);
    const assetId = decodePathPart(object[2]);
    if (!isUuid(accountId) || !isUuid(assetId)) return null;
    return { accountId, assetId, kind: "object", pathname };
  }

  // components/shared/assetUpload.ts
  function isPublicId(value) {
    return isWidgetPublicId(value);
  }
  function isWidgetType(value) {
    return /^[a-z0-9][a-z0-9_-]*$/i.test(value);
  }
  function readDatasetValue(name) {
    if (typeof document === "undefined") return "";
    const value = document.documentElement.dataset?.[name];
    return typeof value === "string" ? value.trim() : "";
  }
  function resolveContextFromDocument() {
    const accountId = readDatasetValue("ckOwnerAccountId");
    const workspaceId = readDatasetValue("ckWorkspaceId");
    const publicId = readDatasetValue("ckPublicId");
    const widgetType = readDatasetValue("ckWidgetType");
    if (!accountId || !isUuid(accountId)) return null;
    const context = {
      accountId
    };
    if (workspaceId && isUuid(workspaceId)) context.workspaceId = workspaceId;
    if (publicId && isPublicId(publicId)) context.publicId = publicId;
    if (widgetType && isWidgetType(widgetType)) context.widgetType = widgetType.toLowerCase();
    return context;
  }
  function safeJsonParse(text) {
    if (!text || typeof text !== "string") return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  function normalizeAssetUrl(payload) {
    const direct = typeof payload.url === "string" ? payload.url.trim() : "";
    if (!direct) return null;
    const parsed = parseCanonicalAssetRef(direct);
    if (!parsed || parsed.kind !== "pointer") return null;
    if (/^https?:\/\//i.test(direct)) return direct;
    return parsed.pathname;
  }
  function assertUploadContext(context) {
    const accountId = String(context.accountId || "").trim();
    const workspaceId = String(context.workspaceId || "").trim();
    const publicId = String(context.publicId || "").trim();
    const widgetType = String(context.widgetType || "").trim().toLowerCase();
    if (!isUuid(accountId)) {
      throw new Error("coreui.errors.accountId.invalid");
    }
    if (workspaceId && !isUuid(workspaceId)) {
      throw new Error("coreui.errors.workspaceId.invalid");
    }
    if (publicId && !isPublicId(publicId)) {
      throw new Error("coreui.errors.publicId.invalid");
    }
    if (widgetType && !isWidgetType(widgetType)) {
      throw new Error("coreui.errors.widgetType.invalid");
    }
    return {
      accountId,
      workspaceId: workspaceId || void 0,
      publicId: publicId || void 0,
      widgetType: widgetType || void 0
    };
  }
  async function uploadEditorAsset(args) {
    const file = args.file;
    if (!(file instanceof File) || file.size <= 0) {
      throw new Error("coreui.errors.payload.empty");
    }
    const context = assertUploadContext(args.context ?? resolveContextFromDocument() ?? {});
    const source = args.source || "api";
    const variant = args.variant || "original";
    const endpoint = (args.endpoint || "/api/assets/upload").trim();
    const headers = new Headers();
    headers.set("content-type", file.type || "application/octet-stream");
    headers.set("x-account-id", context.accountId);
    if (context.workspaceId) headers.set("x-workspace-id", context.workspaceId);
    headers.set("x-filename", file.name || "upload.bin");
    headers.set("x-variant", variant);
    headers.set("x-source", source);
    if (context.publicId) headers.set("x-public-id", context.publicId);
    if (context.widgetType) headers.set("x-widget-type", context.widgetType);
    const response = await fetch(`${endpoint.replace(/\/$/, "")}?_t=${Date.now()}`, {
      method: "POST",
      headers,
      body: file
    });
    const text = await response.text().catch(() => "");
    const payload = safeJsonParse(text);
    if (!response.ok) {
      const errorRecord = payload && typeof payload === "object" && !Array.isArray(payload) ? payload.error : void 0;
      const reasonKey = typeof errorRecord?.reasonKey === "string" ? errorRecord.reasonKey : "";
      const detail = typeof errorRecord?.detail === "string" ? errorRecord.detail : "";
      throw new Error(reasonKey || detail || `coreui.errors.assets.uploadFailed (${response.status})`);
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("coreui.errors.assets.uploadFailed");
    }
    const url = normalizeAssetUrl(payload);
    if (!url) {
      throw new Error("coreui.errors.assets.uploadFailed");
    }
    return url;
  }

  // components/dropdown-fill/asset-picker-data.ts
  function readFillDocumentDatasetValue(key) {
    if (typeof document === "undefined") return "";
    const value = document.documentElement.dataset[key];
    return typeof value === "string" ? value.trim() : "";
  }
  function resolveImageAssetPickerContext() {
    const accountId = readFillDocumentDatasetValue("ckOwnerAccountId");
    if (!isUuid(accountId)) return null;
    const workspaceIdRaw = readFillDocumentDatasetValue("ckWorkspaceId");
    return {
      accountId,
      workspaceId: isUuid(workspaceIdRaw) ? workspaceIdRaw : null
    };
  }
  function formatAssetSizeLabel(sizeBytes) {
    const safe = Number.isFinite(sizeBytes) ? Math.max(0, Math.trunc(sizeBytes)) : 0;
    if (safe < 1024) return `${safe} B`;
    if (safe < 1024 * 1024) return `${Math.round(safe / 1024)} KB`;
    return `${(safe / (1024 * 1024)).toFixed(1)} MB`;
  }
  function resolveAssetChoiceUrl(accountId, assetId) {
    return `/arsenale/a/${encodeURIComponent(accountId)}/${encodeURIComponent(assetId)}`;
  }
  async function fetchImageAssetChoices() {
    const context = resolveImageAssetPickerContext();
    if (!context) {
      throw new Error("No account context available.");
    }
    const params = new URLSearchParams({
      view: "all",
      limit: "200"
    });
    if (context.workspaceId) params.set("workspaceId", context.workspaceId);
    const response = await fetch(`/api/assets/${encodeURIComponent(context.accountId)}?${params.toString()}`, {
      cache: "no-store"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const reasonKey = String(payload?.error?.reasonKey || "").trim();
      throw new Error(reasonKey || `HTTP_${response.status}`);
    }
    const assets = Array.isArray(payload?.assets) ? payload?.assets : [];
    return assets.map((asset) => {
      const assetId = String(asset.assetId || "").trim();
      if (!isUuid(assetId)) return null;
      const contentType = String(asset.contentType || "").trim().toLowerCase();
      if (!contentType.startsWith("image/")) return null;
      const normalizedFilename = String(asset.normalizedFilename || "").trim() || `asset-${assetId.slice(0, 8)}`;
      const sizeBytes = Number(asset.sizeBytes);
      const usageCount = Number(asset.usageCount);
      return {
        assetId,
        accountId: context.accountId,
        normalizedFilename,
        contentType,
        sizeBytes: Number.isFinite(sizeBytes) ? Math.max(0, Math.trunc(sizeBytes)) : 0,
        usageCount: Number.isFinite(usageCount) ? Math.max(0, Math.trunc(usageCount)) : 0,
        url: resolveAssetChoiceUrl(context.accountId, assetId)
      };
    }).filter((asset) => Boolean(asset));
  }
  function toAssetPickerOverlayItems(assets) {
    return assets.map((asset) => ({
      assetId: asset.assetId,
      normalizedFilename: asset.normalizedFilename,
      contentType: asset.contentType,
      sizeLabel: formatAssetSizeLabel(asset.sizeBytes),
      usageCount: asset.usageCount,
      url: asset.url
    }));
  }

  // components/dropdown-fill/media-controller.ts
  function setFillUploadingState(state, uploading) {
    state.root.dataset.uploading = uploading ? "true" : "false";
    if (state.uploadButton) state.uploadButton.disabled = uploading;
    if (state.chooseButton) state.chooseButton.disabled = uploading;
    if (state.removeButton) state.removeButton.disabled = uploading;
    if (state.videoUploadButton) state.videoUploadButton.disabled = uploading;
    if (state.videoReplaceButton) state.videoReplaceButton.disabled = uploading;
    if (state.videoRemoveButton) state.videoRemoveButton.disabled = uploading;
  }
  function syncImageHeader(state, deps) {
    const placeholder = state.headerValue?.dataset.placeholder ?? "";
    if (state.imageSrc && !state.imageUnavailable) {
      const label = state.imageName || "Image selected";
      deps.updateHeader(state, { text: label, muted: false, chipColor: null });
      return;
    }
    if (state.imageSrc && state.imageUnavailable) {
      deps.updateHeader(state, { text: "", muted: true, chipColor: null, noneChip: true });
      return;
    }
    deps.updateHeader(state, { text: placeholder, muted: true, chipColor: null });
  }
  function syncVideoHeader(state, deps) {
    const placeholder = state.headerValue?.dataset.placeholder ?? "";
    if (state.videoSrc && !state.videoUnavailable) {
      const label = state.videoName || "Video selected";
      deps.updateHeader(state, { text: label, muted: false, chipColor: null });
      return;
    }
    if (state.videoSrc && state.videoUnavailable) {
      deps.updateHeader(state, { text: "", muted: true, chipColor: null, noneChip: true });
      return;
    }
    deps.updateHeader(state, { text: placeholder, muted: true, chipColor: null });
  }
  function hasAvailableImage(state) {
    return Boolean(state.imageSrc && !state.imageUnavailable);
  }
  function hasAvailableVideo(state) {
    return Boolean(state.videoSrc && !state.videoUnavailable);
  }
  function syncImageMediaState(state, opts, deps) {
    const hasImage = hasAvailableImage(state);
    if (state.imagePanel) {
      state.imagePanel.dataset.hasImage = hasImage ? "true" : "false";
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
    if (opts.updateHeader !== false) {
      syncVideoHeader(state, deps);
    }
    if (opts.updateRemove !== false) {
      deps.setRemoveFillState(state, !hasVideo);
    }
  }
  function verifyImageAvailability(state, src, deps) {
    const normalizedSrc = normalizeAssetReferenceUrl(src);
    if (!normalizedSrc) {
      state.imageUnavailable = true;
      if (state.mode === "image") syncImageMediaState(state, { updateHeader: true, updateRemove: true }, deps);
      return;
    }
    state.imageAvailabilityRequestId += 1;
    const requestId = state.imageAvailabilityRequestId;
    const probe = new Image();
    const finalize = (available) => {
      if (state.imageAvailabilityRequestId !== requestId) return;
      if (!sameAssetReferenceUrl(state.imageSrc || "", normalizedSrc)) return;
      const nextUnavailable = !available;
      if (state.imageUnavailable === nextUnavailable) return;
      state.imageUnavailable = nextUnavailable;
      if (state.mode === "image") syncImageMediaState(state, { updateHeader: true, updateRemove: true }, deps);
    };
    probe.addEventListener("load", () => finalize(true), { once: true });
    probe.addEventListener("error", () => finalize(false), { once: true });
    probe.src = normalizedSrc;
  }
  async function openImageAssetPicker(state) {
    if (!state.assetPickerOverlay || !state.chooseButton) return;
    state.assetPickerOverlay.open(state.chooseButton);
    state.assetPickerOverlay.setMessage("Loading assets...");
    state.assetPickerOverlay.setRows([]);
    state.imageAssetPickerLoading = true;
    try {
      const assets = await fetchImageAssetChoices();
      const rows = toAssetPickerOverlayItems(assets);
      state.assetPickerOverlay.setRows(rows);
      if (assets.length === 0) {
        state.assetPickerOverlay.setMessage("No assets available.");
      } else {
        state.assetPickerOverlay.setMessage(`Select from ${assets.length} image asset${assets.length === 1 ? "" : "s"}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load assets.";
      state.assetPickerOverlay.setMessage(message || "Failed to load assets.");
      state.assetPickerOverlay.setRows([]);
    } finally {
      state.imageAssetPickerLoading = false;
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
    if (!src) {
      state.imageName = null;
      state.imageUnavailable = false;
      state.imageAvailabilityRequestId += 1;
    } else if (!sameAssetReferenceUrl(src, previousSrc ?? "")) {
      state.imageUnavailable = false;
    }
    if (opts.commit) {
      const fill = src ? {
        type: "image",
        image: {
          src,
          ...state.imageName ? { name: state.imageName } : {},
          fit: "cover",
          position: "center",
          repeat: "no-repeat"
        }
      } : { type: "none" };
      deps.setInputValue(state, fill, true);
    }
    if (src) {
      verifyImageAvailability(state, src, deps);
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
    if (!src) {
      state.videoName = null;
      state.videoUnavailable = false;
    } else if (!sameAssetReferenceUrl(src, previousSrc ?? "")) {
      state.videoUnavailable = false;
    }
    if (opts.commit) {
      const fill = src ? {
        type: "video",
        video: {
          src,
          ...state.videoName ? { name: state.videoName } : {},
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
  function installImageHandlers(state, deps) {
    const { uploadButton, chooseButton, removeButton, fileInput } = state;
    if (uploadButton && fileInput) {
      uploadButton.addEventListener("click", (event) => {
        event.preventDefault();
        fileInput.value = "";
        fileInput.click();
      });
    }
    if (chooseButton) {
      chooseButton.addEventListener("click", (event) => {
        event.preventDefault();
        if (!state.assetPickerOverlay) return;
        if (state.assetPickerOverlay.isOpen()) {
          state.assetPickerOverlay.close();
          return;
        }
        state.assetPickerOverlay.open(chooseButton);
        void openImageAssetPicker(state);
      });
    }
    if (removeButton) {
      removeButton.addEventListener("click", (event) => {
        event.preventDefault();
        if (state.imageObjectUrl) {
          URL.revokeObjectURL(state.imageObjectUrl);
          state.imageObjectUrl = null;
        }
        state.assetPickerOverlay?.close();
        setImageSrc(state, null, { commit: true }, deps);
      });
    }
    if (fileInput) {
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const previousSrc = state.imageSrc;
        const previousName = state.imageName;
        state.imageName = file.name || null;
        setFillUploadingState(state, true);
        state.assetPickerOverlay?.close();
        deps.updateHeader(state, { text: `Uploading ${file.name}...`, muted: true, chipColor: null });
        const localPreviewUrl = URL.createObjectURL(file);
        state.imageObjectUrl = localPreviewUrl;
        setImageSrc(state, localPreviewUrl, { commit: false, updateHeader: true, updateRemove: true }, deps);
        try {
          const uploadedUrl = await uploadEditorAsset({
            file,
            variant: "original",
            source: "api"
          });
          setImageSrc(state, uploadedUrl, { commit: true }, deps);
        } catch {
          state.imageName = previousName;
          setImageSrc(state, previousSrc, { commit: false, updateHeader: true, updateRemove: true }, deps);
          if (!previousSrc) {
            deps.updateHeader(state, { text: "Upload failed", muted: true, chipColor: null, noneChip: true });
          }
        } finally {
          setFillUploadingState(state, false);
          fileInput.value = "";
        }
      });
    }
  }
  function installVideoHandlers(state, deps) {
    const { videoUploadButton, videoReplaceButton, videoRemoveButton, videoFileInput } = state;
    if (state.videoPreview) {
      state.videoPreview.addEventListener("error", () => {
        const currentSrc = state.videoPreview?.currentSrc || state.videoPreview?.src || "";
        if (!state.videoSrc || !sameAssetReferenceUrl(currentSrc, state.videoSrc)) return;
        if (state.videoUnavailable) return;
        state.videoUnavailable = true;
        if (state.mode === "video") syncVideoMediaState(state, { updateHeader: true, updateRemove: true }, deps);
      });
      state.videoPreview.addEventListener("loadeddata", () => {
        const currentSrc = state.videoPreview?.currentSrc || state.videoPreview?.src || "";
        if (!state.videoSrc || !sameAssetReferenceUrl(currentSrc, state.videoSrc)) return;
        if (!state.videoUnavailable) return;
        state.videoUnavailable = false;
        if (state.mode === "video") syncVideoMediaState(state, { updateHeader: true, updateRemove: true }, deps);
      });
    }
    if (videoUploadButton && videoFileInput) {
      videoUploadButton.addEventListener("click", (event) => {
        event.preventDefault();
        videoFileInput.value = "";
        videoFileInput.click();
      });
    }
    if (videoReplaceButton && videoFileInput) {
      videoReplaceButton.addEventListener("click", (event) => {
        event.preventDefault();
        videoFileInput.value = "";
        videoFileInput.click();
      });
    }
    if (videoRemoveButton) {
      videoRemoveButton.addEventListener("click", (event) => {
        event.preventDefault();
        if (state.videoObjectUrl) {
          URL.revokeObjectURL(state.videoObjectUrl);
          state.videoObjectUrl = null;
        }
        setVideoSrc(state, null, { commit: true }, deps);
      });
    }
    if (videoFileInput) {
      videoFileInput.addEventListener("change", async () => {
        const file = videoFileInput.files && videoFileInput.files[0];
        if (!file) return;
        const previousSrc = state.videoSrc;
        const previousName = state.videoName;
        state.videoName = file.name || null;
        setFillUploadingState(state, true);
        deps.updateHeader(state, { text: `Uploading ${file.name}...`, muted: true, chipColor: null });
        const localPreviewUrl = URL.createObjectURL(file);
        state.videoObjectUrl = localPreviewUrl;
        setVideoSrc(state, localPreviewUrl, { commit: false, updateHeader: true, updateRemove: true }, deps);
        try {
          const uploadedUrl = await uploadEditorAsset({
            file,
            variant: "original",
            source: "api"
          });
          setVideoSrc(state, uploadedUrl, { commit: true }, deps);
        } catch {
          state.videoName = previousName;
          setVideoSrc(state, previousSrc, { commit: false, updateHeader: true, updateRemove: true }, deps);
          if (!previousSrc) {
            deps.updateHeader(state, { text: "Upload failed", muted: true, chipColor: null, noneChip: true });
          }
        } finally {
          setFillUploadingState(state, false);
          videoFileInput.value = "";
        }
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
    isInsideTarget: (root, target) => {
      const state = states.get(root);
      if (!state?.assetPickerOverlay) return false;
      return state.assetPickerOverlay.contains(target);
    },
    onClose: (root) => {
      const state = states.get(root);
      if (!state) return;
      state.assetPickerOverlay?.close();
    }
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
      position: clampNumber2(stop.position, 0, 100),
      hsv
    };
  }
  function createDefaultGradientStops(root) {
    return DEFAULT_GRADIENT.stops.map((stop) => createGradientStopState(root, stop));
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
    const uploadButton = root.querySelector(".diet-dropdown-fill__upload-btn");
    const chooseButton = root.querySelector(".diet-dropdown-fill__choose-btn");
    const removeButton = root.querySelector(".diet-dropdown-fill__remove-btn");
    const fileInput = root.querySelector(".diet-dropdown-fill__file-input");
    const videoPanel = root.querySelector(".diet-dropdown-fill__panel--video");
    const videoPreview = root.querySelector(".diet-dropdown-fill__video-preview");
    const videoUploadButton = root.querySelector(".diet-dropdown-fill__video-upload-btn");
    const videoReplaceButton = root.querySelector(".diet-dropdown-fill__video-replace-btn");
    const videoRemoveButton = root.querySelector(".diet-dropdown-fill__video-remove-btn");
    const videoFileInput = root.querySelector(".diet-dropdown-fill__video-file-input");
    if (!input || !hueInput || !alphaInput || !hexField || !alphaField || !svCanvas || !svThumb) {
      return null;
    }
    const assetPickerOverlay = chooseButton ? new AssetPickerOverlay({
      onUse: (item) => {
        const current = states.get(root);
        if (!current) return;
        current.imageName = item.normalizedFilename;
        setImageSrc2(current, item.url, { commit: true });
      },
      onOpenChange: (open) => {
        const current = states.get(root);
        if (!current) return;
        current.imageAssetPickerOpen = open;
        if (current.chooseButton) {
          current.chooseButton.setAttribute("aria-expanded", open ? "true" : "false");
          current.chooseButton.classList.toggle("is-active", open);
        }
      }
    }) : null;
    if (chooseButton) {
      chooseButton.setAttribute("aria-haspopup", "dialog");
      chooseButton.setAttribute("aria-expanded", "false");
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
      gradientCss: null,
      imagePanel,
      imagePreview,
      uploadButton,
      chooseButton,
      removeButton,
      assetPickerOverlay,
      fileInput,
      imageSrc: null,
      imageName: null,
      imageObjectUrl: null,
      imageUnavailable: false,
      imageAvailabilityRequestId: 0,
      imageAssetPickerOpen: false,
      imageAssetPickerLoading: false,
      videoPanel,
      videoPreview,
      videoUploadButton,
      videoReplaceButton,
      videoRemoveButton,
      videoFileInput,
      videoSrc: null,
      videoName: null,
      videoObjectUrl: null,
      videoUnavailable: false,
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
      const hue = clampNumber2(Number(state.hueInput.value), 0, 360);
      state.hsv.h = hue;
      if (state.hsv.a === 0) state.hsv.a = 1;
      syncColorUI(state, { commit: true });
    });
    state.alphaInput.addEventListener("input", () => {
      const alpha = clampNumber2(Number(state.alphaInput.value) / 100, 0, 1);
      state.hsv.a = alpha;
      syncColorUI(state, { commit: true });
    });
    state.hexField.addEventListener("change", () => handleHexInput(state));
    state.hexField.addEventListener("blur", () => handleHexInput(state));
    state.alphaField.addEventListener("change", () => handleAlphaField(state));
    state.alphaField.addEventListener("blur", () => handleAlphaField(state));
    installSvCanvasHandlers(state);
    installSwatchHandlers(state);
    installGradientHandlers(state);
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
  function installGradientHandlers(state) {
    if (state.gradientAngleInput) {
      state.gradientAngleInput.addEventListener("input", () => {
        const angle = clampNumber2(Number(state.gradientAngleInput?.value), 0, 360);
        state.gradientCss = null;
        state.gradient.angle = angle;
        syncGradientUI(state, { commit: true });
      });
    }
    installGradientStopBarHandlers(state);
    installGradientEditorHandlers(state);
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
    const percent = clampNumber2(position, 0, 100);
    const span = metrics.maxX - metrics.minX;
    if (span <= 0) return metrics.minX;
    return metrics.minX + span * percent / 100;
  }
  function gradientPxToPercent(state, clientX) {
    const metrics = getGradientStopMetrics(state);
    if (!metrics) return 0;
    const x = clampNumber2(clientX - metrics.rect.left, metrics.minX, metrics.maxX);
    const span = metrics.maxX - metrics.minX;
    if (span <= 0) return 0;
    return clampNumber2((x - metrics.minX) / span * 100, 0, 100);
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
  function updateGradientPreview(state, opts) {
    const shouldUpdateHeader = opts.updateHeader !== false;
    const shouldUpdateRemove = opts.updateRemove !== false;
    const css = state.gradientCss || buildGradientCss(state);
    if (state.gradientPreview) state.gradientPreview.style.backgroundImage = css;
    if (opts.commit) {
      setInputValue(state, buildGradientFill(state), true);
    }
    if (shouldUpdateHeader) {
      updateHeader(state, { text: "", muted: false, chipColor: css });
    }
    if (shouldUpdateRemove) {
      setRemoveFillState(state, false);
    }
  }
  function addGradientStop(state) {
    ensureGradientStops(state);
    const sorted = getSortedGradientStops(state.gradientStops);
    const active = getActiveGradientStop(state);
    const activeIndex = sorted.findIndex((stop2) => stop2.id === active.id);
    const right = sorted[activeIndex + 1] ?? null;
    const left = sorted[activeIndex - 1] ?? null;
    let position = 50;
    if (right) {
      position = (active.position + right.position) / 2;
    } else if (left) {
      position = (left.position + active.position) / 2;
    }
    const stop = createGradientStopState(state.root, { color: active.color, position });
    stop.hsv = { ...active.hsv };
    state.gradientStops.push(stop);
    state.gradientActiveStopId = stop.id;
    state.gradientCss = null;
    syncGradientUI(state, { commit: true });
  }
  function removeGradientStop(state, stopId) {
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
    state.gradientCss = null;
    syncGradientUI(state, { commit: true });
  }
  function bindGradientStopButton(state, button, stopId) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      setActiveGradientStop(state, stopId);
    });
  }
  function commitGradientStopFromHsv(state) {
    const stop = getActiveGradientStop(state);
    stop.color = colorStringFromHsv(stop.hsv);
    state.gradientCss = null;
    syncGradientUI(state, { commit: true });
  }
  function handleGradientStopHexInput(state) {
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
    commitGradientStopFromHsv(state);
  }
  function handleGradientStopAlphaField(state) {
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
    const percent = clampNumber2(parsed, 0, 100);
    hsv.a = percent / 100;
    commitGradientStopFromHsv(state);
  }
  function installGradientStopBarHandlers(state) {
    if (state.gradientStopAdd) {
      state.gradientStopAdd.addEventListener("click", (event) => {
        event.preventDefault();
        const { sorted, index } = getActiveGradientStopIndex(state);
        const removable = index > 0 && index < sorted.length - 1;
        if (removable) {
          removeGradientStop(state, state.gradientActiveStopId);
          return;
        }
        addGradientStop(state);
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
      state.gradientCss = null;
      syncGradientStopButtons(state);
      updateGradientPreview(state, { commit: true, updateHeader: true, updateRemove: false });
    };
    const finishDrag = (stopId, event) => {
      const rect = bar.getBoundingClientRect();
      const outside = event.clientY < rect.top - 24 || event.clientY > rect.bottom + 24;
      state.gradientDrag = void 0;
      if (outside) {
        removeGradientStop(state, stopId);
        return;
      }
      syncGradientStopButtons(state);
      updateGradientPreview(state, { commit: true, updateHeader: true });
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
  function installGradientEditorHandlers(state) {
    if (state.gradientStopSv) {
      const move = (event) => {
        const rect = state.gradientStopSv?.getBoundingClientRect();
        if (!rect) return;
        const x = clampNumber2(event.clientX - rect.left, 0, rect.width);
        const y = clampNumber2(event.clientY - rect.top, 0, rect.height);
        const s = rect.width ? x / rect.width : 0;
        const v = rect.height ? 1 - y / rect.height : 0;
        const stop = getActiveGradientStop(state);
        stop.hsv.s = clampNumber2(s, 0, 1);
        stop.hsv.v = clampNumber2(v, 0, 1);
        if (stop.hsv.a === 0) stop.hsv.a = 1;
        commitGradientStopFromHsv(state);
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
        const hue = clampNumber2(Number(state.gradientStopHueInput?.value), 0, 360);
        const stop = getActiveGradientStop(state);
        stop.hsv.h = hue;
        if (stop.hsv.a === 0) stop.hsv.a = 1;
        commitGradientStopFromHsv(state);
      });
    }
    if (state.gradientStopAlphaInput) {
      state.gradientStopAlphaInput.addEventListener("input", () => {
        const alpha = clampNumber2(Number(state.gradientStopAlphaInput?.value) / 100, 0, 1);
        const stop = getActiveGradientStop(state);
        stop.hsv.a = alpha;
        commitGradientStopFromHsv(state);
      });
    }
    if (state.gradientStopHexInput) {
      const handler = () => handleGradientStopHexInput(state);
      state.gradientStopHexInput.addEventListener("change", handler);
      state.gradientStopHexInput.addEventListener("blur", handler);
    }
    if (state.gradientStopAlphaField) {
      const handler = () => handleGradientStopAlphaField(state);
      state.gradientStopAlphaField.addEventListener("change", handler);
      state.gradientStopAlphaField.addEventListener("blur", handler);
    }
  }
  function installSvCanvasHandlers(state) {
    const move = (event) => {
      const rect = state.svCanvas.getBoundingClientRect();
      const x = clampNumber2(event.clientX - rect.left, 0, rect.width);
      const y = clampNumber2(event.clientY - rect.top, 0, rect.height);
      const s = rect.width ? x / rect.width : 0;
      const v = rect.height ? 1 - y / rect.height : 0;
      state.hsv.s = clampNumber2(s, 0, 1);
      state.hsv.v = clampNumber2(v, 0, 1);
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
  function colorStringFromHsv(hsv) {
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
    return hsv.a < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${roundTo(hsv.a, 2)})` : formatHex({ ...hsv, a: 1 });
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
  function getSwatchTarget(swatch) {
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
        const target = getSwatchTarget(swatch);
        if (target === "gradient") {
          const stop = getActiveGradientStop(state);
          stop.hsv.h = parsed.h;
          stop.hsv.s = parsed.s;
          stop.hsv.v = parsed.v;
          stop.hsv.a = 1;
          commitGradientStopFromHsv(state);
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
    const percent = clampNumber2(parsed, 0, 100);
    state.hsv.a = percent / 100;
    syncColorUI(state, { commit: true });
  }
  function normalizeGradientColor(state, raw, fallback) {
    let value = raw.trim();
    if (!value) return fallback;
    if (!value.startsWith("#") && /^[0-9a-f]{3,8}$/i.test(value)) {
      value = `#${value}`;
    }
    const parsed = parseColor(value, state.root);
    return parsed ? value : fallback;
  }
  function normalizeGradientStopsForOutput(state) {
    const fallbackStops = DEFAULT_GRADIENT.stops;
    const sourceStops = state.gradientStops.length >= 2 ? getSortedGradientStops(state.gradientStops) : null;
    const stopsToUse = sourceStops ?? fallbackStops.map((stop) => ({ ...stop }));
    return stopsToUse.map((stop, index) => {
      const fallback = fallbackStops[Math.min(index, fallbackStops.length - 1)]?.color || fallbackStops[0].color;
      return {
        color: normalizeGradientColor(state, stop.color, fallback),
        position: clampNumber2(stop.position, 0, 100)
      };
    });
  }
  function buildGradientFill(state) {
    const angle = clampNumber2(state.gradient.angle, 0, 360);
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
    const angle = clampNumber2(state.gradient.angle, 0, 360);
    const normalizedStops = normalizeGradientStopsForOutput(state);
    const stopList = normalizedStops.map((stop) => `${stop.color} ${clampNumber2(stop.position, 0, 100)}%`).join(", ");
    return `linear-gradient(${angle}deg, ${stopList})`;
  }
  function syncGradientUI(state, opts) {
    const shouldUpdateHeader = opts.updateHeader !== false;
    const shouldUpdateRemove = opts.updateRemove !== false;
    ensureGradientStops(state);
    if (state.gradientAngleInput) {
      state.gradientAngleInput.value = String(clampNumber2(state.gradient.angle, 0, 360));
      state.gradientAngleInput.style.setProperty("--value", state.gradientAngleInput.value);
      state.gradientAngleInput.style.setProperty("--min", "0");
      state.gradientAngleInput.style.setProperty("--max", "360");
    }
    syncGradientStopButtons(state);
    syncActiveGradientStopUI(state);
    updateGradientAddButton(state);
    updateGradientPreview(state, { commit: opts.commit, updateHeader: shouldUpdateHeader, updateRemove: shouldUpdateRemove });
  }
  function applyGradientFromFill(state, gradient) {
    state.gradient = { angle: DEFAULT_GRADIENT.angle };
    state.gradientStops = createDefaultGradientStops(state.root);
    state.gradientActiveStopId = state.gradientStops[0]?.id ?? "";
    state.gradientCss = null;
    if (!gradient || typeof gradient !== "object" || Array.isArray(gradient)) return;
    if ("css" in gradient) {
      const css = typeof gradient.css === "string" ? gradient.css.trim() : "";
      state.gradientCss = css || null;
      return;
    }
    const angle = typeof gradient.angle === "number" ? gradient.angle : DEFAULT_GRADIENT.angle;
    state.gradient.angle = clampNumber2(angle, 0, 360);
    if (Array.isArray(gradient.stops) && gradient.stops.length >= 2) {
      state.gradientStops = gradient.stops.map(
        (stop) => createGradientStopState(state.root, {
          color: typeof stop?.color === "string" ? stop.color : DEFAULT_GRADIENT.stops[0].color,
          position: typeof stop?.position === "number" ? stop.position : 0
        })
      );
      state.gradientActiveStopId = state.gradientStops[0]?.id ?? "";
    }
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
        setImageSrc2(state, null, { commit: false });
        return;
      }
      if (nextMode === "video") {
        setVideoSrc2(state, null, { commit: false });
        return;
      }
      if (nextMode === "gradient") {
        state.gradient = { angle: DEFAULT_GRADIENT.angle };
        state.gradientStops = createDefaultGradientStops(state.root);
        state.gradientActiveStopId = state.gradientStops[0]?.id ?? "";
        state.gradientCss = null;
        syncGradientUI(state, { commit: false });
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
      syncGradientUI(state, { commit: false });
      return;
    }
    if (fill.type === "image") {
      state.imageName = readImageName(fill);
      setImageSrc2(state, fill.image?.src || null, { commit: false });
      return;
    }
    if (fill.type === "video") {
      state.videoName = readVideoName(fill);
      setVideoSrc2(state, fill.video?.src || null, { commit: false });
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
      if (getSwatchTarget(swatch) !== "color") return;
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
    if (next !== "image" && state.imageAssetPickerOpen) {
      state.assetPickerOverlay?.close();
    }
  }
  function syncModeUI(state, opts) {
    if (state.mode === "gradient") {
      syncGradientUI(state, opts);
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
