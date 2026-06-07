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

function mergeDefaultsIntoConfig(
  defaults: Record<string, unknown> | undefined,
  config: Record<string, unknown>,
): Record<string, unknown> {
  if (!defaults) return cloneSessionConfig(config);
  const merge = (defaultValue: unknown, configValue: unknown): unknown => {
    if (configValue === undefined) return cloneJsonValue(defaultValue);
    if (isPlainRecord(defaultValue) && isPlainRecord(configValue)) {
      const next: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(defaultValue)) {
        next[key] = merge(value, configValue[key]);
      }
      for (const [key, value] of Object.entries(configValue)) {
        if (next[key] === undefined) next[key] = cloneJsonValue(value);
      }
      return next;
    }
    return cloneJsonValue(configValue);
  };
  return merge(defaults, config) as Record<string, unknown>;
}

export function normalizeSessionConfig(
  config: Record<string, unknown>,
  compiled?: Pick<CompiledWidget, 'controls' | 'defaults' | 'normalization'> | null,
): Record<string, unknown> {
  let next = mergeDefaultsIntoConfig(compiled?.defaults, config);
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
