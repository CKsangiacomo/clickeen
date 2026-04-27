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

  // components/toggle/toggle.ts
  var toggle_exports = {};
  __export(toggle_exports, {
    hydrateToggle: () => hydrateToggle
  });
  function hydrateToggle(scope) {
    scope.querySelectorAll(".diet-toggle").forEach((root) => {
      const input = root.querySelector(".diet-toggle__input");
      if (!input || input.dataset.toggleWired === "true") return;
      input.dataset.toggleWired = "true";
      const switchLabel = root.querySelector(".diet-toggle__switch");
      if (switchLabel) {
        switchLabel.addEventListener("keydown", (event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            input.click();
          }
        });
      }
    });
  }
  return __toCommonJS(toggle_exports);
})();
window.Dieter = { ...__prevDieter, ...Dieter };
