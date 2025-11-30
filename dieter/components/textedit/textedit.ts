/**
 * Dieter Textedit New – experimental rich text editor.
 *
 * Prototype goals:
 *  - Floating palette that appears only after the user interacts with text.
 *  - Palette follows selection / caret and keeps formatting toggles in view.
 *  - Link editor anchored to the link button.
 *  - AI actions handled outside the palette (for whole-field rewrites).
 */

import { parse as tldParse } from 'tldts';

const states = new Map<HTMLElement, TexteditState>();
let activeState: TexteditState | null = null;
let globalBindings = false;

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

type LinkValidity = 'empty' | 'valid' | 'invalid';

interface TexteditState {
  root: HTMLElement;
  control: HTMLElement;
  popover: HTMLElement;
  editor: HTMLElement;
  preview: HTMLElement;
  previewText: HTMLElement;
  hiddenInput: HTMLInputElement;

  palette: HTMLElement;
  paletteButtons: Map<Command, HTMLButtonElement>;
  paletteLinkButton: HTMLButtonElement | null;
  hasInteracted: boolean;
  pointerDown: boolean;
  linkForm: HTMLElement;
  linkTitle: HTMLElement;
  linkInput: HTMLInputElement;
  linkNewTab: HTMLInputElement;
  linkNoFollow: HTMLInputElement;
  linkApply: HTMLButtonElement;
  linkRemove: HTMLButtonElement;
  initialLink: LinkState | null;
  linkSnippet: string;
  linkValidity: LinkValidity;

  selection: Range | null;
  activeAnchor: HTMLAnchorElement | null;
  tempMarker: HTMLElement | null;
  clearFormatButton: HTMLButtonElement;
  clearLinksButton: HTMLButtonElement;
  toolbarDivider: HTMLElement;
}

interface LinkState {
  url: string;
  newTab: boolean;
  noFollow: boolean;
}

export function hydrateTextedit(scope: Element | DocumentFragment): void {
  const roots = scope.querySelectorAll<HTMLElement>('.diet-textedit');
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
      applyExternalValue(state, value);
    });
  });

  if (!globalBindings) {
    globalBindings = true;
    document.addEventListener('selectionchange', handleSelectionChange, true);
    document.addEventListener('pointerdown', handleDocumentPointer, true);
    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.addEventListener('scroll', handleViewportChange, { passive: true });
  }
}

