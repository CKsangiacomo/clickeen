import type { CompiledWidget } from '../types';
import { applyWidgetNormalizations } from './sessionNormalization';

export function applyDefaultsIntoConfig(
  normalization: CompiledWidget['normalization'],
  defaults: Record<string, unknown>,
  config: Record<string, unknown>,
) {
  const merge = (defaultsValue: unknown, targetValue: unknown): void => {
    if (!defaultsValue || typeof defaultsValue !== 'object' || Array.isArray(defaultsValue)) return;
    if (!targetValue || typeof targetValue !== 'object' || Array.isArray(targetValue)) return;

    const defaultsObj = defaultsValue as Record<string, unknown>;
    const targetObj = targetValue as Record<string, unknown>;

    Object.entries(defaultsObj).forEach(([key, dv]) => {
      if (key in targetObj) {
        merge(dv, targetObj[key]);
        return;
      }
      targetObj[key] = structuredClone(dv);
    });
  };

  merge(defaults, config);
  return applyWidgetNormalizations(normalization, config);
}
