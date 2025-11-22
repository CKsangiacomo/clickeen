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

  // components/tabs/tabs.ts
  var tabs_exports = {};
  __export(tabs_exports, {
    hydrateTabs: () => hydrateTabs
  });
  function syncSelected(group) {
    const inputs = Array.from(group.querySelectorAll(".diet-tab__input"));
    inputs.forEach((input) => {
      const label = group.querySelector(`label[for="${input.id}"]`);
      if (!label) return;
      label.setAttribute("role", "tab");
      label.setAttribute("aria-selected", input.checked ? "true" : "false");
      if (input.checked) {
        label.setAttribute("tabindex", "0");
      } else {
        label.setAttribute("tabindex", "-1");
      }
    });
  }
  function hydrateTabs(scope) {
    scope.querySelectorAll(".diet-tabs").forEach((group) => {
      if (group.dataset.tabsWired === "true") return;
      group.dataset.tabsWired = "true";
      syncSelected(group);
      group.addEventListener("change", (event) => {
        if (!(event.target instanceof HTMLInputElement)) return;
        if (!event.target.classList.contains("diet-tab__input")) return;
        syncSelected(group);
      });
      group.addEventListener("keydown", (event) => {
        const activeLabel = group.querySelector('label[role="tab"][aria-selected="true"]');
        if (!activeLabel) return;
        const tabs = Array.from(group.querySelectorAll('label[role="tab"]'));
        const currentIndex = tabs.indexOf(activeLabel);
        if (currentIndex === -1) return;
        let nextIndex = currentIndex;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          nextIndex = (currentIndex + 1) % tabs.length;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        } else {
          return;
        }
        event.preventDefault();
        const nextLabel = tabs[nextIndex];
        const inputId = nextLabel.getAttribute("for");
        if (!inputId) return;
        const input = group.querySelector(`#${inputId}`);
        if (!input) return;
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        nextLabel.focus();
      });
    });
  }
  return __toCommonJS(tabs_exports);
})();