function createState(root: HTMLElement): TexteditState {
  const control = root.querySelector<HTMLElement>('.diet-textedit__control');
  const popover = root.querySelector<HTMLElement>('.diet-popover');
  const editor = root.querySelector<HTMLElement>('.diet-textedit__editor');
  const preview = root.querySelector<HTMLElement>('.diet-textedit__preview');
  const previewText = root.querySelector<HTMLElement>('.diet-textedit__previewin');
  const hiddenInput = root.querySelector<HTMLInputElement>('.diet-textedit__field');

  if (!control || !popover || !editor || !preview || !previewText || !hiddenInput) {
    throw new Error('[textedit] missing DOM nodes');
  }

  const palette = document.createElement('div');
  palette.className = 'diet-textedit__palette is-hidden';
  palette.innerHTML = `
    <div class="diet-textedit__toolbarrow">
      <div class="diet-textedit__group diet-textedit__group--format">
        ${buttonHTML(Command.Bold, 'bold')}
        ${buttonHTML(Command.Italic, 'italic')}
        ${buttonHTML(Command.Underline, 'underline')}
        ${buttonHTML(Command.Strike, 'strikethrough')}
        ${buttonHTML(Command.Link, 'link')}
      </div>
      <span class="diet-textedit__divider is-hidden"></span>
      <div class="diet-textedit__group diet-textedit__group--clear">
        ${buttonHTML(Command.ClearFormat, 'arrow.counterclockwise')}
        ${buttonHTML(Command.ClearLinks, 'personalhotspot.slash')}
      </div>
    </div>
    <div class="diet-textedit__linkform is-hidden" data-validity="empty">
      <div class="diet-textedit__linkinner">
        <div class="diet-textedit__linkheader">
          <span class="diet-textedit__linktitle label">Link this text</span>
          <button type="button" class="diet-btn-txt diet-textedit__linkapply" data-size="xs" data-variant="primary"><span class="diet-btn-txt__label">Apply link</span></button>
        </div>
        <div class="diet-textfield" data-size="md">
          <label class="diet-textfield__control">
            <input type="text" class="diet-textfield__field diet-textedit__linkinput" placeholder="link url" />
          </label>
        </div>
        <div class="diet-textedit__linkoptions">
          <label class="diet-toggle diet-toggle--split" data-size="sm">
            <span class="diet-toggle__label label-small">Open link in a new tab</span>
            <input class="diet-toggle__input sr-only diet-textedit__linknewtab" type="checkbox" />
            <span class="diet-toggle__switch"><span class="diet-toggle__knob"></span></span>
          </label>
          <label class="diet-toggle diet-toggle--split" data-size="sm">
            <span class="diet-toggle__label label-small">Add "no follow" to link</span>
            <input class="diet-toggle__input sr-only diet-textedit__linknofollow" type="checkbox" />
            <span class="diet-toggle__switch"><span class="diet-toggle__knob"></span></span>
          </label>
        </div>
        <button type="button" class="diet-btn-txt diet-textedit__linkremove" data-size="xs" data-variant="secondary"><span class="diet-btn-txt__label">Remove link</span></button>
      </div>
    </div>
  `;
  popover.appendChild(palette);

  const iconButton = root.querySelector<HTMLSpanElement>('.diet-textedit__icon .diet-btn-ic');
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
  const toolbarDivider = palette.querySelector<HTMLElement>('.diet-textedit__divider');
  if (!clearFormatButton || !clearLinksButton || !toolbarDivider) {
    throw new Error('[textedit] missing clear buttons or divider');
  }
  const linkForm = palette.querySelector<HTMLElement>('.diet-textedit__linkform')!;
  const linkTitle = palette.querySelector<HTMLElement>('.diet-textedit__linktitle')!;
  const linkInput = palette.querySelector<HTMLInputElement>('.diet-textedit__linkinput')!;
  const linkNewTab = palette.querySelector<HTMLInputElement>('.diet-textedit__linknewtab')!;
  const linkNoFollow = palette.querySelector<HTMLInputElement>('.diet-textedit__linknofollow')!;
  const linkApply = palette.querySelector<HTMLButtonElement>('.diet-textedit__linkapply')!;
  const linkRemove = palette.querySelector<HTMLButtonElement>('.diet-textedit__linkremove')!;
  linkApply.disabled = true;
  linkRemove.style.display = 'none';

  return {
    root,
    control,
    popover,
    editor,
    preview,
    previewText,
    hiddenInput,
    palette,
    paletteButtons,
    paletteLinkButton,
    hasInteracted: false,
    pointerDown: false,
    linkForm,
    linkTitle,
    linkInput,
    linkNewTab,
    linkNoFollow,
    linkApply,
    linkRemove,
    initialLink: null,
    linkSnippet: '',
    tempMarker: null,
    linkValidity: 'empty',
    clearFormatButton: clearFormatButton!,
    clearLinksButton: clearLinksButton!,
    toolbarDivider: toolbarDivider!,
    selection: null,
    activeAnchor: null,
  };
}

function buttonHTML(command: Command, icon: string): string {
  return `
    <button type="button" class="diet-btn-ic" data-size="sm" data-variant="neutral" data-command="${command}">
      <span class="diet-btn-ic__icon" data-icon="${icon}"></span>
    </button>
  `;
}

