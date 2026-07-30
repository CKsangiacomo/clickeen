import { createDialogLifecycle } from '../shared/dialog-lifecycle';

type ObjectManagerOptions = {
  hydrateChildren?: (scope: HTMLElement) => void;
};

type JsonContainer = Record<string, unknown> | unknown[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function createId(): string {
  if (typeof crypto === 'undefined' || !crypto) {
    throw new Error('[object-manager] crypto unavailable');
  }
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto.getRandomValues !== 'function') {
    throw new Error('[object-manager] crypto.getRandomValues unavailable');
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function ensureIdsDeep(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (!isRecord(item)) return;
      if (!item.id) item.id = createId();
      Object.values(item).forEach(ensureIdsDeep);
    });
    return;
  }
  if (isRecord(value)) {
    Object.values(value).forEach(ensureIdsDeep);
  }
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function parseJsonArray(value: string): unknown[] {
  if (!value.trim()) {
    throw new Error('[object-manager] Missing JSON array value');
  }
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error('[object-manager] Expected JSON array');
  }
  return parsed;
}

function stringify(value: unknown): string {
  return JSON.stringify(value);
}

function parseItemLimit(value: string | null): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function getAt(value: unknown, path: string): unknown {
  if (!path) return undefined;
  let current = value;
  for (const part of path.split('.').filter(Boolean)) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isIndex(segment: string): boolean {
  return /^\d+$/.test(segment);
}

function getContainerValue(container: JsonContainer, key: string | number): unknown {
  return (container as Record<string, unknown>)[String(key)];
}

function setContainerValue(container: JsonContainer, key: string | number, value: unknown): void {
  (container as Record<string, unknown>)[String(key)] = value;
}

function setAt(value: Record<string, unknown>, path: string, nextValue: unknown): void {
  const parts = path.split('.').filter(Boolean);
  if (!parts.length) return;
  let current: JsonContainer = value;

  parts.forEach((part, index) => {
    const key = isIndex(part) ? Number(part) : part;
    if (index === parts.length - 1) {
      setContainerValue(current, key, nextValue);
      return;
    }

    const existing = getContainerValue(current, key);
    const nextPart = parts[index + 1];
    const wantsArray = Boolean(nextPart && isIndex(nextPart));
    const nextContainer: JsonContainer = wantsArray
      ? Array.isArray(existing)
        ? existing
        : []
      : isRecord(existing)
        ? existing
        : {};
    setContainerValue(current, key, nextContainer);
    current = nextContainer;
  });
}

function runChildHydrators(scope: HTMLElement, options?: ObjectManagerOptions): void {
  options?.hydrateChildren?.(scope);
}

function dispatchControlsRendered(root: HTMLElement, source: string): void {
  root.dispatchEvent(
    new CustomEvent('dieter-controls-rendered', {
      bubbles: true,
      detail: { source },
    }),
  );
}

function setActionLabel(button: HTMLButtonElement | null, label: string): void {
  if (!button) return;
  button.setAttribute('aria-label', label);
  button.setAttribute('data-tooltip', label);
}

export function hydrateObjectManager(
  scope: Element | DocumentFragment,
  options?: ObjectManagerOptions,
): void {
  scope.querySelectorAll<HTMLElement>('.diet-object-manager').forEach((root) => {
    if (root.dataset.hydrated === 'true') return;
    root.dataset.hydrated = 'true';

    const hidden = root.querySelector<HTMLInputElement>('.diet-object-manager__field');
    const list = root.querySelector<HTMLElement>('[data-objects-list]');
    const addBtn = root.querySelector<HTMLButtonElement>('[data-objects-add]');
    const manageBtn = root.querySelector<HTMLButtonElement>('[data-objects-manage]');
    const itemTemplate = root.querySelector<HTMLTemplateElement>('template[data-objects-item]');
    const dialog = root.querySelector<HTMLDialogElement>('[data-objects-modal]');
    const editor = root.querySelector<HTMLElement>('[data-objects-editor]');
    const modalList = root.querySelector<HTMLElement>('[data-objects-modal-list]');
    const rowTemplate = root.querySelector<HTMLTemplateElement>('template[data-objects-row]');
    const saveBtn = root.querySelector<HTMLButtonElement>('[data-objects-save]');
    const cancelBtn = root.querySelector<HTMLButtonElement>('[data-objects-cancel]');
    const discardPanel = root.querySelector<HTMLElement>('[data-objects-discard-panel]');
    const keepEditingBtn = root.querySelector<HTMLButtonElement>('[data-objects-keep-editing]');
    const discardBtn = root.querySelector<HTMLButtonElement>('[data-objects-discard]');

    if (
      !hidden ||
      !list ||
      !addBtn ||
      !manageBtn ||
      !itemTemplate ||
      !dialog ||
      !editor ||
      !modalList ||
      !rowTemplate ||
      !saveBtn ||
      !cancelBtn ||
      !discardPanel ||
      !keepEditingBtn ||
      !discardBtn
    ) {
      return;
    }

    const indexToken = (root.getAttribute('data-index-token') || '__INDEX__').trim();
    const labelPath = root.getAttribute('data-label-path') || '';
    const minItems = parseItemLimit(root.getAttribute('data-min-items'));
    const defaultItemAttribute = root.getAttribute('data-default-item') || '';
    const editorLabel = dialog.getAttribute('aria-label') || 'Manage objects';
    let defaultItem: unknown = null;
    if (defaultItemAttribute) {
      defaultItem = JSON.parse(decodeHtmlEntities(defaultItemAttribute)) as unknown;
    }

    const read = (): unknown[] => {
      const raw =
        hidden.value ||
        hidden.getAttribute('value') ||
        hidden.getAttribute('data-bob-json') ||
        '[]';
      return parseJsonArray(raw);
    };

    const write = (value: unknown[]): void => {
      const json = stringify(value);
      hidden.value = json;
      hidden.setAttribute('data-bob-json', json);
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const getSignature = (items: unknown[]): string => {
      const ids = items.map((item) => {
        if (!isRecord(item)) return '';
        return typeof item.id === 'string' ? item.id : '';
      });
      return `${items.length}:${ids.join('|')}`;
    };

    let lastSignature: string | null = null;

    const render = (): void => {
      const items = read();
      lastSignature = getSignature(items);
      list.innerHTML = '';
      const templateHtml = itemTemplate.innerHTML || '';
      const basePath =
        hidden.getAttribute('data-bob-path') || hidden.getAttribute('data-path') || '';

      items.forEach((itemData, index) => {
        const container = document.createElement('div');
        container.className = 'diet-object-manager__item';
        container.setAttribute('data-object-index', String(index));
        container.innerHTML = templateHtml.replace(new RegExp(indexToken, 'g'), String(index));

        container.querySelectorAll<HTMLElement>('[data-bob-path]').forEach((element) => {
          const path = element.getAttribute('data-bob-path') || '';
          const prefix = basePath ? `${basePath}.${index}.` : '';
          if (!prefix || !path.startsWith(prefix)) return;
          const fieldValue = getAt(itemData, path.slice(prefix.length));
          if (fieldValue == null) return;

          if (element instanceof HTMLInputElement) {
            if (element.type === 'checkbox') {
              element.checked = Boolean(fieldValue);
              return;
            }
            if (element.dataset.bobJson != null) {
              const json = stringify(fieldValue);
              element.value = json;
              element.setAttribute('data-bob-json', json);
              return;
            }
            if (element.type === 'hidden' && Array.isArray(fieldValue)) {
              const json = stringify(fieldValue);
              element.value = json;
              element.setAttribute('data-bob-json', json);
              return;
            }
            element.value = String(fieldValue);
            return;
          }

          if (element instanceof HTMLTextAreaElement) {
            element.value = String(fieldValue);
          }
        });
        list.appendChild(container);
      });

      runChildHydrators(list, options);
      const canManage = items.length > 1;
      manageBtn.hidden = !canManage;
      manageBtn.style.display = canManage ? '' : 'none';
      dispatchControlsRendered(root, 'object-manager');
    };

    const handleExternalSync = (event: Event): void => {
      if (event.type !== 'external-sync') return;
      try {
        const detail = (event as CustomEvent<{ value?: unknown }>).detail;
        const payload = detail && typeof detail.value !== 'undefined' ? detail.value : hidden.value;
        const nextJson = typeof payload === 'string' ? payload : stringify(payload);
        hidden.value = nextJson;
        hidden.setAttribute('data-bob-json', nextJson);

        const nextItems = parseJsonArray(nextJson);
        if (getSignature(nextItems) !== lastSignature) {
          render();
        }
      } catch (error) {
        if ((window as Window & { __CK_DEV__?: boolean }).__CK_DEV__ === true) {
          console.warn('[object-manager] external sync failed', error);
        }
      }
    };

    hidden.addEventListener('external-sync', handleExternalSync);

    const handleNestedChange = (event: Event): void => {
      const detail = (event as CustomEvent<{ bobIgnore?: boolean }>).detail;
      if (detail?.bobIgnore) return;
      const target = event.target;
      if (
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement) &&
        !(target instanceof HTMLSelectElement)
      ) {
        return;
      }
      if (target === hidden) return;

      const basePath =
        hidden.getAttribute('data-bob-path') || hidden.getAttribute('data-path') || '';
      if (!basePath) return;
      const path = target.getAttribute('data-bob-path') || '';
      if (!path.startsWith(`${basePath}.`)) return;
      const parts = path.slice(basePath.length + 1).split('.');
      const itemIndex = parts.shift();
      if (!itemIndex || !isIndex(itemIndex) || parts.length === 0) return;

      const items = read();
      const item = items[Number(itemIndex)];
      if (!isRecord(item)) return;
      let nextValue: unknown;
      if (target instanceof HTMLInputElement && target.type === 'checkbox') {
        nextValue = target.checked;
      } else if (target instanceof HTMLInputElement && target.dataset.bobJson != null) {
        try {
          nextValue = JSON.parse(target.value) as unknown;
        } catch {
          return;
        }
      } else {
        nextValue = target.value;
      }
      setAt(item, parts.join('.'), nextValue);
      write(items);
    };

    root.addEventListener('input', handleNestedChange, true);
    root.addEventListener('change', handleNestedChange, true);

    addBtn.addEventListener('click', () => {
      const next = read();
      const clonedDefault = defaultItem ? deepClone(defaultItem) : null;
      const item: Record<string, unknown> = isRecord(clonedDefault) ? clonedDefault : {};
      if (!item.id) item.id = createId();
      ensureIdsDeep(item);
      next.push(item);
      write(next);
      render();
    });

    let original: unknown[] = [];
    let working: unknown[] = [];
    let editorFocus: HTMLElement | null = null;

    const isDirty = (): boolean =>
      original.length !== working.length || original.some((item, index) => item !== working[index]);

    const showEditor = (restoreFocus: boolean): void => {
      discardPanel.hidden = true;
      editor.hidden = false;
      dialog.setAttribute('aria-label', editorLabel);
      if (restoreFocus) {
        const focusTarget = editorFocus?.isConnected ? editorFocus : cancelBtn;
        focusTarget.focus({ preventScroll: true });
      }
    };

    const showDiscardConfirmation = (): void => {
      editorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      editor.hidden = true;
      discardPanel.hidden = false;
      dialog.setAttribute('aria-label', 'Discard changes?');
      keepEditingBtn.focus({ preventScroll: true });
    };

    const requestClose = (): void => {
      if (isDirty()) {
        showDiscardConfirmation();
        return;
      }
      lifecycle.close();
    };

    const lifecycle = createDialogLifecycle({
      dialog,
      initialFocus: cancelBtn,
      requestDismiss: (reason) => {
        if (reason === 'backdrop') return;
        if (!discardPanel.hidden) {
          showEditor(true);
          return;
        }
        requestClose();
      },
    });

    const rebuildRows = (): void => {
      modalList.innerHTML = '';
      const sourceRow = rowTemplate.content.firstElementChild;
      if (!(sourceRow instanceof HTMLElement)) return;

      working.forEach((item, index) => {
        const row = sourceRow.cloneNode(true) as HTMLElement;
        const labelElement = row.querySelector<HTMLElement>('[data-objects-label]');
        const rawLabel = getAt(item, labelPath);
        const label = rawLabel ? String(rawLabel) : `Object ${index + 1}`;
        if (labelElement) labelElement.textContent = label;

        const up = row.querySelector<HTMLButtonElement>('[data-objects-up]');
        const down = row.querySelector<HTMLButtonElement>('[data-objects-down]');
        const deleteButton = row.querySelector<HTMLButtonElement>('[data-objects-delete]');
        setActionLabel(up, `Move ${label} up`);
        setActionLabel(down, `Move ${label} down`);
        setActionLabel(deleteButton, `Delete ${label}`);

        if (deleteButton) {
          deleteButton.disabled = minItems != null && working.length <= minItems;
        }

        up?.addEventListener('click', () => {
          if (index === 0) return;
          const [moved] = working.splice(index, 1);
          working.splice(index - 1, 0, moved);
          rebuildRows();
        });
        down?.addEventListener('click', () => {
          if (index >= working.length - 1) return;
          const [moved] = working.splice(index, 1);
          working.splice(index + 1, 0, moved);
          rebuildRows();
        });
        deleteButton?.addEventListener('click', () => {
          if (minItems != null && working.length <= minItems) return;
          working.splice(index, 1);
          rebuildRows();
        });
        modalList.appendChild(row);
      });
    };

    manageBtn.addEventListener('click', () => {
      original = read();
      working = original.slice();
      editorFocus = null;
      showEditor(false);
      rebuildRows();
      lifecycle.open(manageBtn);
    });

    saveBtn.addEventListener('click', () => {
      write(working);
      render();
      lifecycle.close();
    });
    cancelBtn.addEventListener('click', requestClose);
    keepEditingBtn.addEventListener('click', () => showEditor(true));
    discardBtn.addEventListener('click', () => {
      working = [];
      lifecycle.close();
    });

    render();
  });
}
