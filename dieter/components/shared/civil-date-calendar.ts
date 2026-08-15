import {
  civilDateToUtcDate,
  compareCivilDates,
  parseCivilDate,
  todayCivilDate,
  type CivilDate,
  type CivilDateBounds,
} from './civil-date';

export {
  assertDateWithinBounds,
  civilDateToUtcDate,
  compareCivilDates,
  formatCivilDate,
  formatCivilDateRange,
  initialCalendarView,
  parseCivilDate,
  parseCivilDateRange,
  readCivilDateBounds,
  readOptionalCivilDate,
  todayCivilDate,
  type CivilDate,
  type CivilDateBounds,
  type CivilDateRange,
} from './civil-date';

export type CalendarDayState = {
  selected?: boolean;
  rangeStart?: boolean;
  rangeEnd?: boolean;
  inRange?: boolean;
  preview?: boolean;
};

type CalendarElements = {
  root: HTMLElement;
  monthLabel: HTMLElement;
  weekdayGrid: HTMLElement;
  dayGrid: HTMLElement;
  previousButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
};

type CalendarControllerOptions = {
  elements: CalendarElements;
  locale: string;
  bounds: CivilDateBounds;
  initialView: CivilDate;
  getDayState: (date: CivilDate) => CalendarDayState;
  onSelect: (date: CivilDate) => void;
  onHover?: (date: CivilDate | null) => void;
};

export type CivilDateCalendarController = {
  destroy: () => void;
  render: () => void;
  setView: (date: CivilDate) => void;
};

const DAY_MS = 86_400_000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function dayOrdinal(date: CivilDate): number {
  return Math.trunc(civilDateToUtcDate(date).getTime() / DAY_MS);
}

function civilDateFromOrdinal(ordinal: number): CivilDate {
  const value = new Date(ordinal * DAY_MS);
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + 1;
  const day = value.getUTCDate();
  return {
    year,
    month,
    day,
    iso: `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`,
  };
}

function addMonths(date: CivilDate, delta: number): CivilDate {
  const total = date.year * 12 + date.month - 1 + delta;
  const year = Math.floor(total / 12);
  const month = (((total % 12) + 12) % 12) + 1;
  return {
    year,
    month,
    day: 1,
    iso: `${String(year).padStart(4, '0')}-${pad(month)}-01`,
  };
}

function monthIntersectsBounds(date: CivilDate, bounds: CivilDateBounds): boolean {
  if (date.year < 1 || date.year > 9999) return false;
  const start = {
    ...date,
    day: 1,
    iso: `${String(date.year).padStart(4, '0')}-${pad(date.month)}-01`,
  };
  const lastDay = daysInMonth(date.year, date.month);
  const end = {
    ...date,
    day: lastDay,
    iso: `${String(date.year).padStart(4, '0')}-${pad(date.month)}-${pad(lastDay)}`,
  };
  return !(
    (bounds.min && compareCivilDates(end, bounds.min) < 0) ||
    (bounds.max && compareCivilDates(start, bounds.max) > 0)
  );
}

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`[DieterDate] missing ${selector}`);
  return element;
}

export function readCalendarElements(root: HTMLElement): CalendarElements {
  return {
    root: requiredElement(root, '.diet-calendar'),
    monthLabel: requiredElement(root, '.diet-calendar__month-label'),
    weekdayGrid: requiredElement(root, '.diet-calendar__weekdays'),
    dayGrid: requiredElement(root, '.diet-calendar__days'),
    previousButton: requiredElement(root, '.diet-calendar__previous'),
    nextButton: requiredElement(root, '.diet-calendar__next'),
  };
}

