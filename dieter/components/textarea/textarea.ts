import { createDropdownHydrator } from '../shared/dropdownToggle';

type NativeValue = {
  get: () => string;
  set: (next: string) => void;
};

type TextareaState = {
  root: HTMLElement;
  input: HTMLInputElement;
  editor: HTMLTextAreaElement;
  preview: HTMLElement;
  nativeValue?: NativeValue;
};

const states = new Map<HTMLElement, TextareaState>();

const hydrateHost = createDropdownHydrator({
  rootSelector: '.diet-textarea',
  triggerSelector: '.diet-textarea__control',
  onOpen(root) {
    states.get(root)?.editor.focus({ preventScroll: true });
  },
});

function captureNativeValue(input: HTMLInputElement): NativeValue | undefined {
  const proto = Object.getPrototypeOf(input) as typeof HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (!descriptor?.get || !descriptor.set) return undefined;
  return {
    get: () => String(descriptor.get?.call(input) ?? ''),
    set: (next: string) => descriptor.set?.call(input, next),
  };
}

function syncPreview(state: TextareaState, value: string): void {
  const placeholder = state.input.dataset.placeholder ?? '';
  state.preview.textContent = value || placeholder;
  state.preview.dataset.muted = value ? 'false' : 'true';
}

function syncFromValue(state: TextareaState, value: string): void {
  const next = String(value ?? '');
  state.nativeValue?.set(next);
  if (!state.nativeValue) state.input.value = next;
  state.input.setAttribute('value', next);
  if (state.editor.value !== next) state.editor.value = next;
  syncPreview(state, next);
}

function createState(root: HTMLElement): TextareaState | null {
  const input = root.querySelector<HTMLInputElement>('.diet-textarea__value-field');
  const editor = root.querySelector<HTMLTextAreaElement>('.diet-textarea__editor');
  const preview = root.querySelector<HTMLElement>('.diet-textarea__preview');
  if (!input || !editor || !preview) return null;
  return { root, input, editor, preview, nativeValue: captureNativeValue(input) };
}

function installHandlers(state: TextareaState): void {
  if (state.nativeValue) {
    Object.defineProperty(state.input, 'value', {
      configurable: true,
      get: () => state.nativeValue?.get() ?? '',
      set: (next: string) => syncFromValue(state, String(next ?? '')),
    });
  }

  state.input.addEventListener('external-sync', (event) => {
    const detail = (event as CustomEvent<{ value?: unknown }>).detail;
    if (detail && Object.prototype.hasOwnProperty.call(detail, 'value') && typeof detail.value !== 'string') {
      throw new Error('[textarea] External value must be a string');
    }
    const value = typeof detail?.value === 'string' ? detail.value : state.input.value;
    syncFromValue(state, value);
  });

  state.editor.addEventListener('input', () => {
    const next = state.editor.value;
    state.nativeValue?.set(next);
    if (!state.nativeValue) state.input.value = next;
    state.input.setAttribute('value', next);
    syncPreview(state, next);
    state.input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function hydrateTextarea(scope: Element | DocumentFragment): void {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>('.diet-textarea'));
  if (!roots.length) return;

  roots.forEach((root) => {
    if (states.has(root)) return;
    const state = createState(root);
    if (!state) throw new Error('[textarea] Invalid component markup');
    states.set(root, state);
    installHandlers(state);
    syncFromValue(state, state.input.value);
  });

  hydrateHost(scope);
}
