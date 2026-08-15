type RepeaterOptions = {
  hydrateChildren?: (scope: HTMLElement) => (() => void) | void;
};

type RepeaterState = {
  root: HTMLElement;
  hidden: HTMLInputElement;
  list: HTMLElement;
  template: string;
  addButton: HTMLButtonElement;
  reorderButton: HTMLButtonElement;
  reorder: boolean;
  value: Array<Record<string, unknown>>;
  defaultItem: Record<string, unknown>;
  minItems: number | null;
  maxItems: number | null;
  removeLabel: string;
  moveLabel: string;
  options?: RepeaterOptions;
  cleanupChildren: (() => void) | null;
  activeDragCleanup: (() => void) | null;
  removeListeners: Array<() => void>;
  handleIcon: HTMLElement;
  trashIcon: HTMLElement;
  buttonSize: 'small' | 'medium' | 'large';
};

const states = new Map<HTMLElement, RepeaterState>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function createId(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('[repeater] crypto.randomUUID unavailable');
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
    if (value.id !== '') throw new Error('[repeater] New-item id must be empty');
    value.id = createId();
  }
  Object.values(value).forEach(assignDeclaredIds);
}

function parseJsonArray(value: string): Array<Record<string, unknown>> {
  if (!value.trim()) throw new Error('[repeater] Missing JSON array value');
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((item) => !isRecord(item))) {
    throw new Error('[repeater] Expected an array of objects');
  }
  if (parsed.some((item) => typeof item.id !== 'string' || !item.id.trim())) {
    throw new Error('[repeater] Every item must have a stable id');
  }
  return parsed;
}

function parseItemLimit(value: string | undefined): number | null {
  if (value === undefined) return null;
  if (!/^\d+$/.test(value)) throw new Error('[repeater] Item limit is invalid');
  return Number(value);
}

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`[repeater] Missing required element: ${selector}`);
  return element;
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
  if (!parts.length) throw new Error('[repeater] Nested field path is missing');
  let current = value;
  for (let index = 0; index < parts.length; index += 1) {
    const key = parts[index];
    if (!Object.hasOwn(current, key)) {
      throw new Error(`[repeater] Nested field path does not exist: ${path}`);
    }
    if (index === parts.length - 1) {
      current[key] = nextValue;
      return;
    }
    const next = current[key];
    if (!isRecord(next)) throw new Error(`[repeater] Nested field path does not exist: ${path}`);
    current = next;
  }
}

function labelWithIndex(label: string, index: number): string {
  return label.replaceAll('{index}', String(index + 1));
}

function registerListener(
  state: RepeaterState,
  target: EventTarget,
  type: string,
  listener: EventListener,
  options?: boolean | AddEventListenerOptions,
): void {
  target.addEventListener(type, listener, options);
  state.removeListeners.push(() => target.removeEventListener(type, listener, options));
}

function buttonSizeForControl(size: string | undefined): 'small' | 'medium' | 'large' {
  if (size === 'sm') return 'small';
  if (size === 'md') return 'medium';
  if (size === 'lg') return 'large';
  throw new Error('[repeater] size must be sm, md, or lg');
}

function syncLimitControls(state: RepeaterState): void {
  state.addButton.disabled = state.maxItems != null && state.value.length >= state.maxItems;
  state.list
    .querySelectorAll<HTMLButtonElement>('.diet-repeater__item-remove')
    .forEach((button) => {
      button.disabled = state.minItems != null && state.value.length <= state.minItems;
    });
}

function syncReorderControls(state: RepeaterState): void {
  state.root.dataset.reorder = state.reorder ? 'on' : 'off';
  state.reorderButton.setAttribute('aria-pressed', state.reorder ? 'true' : 'false');
  state.reorderButton.dataset.type = state.reorder ? 'secondary' : 'quaternary';
}

function write(state: RepeaterState): void {
  const json = JSON.stringify(state.value);
  state.hidden.value = json;
  state.hidden.setAttribute('data-dieter-json', json);
  state.hidden.dispatchEvent(new Event('input', { bubbles: true }));
}

function syncItemFields(
  state: RepeaterState,
  body: HTMLElement,
  itemValue: Record<string, unknown>,
  index: number,
): void {
  const arrayPath = state.hidden.dataset.path!;
  const prefix = `${arrayPath}.${index}.`;
  body.querySelectorAll<HTMLElement>('[data-path]').forEach((element) => {
    const path = element.dataset.path!;
    if (!path.startsWith(prefix)) return;
    const value = getAt(itemValue, path.slice(prefix.length));
    if (value === undefined) return;
    if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox') element.checked = Boolean(value);
      else if (element.dataset.dieterJson != null) {
        const json = JSON.stringify(value);
        element.value = json;
        element.setAttribute('data-dieter-json', json);
      } else element.value = String(value);
    } else if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      element.value = String(value);
    }
  });
}

function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, button, [role="button"], label, [contenteditable="true"]',
    ),
  );
}

