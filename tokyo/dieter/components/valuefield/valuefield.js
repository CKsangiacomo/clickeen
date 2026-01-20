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

  // components/valuefield/valuefield.ts
  var valuefield_exports = {};
  __export(valuefield_exports, {
    hydrateValuefield: () => hydrateValuefield
  });
  function hydrateValuefield(scope) {
    scope.querySelectorAll(".diet-valuefield").forEach((root) => {
      const control = root.querySelector(".diet-valuefield__control");
      const input = root.querySelector(".diet-valuefield__field");
      if (!control || !input) return;
      if (control.dataset.valuefieldWired === "true") return;
      control.dataset.valuefieldWired = "true";
      const syncWidth = () => {
        const raw = input.value || "";
        const length = Math.max(1, String(raw).length);
        root.style.setProperty("--valuefield-ch", `${length}ch`);
      };
      const focusInput = (event) => {
        if ("button" in event && typeof event.button === "number" && event.button !== 0) return;
        const target = event.target;
        if (!target) return;
        if (target.closest("button") || target.closest("[data-valuefield-keep-focus]")) return;
        if (document.activeElement !== input) {
          input.focus({ preventScroll: true });
        }
      };
      control.addEventListener("pointerdown", focusInput);
      control.addEventListener("click", (event) => {
        if (event.target?.tagName === "INPUT") return;
        focusInput(event);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
      });
      input.addEventListener("input", syncWidth);
      input.addEventListener("change", syncWidth);
      syncWidth();
    });
  }
  return __toCommonJS(valuefield_exports);
})();
window.Dieter = { ...__prevDieter, ...Dieter };
