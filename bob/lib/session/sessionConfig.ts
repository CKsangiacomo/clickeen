import type { CompiledWidget } from '../types';
import { coerceValueStrict } from '../edit/controls';
import { applyWidgetNormalizationRules } from '../compiler/modules/normalization';
import { getAt, setAt } from '../utils/paths';

function cloneSessionConfig(config: Record<string, unknown>): Record<string, unknown> {
  if (typeof structuredClone === 'function') {
    return structuredClone(config) as Record<string, unknown>;
  }
  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
}

function cloneUnknown<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasAt(obj: unknown, path: string): boolean {
  if (!path) return true;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (!isPlainRecord(cur) && !Array.isArray(cur)) return false;
    const key = /^\d+$/.test(part) ? Number(part) : part;
    if (!Object.prototype.hasOwnProperty.call(cur, key)) return false;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return true;
}

function applyObjectDefaults(
  config: Record<string, unknown>,
  defaults?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!defaults) return config;
  const next: Record<string, unknown> = { ...config };
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const currentValue = next[key];
    if (currentValue === undefined) {
      next[key] = cloneUnknown(defaultValue);
      continue;
    }
    if (isPlainRecord(currentValue) && isPlainRecord(defaultValue)) {
      next[key] = applyObjectDefaults(currentValue, defaultValue);
    }
  }
  return next;
}

export type SessionConfigValidationIssue = {
  path: string;
  message: string;
};

export type SessionConfigValidationResult =
  | { ok: true }
  | { ok: false; issues: SessionConfigValidationIssue[] };

export function validateSessionConfigForOpen(
  config: Record<string, unknown>,
  compiled: Pick<CompiledWidget, 'controls'>,
): SessionConfigValidationResult {
  const issues: SessionConfigValidationIssue[] = [];
  for (const control of compiled.controls ?? []) {
    if (!control.path || control.path.includes('__')) continue;
    if (!['boolean', 'number', 'string', 'enum'].includes(control.kind ?? '')) continue;
    if (!hasAt(config, control.path)) continue;
    const current = getAt<unknown>(config, control.path);
    const coerced = coerceValueStrict(control, current);
    if (!coerced.ok) {
      issues.push({ path: `config.${control.path}`, message: coerced.message });
    }
  }

  return issues.length ? { ok: false, issues } : { ok: true };
}

export function normalizeSessionConfig(
  config: Record<string, unknown>,
  compiled?: Pick<CompiledWidget, 'controls' | 'normalization'> | null,
): Record<string, unknown> {
  let next = cloneSessionConfig(config);
  next = applyWidgetNormalizationRules(next, compiled?.normalization);

  for (const control of compiled?.controls ?? []) {
    if (!control.path || control.path.includes('__')) continue;
    if (!['boolean', 'number', 'string', 'enum'].includes(control.kind ?? '')) continue;

    const current = getAt<unknown>(next, control.path);
    const coerced = coerceValueStrict(control, current);
    if (coerced.ok) {
      if (!Object.is(current, coerced.value)) {
        next = setAt(next, control.path, coerced.value) as Record<string, unknown>;
      }
      continue;
    }
  }

  return next;
}

export function normalizeSessionConfigForOpen(
  config: Record<string, unknown>,
  compiled?: Pick<CompiledWidget, 'controls' | 'defaults' | 'normalization'> | null,
): Record<string, unknown> {
  const withDefaults = applyObjectDefaults(cloneSessionConfig(config), compiled?.defaults);
  return normalizeSessionConfig(withDefaults, compiled);
}
