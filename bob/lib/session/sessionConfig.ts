import type { CompiledWidget } from '../types';
import { coerceValueStrict } from '../edit/controls';
import { applyWidgetNormalizationRules } from '../compiler/modules/normalization';
import { getAt, setAt } from '../utils/paths';

function cloneJsonValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value) as T;
  }
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneSessionConfig(config: Record<string, unknown>): Record<string, unknown> {
  return cloneJsonValue(config);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeMissingDefaults(
  defaults: Record<string, unknown>,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const next = cloneJsonValue(config);

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const currentValue = next[key];
    if (currentValue === undefined) {
      next[key] = cloneJsonValue(defaultValue);
      continue;
    }
    if (isPlainRecord(defaultValue) && isPlainRecord(currentValue)) {
      next[key] = mergeMissingDefaults(defaultValue, currentValue);
    }
  }

  return next;
}

export function normalizeSessionConfig(
  config: Record<string, unknown>,
  compiled?: Pick<CompiledWidget, 'controls' | 'defaults' | 'normalization'> | null,
): Record<string, unknown> {
  let next = compiled?.defaults ? mergeMissingDefaults(compiled.defaults, config) : cloneSessionConfig(config);
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
