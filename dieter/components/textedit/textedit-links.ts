import { parse as tldParse } from 'tldts';
import { syncPreview, updateClearButtons } from './textedit-content';
import { Command } from './textedit-types';
import type { LinkState, LinkValidity, TexteditState } from './textedit-types';

type TexteditLinkRuntime = {
  restoreSelection: (state: TexteditState) => boolean;
  schedulePaletteUpdate: (state: TexteditState, immediate?: boolean) => void;
  updatePalettePosition: (state: TexteditState, range: Range) => void;
};

export function toggleLinkForm(state: TexteditState, runtime: TexteditLinkRuntime): void {
  if (state.linkForm.classList.contains('is-hidden')) {
    openLinkForm(state, runtime);
  } else {
    closeLinkForm(state);
  }
}

export function closeLinkForm(state: TexteditState): void {
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

export function applyLink(state: TexteditState, runtime: TexteditLinkRuntime): void {
  if (!runtime.restoreSelection(state) || !state.selection) return;
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
  } else if (!anchor.parentNode || (anchor === state.activeAnchor && anchor.contains(range.commonAncestorContainer))) {
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
  runtime.schedulePaletteUpdate(state, true);
}

export function removeLink(state: TexteditState, runtime: TexteditLinkRuntime): void {
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
  runtime.schedulePaletteUpdate(state, true);
}

function openLinkForm(state: TexteditState, runtime: TexteditLinkRuntime): void {
  if (!runtime.restoreSelection(state) || !state.selection) {
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
  runtime.updatePalettePosition(state, range);
  state.linkInput.focus({ preventScroll: true });
  state.linkInput.select();
  updateLinkActionState(state);
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

function setLinkValidity(state: TexteditState, validity: LinkValidity): void {
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
