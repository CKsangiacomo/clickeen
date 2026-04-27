var __prevDieter = window.Dieter ? { ...window.Dieter } : {};
(function () {
  const registry = new WeakMap();

  function createId() {
    if (typeof crypto === "undefined" || !crypto) {
      throw new Error("[diet-repeater] crypto unavailable");
    }
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues !== "function") {
      throw new Error("[diet-repeater] crypto.getRandomValues unavailable");
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function decodeHtmlEntities(value) {
    return String(value || "")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
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
    const decoded = decodeHtmlEntities(value);
    if (!decoded) {
      throw new Error("[diet-repeater] Missing JSON array value");
    }
    const parsed = JSON.parse(decoded);
    if (!Array.isArray(parsed)) {
      throw new Error("[diet-repeater] Expected JSON array");
    }
    return parsed;
  }

  function parseJsonValue(value) {
    const decoded = decodeHtmlEntities(value);
    if (!decoded) return null;
    try {
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  function stringify(value) {
    return JSON.stringify(value);
  }

  function diffArrays(prev, next) {
    if (!Array.isArray(prev) || !Array.isArray(next)) {
      return { structuralChange: true, valueChanges: [] };
    }
    if (prev.length !== next.length) {
      return { structuralChange: true, valueChanges: [] };
    }
    const valueChanges = [];
    for (let i = 0; i < next.length; i++) {
      const prevItem = prev[i];
      const nextItem = next[i];
      const prevId = prevItem && prevItem.id;
      const nextId = nextItem && nextItem.id;
      if ((prevId || nextId) && prevId !== nextId) {
        return { structuralChange: true, valueChanges: [] };
      }
      if (JSON.stringify(prevItem) !== JSON.stringify(nextItem)) {
        valueChanges.push({ index: i, nextItem });
      }
    }
    if (valueChanges.length === 0) {
      return { structuralChange: false, valueChanges };
    }
    const signature = (item) => `${typeof item}:${stringify(item)}`;
    const sameCounts = (a, b) => {
      if (a.length !== b.length) return false;
      const counts = new Map();
      a.forEach((sig) => {
        counts.set(sig, (counts.get(sig) || 0) + 1);
      });
      for (const sig of b) {
        const nextCount = (counts.get(sig) || 0) - 1;
        if (nextCount < 0) return false;
        counts.set(sig, nextCount);
      }
      return Array.from(counts.values()).every((v) => v === 0);
    };
    const prevSignatures = prev.map(signature);
    const nextSignatures = next.map(signature);
    if (!valueChanges.length) {
      return { structuralChange: false, valueChanges };
    }
    if (sameCounts(prevSignatures, nextSignatures)) {
      return { structuralChange: true, valueChanges: [] };
    }
    return { structuralChange: false, valueChanges };
  }

  function inferItemKind(state) {
    const arr = Array.isArray(state.value) ? state.value : [];
    const first = arr[0];
    if (first && typeof first === "object" && !Array.isArray(first)) return "object";
    if (typeof first === "string" || typeof first === "number" || typeof first === "boolean") return "primitive";

    const arrayPath = state.hidden.getAttribute("data-bob-path") || state.hidden.getAttribute("data-path") || "";
    if (!arrayPath) return "object";
    const token = "__INDEX__";
    if (typeof state.template === "string") {
      if (state.template.includes(`${arrayPath}.${token}.`)) return "object";
      if (state.template.includes(`${arrayPath}.${token}`)) return "primitive";
    }
    return "object";
  }

  function setAt(obj, path, value) {
    const parts = String(path || "")
      .split(".")
      .filter(Boolean);
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

  function deriveDefaultObjectFromPrototype(proto) {
    const out = {};
    Object.keys(proto || {}).forEach((key) => {
      if (key === "id") return;
      const val = proto[key];
      if (typeof val === "boolean") out[key] = false;
      else if (typeof val === "number") out[key] = 0;
      else if (Array.isArray(val)) out[key] = [];
      else if (val && typeof val === "object") out[key] = {};
      else out[key] = "";
    });
    return out;
  }

  function deriveDefaultObjectFromTemplate(state) {
    const arrayPath = state.hidden.getAttribute("data-bob-path") || state.hidden.getAttribute("data-path") || "";
    if (!arrayPath || typeof state.template !== "string") return {};
    const html = state.template.replace(/__INDEX__/g, "0");
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    const prefix = `${arrayPath}.0.`;
    const out = {};
    wrapper.querySelectorAll("[data-bob-path]").forEach((node) => {
      const nodePath = node.getAttribute("data-bob-path") || "";
      if (!nodePath.startsWith(prefix)) return;
      const rel = nodePath.slice(prefix.length);
      if (!rel) return;
      if (node instanceof HTMLInputElement && node.type === "checkbox") {
        setAt(out, rel, false);
        return;
      }
      if (node instanceof HTMLInputElement && node.dataset.bobJson != null) {
        setAt(out, rel, []);
        return;
      }
      setAt(out, rel, "");
    });
    return out;
  }

  function buildDefaultObjectItem(state) {
    if (state.defaultItem && typeof state.defaultItem === "object" && !Array.isArray(state.defaultItem)) {
      return deepClone(state.defaultItem);
    }
    const proto =
      Array.isArray(state.value) &&
      state.value.find((item) => item && typeof item === "object" && !Array.isArray(item));
    if (proto) return deriveDefaultObjectFromPrototype(proto);
    return deriveDefaultObjectFromTemplate(state);
  }

  function cloneIcon(root, selector) {
    const icon = root.querySelector(selector);
    return icon ? icon.cloneNode(true) : null;
  }

  function hydrateRepeater(scope) {
    const roots = scope.querySelectorAll(".diet-repeater");
    roots.forEach((root) => {
      if (registry.has(root)) return;
      const hidden = root.querySelector(".diet-repeater__field");
      const list = root.querySelector("[data-repeater-list]");
      const templateEl = root.querySelector("template[data-repeater-item]");
      const addBtn = root.querySelector(".diet-repeater__add");
      const reorderBtn = root.querySelector(".diet-repeater__reorder");
      if (!hidden || !list || !templateEl || !addBtn || !reorderBtn) return;
      const syncReorderControls = () => {
        root.dataset.reorder = state.reorder ? "on" : "off";
        reorderBtn.setAttribute("aria-pressed", state.reorder ? "true" : "false");
        reorderBtn.setAttribute("data-variant", state.reorder ? "secondary" : "neutral");
      };

      const state = {
        root,
        hidden,
        list,
        template: templateEl.innerHTML || "",
        addBtn,
        reorderBtn,
        reorder: root.dataset.reorder === "on",
        value: parseJsonArray(hidden.value),
        defaultItem: null,
        iconHandle: cloneIcon(root, ".diet-repeater__icon-handle"),
        iconTrash: cloneIcon(root, ".diet-repeater__icon-trash"),
      };

      const defaultItemAttr = root.getAttribute("data-default-item") || "";
      if (defaultItemAttr) {
        state.defaultItem = JSON.parse(decodeHtmlEntities(defaultItemAttr));
      }
      registry.set(root, state);
      syncReorderControls();
      render(state);

      const handleFieldChange = (event) => {
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
        const arrayPath = hidden.getAttribute("data-bob-path") || hidden.getAttribute("data-path") || "";
        if (!arrayPath) return;
        const path = target.getAttribute("data-bob-path") || "";
        if (!path || !path.startsWith(`${arrayPath}.`)) return;
        const remainder = path.slice(arrayPath.length + 1);
        const parts = remainder.split(".");
        const indexToken = parts.shift();
        if (!indexToken || !/^\d+$/.test(indexToken) || parts.length === 0) return;
        if (!Array.isArray(state.value)) return;
        const idx = Number(indexToken);
        const item = state.value[idx];
        if (!item || typeof item !== "object" || Array.isArray(item)) return;
        let nextValue;
        if (target instanceof HTMLInputElement && target.type === "checkbox") {
          nextValue = target.checked;
        } else if (target instanceof HTMLInputElement && target.dataset.bobJson != null) {
          const parsed = parseJsonValue(target.value || "");
          if (parsed == null) return;
          nextValue = parsed;
        } else {
          nextValue = target.value;
        }
        setAt(item, parts.join("."), nextValue);
      };

      root.addEventListener("input", handleFieldChange, true);
      root.addEventListener("change", handleFieldChange, true);

      const openAddTarget = () => {
        const openTarget = root.dataset.addOpen;
        if (!openTarget) return;
        const scope = root.closest(".tdmenucontent") || root.closest(".tooldrawer") || document;
        let target = null;
        if (openTarget === "bulk-edit") {
          target = scope.querySelector(".diet-bulk-edit [data-bulk-open]");
        } else {
          try {
            target = scope.querySelector(openTarget);
          } catch {
            target = null;
          }
        }
        if (target && typeof target.click === "function") {
          target.click();
        }
      };

      addBtn.addEventListener("click", () => {
        const next = Array.isArray(state.value) ? [...state.value] : [];
        const kind = inferItemKind(state);
        if (kind === "primitive") {
          next.push(typeof state.defaultItem === "string" ? state.defaultItem : "");
        } else {
          const base = buildDefaultObjectItem(state);
          base.id = createId();
          next.push(base);
        }
        state.value = next;
        commit(state);
        if (root.dataset.addOpen) {
          requestAnimationFrame(openAddTarget);
        }
      });

      reorderBtn.addEventListener("click", () => {
        state.reorder = !state.reorder;
        syncReorderControls();
        render(state);
      });

      const handleExternal = (ev) => {
        const payload =
          ev && ev.type === "external-sync" && ev.detail && typeof ev.detail.value !== "undefined"
            ? ev.detail.value
            : hidden.value;
        const next =
          typeof payload === "string"
            ? parseJsonArray(payload)
            : Array.isArray(payload)
              ? payload
              : parseJsonArray(stringify(payload));
        const diff = diffArrays(state.value, next);
        if (diff.structuralChange) {
          state.value = next;
          render(state);
          return;
        }
        if (diff.valueChanges.length > 0) {
          state.value = next;
          syncChangedItems(state, diff.valueChanges);
        }
      };

      hidden.addEventListener("input", handleExternal);
      hidden.addEventListener("change", handleExternal);
      hidden.addEventListener("external-sync", handleExternal);
    });
  }

  function render(state) {
    const { list, template, value, reorder, hidden, root } = state;
    list.innerHTML = "";
    if (!Array.isArray(value)) return;

    value.forEach((_item, index) => {
      const item = document.createElement("div");
      item.className = "diet-repeater__item";
      item.dataset.index = String(index);

      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "diet-btn-ic diet-repeater__item-handle";
      handle.setAttribute("data-size", "sm");
      handle.setAttribute("data-variant", "neutral");
      const handleIcon = state.iconHandle ? state.iconHandle.cloneNode(true) : null;
      if (handleIcon) {
        handle.appendChild(handleIcon);
      }

      const body = document.createElement("div");
      body.className = "diet-repeater__item-body";
      body.innerHTML = template.replace(/__INDEX__/g, String(index));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "diet-btn-ic diet-repeater__item-remove";
      remove.setAttribute("data-size", "sm");
      remove.setAttribute("data-variant", "neutral");
      const removeIcon = state.iconTrash ? state.iconTrash.cloneNode(true) : null;
      if (removeIcon) {
        remove.appendChild(removeIcon);
      }
      remove.addEventListener("click", () => {
        const next = [...state.value];
        next.splice(index, 1);
        state.value = next;
        commit(state);
      });

      const itemValue = Array.isArray(value) ? value[index] : void 0;
      const arrayPath = hidden.getAttribute("data-bob-path") || hidden.getAttribute("data-path") || "";
      const prefix = arrayPath ? `${arrayPath}.${index}.` : "";
      const getAt = (obj, path) => {
        if (!obj || !path) return void 0;
        const parts = path.split(".");
        let cur = obj;
        for (const p of parts) {
          if (cur == null) return void 0;
          cur = cur[p];
        }
        return cur;
      };
      body.querySelectorAll("[data-bob-path]").forEach((el) => {
        const p = el.getAttribute("data-bob-path");
        if (!p) return;
        const rel = prefix && p.startsWith(prefix) ? p.slice(prefix.length) : null;
        const val = rel ? getAt(itemValue, rel) : void 0;
        if (val === void 0) return;
        if (el instanceof HTMLInputElement) {
          if (el.type === "checkbox") {
            el.checked = Boolean(val);
          } else if (el.dataset.bobJson != null) {
            const json = stringify(val);
            el.value = json;
            el.setAttribute("data-bob-json", json);
          } else {
            el.value = String(val);
          }
        } else if ("value" in el) {
          el.value = String(val);
        }
      });

      item.appendChild(handle);
      item.appendChild(body);
      item.appendChild(remove);

      if (reorder) {
        attachReorderVisuals(item);
        installPointerReorder(item, state, index);
      }

      list.appendChild(item);
    });

    runChildHydrators(list);
    if (root) {
      runChildHydrators(root);
    }

    if (!reorder) {
      list.querySelectorAll(".diet-repeater__item").forEach((el) => {
        el.style.borderColor = "";
        el.style.backgroundColor = "";
        el.style.borderWidth = "";
        el.style.borderStyle = "";
        el.style.boxShadow = "";
        el.style.transform = "";
      });
    }
  }

  function updateItemFields(state, itemEl, itemValue, index) {
    const hidden = state.hidden;
    const arrayPath = hidden.getAttribute("data-bob-path") || hidden.getAttribute("data-path") || "";
    const prefix = arrayPath ? `${arrayPath}.${index}.` : "";
    const getAt = (obj, path) => {
      if (!obj || !path) return void 0;
      const parts = path.split(".");
      let cur = obj;
      for (const p of parts) {
        if (cur == null) return void 0;
        cur = cur[p];
      }
      return cur;
    };
    itemEl.querySelectorAll("[data-bob-path]").forEach((el) => {
      const p = el.getAttribute("data-bob-path");
      if (!p) return;
      const rel = prefix && p.startsWith(prefix) ? p.slice(prefix.length) : null;
      const val = rel ? getAt(itemValue, rel) : void 0;
      if (val === void 0) return;
      if (el instanceof HTMLInputElement) {
        if (el.type === "checkbox") {
          const nextChecked = Boolean(val);
          if (el.checked !== nextChecked) {
            el.checked = nextChecked;
          }
        } else if (el.dataset.bobJson != null) {
          const nextVal = stringify(val);
          if (el.value !== nextVal) {
            el.value = nextVal;
            el.setAttribute("data-bob-json", nextVal);
          }
        } else {
          const nextVal = String(val);
          if (el.value !== nextVal) {
            el.value = nextVal;
          }
        }
      } else if ("value" in el) {
        const nextVal = String(val);
        if (el.value !== nextVal) {
          el.value = nextVal;
        }
      }
    });
  }

  function syncChangedItems(state, changes) {
    const { list } = state;
    changes.forEach(({ index, nextItem }) => {
      const itemEl = list.children[index];
      if (!itemEl) return;
      if (itemEl.contains(document.activeElement)) return;
      updateItemFields(state, itemEl, nextItem, index);
    });
  }

  function commit(state) {
    state.hidden.value = stringify(state.value);
    const evt = new Event("input", { bubbles: true });
    state.hidden.dispatchEvent(evt);
    render(state);
  }

  function isInteractive(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (
      target.matches(
        'input, textarea, select, button, [role="button"], label, .diet-toggle__switch, [contenteditable="true"]'
      )
    ) {
      return true;
    }
    return Boolean(
      target.closest(
        'input, textarea, select, button, [role="button"], .diet-toggle__switch, label, [contenteditable="true"]'
      )
    );
  }

  function setItemVisual(item, mode) {
    item.style.borderStyle = "solid";
    item.style.borderWidth = "2px";
    item.style.boxShadow = "none";
    item.style.transition = "border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease";
    if (mode === "drag") {
      item.style.borderColor = "var(--color-system-green)";
      item.style.backgroundColor = "color-mix(in oklab, var(--color-system-green), var(--color-system-white) 85%)";
      item.style.boxShadow = "0 10px 24px color-mix(in oklab, var(--color-system-black), transparent 88%), 0 0 0 2px color-mix(in oklab, var(--color-system-green), transparent 65%)";
      return;
    }
    if (mode === "hover") {
      item.style.borderColor = "var(--color-system-blue)";
      item.style.backgroundColor = "color-mix(in oklab, var(--color-system-blue), var(--color-system-white) 85%)";
      item.style.boxShadow = "none";
      return;
    }
    item.style.borderColor = "var(--color-system-blue)";
    item.style.backgroundColor = "color-mix(in oklab, var(--color-system-blue), var(--color-system-white) 90%)";
    item.style.boxShadow = "none";
  }

  function attachReorderVisuals(item) {
    setItemVisual(item, "base");
    item.addEventListener("mouseenter", () => setItemVisual(item, "hover"));
    item.addEventListener("mouseleave", () => setItemVisual(item, "base"));
  }

  function installPointerReorder(item, state, index) {
    const list = state.list;
    const onPointerDown = (startEvent) => {
      if (startEvent.button !== 0) return;
      if (isInteractive(startEvent.target)) return;
      startEvent.preventDefault();

      const rect = item.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const startLeft = rect.left - listRect.left + list.scrollLeft;
      const startTop = rect.top - listRect.top + list.scrollTop;
      let placeholder = null;
      const items = () => Array.from(list.children).filter((el) => el.classList.contains("diet-repeater__item") || el.classList.contains("diet-repeater__placeholder"));
      const originalPosition = list.style.position;
      if (!originalPosition) {
        list.style.position = "relative";
      }

      const startY = startEvent.clientY;
      let currentIndex = index;
      let hasLifted = false;
      setItemVisual(item, "hover");

      const move = (ev) => {
        ev.preventDefault();
        const deltaY = ev.clientY - startY;

        if (!hasLifted && Math.abs(deltaY) > 4) {
          hasLifted = true;
          placeholder = document.createElement("div");
          placeholder.className = "diet-repeater__placeholder";
          placeholder.style.height = `${rect.height}px`;
          placeholder.style.width = "100%";
          list.insertBefore(placeholder, item);

          setItemVisual(item, "drag");
          item.classList.add("is-dragging");
          item.style.position = "absolute";
          item.style.pointerEvents = "none";
          item.style.width = `${rect.width}px`;
          item.style.left = `${startLeft}px`;
          item.style.top = `${startTop}px`;
          item.style.zIndex = "2";
          item.style.transition = "transform 80ms ease";
          list.appendChild(item);
        }

        if (!placeholder) return;

        const nextTop = startTop + deltaY;
        item.style.transform = `translateY(${nextTop - startTop}px)`;

        const pointerY = ev.clientY;
        let target = placeholder;
        for (const sibling of items()) {
          if (sibling === item || sibling === placeholder) continue;
          const r = sibling.getBoundingClientRect();
          const mid = r.top + r.height / 2;
          if (pointerY < mid) {
            target = sibling;
            break;
          }
        }
        if (target && target !== placeholder) {
          list.insertBefore(placeholder, target);
        } else {
          list.appendChild(placeholder);
        }
        currentIndex = items().indexOf(placeholder);
      };

      const up = (ev) => {
        ev.preventDefault();
        window.removeEventListener("pointermove", move, true);
        window.removeEventListener("pointerup", up, true);
        if (hasLifted && placeholder) {
          item.classList.remove("is-dragging");
          setItemVisual(item, "base");
          item.style.transform = "";
          item.style.position = "";
          item.style.pointerEvents = "";
          item.style.width = "";
          item.style.left = "";
          item.style.top = "";
          item.style.zIndex = "";
          item.style.transition = "";
          const newIndex = currentIndex;
          placeholder.remove();
          if (newIndex !== index && newIndex !== -1) {
            const next = Array.isArray(state.value) ? [...state.value] : [];
            const [moved] = next.splice(index, 1);
            next.splice(newIndex, 0, moved);
            state.value = next;
            commit(state);
          }
        }
        if (!originalPosition) {
          list.style.position = "";
        }
      };

      window.addEventListener("pointermove", move, true);
      window.addEventListener("pointerup", up, true);
    };

    item.addEventListener("pointerdown", onPointerDown);
  }

  function runChildHydrators(scope) {
    if (typeof window === "undefined" || !window.Dieter) return;
    const entries = Object.entries(window.Dieter).filter(
      ([name, fn]) =>
        typeof fn === "function" &&
        name.toLowerCase().startsWith("hydrate") &&
        name.toLowerCase() !== "hydrateall" &&
        name.toLowerCase() !== "hydraterepeater"
    );
    entries.forEach(([, fn]) => {
      try {
        fn(scope);
      } catch (err) {
        if (process.env && process.env.NODE_ENV === "development") {
          console.warn("[repeater] child hydrator error", err);
        }
      }
    });
  }

  window.Dieter = {
    ...__prevDieter,
    hydrateRepeater,
  };
})();
