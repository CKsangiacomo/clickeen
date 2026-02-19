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
    if (!workspaceId || !isUuid(workspaceId)) return null;
    const context = {
      accountId,
      workspaceId
    };
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
  function normalizeUploadUrl(payload) {
    const direct = typeof payload.url === "string" ? payload.url.trim() : "";
    if (!direct) return null;
    const parsed = parseCanonicalAssetRef(direct);
    if (!parsed) return null;
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
    if (!isUuid(workspaceId)) {
      throw new Error("coreui.errors.workspaceId.invalid");
    }
    if (publicId && !isPublicId(publicId)) {
      throw new Error("coreui.errors.publicId.invalid");
    }
    if (widgetType && !isWidgetType(widgetType)) {
      throw new Error("coreui.errors.widgetType.invalid");
    }
    return { accountId, workspaceId, publicId: publicId || void 0, widgetType: widgetType || void 0 };
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
    headers.set("x-workspace-id", context.workspaceId);
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
    const url = normalizeUploadUrl(payload);
    if (!url) {
      throw new Error("coreui.errors.assets.uploadFailed");
    }
    return url;
  }

  // components/dropdown-upload/dropdown-upload.ts
  var states = /* @__PURE__ */ new Map();
  var ASSET_UNAVAILABLE_MESSAGE = "Asset URL is unavailable. Replace file to restore preview.";
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
    const handlePreviewMediaError = (kind, currentSrc) => {
      const raw = state.input.value || "";
      const expected = extractPrimaryUrl(raw) || "";
      if (!expected) return;
      if (state.previewPanel.dataset.kind !== kind) return;
      if (!sameAssetUrl(currentSrc, expected)) return;
      const fallbackLabel = state.previewName.textContent?.trim() || "Asset unavailable";
      setHeaderWithFile(state, fallbackLabel, true);
      setError(state, ASSET_UNAVAILABLE_MESSAGE);
    };
    const handlePreviewMediaReady = (kind, currentSrc) => {
      const raw = state.input.value || "";
      const expected = extractPrimaryUrl(raw) || "";
      if (!expected || state.previewPanel.dataset.kind !== kind) return;
      if (!sameAssetUrl(currentSrc, expected)) return;
      if ((state.previewError.textContent || "").trim() === ASSET_UNAVAILABLE_MESSAGE) {
        clearError(state);
      }
    };
    state.previewImg.addEventListener("error", () => {
      handlePreviewMediaError("image", state.previewImg.currentSrc || state.previewImg.src || "");
    });
    state.previewImg.addEventListener("load", () => {
      handlePreviewMediaReady("image", state.previewImg.currentSrc || state.previewImg.src || "");
    });
    state.previewVideoEl.addEventListener("error", () => {
      handlePreviewMediaError("video", state.previewVideoEl.currentSrc || state.previewVideoEl.src || "");
    });
    state.previewVideoEl.addEventListener("loadeddata", () => {
      handlePreviewMediaReady("video", state.previewVideoEl.currentSrc || state.previewVideoEl.src || "");
    });
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
      try {
        setUploadingState(state, true);
        const uploadedUrl = await uploadEditorAsset({
          file,
          variant: "original",
          source: "api"
        });
        const { kind, ext } = classifyByNameAndType(file.name, file.type);
        state.root.dataset.localName = file.name;
        setMetaValue(state, { name: file.name, mime: file.type || "", source: "user" }, true);
        setHeaderWithFile(state, file.name, false);
        setPreview(state, {
          kind,
          previewUrl: kind === "image" || kind === "video" ? uploadedUrl : void 0,
          name: file.name,
          ext,
          hasFile: true
        });
        setFileKey(state, uploadedUrl, true);
        clearError(state);
      } catch (error2) {
        const message = error2 instanceof Error ? error2.message : "coreui.errors.assets.uploadFailed";
        setError(state, message);
      } finally {
        setUploadingState(state, false);
        state.fileInput.value = "";
      }
    });
  }
  function setUploadingState(state, uploading) {
    state.root.dataset.uploading = uploading ? "true" : "false";
    state.uploadButton.disabled = uploading;
    state.replaceButton.disabled = uploading;
    state.removeButton.disabled = uploading;
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
    if (/^https?:\/\//i.test(v) || v.startsWith("/")) return v;
    const m = v.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
    if (m && m[2]) {
      const extracted = m[2].trim();
      if (/^https?:\/\//i.test(extracted) || extracted.startsWith("/")) return extracted;
    }
    return null;
  }
  function looksLikeUrl(raw) {
    const url = extractPrimaryUrl(raw);
    return Boolean(url && (/^https?:\/\//i.test(url) || url.startsWith("/")));
  }
  function sameAssetUrl(leftRaw, rightRaw) {
    const left = normalizeUrlForCompare(leftRaw);
    const right = normalizeUrlForCompare(rightRaw);
    if (!left || !right) return false;
    return left === right;
  }
  function normalizeUrlForCompare(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    try {
      const parsed = new URL(value, window.location.href);
      return parsed.toString();
    } catch {
      return value;
    }
  }
  function previewFromUrl(state, raw, name, kindName, mime) {
    const url = extractPrimaryUrl(raw);
    if (!url) return;
    const ext = (guessExtFromName(kindName) || "").toLowerCase();
    const kind = classifyByNameAndType(kindName || "file", mime).kind;
    setPreview(state, { kind, previewUrl: url, name, ext, hasFile: true });
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
    const fallbackName = expectsMeta ? "" : state.root.dataset.localName || guessNameFromUrl(rawUrl) || rawUrl || key || "Uploaded file";
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
    if (looksLikeUrl(key)) {
      setHeaderWithFile(state, displayName, false);
      previewFromUrl(state, key, displayName, kindName || displayName, metaMime);
      return;
    }
    setPreview(state, { kind: "unknown", previewUrl: void 0, name: "", ext: "", hasFile: true });
    setHeaderWithFile(state, "Invalid value", true);
    setError(state, "Unsupported value. Expected an absolute URL (http/https) or root-relative path.");
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
    const parsed = parseCanonicalAssetRef(cleaned);
    if (parsed && (parsed.kind === "pointer" || stem === "original" || stem === "grayscale")) {
      const ext = guessExtFromName(filename);
      const shortId = parsed.assetId.replace(/-/g, "").slice(0, 8);
      return ext ? `asset-${shortId}.${ext}` : `asset-${shortId}`;
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
