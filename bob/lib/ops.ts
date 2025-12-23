import type { CompiledControl } from './types';
import { buildControlMatchers, coerceValueStrict, findBestControlForPath } from './controls';
import { getAt, setAt } from './utils/paths';

export type WidgetOp =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'insert'; path: string; index: number; value: unknown }
  | { op: 'remove'; path: string; index: number }
  | { op: 'move'; path: string; from: number; to: number };

export type WidgetOpError = {
  opIndex: number;
  path?: string;
  message: string;
};

export type WidgetDataError = {
  path: string;
  message: string;
};

export type ApplyWidgetOpsResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; errors: WidgetOpError[] };

const TOKEN_SEGMENT = /^__[^.]+__$/;
const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function hasProhibitedSegment(path: string): boolean {
  return path
    .split('.')
    .some((segment) => segment && PROHIBITED_SEGMENTS.has(segment));
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function validateNumberConstraints(control: CompiledControl, value: number): string | null {
  if (typeof control.min === 'number' && value < control.min) return `Value must be >= ${control.min}`;
  if (typeof control.max === 'number' && value > control.max) return `Value must be <= ${control.max}`;
  return null;
}

function validateArrayItemIds(control: CompiledControl, value: unknown): string | null {
  if (!control.itemIdPath) return null;
  if (!Array.isArray(value)) return 'Value must be an array';

  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return `Array items must be objects with "${control.itemIdPath}"`;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const id = (item as any)[control.itemIdPath];
    if (typeof id !== 'string' || !id.trim()) {
      return `Array items must include a non-empty "${control.itemIdPath}"`;
    }
    if (seen.has(id)) {
      return `Duplicate "${control.itemIdPath}" value "${id}"`;
    }
    seen.add(id);
  }
  return null;
}

function toEnumValues(control: CompiledControl): string[] | null {
  if (control.enumValues && control.enumValues.length > 0) return control.enumValues;
  const fromOptions = control.options?.map((opt) => opt.value).filter(Boolean);
  return fromOptions && fromOptions.length > 0 ? fromOptions : null;
}

function validateControlValue(control: CompiledControl, value: unknown): string | null {
  if (!control.kind || control.kind === 'unknown') {
    return 'Control kind is missing or unknown';
  }
  if (value === undefined) return 'Missing required value';

  if (control.kind === 'boolean') {
    return typeof value === 'boolean' ? null : 'Value must be a boolean';
  }

  if (control.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'Value must be a finite number';
    return validateNumberConstraints(control, value);
  }

  if (control.kind === 'string' || control.kind === 'color' || control.kind === 'enum') {
    if (typeof value !== 'string') return 'Value must be a string';
    if (control.kind === 'enum') {
      const allowed = toEnumValues(control);
      if (!allowed) return 'Control is missing enum values';
      if (!allowed.includes(value)) return `Value must be one of: ${allowed.join(', ')}`;
    }
    return null;
  }

  if (control.kind === 'array') {
    if (!Array.isArray(value)) return 'Value must be an array';
    return validateArrayItemIds(control, value);
  }

  if (control.kind === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Value must be an object';
    return null;
  }

  if (control.kind === 'json') {
    // JSON accepts any value except undefined.
    return null;
  }

  return 'Unsupported control kind';
}

