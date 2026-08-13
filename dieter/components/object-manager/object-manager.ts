import { createDialogLifecycle, type DialogLifecycle } from '../shared/dialog-lifecycle';

type ObjectManagerOptions = {
  hydrateChildren?: (scope: HTMLElement) => (() => void) | void;
};

type ObjectManagerState = {
  manageButton: HTMLButtonElement | null;
  lifecycle: DialogLifecycle | null;
  valueJson: string;
  cleanupChildren: (() => void) | null;
  removeListeners: Array<() => void>;
};

type JsonContainer = Record<string, unknown> | unknown[];

const states = new Map<HTMLElement, ObjectManagerState>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function createId(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('[object-manager] crypto.randomUUID unavailable');
  }
  return crypto.randomUUID();
}

function assignDeclaredIds(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assignDeclaredIds);
    return;
  }
  if (!isRecord(value)) return;
  if (Object.hasOwn(value, 'id')) {
    if (value.id !== '') throw new Error('[object-manager] New-item id must be empty');
    value.id = createId();
  }
  Object.values(value).forEach(assignDeclaredIds);
}

function parseJsonArray(value: string): Array<Record<string, unknown>> {
  if (!value.trim()) throw new Error('[object-manager] Missing JSON array value');
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((item) => !isRecord(item))) {
    throw new Error('[object-manager] Expected an array of objects');
  }
  if (parsed.some((item) => typeof item.id !== 'string' || !item.id.trim())) {
    throw new Error('[object-manager] Every item must have a stable id');
  }
  return parsed;
}

function parseItemLimit(value: string | null): number | null {
  if (value == null) return null;
  if (!/^\d+$/.test(value)) throw new Error('[object-manager] Item limit is invalid');
  return Number(value);
}

