import type { CompiledControl } from '../types';

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

export type ValidateValueResult =
  | { ok: true }
  | { ok: false; message: string };

function toEnumValues(control: CompiledControl): string[] | null {
  if (control.enumValues && control.enumValues.length > 0) return control.enumValues;
  const fromOptions = control.options?.map((opt) => opt.value).filter(Boolean);
  return fromOptions && fromOptions.length > 0 ? fromOptions : null;
}

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
    const allowed = toEnumValues(control);
    if (typeof rawValue !== 'string') return { ok: false, message: 'Value must be a string' };
    if (!rawValue) return { ok: false, message: 'Value cannot be empty' };
    if (!allowed || allowed.length === 0) return { ok: false, message: 'Control is missing enum values' };
    if (!allowed.includes(rawValue)) {
      return { ok: false, message: `Value must be one of: ${allowed.join(', ')}` };
    }
    return { ok: true };
  }

  if (kind === 'json') {
    if (rawValue == null) return { ok: false, message: 'Value is required' };
    if (typeof rawValue !== 'string') return { ok: true };
    return { ok: false, message: 'Value must be JSON data, not a string' };
  }

  if (kind === 'array') {
    if (rawValue == null) return { ok: false, message: 'Value is required' };
    if (Array.isArray(rawValue)) return { ok: true };
    return { ok: false, message: 'Value must be an array' };
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
