import type { CompiledControl } from '../types';
import { buildControlMatchers, coerceValueStrict, findBestControlForPath } from './controls';
import { getAt, setAt } from '../utils/paths';
import { getTypographyRoleScaleKind, validateArrayItemIds, validateNumberConstraints, validateWidgetData } from './validate';

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

export type ApplyWidgetOpsResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; errors: WidgetOpError[] };

const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function hasProhibitedSegment(path: string): boolean {
  return path
    .split('.')
    .some((segment) => segment && PROHIBITED_SEGMENTS.has(segment));
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function insertAtPath(data: Record<string, unknown>, path: string, index: number, value: unknown) {
  const current = getAt<any[]>(data, path);
  if (!Array.isArray(current)) {
    throw new Error(`[BobOps] Expected array at "${path}"`);
  }
  const next = [...current.slice(0, index), value, ...current.slice(index)];
  return setAt(data, path, next) as Record<string, unknown>;
}

function removeAtPath(data: Record<string, unknown>, path: string, index: number) {
  const current = getAt<any[]>(data, path);
  if (!Array.isArray(current)) {
    throw new Error(`[BobOps] Expected array at "${path}"`);
  }
  const next = current.filter((_item, idx) => idx !== index);
  return setAt(data, path, next) as Record<string, unknown>;
}

function moveAtPath(data: Record<string, unknown>, path: string, from: number, to: number) {
  const current = getAt<any[]>(data, path);
  if (!Array.isArray(current)) {
    throw new Error(`[BobOps] Expected array at "${path}"`);
  }
  const next = [...current];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return setAt(data, path, next) as Record<string, unknown>;
}

const NUMERIC_STRING = /^-?\d+(?:\.\d+)?$/;

function isNumericString(value: string): boolean {
  return NUMERIC_STRING.test(value.trim());
}

function splitPath(path: string): string[] {
  return String(path ?? '')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function commonPrefixLen(a: string[], b: string[]): number {
  const len = Math.min(a.length, b.length);
  let count = 0;
  for (let i = 0; i < len; i += 1) {
    if (a[i] !== b[i]) break;
    count += 1;
  }
  return count;
}

function findBestOpIndexForPath(path: string, ops: WidgetOp[]): number {
  const target = splitPath(path);
  let bestIndex = 0;
  let bestScore = -1;

  for (let idx = 0; idx < ops.length; idx += 1) {
    const opPath = (ops[idx] as any)?.path;
    if (typeof opPath !== 'string') continue;
    const score = commonPrefixLen(target, splitPath(opPath));
    if (score > bestScore || (score === bestScore && idx > bestIndex)) {
      bestScore = score;
      bestIndex = idx;
    }
  }

  return bestIndex;
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
      let coercedValue = coerced.value;

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

      const typographySizeCustomMatch = path.match(/^typography\.roles\.([^.]+)\.sizeCustom$/);
      if (typographySizeCustomMatch && typeof coerced.value === 'string') {
        const roleKey = typographySizeCustomMatch[1];
        const trimmed = coerced.value.trim();
        const kind = getTypographyRoleScaleKind(working, roleKey);
        if (kind === 'css-length') {
          if (isNumericString(trimmed)) {
            coercedValue = `${trimmed}px`;
          } else if (/^--[a-z0-9-]+$/i.test(trimmed)) {
            coercedValue = `var(${trimmed})`;
          } else {
            coercedValue = trimmed;
          }
        } else if (kind === 'number') {
          if (trimmed.endsWith('%')) {
            const numPart = trimmed.slice(0, -1).trim();
            coercedValue = isNumericString(numPart) ? numPart : trimmed;
          } else {
            coercedValue = trimmed;
          }
        } else {
          coercedValue = trimmed;
        }
      }

      const next = setAt(working, path, coercedValue) as Record<string, unknown>;
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
      if (!Array.isArray(current)) {
        return { ok: false, errors: [{ opIndex: idx, path, message: 'Target must be an array' }] };
      }
      const len = current.length;
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
      working = next;
      continue;
    }

    return { ok: false, errors: [{ opIndex: idx, path, message: `Unknown op "${opType}"` }] };
  }

  const stateErrors = validateWidgetData({ data: working, controls });
  if (stateErrors.length > 0) {
    return {
      ok: false,
      errors: stateErrors.map((err) => ({
        opIndex: findBestOpIndexForPath(err.path, ops),
        path: err.path,
        message: err.message,
      })),
    };
  }
  return { ok: true, data: working };
}