function getAt(value: unknown, path: string): unknown {
  let current = value;
  for (const part of path.split('.')) {
    if (!part || !current || typeof current !== 'object' || !Object.hasOwn(current, part)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setExistingAt(value: Record<string, unknown>, path: string, nextValue: unknown): void {
  const parts = path.split('.').filter(Boolean);
  if (!parts.length) throw new Error('[object-manager] Nested field path is missing');
  let current: JsonContainer = value;
  for (let index = 0; index < parts.length; index += 1) {
    const key = parts[index];
    if (!Object.hasOwn(current, key)) {
      throw new Error(`[object-manager] Nested field path does not exist: ${path}`);
    }
    if (index === parts.length - 1) {
      (current as Record<string, unknown>)[key] = nextValue;
      return;
    }
    const next: unknown = (current as Record<string, unknown>)[key];
    if (!isRecord(next) && !Array.isArray(next)) {
      throw new Error(`[object-manager] Nested field path does not exist: ${path}`);
    }
    current = next;
  }
}

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`[object-manager] Missing required element: ${selector}`);
  return element;
}

function registerListener(
  state: ObjectManagerState,
  target: EventTarget,
  type: string,
  listener: EventListener,
  options?: boolean | AddEventListenerOptions,
): void {
  target.addEventListener(type, listener, options);
  state.removeListeners.push(() => target.removeEventListener(type, listener, options));
}

function fillTemplate(template: string, label: string, index: number): string {
  return template.replaceAll('{label}', label).replaceAll('{index}', String(index + 1));
}

export function hydrateObjectManager(
  scope: Element | DocumentFragment,
  options?: ObjectManagerOptions,
): void {
  scope.querySelectorAll<HTMLElement>('.diet-object-manager').forEach((root) => {
    if (states.has(root)) return;

    const hidden = requiredElement<HTMLInputElement>(root, '.diet-object-manager__field');
    const list = requiredElement<HTMLElement>(root, '[data-objects-list]');
    const itemTemplate = requiredElement<HTMLTemplateElement>(root, 'template[data-objects-item]');
    const allowStructure = root.dataset.allowStructure === 'true';
    if (!allowStructure && root.dataset.allowStructure !== 'false') {
      throw new Error('[object-manager] allow-structure must be true or false');
    }

    const state: ObjectManagerState = {
      manageButton: null,
      lifecycle: null,
      valueJson: hidden.value,
      cleanupChildren: null,
      removeListeners: [],
    };
    states.set(root, state);

    const indexToken = root.dataset.indexToken!;
    const labelPath = root.dataset.labelPath!;
    const minItems = parseItemLimit(root.dataset.minItems ?? null);
    const read = (): Array<Record<string, unknown>> => parseJsonArray(hidden.value);
    const write = (value: Array<Record<string, unknown>>): void => {
      const json = JSON.stringify(value);
      state.valueJson = json;
      hidden.value = json;
      hidden.setAttribute('data-dieter-json', json);
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const render = (): void => {
      const items = read();
      state.cleanupChildren?.();
      list.replaceChildren();
      const basePath = hidden.dataset.bobPath ?? hidden.dataset.path ?? '';

      items.forEach((itemData, index) => {
        const container = document.createElement('div');
        container.className = 'diet-object-manager__item';
        container.dataset.objectIndex = String(index);
        container.innerHTML = itemTemplate.innerHTML.replaceAll(indexToken, String(index));

        container.querySelectorAll<HTMLElement>('[data-bob-path]').forEach((element) => {
          const path = element.dataset.bobPath!;
          const prefix = `${basePath}.${index}.`;
          if (!path.startsWith(prefix)) return;
          const fieldValue = getAt(itemData, path.slice(prefix.length));
          if (fieldValue === undefined) return;

          if (element instanceof HTMLInputElement) {
            if (element.type === 'checkbox') element.checked = Boolean(fieldValue);
            else if (element.dataset.dieterJson != null) {
              const json = JSON.stringify(fieldValue);
              element.value = json;
              element.setAttribute('data-dieter-json', json);
            } else element.value = String(fieldValue);
          } else if (element instanceof HTMLTextAreaElement) {
            element.value = String(fieldValue);
          }
        });
        list.append(container);
      });

      state.cleanupChildren = options?.hydrateChildren?.(list) ?? null;
      if (state.manageButton) {
        const canReorder = items.length > 1;
        const canDelete = minItems == null || items.length > minItems;
        state.manageButton.hidden = !canReorder && !canDelete;
      }
      root.dispatchEvent(
        new CustomEvent('dieter-controls-rendered', {
          bubbles: true,
          detail: { source: 'object-manager' },
        }),
      );
    };

    const handleExternalSync = (event: Event): void => {
      const detail = (event as CustomEvent<{ value?: unknown }>).detail;
      const next = detail && 'value' in detail ? detail.value : hidden.value;
      const nextJson = typeof next === 'string' ? next : JSON.stringify(next);
      parseJsonArray(nextJson);
      if (nextJson === state.valueJson) return;
      state.valueJson = nextJson;
      hidden.value = nextJson;
      hidden.setAttribute('data-dieter-json', nextJson);
      render();
    };
    registerListener(state, hidden, 'external-sync', handleExternalSync);

    const handleNestedChange = (event: Event): void => {
      const detail = (event as CustomEvent<{ bobIgnore?: boolean }>).detail;
      if (detail?.bobIgnore) return;
      const target = event.target;
      if (
        target === hidden ||
        (!(target instanceof HTMLInputElement) &&
          !(target instanceof HTMLTextAreaElement) &&
          !(target instanceof HTMLSelectElement))
      )
        return;

      const basePath = hidden.dataset.bobPath ?? hidden.dataset.path ?? '';
      const path = target.dataset.bobPath ?? '';
      if (!path.startsWith(`${basePath}.`)) return;
      const parts = path.slice(basePath.length + 1).split('.');
      const itemIndex = parts.shift();
      if (!itemIndex || !/^\d+$/.test(itemIndex) || !parts.length) return;

      const items = read();
      const item = items[Number(itemIndex)];
      if (!isRecord(item)) throw new Error('[object-manager] Nested item must be an object');
      const nextValue =
        target instanceof HTMLInputElement && target.type === 'checkbox'
          ? target.checked
          : target instanceof HTMLInputElement && target.dataset.dieterJson != null
            ? JSON.parse(target.value)
            : target.value;
      setExistingAt(item, parts.join('.'), nextValue);
      write(items);
    };
    registerListener(state, root, 'input', handleNestedChange, true);
    registerListener(state, root, 'change', handleNestedChange, true);

    if (allowStructure) {
      const addButton = requiredElement<HTMLButtonElement>(root, '[data-objects-add]');
      const manageButton = requiredElement<HTMLButtonElement>(root, '[data-objects-manage]');
      const dialog = requiredElement<HTMLDialogElement>(root, '[data-objects-modal]');
      const editor = requiredElement<HTMLElement>(dialog, '[data-objects-editor]');
      const modalList = requiredElement<HTMLElement>(dialog, '[data-objects-modal-list]');
      const rowTemplate = requiredElement<HTMLTemplateElement>(root, 'template[data-objects-row]');
      const saveButton = requiredElement<HTMLButtonElement>(dialog, '[data-objects-save]');
      const cancelButton = requiredElement<HTMLButtonElement>(dialog, '[data-objects-cancel]');
      const discardPanel = requiredElement<HTMLElement>(dialog, '[data-objects-discard-panel]');
      const keepEditingButton = requiredElement<HTMLButtonElement>(
        dialog,
        '[data-objects-keep-editing]',
      );
      const discardButton = requiredElement<HTMLButtonElement>(dialog, '[data-objects-discard]');
      const discardTitle = requiredElement<HTMLElement>(
        discardPanel,
        '.diet-object-manager__title',
      ).textContent!;
      const editorTitle = requiredElement<HTMLElement>(
        editor,
        '.diet-object-manager__title',
      ).textContent!;
      const defaultItem = JSON.parse(root.dataset.defaultItem!);
      if (!isRecord(defaultItem))
        throw new Error('[object-manager] default-item must be an object');

      state.manageButton = manageButton;

      if (!Object.hasOwn(defaultItem, 'id')) {
        throw new Error('[object-manager] default-item must declare an id field');
      }

      let original: Array<Record<string, unknown>> = [];
      let working: Array<Record<string, unknown>> = [];
      let editorFocus: HTMLElement | null = null;
      const isDirty = (): boolean => JSON.stringify(original) !== JSON.stringify(working);
      const showEditor = (restoreFocus: boolean): void => {
        discardPanel.hidden = true;
        editor.hidden = false;
        dialog.setAttribute('aria-label', editorTitle);
        if (restoreFocus) (editorFocus?.isConnected ? editorFocus : cancelButton).focus();
      };
      const showDiscard = (): void => {
        editorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        editor.hidden = true;
        discardPanel.hidden = false;
        dialog.setAttribute('aria-label', discardTitle);
        keepEditingButton.focus();
      };
      const lifecycle = createDialogLifecycle({
        dialog,
        initialFocus: cancelButton,
        requestDismiss: (reason) => {
          if (reason === 'backdrop') return;
          if (!discardPanel.hidden) showEditor(true);
          else if (isDirty()) showDiscard();
          else lifecycle.close();
        },
      });
      state.lifecycle = lifecycle;

      const rebuildRows = (): void => {
        modalList.replaceChildren();
        const sourceRow = rowTemplate.content.firstElementChild;
        if (!(sourceRow instanceof HTMLElement)) {
          throw new Error('[object-manager] Row template is empty');
        }
        working.forEach((item, index) => {
          const row = sourceRow.cloneNode(true) as HTMLElement;
          const rawLabel = getAt(item, labelPath);
          const label =
            typeof rawLabel === 'string' && rawLabel.trim()
              ? rawLabel
              : fillTemplate(root.dataset.itemLabel!, '', index).trim();
          requiredElement<HTMLElement>(row, '[data-objects-label]').textContent = label;
          const up = requiredElement<HTMLButtonElement>(row, '[data-objects-up]');
          const down = requiredElement<HTMLButtonElement>(row, '[data-objects-down]');
          const remove = requiredElement<HTMLButtonElement>(row, '[data-objects-delete]');
          const setLabel = (button: HTMLButtonElement, template: string) => {
            const actionLabel = fillTemplate(template, label, index);
            button.setAttribute('aria-label', actionLabel);
            button.setAttribute('data-tooltip', actionLabel);
          };
          setLabel(up, root.dataset.moveUpLabel!);
          setLabel(down, root.dataset.moveDownLabel!);
          setLabel(remove, root.dataset.deleteLabel!);
          up.disabled = index === 0;
          down.disabled = index === working.length - 1;
          remove.disabled = minItems != null && working.length <= minItems;
          up.addEventListener('click', () => {
            const [moved] = working.splice(index, 1);
            working.splice(index - 1, 0, moved);
            rebuildRows();
          });
          down.addEventListener('click', () => {
            const [moved] = working.splice(index, 1);
            working.splice(index + 1, 0, moved);
            rebuildRows();
          });
          remove.addEventListener('click', () => {
            working.splice(index, 1);
            rebuildRows();
          });
          modalList.append(row);
        });
      };

      registerListener(state, addButton, 'click', () => {
        const next = read();
        const item = structuredClone(defaultItem);
        assignDeclaredIds(item);
        next.push(item);
        write(next);
        render();
      });
      registerListener(state, manageButton, 'click', () => {
        original = read();
        working = original.slice();
        editorFocus = null;
        showEditor(false);
        rebuildRows();
        lifecycle.open(manageButton);
      });
      registerListener(state, saveButton, 'click', () => {
        write(working);
        render();
        lifecycle.close();
      });
      registerListener(state, cancelButton, 'click', () => {
        if (isDirty()) showDiscard();
        else lifecycle.close();
      });
      registerListener(state, keepEditingButton, 'click', () => showEditor(true));
      registerListener(state, discardButton, 'click', () => lifecycle.close());
    }

    render();
  });
}

export function destroyObjectManager(root: HTMLElement): void {
  const state = states.get(root);
  if (!state) return;
  state.cleanupChildren?.();
  state.lifecycle?.destroy();
  state.removeListeners.forEach((remove) => remove());
  states.delete(root);
}
