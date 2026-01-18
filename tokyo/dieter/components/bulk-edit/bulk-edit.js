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

  // components/bulk-edit/bulk-edit.ts
  var bulk_edit_exports = {};
  __export(bulk_edit_exports, {
    hydrateBulkEdit: () => hydrateBulkEdit
  });
  function decodeHtmlEntities(value) {
    return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  }
  function escapeAttr(value) {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function parseMetaValue(raw) {
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
  function extractFileNameFromValue(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    const urlMatch = trimmed.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
    const candidate = urlMatch?.[2] || trimmed;
    const base = candidate.split("?")[0].split("#")[0];
    const parts = base.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
  }
  function stripFileExtension(name) {
    const trimmed = name.trim();
    if (!trimmed) return "";
    const lastDot = trimmed.lastIndexOf(".");
    if (lastDot <= 0) return trimmed;
    return trimmed.slice(0, lastDot);
  }
  function findBulkInput(scope, path) {
    if (!path) return null;
    const inputs = Array.from(scope.querySelectorAll("[data-bulk-path]"));
    return inputs.find((input) => input.getAttribute("data-bulk-path") === path) || null;
  }
  function wireAutoNameSync(uploadRoot, row, namePath) {
    const metaInput = uploadRoot.querySelector(".diet-dropdown-upload__meta-field");
    const valueInput = uploadRoot.querySelector(".diet-dropdown-upload__value-field");
    if (!metaInput || !namePath) return;
    const deriveName = () => {
      const meta = parseMetaValue(metaInput.value || "");
      const metaName = typeof meta?.name === "string" ? meta.name.trim() : "";
      if (metaName) return stripFileExtension(metaName);
      const rawValue = valueInput?.value || valueInput?.getAttribute("value") || "";
      const fileName = extractFileNameFromValue(rawValue);
      return stripFileExtension(fileName);
    };
    const sync = () => {
      const nameInput = findBulkInput(row, namePath);
      if (!nameInput) return;
      const nextName = deriveName();
      if (!nextName) return;
      const current = nameInput.value.trim();
      const prevAuto = nameInput.dataset.autoName || "";
      if (!prevAuto && current && current === nextName) {
        nameInput.dataset.autoName = current;
      }
      const effectivePrev = nameInput.dataset.autoName || "";
      if (!current || current === effectivePrev) {
        if (current !== nextName) {
          nameInput.value = nextName;
          nameInput.dataset.autoName = nextName;
          nameInput.dispatchEvent(new Event("input", { bubbles: true }));
        } else if (!effectivePrev) {
          nameInput.dataset.autoName = nextName;
        }
      }
    };
    const prime = () => {
      const nameInput = findBulkInput(row, namePath);
      if (!nameInput) return;
      const nextName = deriveName();
      if (!nextName) return;
      const current = nameInput.value.trim();
      if (!current || current === nextName) {
        nameInput.dataset.autoName = nextName;
      }
    };
    metaInput.addEventListener("input", sync);
    metaInput.addEventListener("external-sync", sync);
    prime();
    sync();
  }
  function parseColumns(raw) {
    if (!raw) return [];
    const decoded = decodeHtmlEntities(raw);
    try {
      const parsed = JSON.parse(decoded);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((entry) => Boolean(entry && typeof entry === "object"));
    } catch {
      return [];
    }
  }
  function readPolicyFlags(root) {
    const container = root.closest("[data-ck-policy-flags]");
    if (!container) return null;
    const raw = container.getAttribute("data-ck-policy-flags");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  }
  function isFlagEnabled(flags, key) {
    if (!flags) return true;
    return flags[key] === true;
  }
  function readJsonArray(input) {
    const raw = input.value || input.getAttribute("data-bob-json") || "[]";
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function buildRows(path, rowPath, strips) {
    const rows = [];
    if (!Array.isArray(strips)) return rows;
    strips.forEach((strip, stripIndex) => {
      if (!strip || typeof strip !== "object") return;
      const record = strip;
      const nested = record[rowPath];
      if (!Array.isArray(nested)) return;
      nested.forEach((entry, rowIndex) => {
        if (!entry || typeof entry !== "object") return;
        rows.push({
          pathPrefix: `${path}.${stripIndex}.${rowPath}.${rowIndex}`,
          data: entry
        });
      });
    });
    return rows;
  }
  function renderEmpty(tableWrap, label) {
    tableWrap.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "diet-bulk-edit__empty";
    empty.textContent = label || "No rows available";
    tableWrap.appendChild(empty);
  }
  function renderTable(tableWrap, rows, columns, flags, emptyLabel) {
    tableWrap.innerHTML = "";
    if (rows.length === 0) {
      renderEmpty(tableWrap, emptyLabel);
      return;
    }
    const visibleColumns = columns.filter((col) => {
      if (!col.flag) return true;
      return isFlagEnabled(flags, col.flag);
    });
    if (visibleColumns.length === 0) {
      renderEmpty(tableWrap, "No editable fields available");
      return;
    }
    const table = document.createElement("table");
    table.className = "diet-bulk-edit__table";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    visibleColumns.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col.label || "";
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      visibleColumns.forEach((col, colIndex) => {
        const td = document.createElement("td");
        const controlType = (col.control || "text").toLowerCase();
        const path = col.path || "";
        const value = path ? row.data[path] : void 0;
        if (controlType === "logo") {
          const wrap = document.createElement("div");
          wrap.className = "diet-bulk-edit__logo";
          const preview = document.createElement("div");
          preview.className = "diet-bulk-edit__logo-preview";
          if (typeof value === "string" && value.trim()) {
            preview.style.background = value;
          }
          const name = document.createElement("div");
          name.className = "diet-bulk-edit__logo-name";
          const labelPath = col.labelPath || "name";
          const nameValue = row.data[labelPath];
          name.textContent = typeof nameValue === "string" ? nameValue : "";
          wrap.appendChild(preview);
          wrap.appendChild(name);
          td.appendChild(wrap);
          tr.appendChild(td);
          return;
        }
        if (controlType === "upload") {
          const upload = buildUploadControl({
            id: `bulk-upload-${rowIndex}-${colIndex}`,
            label: col.label || "Logo",
            placeholder: col.placeholder || "Upload logo",
            path: path ? `${row.pathPrefix}.${path}` : "",
            metaPath: col.metaPath ? `${row.pathPrefix}.${col.metaPath}` : "",
            accept: col.accept || "image/*,.svg",
            value: typeof value === "string" ? value : "",
            meta: col.metaPath ? row.data[col.metaPath] : null
          });
          const wrap = document.createElement("div");
          wrap.className = "diet-bulk-edit__upload";
          wrap.appendChild(upload);
          td.appendChild(wrap);
          tr.appendChild(td);
          if (col.autoNamePath) {
            wireAutoNameSync(upload, tr, `${row.pathPrefix}.${col.autoNamePath}`);
          }
          return;
        }
        if (controlType === "checkbox" || controlType === "toggle") {
          const input2 = document.createElement("input");
          input2.type = "checkbox";
          input2.className = "diet-bulk-edit__checkbox";
          input2.checked = value === true;
          if (path) input2.setAttribute("data-bulk-path", `${row.pathPrefix}.${path}`);
          input2.setAttribute("aria-label", col.label || path);
          td.appendChild(input2);
          tr.appendChild(td);
          return;
        }
        const input = document.createElement("input");
        input.type = "text";
        input.className = "diet-bulk-edit__input";
        input.value = value == null ? "" : String(value);
        if (col.placeholder) input.placeholder = col.placeholder;
        if (path) input.setAttribute("data-bulk-path", `${row.pathPrefix}.${path}`);
        input.setAttribute("aria-label", col.label || path);
        td.appendChild(input);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    hydrateUploadControls(tableWrap);
  }
  function dispatchUpsell(root, reasonKey) {
    root.dispatchEvent(
      new CustomEvent("bob-upsell", {
        detail: { reasonKey },
        bubbles: true
      })
    );
  }
  function hydrateBulkEdit(scope) {
    scope.querySelectorAll(".diet-bulk-edit").forEach((root) => {
      if (root.dataset.bulkEditHydrated === "true") return;
      root.dataset.bulkEditHydrated = "true";
      const openBtn = root.querySelector("[data-bulk-open]");
      const modal = root.querySelector("[data-bulk-modal]");
      const tableWrap = root.querySelector("[data-bulk-table]");
      const closeBtn = root.querySelector("[data-bulk-close]");
      const cancelBtn = root.querySelector("[data-bulk-cancel]");
      const saveBtn = root.querySelector("[data-bulk-save]");
      const hidden = root.querySelector(".diet-bulk-edit__field");
      if (!openBtn || !modal || !tableWrap || !saveBtn || !hidden) return;
      const columns = parseColumns(root.getAttribute("data-columns"));
      const rowPath = root.getAttribute("data-row-path") || "";
      const path = root.getAttribute("data-bulk-path") || root.getAttribute("data-path") || "";
      const render = () => {
        const strips = readJsonArray(hidden);
        const rows = buildRows(path, rowPath, strips);
        const flags = readPolicyFlags(root);
        const emptyLabel = root.getAttribute("data-empty-label");
        renderTable(tableWrap, rows, columns, flags, emptyLabel);
      };
      const openModal = () => {
        const flags = readPolicyFlags(root);
        const allowLinks = isFlagEnabled(flags, "links.enabled");
        const allowMeta = isFlagEnabled(flags, "media.meta.enabled");
        if (!allowLinks && !allowMeta) {
          dispatchUpsell(root, "coreui.upsell.reason.flagBlocked");
          return;
        }
        render();
        modal.hidden = false;
        const firstInput = modal.querySelector("input");
        if (firstInput) firstInput.focus({ preventScroll: true });
        document.addEventListener("keydown", handleKeydown);
      };
      const closeModal = () => {
        modal.hidden = true;
        document.removeEventListener("keydown", handleKeydown);
      };
      const handleKeydown = (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        closeModal();
      };
      const save = () => {
        const inputs = Array.from(modal.querySelectorAll("[data-bulk-path]"));
        const ops = inputs.map((input) => {
          const targetPath = input.getAttribute("data-bulk-path");
          if (!targetPath) return null;
          const value = input.type === "checkbox" ? input.checked : input.value;
          return { op: "set", path: targetPath, value };
        }).filter(Boolean);
        if (ops.length > 0) {
          root.dispatchEvent(
            new CustomEvent("bob-ops", {
              detail: { ops },
              bubbles: true
            })
          );
        }
        closeModal();
      };
      openBtn.addEventListener("click", openModal);
      closeBtn?.addEventListener("click", closeModal);
      cancelBtn?.addEventListener("click", closeModal);
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
      });
      saveBtn.addEventListener("click", save);
    });
  }
  function hydrateUploadControls(scope) {
    const anyWindow = window;
    const hydrate = anyWindow?.Dieter?.hydrateDropdownUpload;
    if (typeof hydrate === "function") {
      hydrate(scope);
    }
  }
  function buildUploadControl(args) {
    const root = document.createElement("div");
    root.className = "diet-dropdown-upload diet-popover-host";
    root.dataset.size = "md";
    root.dataset.state = "closed";
    const label = escapeAttr(args.label || "Logo");
    const placeholder = escapeAttr(args.placeholder || "Upload");
    const id = escapeAttr(args.id);
    const path = escapeAttr(args.path || "");
    const metaPath = escapeAttr(args.metaPath || "");
    const accept = escapeAttr(args.accept || "image/*");
    const value = escapeAttr(args.value || "");
    const metaValue = args.meta ? escapeAttr(JSON.stringify(args.meta)) : "";
    const metaAttr = metaPath ? ` data-bob-path="${metaPath}"` : "";
    root.innerHTML = `
    <input
      id="${id}"
      type="hidden"
      class="diet-dropdown-upload__value-field"
      value="${value}"
      data-bob-path="${path}"
      data-placeholder="${placeholder}"
      data-accept="${accept}"
    />
    <input
      type="hidden"
      class="diet-dropdown-upload__meta-field"
      value="${metaValue}"
      ${metaAttr}
      data-bob-json
    />
    <div
      class="diet-dropdown-header diet-dropdown-upload__control"
      role="button"
      aria-haspopup="dialog"
      aria-expanded="false"
      aria-labelledby="${id}-label"
    >
      <span class="diet-dropdown-header-label label-s" id="${id}-label">${label}</span>
      <span class="diet-dropdown-header-value body-s" data-muted="true" data-placeholder="${placeholder}">
        <span class="diet-dropdown-upload__label">${placeholder}</span>
      </span>
    </div>
    <div class="diet-popover diet-dropdown-upload__popover" role="dialog" aria-label="${label}" data-state="closed">
      <div class="diet-popover__header">
        <span class="diet-popover__header-label label-s">${label}</span>
        <button
          type="button"
          class="diet-btn-ic diet-popover__header-trigger"
          data-size="sm"
          data-variant="neutral"
          aria-hidden="true"
          tabindex="-1"
        >
          <span class="diet-btn-ic__icon" data-icon="paintbrush"></span>
        </button>
      </div>
      <div class="diet-popover__body">
        <div class="diet-dropdown-upload__panel body-xs" data-has-file="false" data-kind="empty">
          <div class="diet-dropdown-upload__preview" aria-hidden="true">
            <div class="diet-dropdown-upload__preview-frame">
              <img class="diet-dropdown-upload__preview-img" data-role="img" alt="" />
              <div class="diet-dropdown-upload__preview-video" data-role="video">
                <video
                  class="diet-dropdown-upload__preview-video-el"
                  data-role="videoEl"
                  muted
                  playsinline
                  preload="metadata"
                ></video>
                <div class="diet-dropdown-upload__preview-video-badge label-s">Video</div>
              </div>
              <div class="diet-dropdown-upload__preview-doc" data-role="doc">
                <button
                  type="button"
                  class="diet-btn-ic diet-dropdown-upload__preview-doc-icon"
                  data-size="xl"
                  data-variant="neutral"
                  aria-hidden="true"
                  tabindex="-1"
                >
                  <span class="diet-btn-ic__icon" data-icon="document"></span>
                </button>
                <div class="diet-dropdown-upload__preview-doc-ext label-s" data-role="ext"></div>
              </div>
              <div class="diet-dropdown-upload__preview-empty" data-role="empty">
                <button
                  type="button"
                  class="diet-btn-ic diet-dropdown-upload__preview-empty-icon"
                  data-size="xl"
                  data-variant="neutral"
                  aria-hidden="true"
                  tabindex="-1"
                >
                  <span class="diet-btn-ic__icon" data-icon="square.dashed"></span>
                </button>
              </div>
            </div>
            <div class="diet-dropdown-upload__preview-meta">
              <div class="diet-dropdown-upload__preview-name label-s" data-role="name"></div>
              <div class="diet-dropdown-upload__preview-error label-xs" data-role="error"></div>
            </div>
          </div>
          <div class="diet-dropdown-upload__actions">
            <button type="button" class="diet-btn-txt diet-dropdown-upload__upload-btn" data-size="lg" data-variant="line1">
              <span class="diet-btn-txt__label">Upload</span>
            </button>
            <div class="diet-dropdown-upload__file-controls">
              <button type="button" class="diet-btn-txt diet-dropdown-upload__replace-btn" data-size="lg" data-variant="line1">
                <span class="diet-btn-txt__label">Replace</span>
              </button>
              <button type="button" class="diet-btn-txt diet-dropdown-upload__remove-btn" data-size="lg" data-variant="neutral">
                <span class="diet-btn-txt__label">Remove</span>
              </button>
            </div>
          </div>
          <input type="file" class="diet-dropdown-upload__file-input" accept="${accept}" aria-hidden="true" tabindex="-1" />
        </div>
      </div>
    </div>
  `;
    return root;
  }
  return __toCommonJS(bulk_edit_exports);
})();
window.Dieter = { ...__prevDieter, ...Dieter };
