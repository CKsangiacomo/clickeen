type TextrenameState = {
  root: HTMLElement;
  view: HTMLElement;
  label: HTMLElement;
  input: HTMLInputElement;
  internalWrite: boolean;
  originalValue: string;
  nativeValue?: { get: () => string; set: (next: string) => void };
};

const states = new Map<HTMLElement, TextrenameState>();

export function hydrateTextrename(scope: Element | DocumentFragment): void {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>('.diet-textrename'));
  if (!roots.length) return;

  roots.forEach((root) => {
    if (states.has(root)) return;
    const state = createState(root);
    if (!state) return;
    states.set(root, state);
    installHandlers(state);
    syncFromValue(state, state.input.value || state.input.getAttribute('value') || '');
  });
}

function createState(root: HTMLElement): TextrenameState | null {
  const view = root.querySelector<HTMLElement>('.diet-textrename__view');
  const label = root.querySelector<HTMLElement>('.diet-textrename__label');
  const input = root.querySelector<HTMLInputElement>('.diet-textrename__input');
  if (!view || !label || !input) return null;

  return {
    root,
    view,
    label,
    input,
    internalWrite: false,
    originalValue: '',
    nativeValue: captureNativeValue(input),
  };
}

function installHandlers(state: TextrenameState): void {
  if (state.nativeValue) {
    Object.defineProperty(state.input, 'value', {
      configurable: true,
      get: () => state.nativeValue?.get() ?? '',
      set: (next: string) => {
        state.nativeValue?.set(String(next ?? ''));
        if (!state.internalWrite) syncFromValue(state, String(next ?? ''));
      },
    });
  }

  state.view.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    enterEditing(state);
  });

  state.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      commitEditing(state);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelEditing(state);
    }
  });

  state.input.addEventListener('blur', () => {
    if (state.root.dataset.state === 'editing') commitEditing(state);
  });

  state.input.addEventListener('input', () => {
    syncFromValue(state, state.input.value);
  });
}

function enterEditing(state: TextrenameState): void {
  if (state.root.dataset.state === 'editing') return;
  state.originalValue = state.input.value || '';
  state.root.dataset.state = 'editing';
  queueMicrotask(() => {
    try {
      state.input.focus({ preventScroll: true });
      state.input.select();
    } catch {
      // ignore
    }
  });
}

function commitEditing(state: TextrenameState): void {
  state.root.dataset.state = 'view';
  state.originalValue = '';
  syncFromValue(state, state.input.value);
  state.input.blur();
}

function cancelEditing(state: TextrenameState): void {
  state.root.dataset.state = 'view';
  const next = state.originalValue;
  state.originalValue = '';
  state.internalWrite = true;
  state.input.value = next;
  state.internalWrite = false;
  syncFromValue(state, next);
  state.input.dispatchEvent(new Event('input', { bubbles: true }));
  state.input.blur();
}

function syncFromValue(state: TextrenameState, raw: string): void {
  const value = String(raw ?? '').trim();
  const placeholder = state.input.getAttribute('placeholder') || '';
  state.label.textContent = value || placeholder;
}

function captureNativeValue(input: HTMLInputElement): TextrenameState['nativeValue'] {
  const proto = Object.getPrototypeOf(input) as typeof HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (!desc?.get || !desc?.set) return undefined;
  return {
    get: () => String(desc.get?.call(input) ?? ''),
    set: (next: string) => {
      desc.set?.call(input, next);
    },
  };
}