function installHandlers(state: TexteditState): void {
  const { control, editor, palette, paletteButtons, linkApply, linkRemove, clearFormatButton, clearLinksButton } = state;

  control.addEventListener('click', (ev) => {
    ev.stopPropagation();
    togglePopover(state, true);
  });

  palette.addEventListener('pointerdown', (ev) => ev.preventDefault());
  palette.addEventListener('click', (ev) => {
    const target = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-command]');
    if (!target) return;
    const command = target.dataset.command as Command;
    handleCommand(state, command);
  });

  linkApply.addEventListener('click', () => applyLink(state));
  linkRemove.addEventListener('click', () => removeLink(state));
  clearFormatButton.addEventListener('click', (ev) => {
    ev.preventDefault();
    clearAllFormatting(state);
  });
  clearLinksButton.addEventListener('click', (ev) => {
    ev.preventDefault();
    clearAllLinks(state);
  });

  editor.addEventListener('input', () => {
    syncPreview(state);
    state.hasInteracted = false;
    closePalette(state);
    closeLinkForm(state);
  });
  editor.addEventListener('pointerdown', () => {
    setActiveState(state);
    state.hasInteracted = true;
    state.pointerDown = true;
    schedulePaletteUpdate(state);
  });
  editor.addEventListener('pointermove', () => {
    if (!state.pointerDown) return;
    schedulePaletteUpdate(state);
  });
  editor.addEventListener('pointerup', () => {
    state.pointerDown = false;
    schedulePaletteUpdate(state, true);
  });
  editor.addEventListener('keyup', () => {
    setActiveState(state);
    state.hasInteracted = true;
    schedulePaletteUpdate(state);
  });
  editor.addEventListener('blur', () => {
    // Don't clear selection if link form is open (user may return to apply link)
    if (!state.linkForm.classList.contains('is-hidden')) return;
    state.selection = null;
  });

  state.linkInput.addEventListener('input', () => {
    const res = validateUrl(state.linkInput.value);
    setLinkValidity(state, res.state);
  });
  state.linkNewTab.addEventListener('change', () => setLinkValidity(state, state.linkValidity));
  state.linkNoFollow.addEventListener('change', () => setLinkValidity(state, state.linkValidity));
  state.linkInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      applyLink(state);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      closeLinkForm(state);
    }
  });
}

function preselectInitialText(state: TexteditState) {
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
  updatePalettePosition(state, range);
  updatePaletteActiveStates(state);
  showPalette(state);
}

function togglePopover(state: TexteditState, force?: boolean) {
  const shouldOpen = force ?? state.root.dataset.state !== 'open';
  if (shouldOpen) {
    closeAll();
    state.root.dataset.state = 'open';
    state.control.setAttribute('aria-expanded', 'true');
    setActiveState(state);
    state.editor.focus({ preventScroll: true });
    state.hasInteracted = true;
    state.pointerDown = false;
    preselectInitialText(state);
    closePalette(state);
  } else {
    state.root.dataset.state = 'closed';
    state.control.setAttribute('aria-expanded', 'false');
    closePalette(state);
    closeLinkForm(state);
  }
}

function closeAll() {
  states.forEach((state) => {
    state.root.dataset.state = 'closed';
    state.control.setAttribute('aria-expanded', 'false');
    closePalette(state);
    closeLinkForm(state);
  });
}

