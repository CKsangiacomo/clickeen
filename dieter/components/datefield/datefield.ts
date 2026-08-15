import {
  assertDateWithinBounds,
  createCivilDateCalendar,
  formatCivilDate,
  initialCalendarView,
  parseCivilDate,
  readCalendarElements,
  readCivilDateBounds,
  type CivilDate,
  type CivilDateCalendarController,
} from '../shared/civil-date-calendar';
import { createDropdownHydrator } from '../shared/dropdownToggle';

type DatefieldState = {
  root: HTMLElement;
  input: HTMLInputElement;
  display: HTMLElement;
  clearButton: HTMLButtonElement;
  locale: string;
  bounds: ReturnType<typeof readCivilDateBounds>;
  value: CivilDate | null;
  calendar: CivilDateCalendarController;
};

const states = new Map<HTMLElement, DatefieldState>();

const hydrateHost = createDropdownHydrator({
  rootSelector: '.diet-datefield',
  triggerSelector: '.diet-datefield__control',
  onOpen: (root) => {
    const state = states.get(root);
    if (state) state.calendar.setView(initialCalendarView(state.value, state.bounds));
  },
});

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`[Datefield] missing ${selector}`);
  return element;
}

function readValue(raw: string, bounds: DatefieldState['bounds']): CivilDate | null {
  if (raw === '') return null;
  const value = parseCivilDate(raw, 'value');
  assertDateWithinBounds(value, bounds, 'value');
  return value;
}

function syncPresentation(state: DatefieldState): void {
  const placeholder = state.root.dataset.placeholder;
  if (placeholder == null) throw new Error('[Datefield] placeholder is required');
  state.display.textContent = state.value
    ? formatCivilDate(state.value, state.locale)
    : placeholder;
  state.display.dataset.muted = state.value ? 'false' : 'true';
  state.clearButton.hidden = state.value == null;
  state.calendar.render();
}

function commit(state: DatefieldState, value: CivilDate | null): void {
  state.value = value;
  state.input.value = value?.iso ?? '';
  syncPresentation(state);
  state.input.dispatchEvent(new Event('input', { bubbles: true }));
  hydrateHost.setOpen(state.root, false);
}

function createState(root: HTMLElement): DatefieldState {
  const input = requiredElement<HTMLInputElement>(root, '.diet-datefield__field');
  const display = requiredElement<HTMLElement>(root, '.diet-datefield__value');
  const clearButton = requiredElement<HTMLButtonElement>(root, '.diet-calendar__clear');
  const locale = root.dataset.locale;
  if (!locale) throw new Error('[Datefield] locale is required');
  const bounds = readCivilDateBounds(root);
  const value = readValue(input.value, bounds);
  const state: DatefieldState = {
    root,
    input,
    display,
    clearButton,
    locale,
    bounds,
    value,
    calendar: null as unknown as CivilDateCalendarController,
  };
  const calendar = createCivilDateCalendar({
    elements: readCalendarElements(root),
    locale,
    bounds,
    initialView: initialCalendarView(value, bounds),
    getDayState: (date) => ({ selected: state.value?.iso === date.iso }),
    onSelect: (date) => commit(state, date),
  });
  state.calendar = calendar;
  input.addEventListener('external-sync', () => {
    state.value = readValue(input.value, bounds);
    syncPresentation(state);
  });
  clearButton.addEventListener('click', () => commit(state, null));
  syncPresentation(state);
  return state;
}

export function hydrateDatefield(scope: Element | DocumentFragment): void {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>('.diet-datefield'));
  roots.forEach((root) => {
    if (!states.has(root)) states.set(root, createState(root));
  });
  hydrateHost(scope);
}

export function destroyDatefield(root: HTMLElement): void {
  states.get(root)?.calendar.destroy();
  states.delete(root);
  hydrateHost.destroy(root);
}
