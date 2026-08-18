import type { CompiledControl } from '../types';

const TOKEN_SEGMENT = /^__[^.]+__$/;

function scoreControl(control: CompiledControl) {
  return (control.options && control.options.length ? 100 : 0) + (control.type === 'field' ? 0 : 10) + (control.label ? 1 : 0);
}

function controlPathMatches(pattern: string, path: string): boolean {
  const patternSegments = pattern.split('.');
  const pathSegments = path.split('.');
  if (patternSegments.length !== pathSegments.length) return false;
  return patternSegments.every((segment, index) => (
    TOKEN_SEGMENT.test(segment) ? /^\d+$/.test(pathSegments[index]) : segment === pathSegments[index]
  ));
}

export function findBestControlForPath(controls: CompiledControl[], path: string): CompiledControl | null {
  let best: CompiledControl | null = null;
  let bestScore = -1;
  for (const control of controls) {
    if (!controlPathMatches(control.path, path)) continue;
    const score = scoreControl(control);
    if (score > bestScore) {
      best = control;
      bestScore = score;
    }
  }
  return best;
}

export type ValidateValueResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateValueStrict(control: CompiledControl, rawValue: unknown): ValidateValueResult {
  const kind = control.kind;
  if (!kind || kind === 'unknown') {
    return { ok: false, message: 'Control kind is missing or unknown' };
  }

  if (kind === 'boolean') {
    if (typeof rawValue !== 'boolean') {
      return { ok: false, message: 'Value must be a boolean' };
    }
    return { ok: true };
  }

  if (kind === 'number') {
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
      return { ok: false, message: 'Value must be a number' };
    }
    if (typeof control.min === 'number' && rawValue < control.min) {
      return { ok: false, message: `Value must be greater than or equal to ${control.min}` };
    }
    if (typeof control.max === 'number' && rawValue > control.max) {
      return { ok: false, message: `Value must be less than or equal to ${control.max}` };
    }
    return { ok: true };
  }

  if (kind === 'enum') {
    const allowed = control.enumValues!;
    if (typeof rawValue !== 'string') return { ok: false, message: 'Value must be a string' };
    if (!rawValue) return { ok: false, message: 'Value cannot be empty' };
    if (!allowed.includes(rawValue)) {
      return { ok: false, message: `Value must be one of: ${allowed.join(', ')}` };
    }
    return { ok: true };
  }

  if (kind === 'json') {
    if (control.type === 'dropdown-upload' && rawValue === null) return { ok: true };
    if (rawValue == null) return { ok: false, message: 'Value is required' };
    if (typeof rawValue !== 'string') return { ok: true };
    return { ok: false, message: 'Value must be JSON data, not a string' };
  }

  if (kind === 'array') {
    if (rawValue == null) return { ok: false, message: 'Value is required' };
    if (!Array.isArray(rawValue)) return { ok: false, message: 'Value must be an array' };
    if (typeof control.min === 'number' && rawValue.length < control.min) {
      return { ok: false, message: `Array must contain at least ${control.min} items` };
    }
    if (typeof control.max === 'number' && rawValue.length > control.max) {
      return { ok: false, message: `Array must contain at most ${control.max} items` };
    }
    return { ok: true };
  }

  if (kind === 'object') {
    if (rawValue == null) return { ok: false, message: 'Value is required' };
    if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) return { ok: true };
    return { ok: false, message: 'Value must be an object' };
  }

  if (kind === 'color') {
    if (rawValue == null) return { ok: false, message: 'Value is required' };
    if (typeof rawValue !== 'string') return { ok: false, message: 'Value must be a string' };
    if (!rawValue) return { ok: false, message: 'Value cannot be empty' };
    return { ok: true };
  }

  // string / unknown
  if (rawValue == null) return { ok: false, message: 'Value is required' };
  if (typeof rawValue !== 'string') return { ok: false, message: 'Value must be a string' };
  if (control.required === true && rawValue.trim() === '') {
    return { ok: false, message: 'Value cannot be empty' };
  }
  return { ok: true };
}
