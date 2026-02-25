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

  // components/datepicker/datepicker.ts
  var datepicker_exports = {};
  __export(datepicker_exports, {
    hydrateDatepicker: () => hydrateDatepicker
  });
  function hydrateDatepicker(scope) {
    scope.querySelectorAll(".diet-datepicker").forEach((root) => {
      const control = root.querySelector(".diet-datepicker__control");
      const hidden = root.querySelector(".diet-datepicker__field");
      const dateInput = root.querySelector(".diet-datepicker__date");
      const timeInput = root.querySelector(".diet-datepicker__time");
      if (!control || !hidden || !dateInput || !timeInput) return;
      if (control.dataset.datepickerWired === "true") return;
      control.dataset.datepickerWired = "true";
      const parseIsoDateTime = (value) => {
        const raw = String(value || "").trim();
        if (!raw) return null;
        const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/);
        if (!match) return null;
        return { date: match[1], time: match[2] };
      };
      const writeVisibleFromHidden = () => {
        const parsed = parseIsoDateTime(hidden.value);
        if (!parsed) {
          if (dateInput.value) dateInput.value = "";
          if (timeInput.value) timeInput.value = "";
          return;
        }
        if (dateInput.value !== parsed.date) dateInput.value = parsed.date;
        if (timeInput.value !== parsed.time) timeInput.value = parsed.time;
      };
      const composeDateTimeValue = () => {
        const date = dateInput.value.trim();
        const time = timeInput.value.trim();
        if (!date && !time) return "";
        if (!date) return "";
        return `${date}T${time || "00:00"}`;
      };
      const emitHiddenUpdate = (type) => {
        const nextValue = composeDateTimeValue();
        if (hidden.value === nextValue) return;
        hidden.value = nextValue;
        hidden.dispatchEvent(new Event(type, { bubbles: true }));
      };
      const focusInput = (event) => {
        if ("button" in event && typeof event.button === "number" && event.button !== 0) return;
        const target = event.target;
        if (!target) return;
        if (target.closest("button") || target.closest("[data-datepicker-keep-focus]")) return;
        if (document.activeElement !== dateInput) {
          dateInput.focus({ preventScroll: true });
        }
      };
      control.addEventListener("pointerdown", focusInput);
      control.addEventListener("click", (event) => {
        if (event.target?.tagName === "INPUT") return;
        focusInput(event);
      });
      dateInput.addEventListener("input", () => emitHiddenUpdate("input"));
      dateInput.addEventListener("change", () => emitHiddenUpdate("change"));
      timeInput.addEventListener("input", () => emitHiddenUpdate("input"));
      timeInput.addEventListener("change", () => emitHiddenUpdate("change"));
      hidden.addEventListener("external-sync", () => {
        writeVisibleFromHidden();
      });
      const handleEnter = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      };
      dateInput.addEventListener("keydown", handleEnter);
      timeInput.addEventListener("keydown", handleEnter);
      writeVisibleFromHidden();
    });
  }
  return __toCommonJS(datepicker_exports);
})();
window.Dieter = { ...__prevDieter, ...Dieter };
