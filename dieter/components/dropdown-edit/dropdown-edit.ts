import { createDropdownHydrator } from '../shared/dropdownToggle';
import { hydratePopAddLink } from '../popaddlink/popaddlink';

const states = new Map<HTMLElement, DropdownEditState>();

const hydrateHost = createDropdownHydrator({
  rootSelector: '.diet-dropdown-edit',
  triggerSelector: '.diet-dropdown-edit__control',
  popoverSelector: '.diet-popover',
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
  },
});

// Formatting commands supported by the palette.
const enum Command {
  Bold = 'bold',
  Italic = 'italic',
  Underline = 'underline',
  Strike = 'strike',
  Link = 'link',
  ClearFormat = 'clear-format',
  ClearLinks = 'clear-links',
}

interface DropdownEditState {
  root: HTMLElement;
  control: HTMLElement;
  popover: HTMLElement;
  editor: HTMLElement;
  headerValue: HTMLElement;
  hiddenInput: HTMLInputElement;
  isActive: boolean;
  pendingExternal?: string;

  palette: HTMLElement;
  paletteButtons: Map<Command, HTMLButtonElement>;
  paletteLinkButton: HTMLButtonElement | null;
  linkSheet: HTMLElement | null;
  linkPopover: HTMLElement | null;
  selection: Range | null;
  activeAnchor: HTMLAnchorElement | null;
  tempMarker: HTMLElement | null;
  clearFormatButton: HTMLButtonElement;
  clearLinksButton: HTMLButtonElement;
  toolbarDivider: HTMLElement;
}

export function hydrateDropdownEdit(scope: Element | DocumentFragment): void {
  const roots = scope.querySelectorAll<HTMLElement>('.diet-dropdown-edit');
  if (!roots.length) return;

  roots.forEach((root) => {
    if (states.has(root)) return;
    const state = createState(root);
    states.set(root, state);
    installHandlers(state);
    syncFromInstanceData(state);
    state.hiddenInput.addEventListener('external-sync', (ev: Event) => {
      const custom = ev as CustomEvent<{ value?: string }>;
      const value =
        (custom.detail && typeof custom.detail.value === 'string' && custom.detail.value) ||
        state.hiddenInput.value ||
        state.hiddenInput.getAttribute('value') ||
        '';
      if (state.isActive) {
        state.pendingExternal = value;
        return;
      }
      applyExternalValue(state, value);
    });
  });

  hydrateHost(scope);
}

function createState(root: HTMLElement): DropdownEditState {
  const control = root.querySelector<HTMLElement>('.diet-dropdown-edit__control');
  const popover = root.querySelector<HTMLElement>('.diet-popover');
  const editor = root.querySelector<HTMLElement>('.diet-dropdown-edit__editor');
  const headerValue = root.querySelector<HTMLElement>('.diet-dropdown-header-value');
  const hiddenInput = root.querySelector<HTMLInputElement>('.diet-dropdown-edit__field');
  const palette = root.querySelector<HTMLElement>('.diet-dropdown-edit__palette');
  const linkSheet = root.querySelector<HTMLElement>('.diet-dropdown-edit__linksheet');
  const linkPopover = linkSheet?.querySelector<HTMLElement>('.diet-popaddlink') ?? null;

  if (!control || !popover || !editor || !headerValue || !hiddenInput || !palette) {
    throw new Error('[textedit] missing DOM nodes');
  }

  const iconButton = root.querySelector<HTMLSpanElement>('.diet-dropdown-edit__icon .diet-btn-ic');
  if (iconButton) {
    const iconSize = root.dataset.size === 'lg' ? 'sm' : 'xs';
    iconButton.setAttribute('data-size', iconSize);
  }

  const paletteButtons = new Map<Command, HTMLButtonElement>();
  palette.querySelectorAll<HTMLButtonElement>('button[data-command]').forEach((btn) => {
    paletteButtons.set(btn.dataset.command as Command, btn);
  });
  const paletteLinkButton = paletteButtons.get(Command.Link) ?? null;
  const clearFormatButton = paletteButtons.get(Command.ClearFormat);
  const clearLinksButton = paletteButtons.get(Command.ClearLinks);
  const toolbarDivider = palette.querySelector<HTMLElement>('.diet-dropdown-edit__divider');
  if (!clearFormatButton || !clearLinksButton || !toolbarDivider) {
    throw new Error('[textedit] missing clear buttons or divider');
  }

  if (linkPopover) {
    hydratePopAddLink(linkPopover);
  }

  return {
    root,
    control,
    popover,
    editor,
    headerValue,
    hiddenInput,
    palette,
    paletteButtons,
    paletteLinkButton,
    linkSheet: linkSheet ?? null,
    linkPopover,
    tempMarker: null,
    clearFormatButton: clearFormatButton!,
    clearLinksButton: clearLinksButton!,
    toolbarDivider: toolbarDivider!,
    selection: null,
    activeAnchor: null,
    isActive: false,
  };
}

