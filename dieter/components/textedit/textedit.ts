/**
 * Dieter Textedit New – experimental rich text editor.
 *
 * Prototype goals:
 *  - Floating palette that appears only after the user interacts with text.
 *  - Palette follows selection / caret and keeps formatting toggles in view.
 *  - Link editor anchored to the link button.
 *  - AI actions handled outside the palette (for whole-field rewrites).
 */

import {
  applyExternalValue,
  clearAllFormatting,
  clearAllLinks,
  syncFromInstanceData,
  syncPreview,
  updateClearButtons,
} from './textedit-content';
import { createState } from './textedit-dom';
import { applyLink, closeLinkForm, removeLink, toggleLinkForm } from './textedit-links';
import { Command, type TexteditState } from './textedit-types';

const states = new Map<HTMLElement, TexteditState>();
let activeState: TexteditState | null = null;
let globalBindings = false;

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

function installHandlers(state: TexteditState): void {
  const { control, editor, palette, linkApply, linkRemove, clearFormatButton, clearLinksButton } = state;

  control.addEventListener('click', (ev) => {
    ev.stopPropagation();
    togglePopover(state, true);
  });

  palette.addEventListener('pointerdown', (ev) => ev.preventDefault());
  palette.addEventListener('click', (ev) => {
    const target = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-command]');
    if (!target) return;
    handleCommand(state, target.dataset.command as Command);
  });

  linkApply.addEventListener('click', () =>
    applyLink(state, { restoreSelection, schedulePaletteUpdate, updatePalettePosition }),
  );
  linkRemove.addEventListener('click', () =>
    removeLink(state, { restoreSelection, schedulePaletteUpdate, updatePalettePosition }),
  );
  clearFormatButton.addEventListener('click', (ev) => {
    ev.preventDefault();
    clearAllFormatting(state);
    closeLinkForm(state);
  });
  clearLinksButton.addEventListener('click', (ev) => {
    ev.preventDefault();
    clearAllLinks(state);
    closeLinkForm(state);
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
    if (!state.linkForm.classList.contains('is-hidden')) return;
    state.selection = null;
  });

  state.linkInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      applyLink(state, { restoreSelection, schedulePaletteUpdate, updatePalettePosition });
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      closeLinkForm(state);
    }
  });
}

function preselectInitialText(state: TexteditState): void {
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
    },
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

function togglePopover(state: TexteditState, force?: boolean): void {
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
    return;
  }

  state.root.dataset.state = 'closed';
  state.control.setAttribute('aria-expanded', 'false');
  closePalette(state);
  closeLinkForm(state);
}

function closeAll(): void {
  states.forEach((state) => {
    state.root.dataset.state = 'closed';
    state.control.setAttribute('aria-expanded', 'false');
    closePalette(state);
    closeLinkForm(state);
  });
}

function handleCommand(state: TexteditState, command: Command): void {
  if (!state.allowLinks && (command === Command.Link || command === Command.ClearLinks)) {
    return;
  }
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
      toggleLinkForm(state, { restoreSelection, schedulePaletteUpdate, updatePalettePosition });
      return;
    case Command.ClearFormat:
      clearAllFormatting(state);
      closeLinkForm(state);
      return;
    case Command.ClearLinks:
      clearAllLinks(state);
      closeLinkForm(state);
      return;
  }

  syncPreview(state);
  schedulePaletteUpdate(state, true);
}

function setActiveState(state: TexteditState): void {
  activeState = state;
}

function handleSelectionChange(): void {
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

function schedulePaletteUpdate(state: TexteditState, immediate = false): void {
  if (immediate) {
    handleSelectionChange();
    return;
  }
  requestAnimationFrame(() => {
    if (state === activeState) handleSelectionChange();
  });
}

function showPalette(state: TexteditState): void {
  state.palette.classList.remove('is-hidden');
  if (!state.selection) return;
  requestAnimationFrame(() => {
    if (state.selection) updatePalettePosition(state, state.selection);
  });
}

function closePalette(state: TexteditState): void {
  state.palette.classList.add('is-hidden');
  closeLinkForm(state);
}

function updatePalettePosition(state: TexteditState, range: Range): void {
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

function updatePaletteActiveStates(state: TexteditState): void {
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

function surroundSelection(state: TexteditState, tag: 'strong' | 'em' | 'u' | 's'): void {
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

function handleDocumentPointer(ev: Event): void {
  if (!activeState) return;
  const target = ev.target as Node;
  if (!activeState.root.contains(target)) {
    togglePopover(activeState, false);
    activeState = null;
  }
}

function handleViewportChange(): void {
  if (!activeState || !activeState.selection) return;
  updatePalettePosition(activeState, activeState.selection);
}
