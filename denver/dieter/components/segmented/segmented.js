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

  // components/segmented/segmented.ts
  var segmented_exports = {};
  __export(segmented_exports, {
    hydrateSegmented: () => hydrateSegmented
  });
  function syncButtonState(input) {
    const button = input.closest(".diet-segment")?.querySelector(".diet-btn-ictxt, .diet-btn-ic, .diet-btn-txt");
    if (!button) return;
    button.setAttribute("aria-pressed", input.checked ? "true" : "false");
  }
  function hydrateSegmented(scope) {
    scope.querySelectorAll(".diet-segmented-ic, .diet-segmented-ictxt, .diet-segmented-txt").forEach((group) => {
      const inputs = Array.from(group.querySelectorAll(".diet-segment__input"));
      inputs.forEach((input) => {
        syncButtonState(input);
        if (input.dataset.segmentedWired === "true") return;
        input.dataset.segmentedWired = "true";
        input.addEventListener("change", () => {
          inputs.forEach((peer) => syncButtonState(peer));
        });
      });
    });
  }
  return __toCommonJS(segmented_exports);
})();