function handleCommand(state: TexteditState, command: Command) {
  if (!restoreSelection(state)) {
    closePalette(state);
    return;
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
      toggleLinkForm(state);
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
  schedulePaletteUpdate(state, true);
}

function setActiveState(state: TexteditState) {
  activeState = state;
}

function handleSelectionChange() {
  if (!activeState) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    closePalette(activeState);
    activeState.selection = null;
    return;
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  if (!activeState.editor.contains(container)) {
    if (!activeState.linkForm.classList.contains('is-hidden')) return;
    closePalette(activeState);
    activeState.selection = null;
    return;
  }

  activeState.selection = range.cloneRange();
  if (range.collapsed) {
    if (!activeState.linkForm.classList.contains('is-hidden')) return;
    closePalette(activeState);
    return;
  }
  if (!activeState.hasInteracted) {
    closePalette(activeState);
    return;
  }

  updatePalettePosition(activeState, range);
  updatePaletteActiveStates(activeState);
  showPalette(activeState);
}

function schedulePaletteUpdate(state: TexteditState, immediate = false) {
  if (immediate) {
    handleSelectionChange();
    return;
  }
  requestAnimationFrame(() => {
    if (state === activeState) handleSelectionChange();
  });
}

function showPalette(state: TexteditState) {
  state.palette.classList.remove('is-hidden');
  if (state.selection) {
    requestAnimationFrame(() => {
      if (state.selection) updatePalettePosition(state, state.selection);
    });
  }
}

function closePalette(state: TexteditState) {
  state.palette.classList.add('is-hidden');
  closeLinkForm(state);
}

function updatePalettePosition(state: TexteditState, range: Range) {
  const rect = range.getBoundingClientRect();
  const hostRect = state.popover.getBoundingClientRect();
  const paletteRect = state.palette.getBoundingClientRect();
  const offset = 6;
  const left = rect.left - hostRect.left + rect.width / 2 - paletteRect.width / 2;
  const top = rect.bottom - hostRect.top + offset;
  state.palette.style.left = `${Math.round(left)}px`;
  state.palette.style.top = `${Math.round(top)}px`;
  state.palette.style.transform = 'translate(0,0)';
}

function updatePaletteActiveStates(state: TexteditState) {
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

function restoreSelection(state: TexteditState): boolean {
  if (!state.selection) return false;
  const selection = window.getSelection();
  if (!selection) return false;
  selection.removeAllRanges();
  selection.addRange(state.selection.cloneRange());
  return true;
}

function surroundSelection(state: TexteditState, tag: 'strong' | 'em' | 'u' | 's') {
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

function toggleLinkForm(state: TexteditState) {
  if (state.linkForm.classList.contains('is-hidden')) {
    openLinkForm(state);
  } else {
    closeLinkForm(state);
  }
}

function openLinkForm(state: TexteditState) {
  if (!restoreSelection(state) || !state.selection) {
    closeLinkForm(state);
    return;
  }

  const range = state.selection.cloneRange();
  const anchor = findAnchor(range);
  state.activeAnchor = anchor;

  if (anchor) {
    state.linkInput.value = anchor.getAttribute('href') || '';
    state.linkNewTab.checked = anchor.getAttribute('target') === '_blank';
    state.linkNoFollow.checked = (anchor.getAttribute('rel') || '').split(/\s+/).includes('nofollow');
    anchor.classList.add('diet-textedit-link');
    clearTempMarker(state);
  } else {
    state.linkInput.value = '';
    state.linkNewTab.checked = false;
    state.linkNoFollow.checked = false;
    state.tempMarker = wrapTempMarker(range);
    if (state.tempMarker) {
      const markerRange = document.createRange();
      markerRange.selectNodeContents(state.tempMarker);
      state.selection = markerRange.cloneRange();
    }
  }

  state.initialLink = {
    url: state.linkInput.value.trim(),
    newTab: state.linkNewTab.checked,
    noFollow: state.linkNoFollow.checked,
  };
  state.linkForm.classList.toggle('has-anchor', Boolean(anchor));
  state.linkRemove.style.display = anchor ? 'inline-flex' : 'none';
  state.linkSnippet = range.toString().trim();
  state.linkTitle.textContent = 'Link this text';
  state.linkTitle.classList.remove('is-error');

  const res = validateUrl(state.linkInput.value);
  setLinkValidity(state, res.state);

  state.linkForm.classList.remove('is-hidden');
  state.palette.classList.add('has-linkform');
  state.paletteButtons.get(Command.Link)?.classList.add('is-active');
  updatePalettePosition(state, range);
  state.linkInput.focus({ preventScroll: true });
  state.linkInput.select();
  updateLinkActionState(state);
}

function closeLinkForm(state: TexteditState) {
  if (state.linkForm.classList.contains('is-hidden')) return;
  state.linkForm.classList.add('is-hidden');
  state.palette.classList.remove('has-linkform');
  state.paletteButtons.get(Command.Link)?.classList.remove('is-active');
  state.linkForm.dataset.validity = 'empty';
  state.linkTitle.textContent = 'Link this text';
  state.linkTitle.classList.remove('is-error');
  state.activeAnchor = null;
  state.initialLink = null;
  state.linkRemove.style.display = 'none';
  state.linkApply.disabled = true;
  clearTempMarker(state);
  state.linkSnippet = '';
}

function applyLink(state: TexteditState) {
  if (!restoreSelection(state) || !state.selection) return;
  const res = validateUrl(state.linkInput.value);
  setLinkValidity(state, res.state);
  if (res.state !== 'valid') return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);

  let anchor = state.activeAnchor && isRangeInsideAnchor(range, state.activeAnchor)
    ? state.activeAnchor
    : document.createElement('a');

  anchor.setAttribute('href', res.url);
  if (state.linkNewTab.checked) anchor.setAttribute('target', '_blank');
  else anchor.removeAttribute('target');
  if (state.linkNoFollow.checked) anchor.setAttribute('rel', 'nofollow noopener');
  else anchor.removeAttribute('rel');

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
  } else if (!anchor.parentNode || anchor === state.activeAnchor && anchor.contains(range.commonAncestorContainer)) {
    // already wrapped
  } else {
    try {
      range.surroundContents(anchor);
    } catch {
      const frag = range.extractContents();
      anchor.append(frag);
      range.insertNode(anchor);
    }
  }

  anchor.classList.add('diet-textedit-link');

  const newRange = document.createRange();
  newRange.selectNodeContents(anchor);
  selection.removeAllRanges();
  selection.addRange(newRange);
  state.selection = newRange.cloneRange();

  closeLinkForm(state);
  syncPreview(state);
  updateClearButtons(state);
  schedulePaletteUpdate(state, true);
}

function removeLink(state: TexteditState) {
  if (!state.activeAnchor) {
    closeLinkForm(state);
    return;
  }
  const anchor = state.activeAnchor;
  const parent = anchor.parentNode;
  if (parent) {
    anchor.classList.remove('diet-textedit-link');
    while (anchor.firstChild) parent.insertBefore(anchor.firstChild, anchor);
    parent.removeChild(anchor);
  }
  closeLinkForm(state);
  syncPreview(state);
  updateClearButtons(state);
  schedulePaletteUpdate(state, true);
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

function handleDocumentPointer(ev: Event) {
  if (!activeState) return;
  const target = ev.target as Node;
  if (!activeState.root.contains(target)) {
    togglePopover(activeState, false);
    activeState = null;
  }
}

function handleViewportChange() {
  if (!activeState || !activeState.selection) return;
  updatePalettePosition(activeState, activeState.selection);
}

function validateUrl(raw?: string): { state: LinkValidity; url: string } {
  const value = (raw || '').trim();
  if (!value) return { state: 'empty', url: '' };
  if (/(\s)/.test(value)) return { state: 'invalid', url: '' };
  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(normalized);
    if (!(url.protocol === 'http:' || url.protocol === 'https:')) return { state: 'invalid', url: '' };
    const host = url.hostname;
    if (host === 'localhost') return { state: 'valid', url: url.toString() };
    const parsed = tldParse(host, { allowPrivateDomains: true });
    if (parsed.isIp) return { state: 'valid', url: url.toString() };
    if (parsed.domain && (parsed.isIcann || parsed.isPrivate)) return { state: 'valid', url: url.toString() };
    return { state: 'invalid', url: '' };
  } catch {
    return { state: 'invalid', url: '' };
  }
}

function setLinkValidity(state: TexteditState, validity: LinkValidity) {
  state.linkValidity = validity;
  state.linkForm.dataset.validity = validity;
  if (validity === 'invalid') {
    state.linkTitle.textContent = 'Not a valid url';
    state.linkTitle.classList.add('is-error');
  } else {
    state.linkTitle.textContent = 'Link this text';
    state.linkTitle.classList.remove('is-error');
  }
  updateLinkActionState(state);
}

function getCurrentLinkState(state: TexteditState): LinkState {
  return {
    url: state.linkInput.value.trim(),
    newTab: state.linkNewTab.checked,
    noFollow: state.linkNoFollow.checked,
  };
}

function updateLinkActionState(state: TexteditState): void {
  const current = getCurrentLinkState(state);
  const initial = state.initialLink ?? { url: '', newTab: false, noFollow: false };
  const hasChanges =
    current.url !== initial.url ||
    current.newTab !== initial.newTab ||
    current.noFollow !== initial.noFollow;
  const canApply = state.linkValidity === 'valid' && hasChanges;
  state.linkApply.disabled = !canApply;
  state.linkForm.classList.toggle('has-anchor', Boolean(state.activeAnchor));
  state.linkRemove.style.display = state.activeAnchor ? 'inline-flex' : 'none';

  const togglesEnabled = Boolean(state.activeAnchor) || state.linkValidity === 'valid';
  state.linkNewTab.disabled = !togglesEnabled;
  state.linkNoFollow.disabled = !togglesEnabled;
  state.linkNewTab.closest('label')?.classList.toggle('is-disabled', !togglesEnabled);
  state.linkNoFollow.closest('label')?.classList.toggle('is-disabled', !togglesEnabled);
  state.linkForm.classList.toggle('can-toggle', togglesEnabled);
}

function updateClearButtons(state: TexteditState): void {
  const hasFormatting = Boolean(state.editor.querySelector('strong, b, em, i, u, s'));
  const hasLinks = Boolean(state.editor.querySelector('a'));
  state.clearFormatButton?.classList.toggle('is-hidden', !hasFormatting);
  state.clearLinksButton?.classList.toggle('is-hidden', !hasLinks);
  const showDivider = (hasFormatting || hasLinks) && state.toolbarDivider;
  if (state.toolbarDivider) {
    state.toolbarDivider.classList.toggle('is-hidden', !showDivider);
  }
}

function clearAllFormatting(state: TexteditState): void {
  const nodes = state.editor.querySelectorAll('strong, b, em, i, u, s');
  nodes.forEach((el) => unwrapElement(el));
  syncPreview(state);
  updateClearButtons(state);
  closeLinkForm(state);
}

function clearAllLinks(state: TexteditState): void {
  const nodes = state.editor.querySelectorAll('a');
  nodes.forEach((anchor) => {
    anchor.classList.remove('diet-textedit-link');
    unwrapElement(anchor);
  });
  syncPreview(state);
  updateClearButtons(state);
  closeLinkForm(state);
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
  marker.className = 'diet-textedit-linktemp';
  try {
    range.surroundContents(marker);
  } catch {
    return null;
  }
  return marker;
}

function clearTempMarker(state: TexteditState): void {
  if (!state.tempMarker) return;
  const marker = state.tempMarker;
  const parent = marker.parentNode;
  if (parent) {
    while (marker.firstChild) parent.insertBefore(marker.firstChild, marker);
    parent.removeChild(marker);
  }
  state.tempMarker = null;
}

function syncFromInstanceData(state: TexteditState) {
  const value = state.hiddenInput.value || state.hiddenInput.getAttribute('value') || '';
  state.editor.innerHTML = value || state.previewText.textContent || '';
  syncPreview(state);
  updateClearButtons(state);
}

function applyExternalValue(state: TexteditState, raw: string) {
  const value = raw || '';
  state.editor.innerHTML = value;
  const sanitized = sanitizeInline(value);
  const span = document.createElement('span');
  span.className = 'diet-textedit__previewin';
  if (sanitized) span.innerHTML = sanitized;
  else span.textContent = state.editor.textContent ?? '';
  state.previewText.replaceWith(span);
  state.previewText = span;
  highlightPreviewLinks(span);
  state.hiddenInput.value = value;
  updateClearButtons(state);
}

function syncPreview(state: TexteditState) {
  const raw = state.editor.innerHTML.trim();
  const sanitized = sanitizeInline(raw);
  const span = document.createElement('span');
  span.className = 'diet-textedit__previewin';
  if (sanitized) span.innerHTML = sanitized;
  else span.textContent = state.editor.textContent ?? '';
  state.previewText.replaceWith(span);
  state.previewText = span;
  highlightPreviewLinks(span);

  state.hiddenInput.value = raw;
  state.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
}

function highlightPreviewLinks(span: HTMLElement) {
  span.querySelectorAll('a').forEach((anchor) => {
    anchor.setAttribute('data-preview-link', '');
  });
}

function sanitizeInline(html: string): string {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const allowed = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S', 'A']);
  wrapper.querySelectorAll('*').forEach((node) => {
    const el = node as HTMLElement;
    const tag = el.tagName;
    if (!allowed.has(tag)) {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      return;
    }
    if (tag === 'A') {
      const href = el.getAttribute('href') || '';
      if (!/^https?:\/\//i.test(href)) {
        el.removeAttribute('href');
        el.removeAttribute('target');
        el.removeAttribute('rel');
      } else {
        if (el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener');
        else el.removeAttribute('rel');
      }
      Array.from(el.attributes).forEach((attr) => {
        if (!['href', 'target', 'rel', 'data-preview-link'].includes(attr.name)) {
          el.removeAttribute(attr.name);
        }
      });
    } else {
      Array.from(el.attributes).forEach((attr) => el.removeAttribute(attr.name));
    }
  });
  return wrapper.innerHTML;
}
