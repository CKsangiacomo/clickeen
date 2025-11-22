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

  // components/button/button.ts
  var button_exports = {};
  __export(button_exports, {
    hydrateButton: () => hydrateButton
  });
  function hydrateButton(scope) {
    scope.querySelectorAll(".diet-btn-ictxt, .diet-btn-ic, .diet-btn-txt").forEach((btn) => {
      if (!btn.hasAttribute("type")) {
        btn.type = "button";
      }
    });
  }
  return __toCommonJS(button_exports);
})();
