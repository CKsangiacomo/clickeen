export type CivilDate = {
  year: number;
  month: number;
  day: number;
  iso: string;
};

export type CivilDateBounds = {
  min: CivilDate | null;
  max: CivilDate | null;
};

export type CivilDateRange = {
  start: CivilDate;
  end: CivilDate;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

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

export function parseCivilDate(value: string, name: string): CivilDate {
  const match = ISO_DATE.exec(value);
  if (!match) throw new Error(`[DieterDate] ${name} must be YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    throw new Error(`[DieterDate] ${name} is not a real civil date`);
  }
  return { year, month, day, iso: `${match[1]}-${pad(month)}-${pad(day)}` };
}

export function readOptionalCivilDate(value: string | undefined, name: string): CivilDate | null {
  return value === undefined ? null : parseCivilDate(value, name);
}

export function compareCivilDates(left: CivilDate, right: CivilDate): number {
  return left.iso.localeCompare(right.iso);
}

export function parseCivilDateRange(value: unknown): CivilDateRange | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('[DieterDate] range must be null or an exact range');
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join('\0') !== 'end\0start' ||
    typeof record.start !== 'string' ||
    typeof record.end !== 'string'
  ) {
    throw new Error('[DieterDate] range must contain only start and end date strings');
  }
  const start = parseCivilDate(record.start, 'range start');
  const end = parseCivilDate(record.end, 'range end');
  if (compareCivilDates(start, end) > 0) {
    throw new Error('[DieterDate] range start must not be after end');
  }
  return { start, end };
}

export function assertDateWithinBounds(
  value: CivilDate,
  bounds: CivilDateBounds,
  name: string,
): void {
  if (bounds.min && compareCivilDates(value, bounds.min) < 0) {
    throw new Error(`[DieterDate] ${name} is before min`);
  }
  if (bounds.max && compareCivilDates(value, bounds.max) > 0) {
    throw new Error(`[DieterDate] ${name} is after max`);
  }
}

export function readCivilDateBounds(root: HTMLElement): CivilDateBounds {
  const bounds = {
    min: readOptionalCivilDate(root.dataset.min, 'min'),
    max: readOptionalCivilDate(root.dataset.max, 'max'),
  };
  if (bounds.min && bounds.max && compareCivilDates(bounds.min, bounds.max) > 0) {
    throw new Error('[DieterDate] min must not be after max');
  }
  return bounds;
}

export function civilDateToUtcDate(date: CivilDate): Date {
  const value = new Date(0);
  value.setUTCHours(12, 0, 0, 0);
  value.setUTCFullYear(date.year, date.month - 1, date.day);
  return value;
}

export function todayCivilDate(): CivilDate {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return {
    year,
    month,
    day,
    iso: `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`,
  };
}

export function initialCalendarView(
  selected: CivilDate | null,
  bounds: CivilDateBounds,
): CivilDate {
  if (selected) return selected;
  const today = todayCivilDate();
  if (bounds.min && compareCivilDates(today, bounds.min) < 0) return bounds.min;
  if (bounds.max && compareCivilDates(today, bounds.max) > 0) return bounds.max;
  return today;
}

export function formatCivilDate(date: CivilDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    calendar: 'gregory',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(civilDateToUtcDate(date));
}

export function formatCivilDateRange(start: CivilDate, end: CivilDate, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    calendar: 'gregory',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return formatter.formatRange(civilDateToUtcDate(start), civilDateToUtcDate(end));
}
