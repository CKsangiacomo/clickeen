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

  // components/choice-tiles/choice-tiles.ts
  var choice_tiles_exports = {};
  __export(choice_tiles_exports, {
    hydrateChoiceTiles: () => hydrateChoiceTiles
  });
  var states = /* @__PURE__ */ new WeakMap();
  function hydrateChoiceTiles(scope) {
    const roots = Array.from(scope.querySelectorAll(".diet-choice-tiles"));
    if (!roots.length) return;
    roots.forEach((root) => {
      if (states.has(root)) return;
      const state = createState(root);
      if (!state) return;
      states.set(root, state);
      installHandlers(state);
      syncFromValue(state, state.input.value);
    });
  }
  function createState(root) {
    const input = root.querySelector(".diet-choice-tiles__field");
    const options = Array.from(root.querySelectorAll(".diet-choice-tiles__option"));
    if (!input || options.length === 0) return null;
    if (options.length < 2 || options.length > 3) return null;
    const nativeValue = captureNativeValue(input);
    return { root, input, options, nativeValue };
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
  function installHandlers(state) {
    const { input, options } = state;
    if (state.nativeValue) {
      Object.defineProperty(input, "value", {
        configurable: true,
        get: () => state.nativeValue?.get() ?? "",
        set: (next) => {
          state.nativeValue?.set(next);
          syncFromValue(state, String(next ?? ""));
        }
      });
    }
    options.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const value = button.dataset.value ?? "";
        if (!value) return;
        input.value = value;
        syncFromValue(state, input.value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      button.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const idx = options.indexOf(button);
        if (idx === -1) return;
        const dir = event.key === "ArrowRight" ? 1 : -1;
        const nextIdx = (idx + dir + options.length) % options.length;
        options[nextIdx]?.focus();
      });
    });
    input.addEventListener("external-sync", () => syncFromValue(state, input.value));
    input.addEventListener("input", () => syncFromValue(state, input.value));
  }
  function syncFromValue(state, value) {
    state.options.forEach((button) => {
      const isSelected = button.dataset.value === value;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-checked", isSelected ? "true" : "false");
      button.dataset.selected = isSelected ? "true" : "false";
    });
  }
  return __toCommonJS(choice_tiles_exports);
})();
window.Dieter = { ...__prevDieter, ...Dieter };