function installPointerReorder(item: HTMLElement, state: RepeaterState, index: number): void {
  item.addEventListener('pointerdown', (startEvent) => {
    if (startEvent.button !== 0) return;
    const onHandle =
      startEvent.target instanceof HTMLElement &&
      Boolean(startEvent.target.closest('.diet-repeater__item-handle'));
    if (!onHandle && isInteractive(startEvent.target)) return;
    startEvent.preventDefault();

    state.activeDragCleanup?.();
    const { list } = state;
    const rect = item.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const startLeft = rect.left - listRect.left + list.scrollLeft;
    const startTop = rect.top - listRect.top + list.scrollTop;
    const startY = startEvent.clientY;
    const previousPosition = list.style.position;
    let placeholder: HTMLElement | null = null;
    let currentIndex = index;

    const children = () =>
      Array.from(list.children).filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement &&
          (element.classList.contains('diet-repeater__item') ||
            element.classList.contains('diet-repeater__placeholder')),
      );

    const cleanup = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      if (state.activeDragCleanup === cleanup) state.activeDragCleanup = null;
    };
    const move = (event: PointerEvent) => {
      event.preventDefault();
      const deltaY = event.clientY - startY;
      if (!placeholder && Math.abs(deltaY) > 4) {
        placeholder = document.createElement('div');
        placeholder.className = 'diet-repeater__placeholder';
        placeholder.style.height = `${rect.height}px`;
        list.insertBefore(placeholder, item);
        if (!previousPosition) list.style.position = 'relative';
        item.classList.add('is-dragging');
        Object.assign(item.style, {
          position: 'absolute',
          pointerEvents: 'none',
          width: `${rect.width}px`,
          left: `${startLeft}px`,
          top: `${startTop}px`,
          zIndex: '2',
        });
        list.append(item);
      }
      if (!placeholder) return;
      item.style.transform = `translateY(${deltaY}px)`;
      let target: HTMLElement | null = null;
      for (const sibling of children()) {
        if (sibling === item || sibling === placeholder) continue;
        const siblingRect = sibling.getBoundingClientRect();
        if (event.clientY < siblingRect.top + siblingRect.height / 2) {
          target = sibling;
          break;
        }
      }
      if (target) list.insertBefore(placeholder, target);
      else list.append(placeholder);
      currentIndex = children().indexOf(placeholder);
    };
    const up = (event: PointerEvent) => {
      event.preventDefault();
      cleanup();
      if (!placeholder) return;
      placeholder.remove();
      if (!previousPosition) list.style.position = '';
      if (currentIndex !== index && currentIndex >= 0) {
        const next = [...state.value];
        const [moved] = next.splice(index, 1);
        next.splice(currentIndex, 0, moved);
        state.value = next;
        write(state);
      }
      render(state);
    };
    state.activeDragCleanup = cleanup;
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
  });
}

function render(state: RepeaterState): void {
  state.activeDragCleanup?.();
  state.cleanupChildren?.();
  state.list.replaceChildren();

  state.value.forEach((itemValue, index) => {
    const item = document.createElement('div');
    item.className = 'diet-repeater__item';
    item.dataset.index = String(index);

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'diet-button diet-tooltip diet-repeater__item-handle';
    handle.dataset.size = state.buttonSize;
    handle.dataset.type = 'quaternary';
    const moveLabel = labelWithIndex(state.moveLabel, index);
    handle.setAttribute('aria-label', moveLabel);
    handle.setAttribute('data-tooltip', moveLabel);
    handle.setAttribute('data-tooltip-kind', 'label');
    handle.setAttribute('data-tooltip-placement', 'right');
    handle.append(state.handleIcon.cloneNode(true));

    const body = document.createElement('div');
    body.className = 'diet-repeater__item-body';
    body.innerHTML = state.template.replaceAll('__INDEX__', String(index));
    syncItemFields(state, body, itemValue, index);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'diet-button diet-tooltip diet-repeater__item-remove';
    remove.dataset.size = state.buttonSize;
    remove.dataset.type = 'quaternary';
    const removeLabel = labelWithIndex(state.removeLabel, index);
    remove.setAttribute('aria-label', removeLabel);
    remove.setAttribute('data-tooltip', removeLabel);
    remove.setAttribute('data-tooltip-kind', 'label');
    remove.setAttribute('data-tooltip-placement', 'left');
    remove.append(state.trashIcon.cloneNode(true));
    remove.addEventListener('click', () => {
      const next = [...state.value];
      next.splice(index, 1);
      state.value = next;
      write(state);
      render(state);
    });

    item.append(handle, body, remove);
    if (state.reorder) installPointerReorder(item, state, index);
    state.list.append(item);
  });

  state.cleanupChildren = state.options?.hydrateChildren?.(state.list) ?? null;
  syncLimitControls(state);
  state.root.dispatchEvent(
    new CustomEvent('dieter-controls-rendered', {
      bubbles: true,
      detail: { source: 'repeater' },
    }),
  );
}

