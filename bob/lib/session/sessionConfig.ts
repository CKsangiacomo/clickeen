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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function materializeConfigWithDefaults(defaults: unknown, config: Record<string, unknown>): Record<string, unknown> {
  if (!isPlainObject(defaults)) return normalizeSessionConfig(config);
  const next = cloneSessionConfig(defaults);

  function mergeInto(target: Record<string, unknown>, source: Record<string, unknown>) {
    for (const [key, value] of Object.entries(source)) {
      const existing = target[key];
      if (isPlainObject(existing) && isPlainObject(value)) {
        mergeInto(existing, value);
        continue;
      }
      target[key] = value;
    }
  }

  mergeInto(next, config);
  return next;
}

export function normalizeSessionConfig(
  config: Record<string, unknown>,
  compiled?: Pick<CompiledWidget, 'controls' | 'defaults' | 'normalization'> | null,
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

    const fallback = getAt<unknown>(compiled?.defaults, control.path);
    const fallbackCoerced = coerceValueStrict(control, fallback);
    if (fallbackCoerced.ok) {
      next = setAt(next, control.path, fallbackCoerced.value) as Record<string, unknown>;
    }
  }

  return next;
}
