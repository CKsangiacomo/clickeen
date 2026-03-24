import type { TexteditState } from './textedit-types';

export function updateClearButtons(state: TexteditState): void {
  const hasFormatting = Boolean(state.editor.querySelector('strong, b, em, i, u, s'));
  const hasLinks = state.allowLinks ? Boolean(state.editor.querySelector('a')) : false;
  state.clearFormatButton.classList.toggle('is-hidden', !hasFormatting);
  state.clearLinksButton.classList.toggle('is-hidden', !hasLinks);
  state.toolbarDivider.classList.toggle('is-hidden', !(hasFormatting || hasLinks));
}

export function clearAllFormatting(state: TexteditState): void {
  const nodes = state.editor.querySelectorAll('strong, b, em, i, u, s');
  nodes.forEach((el) => unwrapElement(el));
  syncPreview(state);
  updateClearButtons(state);
}

export function clearAllLinks(state: TexteditState): void {
  const nodes = state.editor.querySelectorAll('a');
  nodes.forEach((anchor) => {
    anchor.classList.remove('diet-textedit-link');
    unwrapElement(anchor);
  });
  syncPreview(state);
  updateClearButtons(state);
}

export function syncFromInstanceData(state: TexteditState): void {
  const value = state.hiddenInput.value || state.hiddenInput.getAttribute('value') || '';
  const normalized = normalizeEditorValue(value, state.allowLinks);
  state.editor.innerHTML = normalized || state.previewText.textContent || '';
  syncPreview(state);
  updateClearButtons(state);
}

export function applyExternalValue(state: TexteditState, raw: string): void {
  const normalized = normalizeEditorValue(raw || '', state.allowLinks);
  state.editor.innerHTML = normalized;
  replacePreviewText(state, normalized);
  state.hiddenInput.value = normalized;
  updateClearButtons(state);
}

export function syncPreview(state: TexteditState): void {
  const raw = state.editor.innerHTML.trim();
  const normalized = normalizeEditorValue(raw, state.allowLinks);
  replacePreviewText(state, normalized);
  state.hiddenInput.value = normalized;
  state.hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
}

function replacePreviewText(state: TexteditState, normalized: string): void {
  const sanitized = sanitizeInline(normalized, state.allowLinks);
  const span = document.createElement('span');
  span.className = 'diet-textedit__previewin';
  if (sanitized) span.innerHTML = sanitized;
  else span.textContent = state.editor.textContent ?? '';
  state.previewText.replaceWith(span);
  state.previewText = span;
  highlightPreviewLinks(span);
}

function highlightPreviewLinks(span: HTMLElement): void {
  span.querySelectorAll('a').forEach((anchor) => {
    anchor.setAttribute('data-preview-link', '');
  });
}

function normalizeEditorValue(html: string, allowLinks: boolean): string {
  if (allowLinks) return html;
  return stripLinks(html);
}

function stripLinks(html: string): string {
  if (!html) return '';
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  wrapper.querySelectorAll('a').forEach((anchor) => {
    const parent = anchor.parentNode;
    if (!parent) return;
    while (anchor.firstChild) parent.insertBefore(anchor.firstChild, anchor);
    parent.removeChild(anchor);
  });
  return wrapper.innerHTML;
}

function sanitizeInline(html: string, allowLinks = true): string {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const allowed = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S']);
  if (allowLinks) allowed.add('A');
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
      return;
    }
    Array.from(el.attributes).forEach((attr) => el.removeAttribute(attr.name));
  });
  return wrapper.innerHTML;
}

export function unwrapElement(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}