export function hydrateRepeater(
  scope: Element | DocumentFragment,
  options?: RepeaterOptions,
): void {
  scope.querySelectorAll<HTMLElement>('.diet-repeater').forEach((root) => {
    if (states.has(root)) return;
    const hidden = requiredElement<HTMLInputElement>(root, '.diet-repeater__field');
    const list = requiredElement<HTMLElement>(root, '[data-repeater-list]');
    const template = requiredElement<HTMLTemplateElement>(
      root,
      'template[data-repeater-item]',
    ).innerHTML;
    if (!template.trim()) throw new Error('[repeater] Item template is empty');
    const defaultItem = JSON.parse(root.dataset.defaultItem!);
    if (!isRecord(defaultItem) || !Object.hasOwn(defaultItem, 'id')) {
      throw new Error('[repeater] default-item must be an object with an id field');
    }

    const state: RepeaterState = {
      root,
      hidden,
      list,
      template,
      addButton: requiredElement(root, '.diet-repeater__add'),
      reorderButton: requiredElement(root, '.diet-repeater__reorder'),
      reorder: root.dataset.reorder === 'on',
      value: parseJsonArray(hidden.value),
      defaultItem,
      minItems: parseItemLimit(root.dataset.minItems),
      maxItems: parseItemLimit(root.dataset.maxItems),
      removeLabel: root.dataset.removeLabel!,
      moveLabel: root.dataset.moveLabel!,
      options,
      cleanupChildren: null,
      activeDragCleanup: null,
      removeListeners: [],
      handleIcon: requiredElement(root, '.diet-repeater__icon-handle'),
      trashIcon: requiredElement(root, '.diet-repeater__icon-trash'),
      buttonSize: buttonSizeForControl(root.dataset.size),
    };
    states.set(root, state);
    syncReorderControls(state);

    const handleNestedChange = (event: Event): void => {
      const target = event.target;
      if (
        target === hidden ||
        (!(target instanceof HTMLInputElement) &&
          !(target instanceof HTMLTextAreaElement) &&
          !(target instanceof HTMLSelectElement))
      )
        return;
      const arrayPath = hidden.dataset.path!;
      const path = target.dataset.path ?? '';
      if (!path.startsWith(`${arrayPath}.`)) return;
      const nearestCollection = target.closest<HTMLElement>(
        '.diet-repeater, .diet-object-manager',
      );
      if (nearestCollection && nearestCollection !== root) {
        const nestedField = nearestCollection.querySelector<HTMLInputElement>(
          ':scope > .diet-repeater__field, :scope > .diet-object-manager__field',
        );
        const nestedPath = nestedField?.dataset.path;
        if (nestedPath && target !== nestedField && path.startsWith(`${nestedPath}.`)) return;
      }
      const parts = path.slice(arrayPath.length + 1).split('.');
      const indexToken = parts.shift();
      if (!indexToken || !/^\d+$/.test(indexToken) || !parts.length) return;
      const item = state.value[Number(indexToken)];
      if (!item) throw new Error('[repeater] Nested item does not exist');
      const nextValue =
        target instanceof HTMLInputElement && target.type === 'checkbox'
          ? target.checked
          : target instanceof HTMLInputElement && target.dataset.dieterJson != null
            ? JSON.parse(target.value)
            : target.value;
      setExistingAt(item, parts.join('.'), nextValue);
      event.stopPropagation();
      write(state);
    };
    registerListener(state, root, 'input', handleNestedChange);

    registerListener(state, state.addButton, 'click', () => {
      if (state.maxItems != null && state.value.length >= state.maxItems) return;
      const item = structuredClone(state.defaultItem);
      assignDeclaredIds(item);
      state.value = [...state.value, item];
      write(state);
      render(state);
      const addTarget = root.dataset.addOpen;
      if (addTarget) {
        requestAnimationFrame(() => {
          const target = (root.getRootNode() as Document | ShadowRoot).querySelector<HTMLElement>(
            addTarget,
          );
          if (!target) throw new Error(`[repeater] add-open target not found: ${addTarget}`);
          target.click();
        });
      }
    });

    registerListener(state, state.reorderButton, 'click', () => {
      state.reorder = !state.reorder;
      syncReorderControls(state);
      render(state);
    });

    registerListener(state, hidden, 'external-sync', (event) => {
      const detail = (event as CustomEvent<{ value?: unknown }>).detail;
      const payload = detail && 'value' in detail ? detail.value : hidden.value;
      const nextJson = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const nextValue = parseJsonArray(nextJson);
      if (nextJson === JSON.stringify(state.value)) return;
      state.value = nextValue;
      hidden.value = nextJson;
      hidden.setAttribute('data-dieter-json', nextJson);
      render(state);
    });

    render(state);
  });
}

export function destroyRepeater(root: HTMLElement): void {
  const state = states.get(root);
  if (!state) return;
  state.activeDragCleanup?.();
  state.cleanupChildren?.();
  state.removeListeners.forEach((remove) => remove());
  states.delete(root);
}
