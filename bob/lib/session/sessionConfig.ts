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
