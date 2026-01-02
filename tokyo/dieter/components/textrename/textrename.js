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

  // components/textrename/textrename.ts
  var textrename_exports = {};
  __export(textrename_exports, {
    hydrateTextrename: () => hydrateTextrename
  });
  var states = /* @__PURE__ */ new Map();
  function hydrateTextrename(scope) {
    const roots = Array.from(scope.querySelectorAll(".diet-textrename"));
    if (!roots.length) return;
    roots.forEach((root) => {
      if (states.has(root)) return;
      const state = createState(root);
      if (!state) return;
      states.set(root, state);
      installHandlers(state);
      syncFromValue(state, state.input.value || state.input.getAttribute("value") || "");
    });
  }
  function createState(root) {
    const view = root.querySelector(".diet-textrename__view");
    const label = root.querySelector(".diet-textrename__label");
    const input = root.querySelector(".diet-textrename__input");
    if (!view || !label || !input) return null;
    return {
      root,
      view,
      label,
      input,
      internalWrite: false,
      originalValue: "",
      nativeValue: captureNativeValue(input)
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
    state.view.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      enterEditing(state);
    });
    state.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        commitEditing(state);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelEditing(state);
      }
    });
    state.input.addEventListener("blur", () => {
      if (state.root.dataset.state === "editing") commitEditing(state);
    });
    state.input.addEventListener("input", () => {
      syncFromValue(state, state.input.value);
    });
  }
  function enterEditing(state) {
    if (state.root.dataset.state === "editing") return;
    state.originalValue = state.input.value || "";
    state.root.dataset.state = "editing";
    queueMicrotask(() => {
      try {
        state.input.focus({ preventScroll: true });
        state.input.select();
      } catch {
      }
    });
  }
  function commitEditing(state) {
    state.root.dataset.state = "view";
    state.originalValue = "";
    syncFromValue(state, state.input.value);
    state.input.blur();
  }
  function cancelEditing(state) {
    state.root.dataset.state = "view";
    const next = state.originalValue;
    state.originalValue = "";
    state.internalWrite = true;
    state.input.value = next;
    state.internalWrite = false;
    syncFromValue(state, next);
    state.input.dispatchEvent(new Event("input", { bubbles: true }));
    state.input.blur();
  }
  function syncFromValue(state, raw) {
    const value = String(raw ?? "").trim();
    const placeholder = state.input.getAttribute("placeholder") || "";
    state.label.textContent = value || placeholder;
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
  return __toCommonJS(textrename_exports);
})();
window.Dieter = { ...__prevDieter, ...Dieter };
