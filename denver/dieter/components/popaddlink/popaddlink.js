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

  // components/popaddlink/popaddlink.ts
  var popaddlink_exports = {};
  __export(popaddlink_exports, {
    hydratePopAddLink: () => hydratePopAddLink
  });
  function hydratePopAddLink(scope) {
    scope.querySelectorAll(".diet-popaddlink").forEach((root) => {
      const input = root.querySelector(".diet-popaddlink__input");
      const apply = root.querySelector(".diet-popaddlink__apply");
      const close = root.querySelector(".diet-popaddlink__close");
      const helper = root.querySelector(".diet-popaddlink__helper");
      if (!input || !apply || !close || !helper) return;
      const setState = (state, message = "") => {
        root.dataset.state = state;
        helper.textContent = message;
      };
      const normalizeUrl = (raw) => {
        const value = raw.trim();
        if (!value) return { ok: false, url: "" };
        const prefixed = /^https?:\/\//i.test(value) ? value : `https://${value}`;
        try {
          const url = new URL(prefixed);
          if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, url: "" };
          const host = url.hostname.toLowerCase();
          if (host === "localhost") {
            return { ok: true, url: url.toString() };
          }
          if (!host.includes(".") || host.startsWith(".") || host.endsWith(".")) {
            return { ok: false, url: "" };
          }
          const labels = host.split(".");
          if (labels.some(
            (label) => !label || !/^[a-z0-9-]+$/.test(label) || label.startsWith("-") || label.endsWith("-")
          )) {
            return { ok: false, url: "" };
          }
          const tld = labels[labels.length - 1];
          if (tld.length < 2) return { ok: false, url: "" };
          return { ok: true, url: url.toString() };
        } catch {
          return { ok: false, url: "" };
        }
      };
      const evaluate = () => {
        const value = input.value;
        if (!value.trim()) {
          setState("empty", "");
          apply.disabled = true;
          return;
        }
        const { ok } = normalizeUrl(value);
        if (ok) {
          setState("valid", "");
          apply.disabled = false;
        } else {
          setState("invalid", "");
          apply.disabled = true;
        }
      };
      const emitApply = () => {
        const { ok, url } = normalizeUrl(input.value);
        if (!ok) {
          return;
        }
        const event = new CustomEvent("popaddlink:submit", {
          bubbles: true,
          detail: { href: url }
        });
        root.dispatchEvent(event);
      };
      const emitCancel = () => {
        const event = new CustomEvent("popaddlink:cancel", { bubbles: true });
        root.dispatchEvent(event);
      };
      input.addEventListener("input", evaluate);
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          emitApply();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          emitCancel();
        }
      });
      apply.addEventListener("click", emitApply);
      close.addEventListener("click", emitCancel);
      setState("empty", "");
      apply.disabled = true;
    });
  }
  return __toCommonJS(popaddlink_exports);
})();
