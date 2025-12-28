type ChoiceTilesState = {
  root: HTMLElement;
  input: HTMLInputElement;
  options: HTMLButtonElement[];
  nativeValue?: { get: () => string; set: (next: string) => void };
};

const states = new WeakMap<HTMLElement, ChoiceTilesState>();

export function hydrateChoiceTiles(scope: Element | DocumentFragment): void {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>('.diet-choice-tiles'));
  if (!roots.length) return;

  roots.forEach((root) => {
    if (states.has(root)) return;
    const state = createState(root);
    if (!state) return;
    states.set(root, state);
    installHandlers(state);
    syncFromValue(state, state.input.value);
  });
}

function createState(root: HTMLElement): ChoiceTilesState | null {
  const input = root.querySelector<HTMLInputElement>('.diet-choice-tiles__field');
  const options = Array.from(root.querySelectorAll<HTMLButtonElement>('.diet-choice-tiles__option'));
  if (!input || options.length === 0) return null;
  if (options.length < 2 || options.length > 3) return null;
  const nativeValue = captureNativeValue(input);
  return { root, input, options, nativeValue };
}

function captureNativeValue(input: HTMLInputElement): ChoiceTilesState['nativeValue'] {
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

function installHandlers(state: ChoiceTilesState) {
  const { input, options } = state;

  if (state.nativeValue) {
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => state.nativeValue?.get() ?? '',
      set: (next: string) => {
        state.nativeValue?.set(next);
        syncFromValue(state, String(next ?? ''));
      },
    });
  }

  options.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const value = button.dataset.value ?? '';
      if (!value) return;
      input.value = value;
      syncFromValue(state, input.value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    button.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const idx = options.indexOf(button);
      if (idx === -1) return;
      const dir = event.key === 'ArrowRight' ? 1 : -1;
      const nextIdx = (idx + dir + options.length) % options.length;
      options[nextIdx]?.focus();
    });
  });

  input.addEventListener('external-sync', () => syncFromValue(state, input.value));
  input.addEventListener('input', () => syncFromValue(state, input.value));
}

function syncFromValue(state: ChoiceTilesState, value: string) {
  state.options.forEach((button) => {
    const isSelected = button.dataset.value === value;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    button.dataset.selected = isSelected ? 'true' : 'false';
  });
}
