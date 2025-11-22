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

  // components/textfield/textfield.ts
  var textfield_exports = {};
  __export(textfield_exports, {
    hydrateTextfield: () => hydrateTextfield
  });
  function hydrateTextfield(scope) {
    scope.querySelectorAll(".diet-textfield").forEach((root) => {
      const control = root.querySelector(".diet-textfield__control");
      const input = root.querySelector(".diet-textfield__field");
      if (!control || !input) return;
      if (control.dataset.textfieldWired === "true") return;
      control.dataset.textfieldWired = "true";
      const focusInput = (event) => {
        if ("button" in event && typeof event.button === "number" && event.button !== 0) return;
        const target = event.target;
        if (!target) return;
        if (target.closest("button") || target.closest("[data-textfield-keep-focus]")) return;
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
    });
  }
  return __toCommonJS(textfield_exports);
})();
