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

function createState(root: HTMLElement): DropdownActionsState | null {
  const input = root.querySelector<HTMLInputElement>('.diet-dropdown-actions__value-field');
  const display = root.querySelector<HTMLElement>('.diet-dropdown-header-value');
  const trigger = root.querySelector<HTMLElement>('.diet-dropdown-actions__control');
  const menuActions = Array.from(
    root.querySelectorAll<HTMLButtonElement>('.diet-dropdown-actions__menuaction'),
  );

  if (!input || !display || !trigger || menuActions.length === 0) {
    return null;
  }

  return { root, input, display, trigger, menuActions };
}

function installHandlers(state: DropdownActionsState): void {
  const { trigger, menuActions } = state;

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
  const { menuActions, input } = state;
  const selectedOption =
    menuActions.find((action) => action.dataset.value === input.value) ??
    menuActions.find((action) => action.dataset.selected === 'true') ??
    menuActions[0];

  if (selectedOption) {
    const value = selectedOption.dataset.value ?? '';
    const label = selectedOption.dataset.label ?? value;
    setSelection(state, value, label);
  } else {
    updateDisplay(state, null);
  }
}

function updateDisplay(state: DropdownActionsState, label: string | null): void {
  const placeholder = state.input.dataset.placeholder ?? '';
  state.display.textContent = label ?? placeholder;
  state.display.dataset.muted = label ? 'false' : 'true';
}

function setSelection(state: DropdownActionsState, value: string, label: string | null): void {
  state.input.value = value;
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
