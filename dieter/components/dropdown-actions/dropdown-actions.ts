import { createDropdownHydrator } from '../shared/dropdownToggle';

const states = new Map<HTMLElement, DropdownActionsState>();

const hydrateHost = createDropdownHydrator({
  rootSelector: '.diet-dropdown-actions',
  triggerSelector: '.diet-dropdown-actions__control',
});

interface DropdownActionsState {
  root: HTMLElement;
  input: HTMLInputElement;
  display: HTMLElement;
  trigger: HTMLElement;
  menuActions: HTMLButtonElement[];
  nativeValue?: { get: () => string; set: (next: string) => void };
}

export function hydrateDropdownActions(scope: Element | DocumentFragment): void {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>('.diet-dropdown-actions'));
  if (!roots.length) return;

  roots.forEach((root) => {
    if (states.has(root)) return;
    const state = createState(root);
    if (!state) return;
    states.set(root, state);
    installHandlers(state);
    initialize(state);
  });

  hydrateHost(scope);
}

export function destroyDropdownActions(root: HTMLElement): void {
  states.delete(root);
  hydrateHost.destroy(root);
}

function createState(root: HTMLElement): DropdownActionsState | null {
  const input = root.querySelector<HTMLInputElement>('.diet-dropdown-actions__value-field');
  const display = root.querySelector<HTMLElement>('.diet-dropdown-actions__value');
  const trigger = root.querySelector<HTMLElement>('.diet-dropdown-actions__control');
  const menuActions = Array.from(
    root.querySelectorAll<HTMLButtonElement>('.diet-dropdown-actions__menuaction'),
  );

  if (!input || !display || !trigger || menuActions.length === 0) {
    return null;
  }

  const nativeValue = captureNativeValue(input);

  return {
    root,
    input,
    display,
    trigger,
    menuActions,
    nativeValue,
  };
}

function installHandlers(state: DropdownActionsState): void {
  const { input, trigger, menuActions } = state;

  if (state.nativeValue) {
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => state.nativeValue?.get() ?? '',
      set: (next: string) => {
        state.nativeValue?.set(String(next ?? ''));
        syncFromValue(state, String(next ?? ''));
      },
    });
  }

  const syncCommitted = () => {
    syncFromValue(state, input.value);
  };
  input.addEventListener('external-sync', syncCommitted);
  input.addEventListener('input', syncCommitted);

  menuActions.forEach((action) => {
    action.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const value = action.dataset.value ?? '';
      const label = action.dataset.label ?? value;
      setSelection(state, value, label);
      trigger.focus();
      // Closing via trigger click keeps shared dropdown lifecycle consistent.
      trigger.click();
    });
  });
}

function initialize(state: DropdownActionsState): void {
  syncFromValue(state, state.input.value);
}

function updateDisplay(state: DropdownActionsState, label: string | null): void {
  const placeholder = state.input.dataset.placeholder ?? '';
  state.display.textContent = label ?? placeholder;
  state.display.dataset.muted = label ? 'false' : 'true';
}

function setSelection(state: DropdownActionsState, value: string, label: string | null): void {
  state.input.value = value;
  if (!state.nativeValue) syncFromValue(state, value, label);
  state.input.dispatchEvent(new Event('input', { bubbles: true }));
}

function captureNativeValue(input: HTMLInputElement): DropdownActionsState['nativeValue'] {
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

function syncFromValue(state: DropdownActionsState, value: string, labelOverride?: string | null) {
  const selectedAction = state.menuActions.find((action) => action.dataset.value === value);
  const label = labelOverride ?? (selectedAction ? selectedAction.dataset.label ?? value : null);
  updateDisplay(state, label);

  state.menuActions.forEach((action) => {
    const isSelected = action.dataset.value === value;
    action.classList.toggle('is-selected', isSelected);
    action.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    if (isSelected) {
      action.dataset.selected = 'true';
    } else {
      delete action.dataset.selected;
    }
  });
}
