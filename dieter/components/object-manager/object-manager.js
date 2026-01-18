// Object manager: array-only controller (add + modal reorder/delete).
// Slot any per-item editor inside via the template (__INDEX__ replaced).
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  function createId() {
    if (typeof crypto === "undefined" || !crypto) {
      throw new Error("[object-manager] crypto unavailable");
    }
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues !== "function") {
      throw new Error("[object-manager] crypto.getRandomValues unavailable");
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function ensureIdsDeep(value) {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return;
        if (!item.id) item.id = createId();
        Object.values(item).forEach(ensureIdsDeep);
      });
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(ensureIdsDeep);
    }
  }

  function deepClone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  function parseJsonArray(value) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error("[object-manager] Missing JSON array value");
    }
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error("[object-manager] Expected JSON array");
    }
    return parsed;
  }

  function stringify(value) {
    return JSON.stringify(value);
  }

  function decodeHtmlEntities(value) {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  function getAt(obj, path) {
    if (!path) return undefined;
    const parts = path.split(".").filter(Boolean);
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  function setAt(obj, path, value) {
    const parts = String(path || "").split(".").filter(Boolean);
    if (!parts.length) return obj;
    let cur = obj;
    for (let i = 0; i < parts.length; i += 1) {
      const key = parts[i];
      const last = i === parts.length - 1;
      if (last) {
        cur[key] = value;
      } else {
        const next = cur[key];
        const nextObj = next && typeof next === "object" && !Array.isArray(next) ? next : {};
        cur[key] = nextObj;
        cur = nextObj;
      }
    }
    return obj;
  }

  function runChildHydrators(scope) {
    if (typeof window === "undefined" || !window.Dieter) return;
    const entries = Object.entries(window.Dieter).filter(
      ([name, fn]) =>
        typeof fn === "function" &&
        name.toLowerCase().startsWith("hydrate") &&
        name.toLowerCase() !== "hydrateall" &&
        name.toLowerCase() !== "hydrateobjectmanager"
    );
    entries.forEach(([, fn]) => {
      try {
        fn(scope);
      } catch (err) {
        if (process.env && process.env.NODE_ENV === "development") {
          console.warn("[object-manager] child hydrator error", err);
        }
      }
    });
  }

  function hydrateObjectManager(scope) {
    const roots = scope.querySelectorAll(".diet-object-manager");
    roots.forEach((root) => {
      if (root.dataset.hydrated === "true") return;
      root.dataset.hydrated = "true";
      const hidden = root.querySelector(".diet-object-manager__field");
      const list = root.querySelector("[data-objects-list]");
      const addBtn = root.querySelector("[data-objects-add]");
      const manageBtn = root.querySelector("[data-objects-manage]");
      const tpl = root.querySelector("template[data-objects-item]");
      const modal = root.querySelector(".diet-object-manager__modal");
      const modalList = root.querySelector("[data-objects-modal-list]");
      const rowTpl = root.querySelector("template[data-objects-row]");
      const saveBtn = root.querySelector("[data-objects-save]");
      const cancelBtn = root.querySelector("[data-objects-cancel]");
      if (
        !hidden ||
        !list ||
        !addBtn ||
        !manageBtn ||
        !tpl ||
        !modal ||
        !modalList ||
        !rowTpl ||
        !saveBtn ||
        !cancelBtn
      ) {
        return;
      }
      const indexToken = (root.getAttribute("data-index-token") || "__INDEX__").trim();
      const labelPath = root.getAttribute("data-label-path") || "";
      const defaultItemAttr = root.getAttribute("data-default-item") || "";
      let defaultItem = null;
      if (defaultItemAttr) {
        const decoded = decodeHtmlEntities(defaultItemAttr);
        defaultItem = JSON.parse(decoded);
      }

      const read = () => {
        const raw = hidden.value || hidden.getAttribute("value") || hidden.getAttribute("data-bob-json") || "[]";
        return parseJsonArray(raw);
      };

      const write = (value) => {
        const json = stringify(value);
        hidden.value = json;
        hidden.setAttribute("data-bob-json", json);
        hidden.dispatchEvent(new Event("input", { bubbles: true }));
      };

      const getSignature = (items) => {
        if (!Array.isArray(items)) return "invalid";
        const ids = items.map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return "";
          const id = item.id;
          return typeof id === "string" ? id : "";
        });
        return `${items.length}:${ids.join("|")}`;
      };

      let lastSignature = null;

      const render = () => {
        const items = read();
        lastSignature = getSignature(items);
        list.innerHTML = "";
        const templateHtml = tpl.innerHTML || "";
        const basePath = hidden.getAttribute("data-bob-path") || hidden.getAttribute("data-path") || "";
        items.forEach((itemData, idx) => {
          const container = document.createElement("div");
          container.className = "diet-object-manager__item";
          container.setAttribute("data-object-index", String(idx));
          const html = templateHtml.replace(new RegExp(indexToken, "g"), String(idx));
          container.innerHTML = html;
          // Populate bound fields with current item data so nested controls show defaults immediately.
          const bindings = container.querySelectorAll("[data-bob-path]");
          bindings.forEach((el) => {
            const path = el.getAttribute("data-bob-path") || "";
            const prefix = basePath ? `${basePath}.${idx}.` : "";
            if (!prefix || !path.startsWith(prefix)) return;
            const sub = path.slice(prefix.length);
            const val = getAt(itemData, sub);
            if (val == null) return;
            if (el instanceof HTMLInputElement) {
              if (el.type === "checkbox") {
                el.checked = Boolean(val);
                return;
              }
              if (el.dataset.bobJson != null) {
                const json = stringify(val);
                el.value = json;
                el.setAttribute("data-bob-json", json);
                return;
              }
              if (el.type === "hidden" && Array.isArray(val)) {
                const json = stringify(val);
                el.value = json;
                el.setAttribute("data-bob-json", json);
                return;
              }
              el.value = String(val);
              return;
            }
            if (el instanceof HTMLTextAreaElement) {
              el.value = String(val);
            }
          });
          list.appendChild(container);
        });
        // Hydrate any nested components (e.g., repeaters) inside new items.
        runChildHydrators(list);
        const canManage = items.length > 1;
        manageBtn.hidden = !canManage;
        manageBtn.style.display = canManage ? "" : "none";
      };

      const handleExternalSync = (ev) => {
        if (!ev || ev.type !== "external-sync") return;
        try {
          const payload = ev.detail && typeof ev.detail.value !== "undefined" ? ev.detail.value : hidden.value;
          const nextJson = typeof payload === "string" ? payload : stringify(payload);
          hidden.value = nextJson;
          hidden.setAttribute("data-bob-json", nextJson);

          const nextItems = parseJsonArray(nextJson);
          const nextSignature = getSignature(nextItems);
          if (nextSignature !== lastSignature) {
            render();
          }
        } catch (err) {
          if (process.env && process.env.NODE_ENV === "development") {
            console.warn("[object-manager] external sync failed", err);
          }
        }
      };

      hidden.addEventListener("external-sync", handleExternalSync);

      const handleNestedChange = (event) => {
        const detail = event && event.detail;
        if (detail && detail.bobIgnore) return;
        const target = event.target;
        if (
          !(target instanceof HTMLInputElement) &&
          !(target instanceof HTMLTextAreaElement) &&
          !(target instanceof HTMLSelectElement)
        ) {
          return;
        }
        if (target === hidden) return;
        const basePath = hidden.getAttribute("data-bob-path") || hidden.getAttribute("data-path") || "";
        if (!basePath) return;
        const path = target.getAttribute("data-bob-path") || "";
        if (!path || !path.startsWith(`${basePath}.`)) return;
        const remainder = path.slice(basePath.length + 1);
        const parts = remainder.split(".");
        const indexToken = parts.shift();
        if (!indexToken || !/^\d+$/.test(indexToken) || parts.length === 0) return;
        const idx = Number(indexToken);
        const items = read();
        const item = items[idx];
        if (!item || typeof item !== "object" || Array.isArray(item)) return;
        let nextValue;
        if (target instanceof HTMLInputElement && target.type === "checkbox") {
          nextValue = target.checked;
        } else if (target instanceof HTMLInputElement && target.dataset.bobJson != null) {
          try {
            nextValue = JSON.parse(target.value || "");
          } catch {
            return;
          }
        } else {
          nextValue = target.value;
        }
        setAt(item, parts.join("."), nextValue);
        write(items);
      };

      root.addEventListener("input", handleNestedChange, true);
      root.addEventListener("change", handleNestedChange, true);

      addBtn.addEventListener("click", () => {
        const next = read();
        let item = defaultItem ? deepClone(defaultItem) : {};
        if (!item || typeof item !== "object" || Array.isArray(item)) item = {};
        if (!item.id) item.id = createId();
        ensureIdsDeep(item);
        next.push(item);
        write(next);
        render();
      });

      manageBtn.addEventListener("click", () => {
        const items = read();
        modalList.innerHTML = "";
        const rowTemplate = rowTpl.content.firstElementChild;
        if (!rowTemplate) return;
        const working = items.map((item) => item);

        const rebuildRows = () => {
          modalList.innerHTML = "";
          working.forEach((item, idx) => {
            const row = rowTemplate.cloneNode(true);
            const labelEl = row.querySelector("[data-objects-label]");
            const labelVal = getAt(item, labelPath) || `Object ${idx + 1}`;
            if (labelEl) labelEl.textContent = labelVal;
            const up = row.querySelector("[data-objects-up]");
            const down = row.querySelector("[data-objects-down]");
            const del = row.querySelector("[data-objects-delete]");
            up?.addEventListener("click", () => {
              if (idx === 0) return;
              const [moved] = working.splice(idx, 1);
              working.splice(idx - 1, 0, moved);
              rebuildRows();
            });
            down?.addEventListener("click", () => {
              if (idx >= working.length - 1) return;
              const [moved] = working.splice(idx, 1);
              working.splice(idx + 1, 0, moved);
              rebuildRows();
            });
            del?.addEventListener("click", () => {
              working.splice(idx, 1);
              rebuildRows();
            });
            modalList.appendChild(row);
          });
        };

        rebuildRows();
        modal.hidden = false;

        const close = () => {
          modal.hidden = true;
        };

        saveBtn.onclick = () => {
          write(working);
          render();
          close();
        };
        cancelBtn.onclick = () => close();
        modal.addEventListener("click", (ev) => {
          if (ev.target === modal) close();
        });
      });

      render();
    });
  }

  hydrateObjectManager(document);
  if (window.Dieter) {
    window.Dieter.hydrateObjectManager = hydrateObjectManager;
  }
})();
