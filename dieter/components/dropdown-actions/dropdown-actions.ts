import { createDropdownHydrator } from '../shared/dropdownToggle';

const states = new Map<HTMLElement, DropdownActionsState>();

const hydrateHost = createDropdownHydrator({
  rootSelector: '.diet-dropdown-actions',
  triggerSelector: '.diet-dropdown-actions__control',
  onClose: (root) => {
    const state = states.get(root);
    if (state && state.applyActions) {
      cancelPending(state, { close: false });
    }
  },
});

interface DropdownActionsState {
  scope: Element | DocumentFragment;
  root: HTMLElement;
  input: HTMLInputElement;
  display: HTMLElement;
  trigger: HTMLElement;
  menuActions: HTMLButtonElement[];
  applyActions: boolean;
  applyButton: HTMLButtonElement | null;
  cancelButton: HTMLButtonElement | null;
  committedValue: string;
  pendingValue: string | null;
  nativeValue?: { get: () => string; set: (next: string) => void };
}

export function hydrateDropdownActions(scope: Element | DocumentFragment): void {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>('.diet-dropdown-actions'));
  if (!roots.length) return;

  roots.forEach((root) => {
    if (states.has(root)) return;
    const state = createState(root, scope);
    if (!state) return;
    states.set(root, state);
    installHandlers(state);
    initialize(state);
    maybeInstallTypographyWeightFilter(state);
    maybeInstallTypographyFontStyleFilter(state);
  });

  hydrateHost(scope);
}

function createState(root: HTMLElement, scope: Element | DocumentFragment): DropdownActionsState | null {
  const input = root.querySelector<HTMLInputElement>('.diet-dropdown-actions__value-field');
  const display = root.querySelector<HTMLElement>('.diet-dropdown-header-value');
  const trigger = root.querySelector<HTMLElement>('.diet-dropdown-actions__control');
  const menuActions = Array.from(
    root.querySelectorAll<HTMLButtonElement>('.diet-dropdown-actions__menuaction'),
  );
  const applyButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-actions__apply');
  const cancelButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-actions__cancel');
  const applyActions = root.dataset.applyActions === 'true';

  if (!input || !display || !trigger || menuActions.length === 0) {
    return null;
  }

  const nativeValue = captureNativeValue(input);

  return {
    scope,
    root,
    input,
    display,
    trigger,
    menuActions,
    applyActions,
    applyButton,
    cancelButton,
    committedValue: input.value,
    pendingValue: null,
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
    state.committedValue = input.value;
    state.pendingValue = null;
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
      if (state.applyActions) {
        setPendingSelection(state, value, label);
        return;
      }
      const path = input.dataset.bobPath;
      if (path && /^typography\.roles\.[^.]+\.family$/.test(path)) {
        const roleRoot = path.slice(0, -'.family'.length);
        const weightPath = `${roleRoot}.weight`;
        const stylePath = `${roleRoot}.fontStyle`;
        const weightInput = state.scope.querySelector<HTMLInputElement>(`[data-bob-path="${weightPath}"]`);
        const styleInput = state.scope.querySelector<HTMLInputElement>(`[data-bob-path="${stylePath}"]`);

        const allowedWeights = (action.dataset.weights ?? '')
          .split(',')
          .map((w) => w.trim())
          .filter(Boolean);
        const allowedStyles = (action.dataset.styles ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        const pick = (current: string | undefined, allowed: string[], preferred: string) => {
          const trimmed = String(current ?? '').trim();
          if (trimmed && allowed.includes(trimmed)) return trimmed;
          if (allowed.includes(preferred)) return preferred;
          return allowed[0] ?? '';
        };

        const nextWeight = allowedWeights.length
          ? pick(weightInput?.value, allowedWeights, '400')
          : '';
        const nextStyle = allowedStyles.length
          ? pick(styleInput?.value, allowedStyles, 'normal')
          : '';

        // Update UI values without emitting state ops via normal 'input' events.
        input.value = value;
        if (weightInput && nextWeight) weightInput.value = nextWeight;
        if (styleInput && nextStyle) styleInput.value = nextStyle;

        input.dispatchEvent(
          new CustomEvent('bob-ops', {
            bubbles: true,
            detail: {
              ops: [
                { op: 'set', path, value },
                ...(nextWeight ? [{ op: 'set', path: weightPath, value: nextWeight }] : []),
                ...(nextStyle ? [{ op: 'set', path: stylePath, value: nextStyle }] : []),
              ],
            },
          }),
        );

        // Notify dependent typography controls to refresh their allowed options,
        // while allowing Bob to ignore this UI-only event.
        input.dispatchEvent(
          new CustomEvent('input', {
            bubbles: true,
            detail: { bobIgnore: true },
          }),
        );

        trigger.focus();
        trigger.click();
        return;
      }

      setSelection(state, value, label);
      trigger.focus();
      // Closing via trigger click keeps shared dropdown lifecycle consistent.
      trigger.click();
    });
  });

  if (state.applyActions && state.applyButton && state.cancelButton) {
    state.applyButton.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      commitPending(state);
    });
    state.cancelButton.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      cancelPending(state, { close: true });
    });
  }
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