function installHandlers(state: DropdownEditState): void {
  const { editor, palette, paletteButtons, clearFormatButton, clearLinksButton, linkPopover, root } = state;

  palette.addEventListener('click', (ev) => {
    const target = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-command]');
    if (!target) return;
    const command = target.dataset.command as Command;
    handleCommand(state, command);
  });

  clearFormatButton.addEventListener('click', (ev) => {
    ev.preventDefault();
    clearAllFormatting(state);
  });
  clearLinksButton.addEventListener('click', (ev) => {
    ev.preventDefault();
    clearAllLinks(state);
  });

  editor.addEventListener('input', () => {
    state.isActive = true;
    syncPreview(state);
    updateSelectionFromEditor(state);
  });
  editor.addEventListener('focus', () => {
    state.isActive = true;
  });
  editor.addEventListener('mouseup', () => {
    // While the link sheet is open, keep the original selection stable.
    if (!state.root.classList.contains('has-linksheet')) {
      updateSelectionFromEditor(state);
    }
  });
  editor.addEventListener('keyup', () => {
    if (!state.root.classList.contains('has-linksheet')) {
      updateSelectionFromEditor(state);
    }
  });
  editor.addEventListener('blur', () => {
    state.isActive = false;
    if (state.pendingExternal !== undefined) {
      applyExternalValue(state, state.pendingExternal);
      state.pendingExternal = undefined;
    }
    if (!state.root.classList.contains('has-linksheet')) {
      state.selection = null;
      updatePaletteActiveStates(state);
    }
  });

  if (linkPopover) {
    linkPopover.addEventListener('popaddlink:submit', (ev) => {
      const href = (ev as CustomEvent<{ href: string }>).detail?.href;
      if (!href) return;
      applyLinkFromHost(state, href);
      closeInternalLinkSheet(state);
    });
    linkPopover.addEventListener('popaddlink:cancel', () => {
      closeInternalLinkSheet(state);
    });
  }

  // Close link sheet when popover host closes
  root.addEventListener('diet-dropdown-edit:close-linksheet', () => {
    closeInternalLinkSheet(state);
  });
}

function preselectInitialText(state: DropdownEditState) {
  const selection = window.getSelection();
  if (!selection) return;
  const text = state.editor.textContent ?? '';
  if (!text.trim()) {
    selection.removeAllRanges();
    return;
  }
  const walker = document.createTreeWalker(state.editor, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.textContent && node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });
  const first = walker.nextNode() as Text | null;
  if (!first) return;
  const range = document.createRange();
  const textValue = first.textContent || '';
  const words = textValue.trim().split(/\s+/);
  const firstWord = words[0] || '';
  const startIndex = first.textContent!.indexOf(firstWord);
  range.setStart(first, Math.max(0, startIndex));
  range.setEnd(first, Math.min(first.length, startIndex + firstWord.length));
  selection.removeAllRanges();
  selection.addRange(range);
  state.selection = range.cloneRange();
  updatePaletteActiveStates(state);
}

