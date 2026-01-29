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
    triggerSelector: ".diet-dropdown-actions__control",
    onClose: (root) => {
      const state = states.get(root);
      if (state && state.applyActions) {
        cancelPending(state, { close: false });
      }
    }
  });
  function hydrateDropdownActions(scope) {
    const roots = Array.from(scope.querySelectorAll(".diet-dropdown-actions"));
    if (!roots.length) return;
    roots.forEach((root) => {
      if (states.has(root)) return;
      const state = createState(root, scope);
      if (!state) return;
      states.set(root, state);
      installHandlers(state);
      initialize(state);
      maybeInstallTypographyWeightFilter(state);
      maybeInstallTypographyFontStyleFilter(state);
    });
    hydrateHost(scope);
  }
  function createState(root, scope) {
    const input = root.querySelector(".diet-dropdown-actions__value-field");
    const display = root.querySelector(".diet-dropdown-header-value");
    const trigger = root.querySelector(".diet-dropdown-actions__control");
    const menuActions = Array.from(
      root.querySelectorAll(".diet-dropdown-actions__menuaction")
    );
    const applyButton = root.querySelector(".diet-dropdown-actions__apply");
    const cancelButton = root.querySelector(".diet-dropdown-actions__cancel");
    const applyActions = root.dataset.applyActions === "true";
    if (!input || !display || !trigger || menuActions.length === 0) {
      return null;
    }
    const nativeValue = captureNativeValue(input);
    return {
      scope,
      root,
      input,
      display,
      trigger,
      menuActions,
      applyActions,
      applyButton,
      cancelButton,
      committedValue: input.value,
      pendingValue: null,
      nativeValue
    };
  }
  function installHandlers(state) {
    const { input, trigger, menuActions } = state;
    if (state.nativeValue) {
      Object.defineProperty(input, "value", {
        configurable: true,
        get: () => state.nativeValue?.get() ?? "",
        set: (next) => {
          state.nativeValue?.set(String(next ?? ""));
          syncFromValue(state, String(next ?? ""));
        }
      });
    }
    const syncCommitted = () => {
      state.committedValue = input.value;
      state.pendingValue = null;
      syncFromValue(state, input.value);
    };
    input.addEventListener("external-sync", syncCommitted);
    input.addEventListener("input", syncCommitted);
    menuActions.forEach((action) => {
      action.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        const value = action.dataset.value ?? "";
        const label = action.dataset.label ?? value;
        if (state.applyActions) {
          setPendingSelection(state, value, label);
          return;
        }
        const path = input.dataset.bobPath;
        if (path && /^typography\.roles\.[^.]+\.family$/.test(path)) {
          const roleRoot = path.slice(0, -".family".length);
          const weightPath = `${roleRoot}.weight`;
          const stylePath = `${roleRoot}.fontStyle`;
          const weightInput = state.scope.querySelector(`[data-bob-path="${weightPath}"]`);
          const styleInput = state.scope.querySelector(`[data-bob-path="${stylePath}"]`);
          const allowedWeights = (action.dataset.weights ?? "").split(",").map((w) => w.trim()).filter(Boolean);
          const allowedStyles = (action.dataset.styles ?? "").split(",").map((s) => s.trim()).filter(Boolean);
          const pick = (current, allowed, preferred) => {
            const trimmed = String(current ?? "").trim();
            if (trimmed && allowed.includes(trimmed)) return trimmed;
            if (allowed.includes(preferred)) return preferred;
            return allowed[0] ?? "";
          };
          const nextWeight = allowedWeights.length ? pick(weightInput?.value, allowedWeights, "400") : "";
          const nextStyle = allowedStyles.length ? pick(styleInput?.value, allowedStyles, "normal") : "";
          input.value = value;
          if (weightInput && nextWeight) weightInput.value = nextWeight;
          if (styleInput && nextStyle) styleInput.value = nextStyle;
          input.dispatchEvent(
            new CustomEvent("bob-ops", {
              bubbles: true,
              detail: {
                ops: [
                  { op: "set", path, value },
                  ...nextWeight ? [{ op: "set", path: weightPath, value: nextWeight }] : [],
                  ...nextStyle ? [{ op: "set", path: stylePath, value: nextStyle }] : []
                ]
              }
            })
          );
          input.dispatchEvent(
            new CustomEvent("input", {
              bubbles: true,
              detail: { bobIgnore: true }
            })
          );
          trigger.focus();
          trigger.click();
          return;
        }
        setSelection(state, value, label);
        trigger.focus();
        trigger.click();
      });
    });
    if (state.applyActions && state.applyButton && state.cancelButton) {
      state.applyButton.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        commitPending(state);
      });
      state.cancelButton.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        cancelPending(state, { close: true });
      });
    }
  }
  function initialize(state) {
    syncFromValue(state, state.input.value);
  }
  function updateDisplay(state, label) {
    const placeholder = state.input.dataset.placeholder ?? "";
    state.display.textContent = label ?? placeholder;
    state.display.dataset.muted = label ? "false" : "true";
  }
  function setSelection(state, value, label) {
    state.input.value = value;
    if (!state.nativeValue) syncFromValue(state, value, label);
    state.input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function dispatchPreview(state, value) {
    if (!state.applyActions) return;
    const path = state.input.dataset.bobPath;
    if (!path) return;
    if (value == null) {
      state.input.dispatchEvent(
        new CustomEvent("bob-preview", {
          bubbles: true,
          detail: { clear: true }
        })
      );
      return;
    }
    state.input.dispatchEvent(
      new CustomEvent("bob-preview", {
        bubbles: true,
        detail: {
          ops: [{ op: "set", path, value }]
        }
      })
    );
  }
  function setPendingSelection(state, value, label) {
    state.pendingValue = value;
    syncFromValue(state, value, label);
    dispatchPreview(state, value);
  }
  function commitPending(state) {
    if (!state.pendingValue) {
      state.trigger.focus();
      state.trigger.click();
      return;
    }
    dispatchPreview(state, null);
    const next = state.pendingValue;
    state.pendingValue = null;
    state.committedValue = next;
    state.input.value = next;
    if (!state.nativeValue) syncFromValue(state, next);
    const path = state.input.dataset.bobPath;
    if (path) {
      state.input.dispatchEvent(
        new CustomEvent("bob-ops", {
          bubbles: true,
          detail: {
            ops: [{ op: "set", path, value: next }]
          }
        })
      );
    } else {
      state.input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    state.trigger.focus();
    state.trigger.click();
  }
  function cancelPending(state, opts) {
    if (!state.pendingValue) {
      if (opts.close) {
        state.trigger.focus();
        state.trigger.click();
      }
      return;
    }
    state.pendingValue = null;
    syncFromValue(state, state.committedValue);
    dispatchPreview(state, null);
    if (opts.close) {
      state.trigger.focus();
      state.trigger.click();
    }
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
  function syncFromValue(state, value, labelOverride) {
    const selectedAction = state.menuActions.find((action) => action.dataset.value === value);
    const label = labelOverride ?? (selectedAction ? selectedAction.dataset.label ?? value : null);
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
  }
  function maybeInstallTypographyWeightFilter(state) {
    const path = state.input.dataset.bobPath;
    if (!path || !path.startsWith("typography.roles.") || !path.endsWith(".weight")) return;
    const familyPath = path.slice(0, -".weight".length) + ".family";
    const familyInput = state.scope.querySelector(`[data-bob-path="${familyPath}"]`);
    if (!familyInput) return;
    const update = () => {
      const familyRoot = familyInput.closest(".diet-dropdown-actions");
      if (!familyRoot) return;
      const familyAction = Array.from(
        familyRoot.querySelectorAll(".diet-dropdown-actions__menuaction")
      ).find((action) => (action.dataset.value ?? "") === familyInput.value);
      const raw = familyAction?.dataset.weights ?? "";
      const allowed = raw.split(",").map((w) => w.trim()).filter(Boolean);
      if (allowed.length === 0) return;
      state.menuActions.forEach((action) => {
        const value = action.dataset.value ?? "";
        const isAllowed = allowed.includes(value);
        action.hidden = !isAllowed;
        action.disabled = !isAllowed;
      });
    };
    familyInput.addEventListener("input", update);
    state.trigger.addEventListener("click", update);
    update();
  }
  function maybeInstallTypographyFontStyleFilter(state) {
    const path = state.input.dataset.bobPath;
    if (!path || !path.startsWith("typography.roles.") || !path.endsWith(".fontStyle")) return;
    const familyPath = path.slice(0, -".fontStyle".length) + ".family";
    const familyInput = state.scope.querySelector(`[data-bob-path="${familyPath}"]`);
    if (!familyInput) return;
    const update = () => {
      const familyRoot = familyInput.closest(".diet-dropdown-actions");
      if (!familyRoot) return;
      const familyAction = Array.from(
        familyRoot.querySelectorAll(".diet-dropdown-actions__menuaction")
      ).find((action) => (action.dataset.value ?? "") === familyInput.value);
      const raw = familyAction?.dataset.styles ?? "";
      const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
      if (allowed.length === 0) return;
      state.menuActions.forEach((action) => {
        const value = action.dataset.value ?? "";
        const isAllowed = allowed.includes(value);
        action.hidden = !isAllowed;
        action.disabled = !isAllowed;
      });
    };
    familyInput.addEventListener("input", update);
    state.trigger.addEventListener("click", update);
    update();
  }
  return __toCommonJS(dropdown_actions_exports);
})();
window.Dieter = { ...__prevDieter, ...Dieter };