function dispatchPreview(state: DropdownActionsState, value: string | null): void {
  if (!state.applyActions) return;
  const path = state.input.dataset.bobPath;
  if (!path) return;

  if (value == null) {
    state.input.dispatchEvent(
      new CustomEvent('bob-preview', {
        bubbles: true,
        detail: { clear: true },
      }),
    );
    return;
  }

  state.input.dispatchEvent(
    new CustomEvent('bob-preview', {
      bubbles: true,
      detail: {
        ops: [{ op: 'set', path, value }],
      },
    }),
  );
}

function setPendingSelection(state: DropdownActionsState, value: string, label: string | null): void {
  state.pendingValue = value;
  syncFromValue(state, value, label);
  dispatchPreview(state, value);
}

function commitPending(state: DropdownActionsState): void {
  if (!state.pendingValue) {
    state.trigger.focus();
    state.trigger.click();
    return;
  }
  dispatchPreview(state, null);
  const next = state.pendingValue;
  state.pendingValue = null;
  state.committedValue = next;
  state.input.value = next;
  if (!state.nativeValue) syncFromValue(state, next);

  const path = state.input.dataset.bobPath;
  if (path) {
    state.input.dispatchEvent(
      new CustomEvent('bob-ops', {
        bubbles: true,
        detail: {
          ops: [{ op: 'set', path, value: next }],
        },
      }),
    );
  } else {
    state.input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  state.trigger.focus();
  state.trigger.click();
}

function cancelPending(state: DropdownActionsState, opts: { close: boolean }): void {
  if (!state.pendingValue) {
    if (opts.close) {
      state.trigger.focus();
      state.trigger.click();
    }
    return;
  }
  state.pendingValue = null;
  syncFromValue(state, state.committedValue);
  dispatchPreview(state, null);
  if (opts.close) {
    state.trigger.focus();
    state.trigger.click();
  }
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

function maybeInstallTypographyWeightFilter(state: DropdownActionsState) {
  const path = state.input.dataset.bobPath;
  if (!path || !path.startsWith('typography.roles.') || !path.endsWith('.weight')) return;

  const familyPath = path.slice(0, -'.weight'.length) + '.family';
  const familyInput = state.scope.querySelector<HTMLInputElement>(`[data-bob-path="${familyPath}"]`);
  if (!familyInput) return;

  const update = () => {
    const familyRoot = familyInput.closest<HTMLElement>('.diet-dropdown-actions');
    if (!familyRoot) return;

    const familyAction = Array.from(
      familyRoot.querySelectorAll<HTMLButtonElement>('.diet-dropdown-actions__menuaction'),
    ).find((action) => (action.dataset.value ?? '') === familyInput.value);

    const raw = familyAction?.dataset.weights ?? '';
    const allowed = raw
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);
    if (allowed.length === 0) return;

    state.menuActions.forEach((action) => {
      const value = action.dataset.value ?? '';
      const isAllowed = allowed.includes(value);
      action.hidden = !isAllowed;
      action.disabled = !isAllowed;
    });
  };

  familyInput.addEventListener('input', update);
  state.trigger.addEventListener('click', update);
  update();
}

function maybeInstallTypographyFontStyleFilter(state: DropdownActionsState) {
  const path = state.input.dataset.bobPath;
  if (!path || !path.startsWith('typography.roles.') || !path.endsWith('.fontStyle')) return;

  const familyPath = path.slice(0, -'.fontStyle'.length) + '.family';
  const familyInput = state.scope.querySelector<HTMLInputElement>(`[data-bob-path="${familyPath}"]`);
  if (!familyInput) return;

  const update = () => {
    const familyRoot = familyInput.closest<HTMLElement>('.diet-dropdown-actions');
    if (!familyRoot) return;

    const familyAction = Array.from(
      familyRoot.querySelectorAll<HTMLButtonElement>('.diet-dropdown-actions__menuaction'),
    ).find((action) => (action.dataset.value ?? '') === familyInput.value);

    const raw = familyAction?.dataset.styles ?? '';
    const allowed = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.length === 0) return;

    state.menuActions.forEach((action) => {
      const value = action.dataset.value ?? '';
      const isAllowed = allowed.includes(value);
      action.hidden = !isAllowed;
      action.disabled = !isAllowed;
    });
  };

  familyInput.addEventListener('input', update);
  state.trigger.addEventListener('click', update);
  update();
}
