import type { CompiledControl, CompiledControlOption } from '../types';

export type ControlMatcher = {
  control: CompiledControl;
  regex: RegExp;
  optionValues?: Set<string>;
  score: number;
};

const TOKEN_SEGMENT = /^__[^.]+__$/;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileControlPattern(pathPattern: string): RegExp {
  const segments = pathPattern.split('.').filter(Boolean);
  const regexSegments = segments.map((segment) => {
    if (TOKEN_SEGMENT.test(segment)) return '\\d+';
    return escapeRegex(segment);
  });
  return new RegExp(`^${regexSegments.join('\\.')}$`);
}

function scoreControl(control: CompiledControl) {
  return (control.options && control.options.length ? 100 : 0) + (control.type === 'field' ? 0 : 10) + (control.label ? 1 : 0);
}

export function buildControlMatchers(controls: CompiledControl[]): ControlMatcher[] {
  return controls
    .filter((c) => typeof c.path === 'string' && c.path.trim().length > 0)
    .map((control) => {
      const optionValues = control.options?.length
        ? new Set(control.options.map((o) => o.value))
        : undefined;
      return {
        control,
        regex: compileControlPattern(control.path),
        optionValues,
        score: scoreControl(control),
      };
    });
}

export function findBestControlForPath(matchers: ControlMatcher[], path: string): CompiledControl | null {
  let best: ControlMatcher | null = null;
  for (const matcher of matchers) {
    if (!matcher.regex.test(path)) continue;
    if (!best || matcher.score > best.score) {
      best = matcher;
    }
  }
  return best?.control ?? null;
}

export type CoerceStrictResult =
  | { ok: true; value: unknown }
  | { ok: false; message: string };

function toEnumValues(control: CompiledControl): string[] | null {
  if (control.enumValues && control.enumValues.length > 0) return control.enumValues;
  const fromOptions = control.options?.map((opt) => opt.value).filter(Boolean);
  return fromOptions && fromOptions.length > 0 ? fromOptions : null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '') return null;
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return null;
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

export function coerceValueStrict(control: CompiledControl, rawValue: unknown): CoerceStrictResult {
  const kind = control.kind;
  if (!kind || kind === 'unknown') {
    return { ok: false, message: 'Control kind is missing or unknown' };
  }

  if (kind === 'boolean') {
    const parsed = parseBoolean(rawValue);
    if (parsed === null) {
      return { ok: false, message: 'Value must be a boolean' };
    }
    return { ok: true, value: parsed };
  }

  if (kind === 'number') {
    const parsed = parseNumber(rawValue);
    if (parsed === null) {
      return { ok: false, message: 'Value must be a number' };
    }
    return { ok: true, value: parsed };
  }

  if (kind === 'enum') {
    const allowed = toEnumValues(control);
    if (typeof rawValue !== 'string') return { ok: false, message: 'Value must be a string' };
    const value = rawValue.trim();
    if (!value) return { ok: false, message: 'Value cannot be empty' };
    if (!allowed || allowed.length === 0) return { ok: false, message: 'Control is missing enum values' };
    if (!allowed.includes(value)) {
      return { ok: false, message: `Value must be one of: ${allowed.join(', ')}` };
    }
    return { ok: true, value };
  }

  if (kind === 'json') {
    if (rawValue == null) return { ok: false, message: 'Value is required' };
    if (typeof rawValue !== 'string') return { ok: true, value: rawValue };
    const trimmed = rawValue.trim();
    if (!trimmed) return { ok: false, message: 'Value cannot be empty JSON' };
    try {
      return { ok: true, value: JSON.parse(trimmed) };
    } catch {
      return { ok: false, message: 'Invalid JSON' };
    }
  }

  if (kind === 'array') {
    if (rawValue == null) return { ok: false, message: 'Value is required' };
    if (Array.isArray(rawValue)) return { ok: true, value: rawValue };
    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (!trimmed) return { ok: false, message: 'Value cannot be empty JSON array' };
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (!Array.isArray(parsed)) return { ok: false, message: 'Expected a JSON array' };
        return { ok: true, value: parsed };
      } catch {
        return { ok: false, message: 'Invalid JSON array' };
      }
    }
    return { ok: false, message: 'Value must be an array' };
  }

  if (kind === 'object') {
    if (rawValue == null) return { ok: false, message: 'Value is required' };
    if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) return { ok: true, value: rawValue };
    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (!trimmed) return { ok: false, message: 'Value cannot be empty JSON object' };
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return { ok: false, message: 'Expected a JSON object' };
        }
        return { ok: true, value: parsed };
      } catch {
        return { ok: false, message: 'Invalid JSON object' };
      }
    }
    return { ok: false, message: 'Value must be an object' };
  }

  if (kind === 'color') {
    if (rawValue == null) return { ok: false, message: 'Value is required' };
    if (typeof rawValue !== 'string') return { ok: false, message: 'Value must be a string' };
    const value = rawValue.trim();
    if (!value) return { ok: false, message: 'Value cannot be empty' };
    return { ok: true, value };
  }

  // string / unknown
  if (rawValue == null) return { ok: false, message: 'Value is required' };
  if (typeof rawValue !== 'string') return { ok: false, message: 'Value must be a string' };
  return { ok: true, value: rawValue };
}
