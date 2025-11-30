var __prevDieter = window.Dieter ? { ...window.Dieter } : {};
"use strict";
var Dieter = (() => {
  var __defProp = Object.defineProperty;
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
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = Object.getOwnPropertyDescriptor(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // components/repeater/repeater.ts
  var repeater_exports = {};
  __export(repeater_exports, {
    hydrateRepeater: () => hydrateRepeater
  });

  // components/repeater/repeater.ts
  var registry = /* @__PURE__ */ new WeakMap();
function parseJson(value, fallback) {
    if (!value) return fallback;
    try {
      // Decode common HTML entities that may survive attribute parsing
      const decoded = value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
      return JSON.parse(decoded);
    } catch {
      return fallback;
    }
  }
  function stringify(value) {
    try {
      return JSON.stringify(value);
    } catch {
      return "[]";
    }
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
      const prevString = JSON.stringify(prevItem);
      const nextString = JSON.stringify(nextItem);
      if (prevString !== nextString) {
        valueChanges.push({ index: i, nextItem });
      }
    }
    return { structuralChange: false, valueChanges };
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
      if (!hidden || !list || !templateEl || !addBtn || !reorderBtn)
        return;
      const state = {
        root,
        hidden,
        list,
        template: templateEl.innerHTML || "",
        addBtn,
        reorderBtn,
        reorder: false,
        value: parseJson(hidden.value, [])
      };
      registry.set(root, state);
      render(state);
      addBtn.addEventListener("click", () => {
        state.value = Array.isArray(state.value) ? [...state.value, {}] : [{}];
        commit(state);
      });
      reorderBtn.addEventListener("click", () => {
        state.reorder = !state.reorder;
        root.dataset.reorder = state.reorder ? "on" : "off";
        reorderBtn.setAttribute("aria-pressed", state.reorder ? "true" : "false");
        render(state);
      });
      const handleExternal = (ev) => {
        const payload = ev && ev.type === "external-sync" && ev.detail && typeof ev.detail.value !== "undefined" ? ev.detail.value : hidden.value;
        const next = typeof payload === "string" ? parseJson(payload, []) : Array.isArray(payload) ? payload : parseJson(stringify(payload), []);
        const diff = diffArrays(state.value, next);
        if (diff.structuralChange) {
          state.value = Array.isArray(next) ? next : [];
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
      handle.innerHTML = '<span class="diet-btn-ic__icon" data-icon="line.3.horizontal"></span>';
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "diet-btn-ic diet-repeater__item-remove";
      remove.setAttribute("data-size", "sm");
      remove.setAttribute("data-variant", "neutral");
      remove.innerHTML = '<span class="diet-btn-ic__icon" data-icon="trash"></span>';
      const body = document.createElement("div");
      body.className = "diet-repeater__item-body";
      body.innerHTML = template.replace(/__INDEX__/g, String(index));
      // Pre-fill child controls with current item values before hydration
      const itemValue = Array.isArray(value) ? value[index] : void 0;
      const arrayPath = hidden.getAttribute("data-bob-path") || hidden.getAttribute("data-path") || "";
      const prefix = arrayPath ? `${arrayPath}.${index}.` : "";
      const getAt = (obj, path2) => {
        if (!obj || !path2) return void 0;
        const parts = path2.split(".");
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
          } else {
            el.value = String(val);
          }
        } else if ("value" in el) {
          el.value = String(val);
        }
      });
      item.appendChild(handle);
      item.appendChild(remove);
      item.appendChild(body);
      if (reorder) {
        item.draggable = true;
        handle.draggable = true;
        installDragHandlers(item, state);
      }
      remove.addEventListener("click", () => {
        const next = [...state.value];
        next.splice(index, 1);
        state.value = next;
        commit(state);
      });
      list.appendChild(item);
    });
    runChildHydrators(list);
    if (root) {
      runChildHydrators(root);
    }
  }
  function updateItemFields(state, itemEl, itemValue, index) {
    const hidden = state.hidden;
    const arrayPath = hidden.getAttribute("data-bob-path") || hidden.getAttribute("data-path") || "";
    const prefix = arrayPath ? `${arrayPath}.${index}.` : "";
    const getAt = (obj, path2) => {
      if (!obj || !path2) return void 0;
      const parts = path2.split(".");
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
  function installDragHandlers(item, state) {
    item.addEventListener("dragstart", (ev) => {
      item.classList.add("is-dragging");
      ev.dataTransfer?.setData("text/plain", item.dataset.index || "0");
      ev.dataTransfer?.setDragImage(item, 10, 10);
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("is-dragging");
    });
    item.addEventListener("dragover", (ev) => {
      ev.preventDefault();
    });
    item.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const fromIndex = Number(ev.dataTransfer?.getData("text/plain") || -1);
      const toIndex = Number(item.dataset.index || -1);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex)
        return;
      const next = Array.isArray(state.value) ? [...state.value] : [];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      state.value = next;
      commit(state);
    });
  }
  function runChildHydrators(scope) {
    if (typeof window === "undefined" || !window.Dieter) return;
    const entries = Object.entries(window.Dieter).filter(
      ([name, fn]) => typeof fn === "function" && name.toLowerCase().startsWith("hydrate") && name.toLowerCase() !== "hydrateall" && name.toLowerCase() !== "hydraterepeater"
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
  return __toCommonJS(repeater_exports);
})();
window.Dieter = {
  ...__prevDieter,
  hydrateRepeater: Dieter.hydrateRepeater
};