function handleCommand(state: DropdownEditState, command: Command) {
  switch (command) {
    case Command.Bold:
    case Command.Italic:
    case Command.Underline:
    case Command.Strike: {
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
    case Command.Bold:
      surroundSelection(state, 'strong');
      break;
    case Command.Italic:
      surroundSelection(state, 'em');
      break;
    case Command.Underline:
      surroundSelection(state, 'u');
      break;
    case Command.Strike:
      surroundSelection(state, 's');
      break;
    case Command.Link:
      if (!state.selection) {
        updateSelectionFromEditor(state);
      }
      openInternalLinkSheet(state);
      return;
    case Command.ClearFormat:
      clearAllFormatting(state);
      return;
    case Command.ClearLinks:
      clearAllLinks(state);
      return;
    default:
      break;
  }

  syncPreview(state);
  updatePaletteActiveStates(state);
}

function updatePaletteActiveStates(state: DropdownEditState) {
  const tags = collectFormattingTags(state.selection);
  state.paletteButtons.forEach((btn, command) => {
    let tag: string | null = null;
    if (command === Command.Bold) tag = 'STRONG';
    if (command === Command.Italic) tag = 'EM';
    if (command === Command.Underline) tag = 'U';
    if (command === Command.Strike) tag = 'S';
    if (!tag) return;
    btn.classList.toggle('is-active', tags.has(tag));
  });
  updateClearButtons(state);
}

function collectFormattingTags(range: Range | null): Set<string> {
  const tags = new Set<string>();
  if (!range) return tags;
  const frag = range.cloneContents();
  frag.querySelectorAll('*').forEach((node) => tags.add(node.tagName));
  return tags;
}

function surroundSelection(state: DropdownEditState, tag: 'strong' | 'em' | 'u' | 's') {
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

function openInternalLinkSheet(state: DropdownEditState) {
  const { linkSheet, linkPopover, root } = state;
  if (!linkSheet || !linkPopover) return;
  if (!state.selection) return;

  const range = state.selection.cloneRange();
  const anchor = findAnchor(range);
  state.activeAnchor = anchor || null;

   // If we're creating a new link (no existing anchor), visually mark the
   // selection so the user understands which text is being linked.
   if (!anchor) {
     clearTempMarker(state);
     const marker = wrapTempMarker(range);
     if (marker) {
       state.tempMarker = marker;
     }
   }

  const input = linkPopover.querySelector<HTMLInputElement>('.diet-popaddlink__input');
  if (input) {
    input.value = anchor?.getAttribute('href') || '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
    }, 0);
  }

  root.classList.add('has-linksheet');
  linkSheet.setAttribute('aria-hidden', 'false');
}