function validateControlInData(control: CompiledControl, data: Record<string, unknown>, errors: WidgetDataError[]) {
  const segments = control.path.split('.').filter(Boolean);

  const walk = (idx: number, current: unknown, acc: string[]) => {
    if (idx >= segments.length) {
      const err = validateControlValue(control, current);
      if (err) errors.push({ path: acc.join('.'), message: err });
      return;
    }

    const segment = segments[idx];
    if (TOKEN_SEGMENT.test(segment)) {
      if (!Array.isArray(current)) {
        errors.push({ path: acc.join('.'), message: 'Expected an array' });
        return;
      }
      current.forEach((item, itemIndex) => walk(idx + 1, item, [...acc, String(itemIndex)]));
      return;
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      errors.push({
        path: acc.join('.'),
        message: `Expected an object to resolve "${segment}"`,
      });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next = (current as any)[segment];
    walk(idx + 1, next, [...acc, segment]);
  };

  walk(0, data, []);
}

export function validateWidgetData(args: {
  data: Record<string, unknown>;
  controls: CompiledControl[];
}): WidgetDataError[] {
  const errors: WidgetDataError[] = [];
  for (const control of args.controls) {
    validateControlInData(control, args.data, errors);
  }
  return errors;
}

function insertAtPath(data: Record<string, unknown>, path: string, index: number, value: unknown) {
  const current = getAt<any[]>(data, path);
  const arr = Array.isArray(current) ? current : [];
  const next = [...arr.slice(0, index), value, ...arr.slice(index)];
  return setAt(data, path, next) as Record<string, unknown>;
}

function removeAtPath(data: Record<string, unknown>, path: string, index: number) {
  const current = getAt<any[]>(data, path);
  const arr = Array.isArray(current) ? current : [];
  const next = arr.filter((_item, idx) => idx !== index);
  return setAt(data, path, next) as Record<string, unknown>;
}

function moveAtPath(data: Record<string, unknown>, path: string, from: number, to: number) {
  const current = getAt<any[]>(data, path);
  const arr = Array.isArray(current) ? current : [];
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return setAt(data, path, next) as Record<string, unknown>;
}

export function applyWidgetOps(args: {
  data: Record<string, unknown>;
  ops: WidgetOp[];
  controls: CompiledControl[];
}): ApplyWidgetOpsResult {
  const { data, ops, controls } = args;

  if (!Array.isArray(ops) || ops.length === 0) {
    return { ok: false, errors: [{ opIndex: 0, message: 'Ops must be a non-empty array' }] };
  }

  const matchers = buildControlMatchers(controls);
  let working = data;

  for (let idx = 0; idx < ops.length; idx += 1) {
    const op = ops[idx];
    if (!op || typeof op !== 'object') {
      return { ok: false, errors: [{ opIndex: idx, message: 'Op must be an object' }] };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = op as any;
    const opType = raw.op;
    const path = raw.path;

    if (typeof opType !== 'string') {
      return { ok: false, errors: [{ opIndex: idx, message: "Missing op (expected 'set'|'insert'|'remove'|'move')" }] };
    }

    if (typeof path !== 'string' || !path.trim()) {
      return { ok: false, errors: [{ opIndex: idx, message: 'Missing path' }] };
    }

    if (hasProhibitedSegment(path)) {
      return { ok: false, errors: [{ opIndex: idx, path, message: 'Path contains a prohibited segment' }] };
    }

    const control = findBestControlForPath(matchers, path);
    if (!control) {
      return { ok: false, errors: [{ opIndex: idx, path, message: 'Path is not editable' }] };
    }

    if (opType === 'set') {
      if (raw.value === undefined) {
        return { ok: false, errors: [{ opIndex: idx, path, message: 'Value cannot be undefined' }] };
      }
      const coerced = coerceValueStrict(control, raw.value);
      if (!coerced.ok) {
        return { ok: false, errors: [{ opIndex: idx, path, message: coerced.message }] };
      }

      if (control.kind === 'number' && typeof coerced.value === 'number') {
        const constraintError = validateNumberConstraints(control, coerced.value);
        if (constraintError) {
          return { ok: false, errors: [{ opIndex: idx, path, message: constraintError }] };
        }
      }

      const idError = validateArrayItemIds(control, coerced.value);
      if (idError) {
        return { ok: false, errors: [{ opIndex: idx, path, message: idError }] };
      }

      const next = setAt(working, path, coerced.value) as Record<string, unknown>;
      const stateErrors = validateWidgetData({ data: next, controls });
      if (stateErrors.length > 0) {
        return {
          ok: false,
          errors: stateErrors.map((err) => ({ opIndex: idx, path: err.path, message: err.message })),
        };
      }
      working = next;
      continue;
    }

    if (opType === 'insert') {
      if (control.kind !== 'array') {
        return { ok: false, errors: [{ opIndex: idx, path, message: 'Target must be an array control' }] };
      }
      if (!isInteger(raw.index) || raw.index < 0) {
        return { ok: false, errors: [{ opIndex: idx, path, message: 'index must be an integer >= 0' }] };
      }
      const current = getAt<unknown>(working, path);
      if (current !== undefined && !Array.isArray(current)) {
        return { ok: false, errors: [{ opIndex: idx, path, message: 'Target must be an array' }] };
      }
      const len = Array.isArray(current) ? current.length : 0;
      if (raw.index > len) {
        return { ok: false, errors: [{ opIndex: idx, path, message: `index out of range (0..${len})` }] };
      }
      if (control.itemIdPath) {
        const item = raw.value;
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return {
            ok: false,
            errors: [
              { opIndex: idx, path, message: `Inserted item must be an object with "${control.itemIdPath}"` },
            ],
          };
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const id = (item as any)[control.itemIdPath];
        if (typeof id !== 'string' || !id.trim()) {
          return {
            ok: false,
            errors: [
              { opIndex: idx, path, message: `Inserted item must include a non-empty "${control.itemIdPath}"` },
            ],
          };
        }
      }
      const next = insertAtPath(working, path, raw.index, raw.value);
      const stateErrors = validateWidgetData({ data: next, controls });
      if (stateErrors.length > 0) {
        return {
          ok: false,
          errors: stateErrors.map((err) => ({ opIndex: idx, path: err.path, message: err.message })),
        };
      }
      working = next;
      continue;
    }

    if (opType === 'remove') {
      if (control.kind !== 'array') {
        return { ok: false, errors: [{ opIndex: idx, path, message: 'Target must be an array control' }] };
      }
      if (!isInteger(raw.index) || raw.index < 0) {
        return { ok: false, errors: [{ opIndex: idx, path, message: 'index must be an integer >= 0' }] };
      }
      const current = getAt<unknown>(working, path);
      if (!Array.isArray(current)) {
        return { ok: false, errors: [{ opIndex: idx, path, message: 'Target must be an array' }] };
      }
      if (raw.index >= current.length) {
        return {
          ok: false,
          errors: [{ opIndex: idx, path, message: `index out of range (0..${Math.max(0, current.length - 1)})` }],
        };
      }
      const next = removeAtPath(working, path, raw.index);
      const stateErrors = validateWidgetData({ data: next, controls });
      if (stateErrors.length > 0) {
        return {
          ok: false,
          errors: stateErrors.map((err) => ({ opIndex: idx, path: err.path, message: err.message })),
        };
      }
      working = next;
      continue;
    }

    if (opType === 'move') {
      if (control.kind !== 'array') {
        return { ok: false, errors: [{ opIndex: idx, path, message: 'Target must be an array control' }] };
      }
      if (!isInteger(raw.from) || raw.from < 0) {
        return { ok: false, errors: [{ opIndex: idx, path, message: 'from must be an integer >= 0' }] };
      }
      if (!isInteger(raw.to) || raw.to < 0) {
        return { ok: false, errors: [{ opIndex: idx, path, message: 'to must be an integer >= 0' }] };
      }
      const current = getAt<unknown>(working, path);
      if (!Array.isArray(current)) {
        return { ok: false, errors: [{ opIndex: idx, path, message: 'Target must be an array' }] };
      }
      const max = current.length - 1;
      if (max < 0) {
        return { ok: false, errors: [{ opIndex: idx, path, message: 'Cannot move items in an empty array' }] };
      }
      if (raw.from > max || raw.to > max) {
        return { ok: false, errors: [{ opIndex: idx, path, message: `Indices out of range (0..${max})` }] };
      }
      const next = moveAtPath(working, path, raw.from, raw.to);
      const stateErrors = validateWidgetData({ data: next, controls });
      if (stateErrors.length > 0) {
        return {
          ok: false,
          errors: stateErrors.map((err) => ({ opIndex: idx, path: err.path, message: err.message })),
        };
      }
      working = next;
      continue;
    }

    return { ok: false, errors: [{ opIndex: idx, path, message: `Unknown op "${opType}"` }] };
  }
  return { ok: true, data: working };
}
