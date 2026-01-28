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

  // components/dropdown-edit/dropdown-edit.ts
  var dropdown_edit_exports = {};
  __export(dropdown_edit_exports, {
    hydrateDropdownEdit: () => hydrateDropdownEdit
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

  // components/popaddlink/popaddlink.ts
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

  // components/dropdown-edit/dropdown-edit.ts
  var states = /* @__PURE__ */ new Map();
  var hydrateHost = createDropdownHydrator({
    rootSelector: ".diet-dropdown-edit",
    triggerSelector: ".diet-dropdown-edit__control",
    popoverSelector: ".diet-popover",
    onOpen: (root) => {
      const state = states.get(root);
      if (!state) return;
      state.editor.focus({ preventScroll: true });
      preselectInitialText(state);
    },
    onClose: (root) => {
      const state = states.get(root);
      if (!state) return;
      state.selection = null;
      closeInternalLinkSheet(state);
    }
  });
  function hydrateDropdownEdit(scope) {
    const roots = scope.querySelectorAll(".diet-dropdown-edit");
    if (!roots.length) return;
    roots.forEach((root) => {
      if (states.has(root)) return;
      const state = createState(root);
      states.set(root, state);
      installHandlers(state);
      syncFromInstanceData(state);
      state.hiddenInput.addEventListener("external-sync", (ev) => {
        const custom = ev;
        const value = custom.detail && typeof custom.detail.value === "string" && custom.detail.value || state.hiddenInput.value || state.hiddenInput.getAttribute("value") || "";
        if (state.isActive) {
          state.pendingExternal = value;
          return;
        }
        applyExternalValue(state, value);
      });
    });
    hydrateHost(scope);
  }
  function createState(root) {
    const control = root.querySelector(".diet-dropdown-edit__control");
    const popover = root.querySelector(".diet-popover");
    const editor = root.querySelector(".diet-dropdown-edit__editor");
    const headerValue = root.querySelector(".diet-dropdown-header-value");
    const hiddenInput = root.querySelector(".diet-dropdown-edit__field");
    const palette = root.querySelector(".diet-dropdown-edit__palette");
    const linkSheet = root.querySelector(".diet-dropdown-edit__linksheet");
    const linkPopover = linkSheet?.querySelector(".diet-popaddlink") ?? null;
    const allowLinksAttr = root.getAttribute("data-allow-links");
    const allowLinks = allowLinksAttr == null ? true : !["false", "0", "no"].includes(allowLinksAttr.trim().toLowerCase());
    if (!control || !popover || !editor || !headerValue || !hiddenInput || !palette) {
      throw new Error("[textedit] missing DOM nodes");
    }
    const iconButton = root.querySelector(".diet-dropdown-edit__icon .diet-btn-ic");
    if (iconButton) {
      const iconSize = root.dataset.size === "lg" ? "sm" : "xs";
      iconButton.setAttribute("data-size", iconSize);
    }
    const paletteButtons = /* @__PURE__ */ new Map();
    palette.querySelectorAll("button[data-command]").forEach((btn) => {
      paletteButtons.set(btn.dataset.command, btn);
    });
    const paletteLinkButton = paletteButtons.get("link" /* Link */) ?? null;
    const clearFormatButton = paletteButtons.get("clear-format" /* ClearFormat */);
    const clearLinksButton = paletteButtons.get("clear-links" /* ClearLinks */);
    const toolbarDivider = palette.querySelector(".diet-dropdown-edit__divider");
    if (!clearFormatButton || !clearLinksButton || !toolbarDivider) {
      throw new Error("[textedit] missing clear buttons or divider");
    }
    if (linkPopover && allowLinks) {
      hydratePopAddLink(linkPopover);
    }
    if (!allowLinks) {
      if (paletteLinkButton) paletteLinkButton.style.display = "none";
      clearLinksButton.classList.add("is-hidden");
      if (linkSheet) linkSheet.style.display = "none";
    }
    return {
      root,
      control,
      popover,
      editor,
      headerValue,
      hiddenInput,
      allowLinks,
      palette,
      paletteButtons,
      paletteLinkButton,
      linkSheet: linkSheet ?? null,
      linkPopover,
      tempMarker: null,
      clearFormatButton,
      clearLinksButton,
      toolbarDivider,
      selection: null,
      activeAnchor: null,
      isActive: false
    };
  }
  function installHandlers(state) {
    const { editor, palette, paletteButtons, clearFormatButton, clearLinksButton, linkPopover, root } = state;
    palette.addEventListener("click", (ev) => {
      const target = ev.target.closest("button[data-command]");
      if (!target) return;
      const command = target.dataset.command;
      handleCommand(state, command);
    });
    clearFormatButton.addEventListener("click", (ev) => {
      ev.preventDefault();
      clearAllFormatting(state);
    });
    clearLinksButton.addEventListener("click", (ev) => {
      ev.preventDefault();
      clearAllLinks(state);
    });
    editor.addEventListener("input", () => {
      state.isActive = true;
      syncPreview(state);
      updateSelectionFromEditor(state);
    });
    editor.addEventListener("focus", () => {
      state.isActive = true;
    });
    editor.addEventListener("mouseup", () => {
      if (!state.root.classList.contains("has-linksheet")) {
        updateSelectionFromEditor(state);
      }
    });
    editor.addEventListener("keyup", () => {
      if (!state.root.classList.contains("has-linksheet")) {
        updateSelectionFromEditor(state);
      }
    });
    editor.addEventListener("blur", () => {
      state.isActive = false;
      if (state.pendingExternal !== void 0) {
        applyExternalValue(state, state.pendingExternal);
        state.pendingExternal = void 0;
      }
      if (!state.root.classList.contains("has-linksheet")) {
        state.selection = null;
        updatePaletteActiveStates(state);
      }
    });
    if (linkPopover && state.allowLinks) {
      linkPopover.addEventListener("popaddlink:submit", (ev) => {
        const href = ev.detail?.href;
        if (!href) return;
        applyLinkFromHost(state, href);
        closeInternalLinkSheet(state);
      });
      linkPopover.addEventListener("popaddlink:cancel", () => {
        closeInternalLinkSheet(state);
      });
    }
    root.addEventListener("diet-dropdown-edit:close-linksheet", () => {
      closeInternalLinkSheet(state);
    });
  }
  function preselectInitialText(state) {
    const selection = window.getSelection();
    if (!selection) return;
    const text = state.editor.textContent ?? "";
    if (!text.trim()) {
      selection.removeAllRanges();
      return;
    }
    const walker = document.createTreeWalker(state.editor, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent && node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const first = walker.nextNode();
    if (!first) return;
    const range = document.createRange();
    const textValue = first.textContent || "";
    const words = textValue.trim().split(/\s+/);
    const firstWord = words[0] || "";
    const startIndex = first.textContent.indexOf(firstWord);
    range.setStart(first, Math.max(0, startIndex));
    range.setEnd(first, Math.min(first.length, startIndex + firstWord.length));
    selection.removeAllRanges();
    selection.addRange(range);
    state.selection = range.cloneRange();
    updatePaletteActiveStates(state);
  }
  function handleCommand(state, command) {
    if (!state.allowLinks && (command === "link" /* Link */ || command === "clear-links" /* ClearLinks */)) {
      return;
    }
    switch (command) {
      case "bold" /* Bold */:
      case "italic" /* Italic */:
      case "underline" /* Underline */:
      case "strike" /* Strike */: {
        const selection = window.getSelection();
        const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (range && state.editor.contains(range.commonAncestorContainer) && !range.collapsed) {
          state.selection = range.cloneRange();
        }
        break;
      }
      default:
        break;
    }
    switch (command) {
      case "bold" /* Bold */:
        surroundSelection(state, "strong");
        break;
      case "italic" /* Italic */:
        surroundSelection(state, "em");
        break;
      case "underline" /* Underline */:
        surroundSelection(state, "u");
        break;
      case "strike" /* Strike */:
        surroundSelection(state, "s");
        break;
      case "link" /* Link */:
        if (!state.selection) {
          updateSelectionFromEditor(state);
        }
        openInternalLinkSheet(state);
        return;
      case "clear-format" /* ClearFormat */:
        clearAllFormatting(state);
        return;
      case "clear-links" /* ClearLinks */:
        clearAllLinks(state);
        return;
      default:
        break;
    }
    syncPreview(state);
    updatePaletteActiveStates(state);
  }
  function updatePaletteActiveStates(state) {
    const tags = collectFormattingTags(state.selection);
    state.paletteButtons.forEach((btn, command) => {
      let tag = null;
      if (command === "bold" /* Bold */) tag = "STRONG";
      if (command === "italic" /* Italic */) tag = "EM";
      if (command === "underline" /* Underline */) tag = "U";
      if (command === "strike" /* Strike */) tag = "S";
      if (!tag) return;
      btn.classList.toggle("is-active", tags.has(tag));
    });
    updateClearButtons(state);
  }
  function collectFormattingTags(range) {
    const tags = /* @__PURE__ */ new Set();
    if (!range) return tags;
    const frag = range.cloneContents();
    frag.querySelectorAll("*").forEach((node) => tags.add(node.tagName));
    return tags;
  }
  function surroundSelection(state, tag) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!state.editor.contains(range.commonAncestorContainer) || range.collapsed) return;
    const wrapper = document.createElement(tag);
    try {
      range.surroundContents(wrapper);
    } catch {
      const contents = range.extractContents();
      wrapper.append(contents);
      range.insertNode(wrapper);
    }
    const nextRange = document.createRange();
    nextRange.selectNodeContents(wrapper);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    state.selection = nextRange.cloneRange();
  }
  function openInternalLinkSheet(state) {
    if (!state.allowLinks) return;
    const { linkSheet, linkPopover, root } = state;
    if (!linkSheet || !linkPopover) return;
    if (!state.selection) return;
    const range = state.selection.cloneRange();
    const anchor = findAnchor(range);
    state.activeAnchor = anchor || null;
    if (!anchor) {
      clearTempMarker(state);
      const marker = wrapTempMarker(range);
      if (marker) {
        state.tempMarker = marker;
      }
    }
    const input = linkPopover.querySelector(".diet-popaddlink__input");
    if (input) {
      input.value = anchor?.getAttribute("href") || "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      setTimeout(() => {
        input.focus();
        input.selectionStart = input.selectionEnd = input.value.length;
      }, 0);
    }
    root.classList.add("has-linksheet");
    linkSheet.setAttribute("aria-hidden", "false");
  }
  function applyLinkFromHost(state, href) {
    if (!state.selection) {
      updateSelectionFromEditor(state);
    }
    if (!state.selection) return;
    const range = state.selection.cloneRange();
    let anchor = state.activeAnchor && isRangeInsideAnchor(range, state.activeAnchor) ? state.activeAnchor : document.createElement("a");
    anchor.setAttribute("href", href);
    if (state.tempMarker && !state.activeAnchor) {
      const marker = state.tempMarker;
      const parent = marker.parentNode;
      if (parent) {
        const frag = document.createDocumentFragment();
        while (marker.firstChild) frag.appendChild(marker.firstChild);
        anchor.append(frag);
        parent.replaceChild(anchor, marker);
      }
      state.tempMarker = null;
    } else if (!anchor.parentNode || anchor === state.activeAnchor && !anchor.contains(range.commonAncestorContainer)) {
      try {
        range.surroundContents(anchor);
      } catch {
        const frag = range.extractContents();
        anchor.append(frag);
        range.insertNode(anchor);
      }
    }
    anchor.classList.add("diet-dropdown-edit-link");
    const newRange = document.createRange();
    newRange.selectNodeContents(anchor);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
    state.selection = newRange.cloneRange();
    syncPreview(state);
    updateClearButtons(state);
    updatePaletteActiveStates(state);
  }
  function closeInternalLinkSheet(state) {
    const { linkSheet, root } = state;
    if (!linkSheet) return;
    root.classList.remove("has-linksheet");
    linkSheet.setAttribute("aria-hidden", "true");
    clearTempMarker(state);
  }
  function findAnchor(range) {
    let node = range.commonAncestorContainer;
    if (node instanceof HTMLAnchorElement) return node;
    node = node.parentNode;
    while (node) {
      if (node instanceof HTMLAnchorElement) return node;
      node = node.parentNode;
    }
    return null;
  }
  function isRangeInsideAnchor(range, anchor) {
    return anchor.contains(range.startContainer) && anchor.contains(range.endContainer);
  }
  function updateSelectionFromEditor(state) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      state.selection = null;
      updatePaletteActiveStates(state);
      return;
    }
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    if (!state.editor.contains(container)) {
      state.selection = null;
      updatePaletteActiveStates(state);
      return;
    }
    state.selection = range.collapsed ? null : range.cloneRange();
    updatePaletteActiveStates(state);
  }
  function updateClearButtons(state) {
    const hasFormatting = Boolean(state.editor.querySelector("strong, b, em, i, u, s"));
    const hasLinks = state.allowLinks ? Boolean(state.editor.querySelector("a")) : false;
    state.clearFormatButton?.classList.toggle("is-hidden", !hasFormatting);
    state.clearLinksButton?.classList.toggle("is-hidden", !hasLinks);
    const showDivider = (hasFormatting || hasLinks) && state.toolbarDivider;
    if (state.toolbarDivider) {
      state.toolbarDivider.classList.toggle("is-hidden", !showDivider);
    }
  }
  function clearAllFormatting(state) {
    const nodes = state.editor.querySelectorAll("strong, b, em, i, u, s");
    nodes.forEach((el) => unwrapElement(el));
    syncPreview(state);
    updateClearButtons(state);
  }
  function clearAllLinks(state) {
    const nodes = state.editor.querySelectorAll("a");
    nodes.forEach((anchor) => {
      anchor.classList.remove("diet-dropdown-edit-link");
      unwrapElement(anchor);
    });
    syncPreview(state);
    updateClearButtons(state);
  }
  function unwrapElement(el) {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }
  function wrapTempMarker(range) {
    if (range.collapsed) return null;
    const marker = document.createElement("span");
    marker.className = "diet-dropdown-edit-linktemp";
    try {
      range.surroundContents(marker);
    } catch {
      return null;
    }
    return marker;
  }
  function clearTempMarker(state) {
    if (!state.tempMarker) return;
    const marker = state.tempMarker;
    const parent = marker.parentNode;
    if (parent) {
      while (marker.firstChild) parent.insertBefore(marker.firstChild, marker);
      parent.removeChild(marker);
    }
    state.tempMarker = null;
  }
  function syncFromInstanceData(state) {
    const value = state.hiddenInput.value || state.hiddenInput.getAttribute("value") || "";
    applyExternalValue(state, value);
  }
  function applyExternalValue(state, raw) {
    const value = raw || "";
    const sanitized = sanitizeInline(value, state.allowLinks);
    state.editor.innerHTML = sanitized;
    const target = state.headerValue;
    if (sanitized) {
      target.textContent = toPreviewText(sanitized);
      target.dataset.muted = "false";
    } else {
      target.textContent = target.dataset.placeholder ?? "";
      target.dataset.muted = "true";
    }
    state.hiddenInput.value = sanitized;
    updateClearButtons(state);
  }
  function syncPreview(state) {
    const raw = state.editor.innerHTML.trim();
    const sanitized = sanitizeInline(raw, state.allowLinks);
    const target = state.headerValue;
    if (sanitized) {
      target.textContent = toPreviewText(sanitized);
    } else {
      target.textContent = state.editor.textContent ?? "";
    }
    const hasValue = raw.length > 0;
    target.dataset.muted = hasValue ? "false" : "true";
    if (!hasValue) {
      target.textContent = target.dataset.placeholder ?? "";
    }
    state.hiddenInput.value = sanitized;
    state.hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function toPreviewText(sanitized) {
    const tmp = document.createElement("div");
    tmp.innerHTML = sanitized;
    const text = tmp.textContent ?? "";
    return text.replace(/\s+/g, " ").trim();
  }
  function sanitizeInline(html, allowLinks = true) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    const allowed = /* @__PURE__ */ new Set(["STRONG", "B", "EM", "I", "U", "S", "BR"]);
    if (allowLinks) allowed.add("A");
    const sanitizeNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return { type: "text", value: node.textContent || "" };
      }
      if (!(node instanceof HTMLElement)) return null;
      const tag = node.tagName.toUpperCase();
      if (!allowed.has(tag)) {
        return Array.from(node.childNodes).map((child) => sanitizeNode(child)).flat().filter(Boolean);
      }
      if (tag === "BR") return { type: "br" };
      const attrs = {};
      if (tag === "A") {
        const href = node.getAttribute("href") || "";
        if (/^https?:\/\//i.test(href)) {
          attrs.href = href;
          if (node.getAttribute("target") === "_blank") {
            attrs.target = "_blank";
            attrs.rel = "noopener";
          }
        }
        const cls = node.getAttribute("class") || "";
        if (/\bdiet-dropdown-edit-link\b/.test(cls)) {
          attrs.class = "diet-dropdown-edit-link";
        }
      }
      const children = Array.from(node.childNodes).map((child) => sanitizeNode(child)).flat().filter(Boolean);
      return { type: "tag", tag: tag.toLowerCase(), attrs, children };
    };
    const sanitizedChildren = Array.from(wrapper.childNodes).map((child) => sanitizeNode(child)).flat().filter(Boolean);
    const parts = [];
    const startsWithNonSpace = (node) => {
      if (!node) return false;
      if (node.type === "text") return /^\S/.test(node.value);
      if (node.type === "br") return false;
      return node.children.some((child) => startsWithNonSpace(child));
    };
    const endsWithNonSpace = (node) => {
      if (!node) return false;
      if (node.type === "text") return /\S$/.test(node.value);
      if (node.type === "br") return false;
      for (let i = node.children.length - 1; i >= 0; i--) {
        if (endsWithNonSpace(node.children[i])) return true;
      }
      return false;
    };
    const appendWithSpace = (node, prev2) => {
      const needSpace = prev2 && prev2.type !== "br" && node.type !== "br" && endsWithNonSpace(prev2) && startsWithNonSpace(node);
      if (needSpace) parts.push(" ");
      if (node.type === "text") {
        parts.push(node.value);
        return;
      }
      if (node.type === "br") {
        parts.push("<br>");
        return;
      }
      if (node.type === "tag") {
        const attrs = Object.entries(node.attrs).map(([k, v]) => `${k}="${v.replace(/"/g, "&quot;")}"`).join(" ");
        const open = attrs ? `<${node.tag} ${attrs}>` : `<${node.tag}>`;
        parts.push(open);
        let prevChild = null;
        node.children.forEach((child) => {
          appendWithSpace(child, prevChild);
          prevChild = child;
        });
        parts.push(`</${node.tag}>`);
      }
    };
    let prev = null;
    sanitizedChildren.forEach((child) => {
      appendWithSpace(child, prev);
      prev = child;
    });
    return parts.join("");
  }
  return __toCommonJS(dropdown_edit_exports);
})();
window.Dieter = { ...__prevDieter, ...Dieter };