export function createCivilDateCalendar(
  options: CalendarControllerOptions,
): CivilDateCalendarController {
  const { elements, locale, bounds, getDayState, onHover, onSelect } = options;
  const localeInfo = new Intl.Locale(locale) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number };
  };
  if (typeof localeInfo.getWeekInfo !== 'function') {
    throw new Error('[DieterDate] locale week information is unavailable');
  }
  const firstDay = localeInfo.getWeekInfo().firstDay % 7;
  const monthFormatter = new Intl.DateTimeFormat(locale, {
    calendar: 'gregory',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const weekdayFormatter = new Intl.DateTimeFormat(locale, {
    calendar: 'gregory',
    weekday: 'short',
    timeZone: 'UTC',
  });
  const fullDateFormatter = new Intl.DateTimeFormat(locale, {
    calendar: 'gregory',
    dateStyle: 'full',
    timeZone: 'UTC',
  });
  const dayNumberFormatter = new Intl.NumberFormat(locale);
  let view = { ...options.initialView, day: 1 };

  const renderWeekdays = () => {
    const sunday = civilDateFromOrdinal(dayOrdinal(parseCivilDate('2026-08-16', 'weekday anchor')));
    elements.weekdayGrid.replaceChildren();
    for (let offset = 0; offset < 7; offset += 1) {
      const weekdayIndex = (firstDay + offset) % 7;
      const date = civilDateFromOrdinal(dayOrdinal(sunday) + weekdayIndex);
      const label = document.createElement('span');
      label.className = 'diet-calendar__weekday';
      label.textContent = weekdayFormatter.format(civilDateToUtcDate(date));
      elements.weekdayGrid.append(label);
    }
  };

  const render = () => {
    const first = parseCivilDate(
      `${String(view.year).padStart(4, '0')}-${pad(view.month)}-01`,
      'calendar month',
    );
    const firstWeekday = civilDateToUtcDate(first).getUTCDay();
    const leading = (firstWeekday - firstDay + 7) % 7;
    const gridStart = dayOrdinal(first) - leading;
    const today = todayCivilDate();

    elements.monthLabel.textContent = monthFormatter.format(civilDateToUtcDate(first));
    const existingButtons = Array.from(
      elements.dayGrid.querySelectorAll<HTMLButtonElement>(':scope > .diet-calendar__day'),
    );
    const nextButtons: HTMLButtonElement[] = [];

    for (let index = 0; index < 42; index += 1) {
      const date = civilDateFromOrdinal(gridStart + index);
      const allowed =
        date.year >= 1 &&
        date.year <= 9999 &&
        (!bounds.min || compareCivilDates(date, bounds.min) >= 0) &&
        (!bounds.max || compareCivilDates(date, bounds.max) <= 0);
      const state = getDayState(date);
      const existing = existingButtons[index];
      const button =
        existing?.dataset.date === date.iso ? existing : document.createElement('button');
      button.type = 'button';
      button.className = 'diet-calendar__day';
      button.dataset.date = date.iso;
      button.textContent = dayNumberFormatter.format(date.day);
      button.setAttribute('aria-label', fullDateFormatter.format(civilDateToUtcDate(date)));
      button.disabled = !allowed;
      delete button.dataset.outsideMonth;
      delete button.dataset.selected;
      delete button.dataset.rangeStart;
      delete button.dataset.rangeEnd;
      delete button.dataset.inRange;
      delete button.dataset.preview;
      delete button.dataset.weekStart;
      delete button.dataset.weekEnd;
      button.removeAttribute('aria-current');
      if (date.month !== view.month) button.dataset.outsideMonth = 'true';
      if (date.iso === today.iso) button.setAttribute('aria-current', 'date');
      if (state.selected) button.dataset.selected = 'true';
      if (state.rangeStart) button.dataset.rangeStart = 'true';
      if (state.rangeEnd) button.dataset.rangeEnd = 'true';
      if (state.inRange) button.dataset.inRange = 'true';
      if (state.preview) button.dataset.preview = 'true';
      if (index % 7 === 0) button.dataset.weekStart = 'true';
      if (index % 7 === 6) button.dataset.weekEnd = 'true';
      nextButtons.push(button);
    }

    if (nextButtons.some((button, index) => button !== existingButtons[index])) {
      elements.dayGrid.replaceChildren(...nextButtons);
    }

    elements.previousButton.disabled = !monthIntersectsBounds(addMonths(first, -1), bounds);
    elements.nextButton.disabled = !monthIntersectsBounds(addMonths(first, 1), bounds);
  };

  const changeMonth = (delta: number) => {
    const next = addMonths(view, delta);
    if (!monthIntersectsBounds(next, bounds)) return;
    view = next;
    render();
  };
  const selectDay = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('.diet-calendar__day[data-date]');
    if (!button || button.disabled || !elements.dayGrid.contains(button)) return;
    onSelect(parseCivilDate(button.dataset.date!, 'selected date'));
  };
  const hoverDay = (event: Event) => {
    if (!onHover) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('.diet-calendar__day[data-date]');
    if (!button || button.disabled || !elements.dayGrid.contains(button)) return;
    onHover(parseCivilDate(button.dataset.date!, 'hover date'));
  };
  const clearHover = () => onHover?.(null);
  const previousMonth = () => changeMonth(-1);
  const nextMonth = () => changeMonth(1);

  elements.previousButton.addEventListener('click', previousMonth);
  elements.nextButton.addEventListener('click', nextMonth);
  elements.dayGrid.addEventListener('click', selectDay);
  elements.dayGrid.addEventListener('pointerover', hoverDay);
  elements.dayGrid.addEventListener('pointerleave', clearHover);
  renderWeekdays();
  render();

  return {
    destroy: () => {
      elements.previousButton.removeEventListener('click', previousMonth);
      elements.nextButton.removeEventListener('click', nextMonth);
      elements.dayGrid.removeEventListener('click', selectDay);
      elements.dayGrid.removeEventListener('pointerover', hoverDay);
      elements.dayGrid.removeEventListener('pointerleave', clearHover);
    },
    render,
    setView: (date: CivilDate) => {
      view = { ...date, day: 1 };
      render();
    },
  };
}
