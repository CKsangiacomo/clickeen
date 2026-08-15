import {
  assertDateWithinBounds,
  compareCivilDates,
  createCivilDateCalendar,
  formatCivilDateRange,
  initialCalendarView,
  parseCivilDateRange,
  readCalendarElements,
  readCivilDateBounds,
  type CivilDate,
  type CivilDateCalendarController,
  type CivilDateRange,
} from '../shared/civil-date-calendar';
import { createDropdownHydrator } from '../shared/dropdownToggle';

type DateRangePickerState = {
  root: HTMLElement;
  input: HTMLInputElement;
  display: HTMLElement;
  clearButton: HTMLButtonElement;
  locale: string;
  bounds: ReturnType<typeof readCivilDateBounds>;
  value: CivilDateRange | null;
  provisionalStart: CivilDate | null;
  hoverDate: CivilDate | null;
  calendar: CivilDateCalendarController;
};

const states = new Map<HTMLElement, DateRangePickerState>();

const hydrateHost = createDropdownHydrator({
  rootSelector: '.diet-date-range-picker',
  triggerSelector: '.diet-date-range-picker__control',
  onOpen: (root) => {
    const state = states.get(root);
    if (!state) return;
    state.provisionalStart = null;
    state.hoverDate = null;
    state.calendar.setView(initialCalendarView(state.value?.start ?? null, state.bounds));
  },
  onClose: (root) => {
    const state = states.get(root);
    if (!state) return;
    state.provisionalStart = null;
    state.hoverDate = null;
    state.calendar.render();
  },
});

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`[DateRangePicker] missing ${selector}`);
  return element;
}

function readValue(raw: string, bounds: DateRangePickerState['bounds']): CivilDateRange | null {
  const value = parseCivilDateRange(JSON.parse(raw) as unknown);
  if (!value) return null;
  assertDateWithinBounds(value.start, bounds, 'range start');
  assertDateWithinBounds(value.end, bounds, 'range end');
  return value;
}

function rangeIncludes(date: CivilDate, start: CivilDate, end: CivilDate): boolean {
  return compareCivilDates(date, start) >= 0 && compareCivilDates(date, end) <= 0;
}

function readDayState(state: DateRangePickerState, date: CivilDate) {
  if (state.provisionalStart) {
    const hoverIsAfter =
      state.hoverDate && compareCivilDates(state.hoverDate, state.provisionalStart) >= 0;
    const previewEnd = hoverIsAfter ? state.hoverDate : null;
    return {
      rangeStart: date.iso === state.provisionalStart.iso,
      rangeEnd: previewEnd?.iso === date.iso,
      inRange: previewEnd ? rangeIncludes(date, state.provisionalStart, previewEnd) : false,
      preview: previewEnd ? rangeIncludes(date, state.provisionalStart, previewEnd) : false,
    };
  }
  if (!state.value) return {};
  return {
    rangeStart: date.iso === state.value.start.iso,
    rangeEnd: date.iso === state.value.end.iso,
    inRange: rangeIncludes(date, state.value.start, state.value.end),
  };
}

function syncPresentation(state: DateRangePickerState): void {
  const placeholder = state.root.dataset.placeholder;
  if (placeholder == null) throw new Error('[DateRangePicker] placeholder is required');
  state.display.textContent = state.value
    ? formatCivilDateRange(state.value.start, state.value.end, state.locale)
    : placeholder;
  state.display.dataset.muted = state.value ? 'false' : 'true';
  state.clearButton.hidden = state.value == null;
  state.calendar.render();
}

function commit(state: DateRangePickerState, value: CivilDateRange | null): void {
  state.value = value;
  state.provisionalStart = null;
  state.hoverDate = null;
  state.input.value = value
    ? JSON.stringify({ start: value.start.iso, end: value.end.iso })
    : 'null';
  syncPresentation(state);
  state.input.dispatchEvent(new Event('input', { bubbles: true }));
  hydrateHost.setOpen(state.root, false);
}

function selectDate(state: DateRangePickerState, date: CivilDate): void {
  if (!state.provisionalStart || compareCivilDates(date, state.provisionalStart) < 0) {
    state.provisionalStart = date;
    state.hoverDate = null;
    state.calendar.render();
    return;
  }
  commit(state, { start: state.provisionalStart, end: date });
}

function createState(root: HTMLElement): DateRangePickerState {
  const input = requiredElement<HTMLInputElement>(root, '.diet-date-range-picker__field');
  const display = requiredElement<HTMLElement>(root, '.diet-date-range-picker__value');
  const clearButton = requiredElement<HTMLButtonElement>(root, '.diet-calendar__clear');
  const locale = root.dataset.locale;
  if (!locale) throw new Error('[DateRangePicker] locale is required');
  const bounds = readCivilDateBounds(root);
  const value = readValue(input.value, bounds);
  const state: DateRangePickerState = {
    root,
    input,
    display,
    clearButton,
    locale,
    bounds,
    value,
    provisionalStart: null,
    hoverDate: null,
    calendar: null as unknown as CivilDateCalendarController,
  };
  const calendar = createCivilDateCalendar({
    elements: readCalendarElements(root),
    locale,
    bounds,
    initialView: initialCalendarView(value?.start ?? null, bounds),
    getDayState: (date) => readDayState(state, date),
    onSelect: (date) => selectDate(state, date),
    onHover: (date) => {
      if (!state.provisionalStart) return;
      state.hoverDate = date;
      state.calendar.render();
    },
  });
  state.calendar = calendar;
  input.addEventListener('external-sync', () => {
    state.value = readValue(input.value, bounds);
    state.provisionalStart = null;
    state.hoverDate = null;
    syncPresentation(state);
  });
  clearButton.addEventListener('click', () => commit(state, null));
  syncPresentation(state);
  return state;
}

export function hydrateDateRangePicker(scope: Element | DocumentFragment): void {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>('.diet-date-range-picker'));
  roots.forEach((root) => {
    if (!states.has(root)) states.set(root, createState(root));
  });
  hydrateHost(scope);
}

export function destroyDateRangePicker(root: HTMLElement): void {
  states.get(root)?.calendar.destroy();
  states.delete(root);
  hydrateHost.destroy(root);
}