function applyLinkFromHost(state: DropdownEditState, href: string) {
  if (!state.selection) {
    updateSelectionFromEditor(state);
  }
  if (!state.selection) return;

  const range = state.selection.cloneRange();
  let anchor = state.activeAnchor && isRangeInsideAnchor(range, state.activeAnchor)
    ? state.activeAnchor
    : document.createElement('a');

  anchor.setAttribute('href', href);

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

  anchor.classList.add('diet-dropdown-edit-link');

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

function closeInternalLinkSheet(state: DropdownEditState) {
  const { linkSheet, root } = state;
  if (!linkSheet) return;
  root.classList.remove('has-linksheet');
  linkSheet.setAttribute('aria-hidden', 'true');
  clearTempMarker(state);
}

function removeLinkAtSelection(state: DropdownEditState) {
  if (!state.selection) return;
  const range = state.selection.cloneRange();
  const anchor = findAnchor(range);
  if (!anchor) return;
  const parent = anchor.parentNode;
  if (!parent) return;
  anchor.classList.remove('diet-dropdown-edit-link');
  while (anchor.firstChild) parent.insertBefore(anchor.firstChild, anchor);
  parent.removeChild(anchor);
  syncPreview(state);
  updateClearButtons(state);
  updatePaletteActiveStates(state);
}

function findAnchor(range: Range): HTMLAnchorElement | null {
  let node: Node | null = range.commonAncestorContainer;
  if (node instanceof HTMLAnchorElement) return node;
  node = node.parentNode;
  while (node) {
    if (node instanceof HTMLAnchorElement) return node;
    node = node.parentNode;
  }
  return null;
}

function isRangeInsideAnchor(range: Range, anchor: HTMLAnchorElement): boolean {
  return anchor.contains(range.startContainer) && anchor.contains(range.endContainer);
}

function updateSelectionFromEditor(state: DropdownEditState): void {
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

function updateClearButtons(state: DropdownEditState): void {
  const hasFormatting = Boolean(state.editor.querySelector('strong, b, em, i, u, s'));
  const hasLinks = Boolean(state.editor.querySelector('a'));
  state.clearFormatButton?.classList.toggle('is-hidden', !hasFormatting);
  state.clearLinksButton?.classList.toggle('is-hidden', !hasLinks);
  const showDivider = (hasFormatting || hasLinks) && state.toolbarDivider;
  if (state.toolbarDivider) {
    state.toolbarDivider.classList.toggle('is-hidden', !showDivider);
  }
}

function clearAllFormatting(state: DropdownEditState): void {
  const nodes = state.editor.querySelectorAll('strong, b, em, i, u, s');
  nodes.forEach((el) => unwrapElement(el));
  syncPreview(state);
  updateClearButtons(state);
}

function clearAllLinks(state: DropdownEditState): void {
  const nodes = state.editor.querySelectorAll('a');
  nodes.forEach((anchor) => {
    anchor.classList.remove('diet-dropdown-edit-link');
    unwrapElement(anchor);
  });
  syncPreview(state);
  updateClearButtons(state);
}

function unwrapElement(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function wrapTempMarker(range: Range): HTMLElement | null {
  if (range.collapsed) return null;
  const marker = document.createElement('span');
  marker.className = 'diet-dropdown-edit-linktemp';
  try {
    range.surroundContents(marker);
  } catch {
    return null;
  }
  return marker;
}

function clearTempMarker(state: DropdownEditState): void {
  if (!state.tempMarker) return;
  const marker = state.tempMarker;
  const parent = marker.parentNode;
  if (parent) {
    while (marker.firstChild) parent.insertBefore(marker.firstChild, marker);
    parent.removeChild(marker);
  }
  state.tempMarker = null;
}

function syncFromInstanceData(state: DropdownEditState) {
  const value = state.hiddenInput.value || state.hiddenInput.getAttribute('value') || '';
  state.editor.innerHTML = value || state.headerValue.textContent || '';
  syncPreview(state);
  updateClearButtons(state);
}

function applyExternalValue(state: DropdownEditState, raw: string) {
  const value = raw || '';
  const sanitized = sanitizeInline(value);
  state.editor.innerHTML = sanitized;
  const target = state.headerValue;
  if (sanitized) {
    target.innerHTML = sanitized;
    target.dataset.muted = 'false';
  } else {
    target.textContent = target.dataset.placeholder ?? '';
    target.dataset.muted = 'true';
  }
  highlightPreviewLinks(target);
  state.hiddenInput.value = sanitized;
  updateClearButtons(state);
}

function syncPreview(state: DropdownEditState) {
  const raw = state.editor.innerHTML.trim();
  const sanitized = sanitizeInline(raw);
  const target = state.headerValue;
  if (sanitized) {
    target.innerHTML = sanitized;
  } else {
    target.textContent = state.editor.textContent ?? '';
  }
  highlightPreviewLinks(target);
  const hasValue = raw.length > 0;
  target.dataset.muted = hasValue ? 'false' : 'true';
  if (!hasValue) {
    target.textContent = target.dataset.placeholder ?? '';
  }

  state.hiddenInput.value = sanitized;
  state.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
}

function highlightPreviewLinks(span: HTMLElement) {
  span.querySelectorAll('a').forEach((anchor) => {
    anchor.setAttribute('data-preview-link', '');
  });
}

type SanitizedNode =
  | { type: 'text'; value: string }
  | { type: 'br' }
  | { type: 'tag'; tag: 'strong' | 'b' | 'em' | 'i' | 'u' | 's' | 'a'; attrs: Record<string, string>; children: SanitizedNode[] };

function sanitizeInline(html: string): string {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const allowed = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S', 'A', 'BR']);

  const sanitizeNode = (node: Node): SanitizedNode | SanitizedNode[] | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return { type: 'text', value: node.textContent || '' };
    }
    if (!(node instanceof HTMLElement)) return null;
    const tag = node.tagName.toUpperCase();
    if (!allowed.has(tag)) {
      return Array.from(node.childNodes)
        .map((child) => sanitizeNode(child))
        .flat()
        .filter(Boolean) as SanitizedNode[];
    }
    if (tag === 'BR') return { type: 'br' };

    const attrs: Record<string, string> = {};
    if (tag === 'A') {
      const href = node.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) {
        attrs.href = href;
        if (node.getAttribute('target') === '_blank') {
          attrs.target = '_blank';
          attrs.rel = 'noopener';
        }
      }
      const cls = node.getAttribute('class') || '';
      if (/\bdiet-dropdown-edit-link\b/.test(cls)) {
        attrs.class = 'diet-dropdown-edit-link';
      }
    }

    const children = Array.from(node.childNodes)
      .map((child) => sanitizeNode(child))
      .flat()
      .filter(Boolean) as SanitizedNode[];

    return { type: 'tag', tag: tag.toLowerCase() as any, attrs, children };
  };

  const sanitizedChildren = Array.from(wrapper.childNodes)
    .map((child) => sanitizeNode(child))
    .flat()
    .filter(Boolean) as SanitizedNode[];

  const parts: string[] = [];

  const startsWithNonSpace = (node: SanitizedNode | null): boolean => {
    if (!node) return false;
    if (node.type === 'text') return /^\S/.test(node.value);
    if (node.type === 'br') return false;
    return node.children.some((child) => startsWithNonSpace(child));
  };
  const endsWithNonSpace = (node: SanitizedNode | null): boolean => {
    if (!node) return false;
    if (node.type === 'text') return /\S$/.test(node.value);
    if (node.type === 'br') return false;
    for (let i = node.children.length - 1; i >= 0; i--) {
      if (endsWithNonSpace(node.children[i])) return true;
    }
    return false;
  };

  const appendWithSpace = (node: SanitizedNode, prev: SanitizedNode | null) => {
    const needSpace =
      prev &&
      prev.type !== 'br' &&
      node.type !== 'br' &&
      endsWithNonSpace(prev) &&
      startsWithNonSpace(node);

    if (needSpace) parts.push(' ');

    if (node.type === 'text') {
      parts.push(node.value);
      return;
    }
    if (node.type === 'br') {
      parts.push('<br>');
      return;
    }
    if (node.type === 'tag') {
      const attrs = Object.entries(node.attrs)
        .map(([k, v]) => `${k}="${v.replace(/"/g, '&quot;')}"`)
        .join(' ');
      const open = attrs ? `<${node.tag} ${attrs}>` : `<${node.tag}>`;
      parts.push(open);
      let prevChild: SanitizedNode | null = null;
      node.children.forEach((child) => {
        appendWithSpace(child, prevChild);
        prevChild = child;
      });
      parts.push(`</${node.tag}>`);
    }
  };

  let prev: SanitizedNode | null = null;
  sanitizedChildren.forEach((child) => {
    appendWithSpace(child, prev);
    prev = child;
  });

  return parts.join('');
}
