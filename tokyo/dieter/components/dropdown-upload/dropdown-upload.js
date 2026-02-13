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

  // components/dropdown-upload/dropdown-upload.ts
  var dropdown_upload_exports = {};
  __export(dropdown_upload_exports, {
    hydrateDropdownUpload: () => hydrateDropdownUpload
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

  // components/dropdown-upload/dropdown-upload.ts
  var states = /* @__PURE__ */ new Map();
  var hydrateHost = createDropdownHydrator({
    rootSelector: ".diet-dropdown-upload",
    triggerSelector: ".diet-dropdown-upload__control",
    onOpen: (root) => {
      const state = states.get(root);
      if (!state) return;
      syncFromInputs(state);
    }
  });
  function hydrateDropdownUpload(scope) {
    const roots = Array.from(scope.querySelectorAll(".diet-dropdown-upload"));
    if (!roots.length) return;
    roots.forEach((root) => {
      if (states.has(root)) return;
      const state = createState(root);
      if (!state) return;
      states.set(root, state);
      installHandlers(state);
      const initialValue = state.input.value || state.input.getAttribute("value") || "";
      syncFromInputs(state, initialValue);
    });
    hydrateHost(scope);
  }
  function createState(root) {
    const input = root.querySelector(".diet-dropdown-upload__value-field");
    const headerLabel = root.querySelector(".diet-dropdown-header-label");
    const headerValue = root.querySelector(".diet-dropdown-header-value");
    const headerValueLabel = root.querySelector(".diet-dropdown-upload__label");
    const previewPanel = root.querySelector(".diet-dropdown-upload__panel");
    const previewImg = root.querySelector(".diet-dropdown-upload__preview-img");
    const previewVideoEl = root.querySelector('[data-role="videoEl"]');
    const previewName = root.querySelector('[data-role="name"]');
    const previewExt = root.querySelector('[data-role="ext"]');
    const previewError = root.querySelector('[data-role="error"]');
    const uploadButton = root.querySelector(".diet-dropdown-upload__upload-btn");
    const replaceButton = root.querySelector(".diet-dropdown-upload__replace-btn");
    const removeButton = root.querySelector(".diet-dropdown-upload__remove-btn");
    const fileInput = root.querySelector(".diet-dropdown-upload__file-input");
    const metaInput = root.querySelector(".diet-dropdown-upload__meta-field");
    const metaHasPath = Boolean(metaInput?.getAttribute("data-bob-path"));
    if (!input || !previewPanel || !previewImg || !previewVideoEl || !previewName || !previewExt || !previewError || !uploadButton || !replaceButton || !removeButton || !fileInput) {
      return null;
    }
    const accept = (input.dataset.accept || fileInput.getAttribute("accept") || "image/*").trim();
    const maxImageKbRaw = (input.dataset.maxImageKb || "").trim();
    const maxVideoKbRaw = (input.dataset.maxVideoKb || "").trim();
    const maxOtherKbRaw = (input.dataset.maxOtherKb || "").trim();
    const maxImageKb = maxImageKbRaw ? Number(maxImageKbRaw) : void 0;
    const maxVideoKb = maxVideoKbRaw ? Number(maxVideoKbRaw) : void 0;
    const maxOtherKb = maxOtherKbRaw ? Number(maxOtherKbRaw) : void 0;
    if (accept) fileInput.setAttribute("accept", accept);
    return {
      root,
      input,
      metaInput,
      metaHasPath,
      headerLabel,
      baseHeaderLabelText: (headerLabel?.textContent || "").trim(),
      headerValue,
      headerValueLabel,
      previewPanel,
      previewImg,
      previewVideoEl,
      previewName,
      previewExt,
      previewError,
      uploadButton,
      replaceButton,
      removeButton,
      fileInput,
      accept,
      maxImageKb: Number.isFinite(maxImageKb) ? maxImageKb : void 0,
      maxVideoKb: Number.isFinite(maxVideoKb) ? maxVideoKb : void 0,
      maxOtherKb: Number.isFinite(maxOtherKb) ? maxOtherKb : void 0,
      localObjectUrl: null,
      nativeValue: captureNativeValue(input),
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
    state.input.addEventListener("external-sync", () => syncFromInputs(state));
    state.input.addEventListener("input", () => syncFromInputs(state));
    if (state.metaInput) {
      state.metaInput.addEventListener("external-sync", () => syncFromInputs(state));
      state.metaInput.addEventListener("input", () => syncFromInputs(state));
    }
    const pickFile = (event) => {
      event.preventDefault();
      state.fileInput.value = "";
      state.fileInput.click();
    };
    state.uploadButton.addEventListener("click", pickFile);
    state.replaceButton.addEventListener("click", pickFile);
    state.removeButton.addEventListener("click", (event) => {
      event.preventDefault();
      if (state.localObjectUrl) {
        URL.revokeObjectURL(state.localObjectUrl);
        state.localObjectUrl = null;
      }
      setMetaValue(state, null, true);
      setFileKey(state, "", true);
    });
    state.fileInput.addEventListener("change", async () => {
      const file = state.fileInput.files && state.fileInput.files[0];
      if (!file) return;
      const error = validateFileSelection(state, file);
      if (error) {
        setError(state, error);
        return;
      }
      clearError(state);
      if (state.localObjectUrl) URL.revokeObjectURL(state.localObjectUrl);
      const objectUrl = URL.createObjectURL(file);
      state.localObjectUrl = objectUrl;
      const { kind, ext } = classifyByNameAndType(file.name, file.type);
      state.root.dataset.localName = file.name;
      setMetaValue(state, { name: file.name, mime: file.type || "", source: "user" }, true);
      setHeaderWithFile(state, file.name, false);
      setPreview(state, {
        kind,
        previewUrl: kind === "image" || kind === "video" ? objectUrl : void 0,
        name: file.name,
        ext,
        hasFile: true
      });
      setFileKey(state, objectUrl, true);
    });
  }
  function validateFileSelection(state, file) {
    const { kind } = classifyByNameAndType(file.name, file.type);
    const capKb = kind === "image" ? state.maxImageKb : kind === "video" ? state.maxVideoKb : state.maxOtherKb;
    if (capKb && Number.isFinite(capKb)) {
      const maxBytes = capKb * 1024;
      if (file.size > maxBytes) return `File too large (max ${capKb}KB)`;
    }
    const accept = state.accept;
    if (!accept) return null;
    const accepted = accept.split(",").map((s) => s.trim()).filter(Boolean);
    if (!accepted.length) return null;
    const nameLower = file.name.toLowerCase();
    const typeLower = (file.type || "").toLowerCase();
    const ok = accepted.some((rule) => {
      if (rule === "*/*") return true;
      if (rule.endsWith("/*")) {
        const prefix = rule.slice(0, -2).toLowerCase();
        return typeLower.startsWith(`${prefix}/`);
      }
      if (rule.startsWith(".")) {
        return nameLower.endsWith(rule.toLowerCase());
      }
      return typeLower === rule.toLowerCase();
    });
    return ok ? null : "File type not allowed";
  }
  function syncFromInputs(state, fallbackValue) {
    const value = fallbackValue ?? state.input.value;
    const meta = readMeta(state);
    syncFromValue(state, value, meta);
  }
  function readMeta(state) {
    if (!state.metaInput) return null;
    const raw = state.metaInput.value || state.metaInput.getAttribute("value") || "";
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  }
  function extractPrimaryUrl(raw) {
    const v = (raw || "").trim();
    if (!v) return null;
    if (/^data:/i.test(v) || /^blob:/i.test(v) || /^https?:\/\//i.test(v)) return v;
    const m = v.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
    if (m && m[2]) return m[2];
    return null;
  }
  function isDataUrl(raw) {
    const url = extractPrimaryUrl(raw);
    return Boolean(url && /^data:/i.test(url));
  }
  function looksLikeUrl(raw) {
    const url = extractPrimaryUrl(raw);
    return Boolean(url && (/^https?:\/\//i.test(url) || /^blob:/i.test(url) || url.startsWith("/")));
  }
  function previewFromUrl(state, raw, name, kindName, mime) {
    const url = extractPrimaryUrl(raw);
    if (!url) return;
    const ext = (guessExtFromName(kindName) || "").toLowerCase();
    const kind = classifyByNameAndType(kindName || "file", mime).kind;
    setPreview(state, { kind, previewUrl: url, name, ext, hasFile: true });
  }
  function previewFromDataUrl(state, raw, name, kindName, mimeOverride) {
    const url = extractPrimaryUrl(raw) || "";
    const mime = mimeOverride || (url.split(";")[0] || "").slice("data:".length);
    const ext = (guessExtFromName(kindName) || "").toLowerCase();
    const kind = classifyByNameAndType(kindName || "file", mime).kind;
    setPreview(state, { kind, previewUrl: kind === "doc" ? void 0 : url, name, ext, hasFile: true });
  }
  function syncFromValue(state, raw, meta = null) {
    let key = String(raw ?? "").trim();
    if (key === "transparent") key = "";
    const placeholder = state.headerValue?.dataset.placeholder ?? "";
    const metaName = typeof meta?.name === "string" ? meta.name.trim() : "";
    const metaMime = typeof meta?.mime === "string" ? meta.mime.trim() : "";
    const expectsMeta = state.metaHasPath;
    const rawUrl = extractPrimaryUrl(key) || "";
    const kindName = metaName || guessNameFromUrl(rawUrl) || "";
    const fallbackName = expectsMeta ? "" : isDataUrl(key) ? state.root.dataset.localName || "Uploaded file" : state.root.dataset.localName || guessNameFromUrl(rawUrl) || rawUrl || key || "Uploaded file";
    const displayName = metaName || fallbackName || (expectsMeta ? "Unnamed file" : "Uploaded file");
    if (!key) {
      clearError(state);
      setHeaderEmpty(state, placeholder);
      state.root.dataset.hasFile = "false";
      setPreview(state, { kind: "empty", previewUrl: void 0, name: "", ext: "", hasFile: false });
      delete state.root.dataset.localName;
      return;
    }
    state.root.dataset.hasFile = "true";
    const hasMetaError = expectsMeta && !metaName;
    if (hasMetaError) {
      setError(state, "Missing file metadata.");
    } else {
      clearError(state);
    }
    if (isDataUrl(key)) {
      setHeaderWithFile(state, displayName, false);
      previewFromDataUrl(state, key, displayName, kindName || displayName, metaMime);
      return;
    }
    if (looksLikeUrl(key)) {
      setHeaderWithFile(state, displayName, false);
      previewFromUrl(state, key, displayName, kindName || displayName, metaMime);
      return;
    }
    setPreview(state, { kind: "unknown", previewUrl: void 0, name: "", ext: "", hasFile: true });
    setHeaderWithFile(state, "Invalid value", true);
    setError(state, "Unsupported value. Expected a URL (http/https) or an editor-only data URL.");
  }
  function setFileKey(state, fileKey, emit) {
    state.internalWrite = true;
    state.input.value = fileKey;
    state.internalWrite = false;
    if (emit) state.input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function setMetaValue(state, meta, emit) {
    if (!state.metaInput) return;
    const next = meta ? JSON.stringify(meta) : "";
    state.metaInput.value = next;
    if (emit) state.metaInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function setPreview(state, args) {
    state.previewPanel.dataset.hasFile = args.hasFile ? "true" : "false";
    state.previewPanel.dataset.kind = args.kind;
    state.previewName.textContent = args.name || "";
    state.previewExt.textContent = args.ext ? args.ext.toUpperCase() : "";
    if (args.hasFile && args.name) setHeaderWithFile(state, args.name, false);
    if (args.kind === "image" && args.previewUrl) {
      state.previewImg.src = args.previewUrl;
    } else {
      state.previewImg.removeAttribute("src");
    }
    if (args.kind === "video" && args.previewUrl) {
      state.previewVideoEl.src = args.previewUrl;
      state.previewVideoEl.load();
    } else {
      state.previewVideoEl.removeAttribute("src");
    }
  }
  function setError(state, message) {
    state.previewError.textContent = message;
  }
  function clearError(state) {
    state.previewError.textContent = "";
  }
  function setHeaderEmpty(state, placeholder) {
    if (state.headerLabel) state.headerLabel.textContent = placeholder;
    if (state.headerValueLabel) state.headerValueLabel.textContent = "";
    if (state.headerValue) {
      state.headerValue.hidden = true;
      state.headerValue.dataset.muted = "true";
    }
  }
  function setHeaderWithFile(state, rightText, muted) {
    if (state.headerLabel) state.headerLabel.textContent = state.baseHeaderLabelText || "File";
    if (state.headerValueLabel) state.headerValueLabel.textContent = rightText;
    if (state.headerValue) {
      state.headerValue.hidden = false;
      state.headerValue.dataset.muted = muted ? "true" : "false";
    }
  }
  function classifyByNameAndType(name, mimeType) {
    const ext = guessExtFromName(name);
    const mt = (mimeType || "").toLowerCase();
    const extLower = (ext || "").toLowerCase();
    const isImage = mt.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(extLower);
    if (isImage) return { kind: "image", ext: extLower };
    const isVideo = mt.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(extLower);
    if (isVideo) return { kind: "video", ext: extLower };
    const isDoc = mt === "application/pdf" || mt === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mt === "application/vnd.ms-excel" || ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip", "csv", "lottie", "json"].includes(extLower);
    if (isDoc) return { kind: "doc", ext: extLower };
    return { kind: "unknown", ext: extLower };
  }
  function guessExtFromName(name) {
    const base = (name || "").split("?")[0];
    const parts = base.split(".").filter(Boolean);
    if (parts.length < 2) return "";
    return parts[parts.length - 1];
  }
  function guessNameFromUrl(url) {
    const cleaned = url.split("?")[0];
    const parts = cleaned.split("/").filter(Boolean);
    if (!parts.length) return "";
    const filename = parts[parts.length - 1];
    const stem = filename.replace(/\.[^.]+$/, "").toLowerCase();
    if (stem === "original" || stem === "grayscale") {
      const legacyAssetId = parts.length >= 2 ? parts[parts.length - 2] : "";
      const nestedAssetId = parts.length >= 3 ? parts[parts.length - 3] : "";
      const assetId = /^[a-f0-9-]{8,}$/i.test(nestedAssetId) ? nestedAssetId : /^[a-f0-9-]{8,}$/i.test(legacyAssetId) ? legacyAssetId : "";
      if (assetId) {
        const ext = guessExtFromName(filename);
        const shortId = assetId.replace(/-/g, "").slice(0, 8);
        return ext ? `asset-${shortId}.${ext}` : `asset-${shortId}`;
      }
    }
    return filename;
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
  return __toCommonJS(dropdown_upload_exports);
})();
window.Dieter = { ...__prevDieter, ...Dieter };
