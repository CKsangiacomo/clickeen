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

  // components/dropdown-actions/dropdown-actions.ts
  var dropdown_actions_exports = {};
  __export(dropdown_actions_exports, {
    hydrateDropdownActions: () => hydrateDropdownActions
  });

  // components/shared/dropdownToggle.ts
  function createDropdownHydrator(config) {
    const {
      rootSelector,
      triggerSelector,
      popoverSelector = ".diet-popover",
      onOpen,
      onClose,
      initialState = "closed"
    } = config;
    const hostRegistry = /* @__PURE__ */ new Map();
    let globalHandlersBound = false;
    const setOpen = (record, open) => {
      const { root, trigger, popover } = record;
      const next = open ? "open" : "closed";
      if (root.dataset.state === next) return;
      root.dataset.state = next;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        record.onOpen?.(root, popover, trigger);
      } else {
        record.onClose?.(root, popover, trigger);
      }
    };
    return function hydrate(scope) {
      const roots = Array.from(scope.querySelectorAll(rootSelector));
      if (!roots.length) return;
      roots.forEach((root) => {
        if (hostRegistry.has(root)) return;
        const trigger = root.querySelector(triggerSelector);
        const popover = root.querySelector(popoverSelector);
        if (!trigger || !popover) return;
        const record = { root, trigger, popover, onOpen, onClose };
        hostRegistry.set(root, record);
        trigger.addEventListener("click", (event) => {
          event.stopPropagation();
          setOpen(record, root.dataset.state !== "open");
        });
        const requestedState = root.dataset.state || initialState;
        setOpen(record, requestedState === "open");
      });
      if (!globalHandlersBound) {
        globalHandlersBound = true;
        document.addEventListener(
          "pointerdown",
          (event) => {
            const target = event.target;
            if (!target) return;
            hostRegistry.forEach((record) => {
              const { root } = record;
              if (!root.contains(target) && root.dataset.state === "open") {
                setOpen(record, false);
              }
            });
          },
          true
        );
        document.addEventListener("keydown", (event) => {
          if (event.key !== "Escape") return;
          hostRegistry.forEach((record) => {
            const { root } = record;
            if (root.dataset.state === "open") setOpen(record, false);
          });
        });
      }
    };
  }

  // components/dropdown-actions/dropdown-actions.ts
  var states = /* @__PURE__ */ new Map();
  var hydrateHost = createDropdownHydrator({
    rootSelector: ".diet-dropdown-actions",
    triggerSelector: ".diet-dropdown-actions__control"
  });
  function hydrateDropdownActions(scope) {
    const roots = Array.from(scope.querySelectorAll(".diet-dropdown-actions"));
    if (!roots.length) return;
    roots.forEach((root) => {
      if (states.has(root)) return;
      const state = createState(root);
      if (!state) return;
      states.set(root, state);
      installHandlers(state);
      initialize(state);
    });
    hydrateHost(scope);
  }
  function createState(root) {
    const input = root.querySelector(".diet-dropdown-actions__value-field");
    const display = root.querySelector(".diet-dropdown-header-value");
    const trigger = root.querySelector(".diet-dropdown-actions__control");
    const menuActions = Array.from(
      root.querySelectorAll(".diet-dropdown-actions__menuaction")
    );
    if (!input || !display || !trigger || menuActions.length === 0) {
      return null;
    }
    return { root, input, display, trigger, menuActions };
  }
  function installHandlers(state) {
    const { trigger, menuActions } = state;
    menuActions.forEach((action) => {
      action.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        const value = action.dataset.value ?? "";
        const label = action.dataset.label ?? value;
        setSelection(state, value, label);
        trigger.focus();
        trigger.click();
      });
    });
  }
  function initialize(state) {
    const { menuActions, input } = state;
    const selectedOption = menuActions.find((action) => action.dataset.value === input.value) ?? menuActions.find((action) => action.dataset.selected === "true") ?? menuActions[0];
    if (selectedOption) {
      const value = selectedOption.dataset.value ?? "";
      const label = selectedOption.dataset.label ?? value;
      setSelection(state, value, label);
    } else {
      updateDisplay(state, null);
    }
  }
  function updateDisplay(state, label) {
    const placeholder = state.input.dataset.placeholder ?? "";
    state.display.textContent = label ?? placeholder;
    state.display.dataset.muted = label ? "false" : "true";
  }
  function setSelection(state, value, label) {
    state.input.value = value;
    updateDisplay(state, label);
    state.menuActions.forEach((action) => {
      const isSelected = action.dataset.value === value;
      action.classList.toggle("is-selected", isSelected);
      action.setAttribute("aria-selected", isSelected ? "true" : "false");
      if (isSelected) {
        action.dataset.selected = "true";
      } else {
        delete action.dataset.selected;
      }
    });
    state.input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  return __toCommonJS(dropdown_actions_exports);
})();
window.Dieter = { ...__prevDieter, ...Dieter };
