'use client';

import { applyWidgetNormalizationRules } from '../compiler/modules/normalization';
import type { CompiledWidget } from '../types';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeMissingDefaults(
  defaults: Record<string, unknown>,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};

  Object.entries(defaults).forEach(([key, defaultValue]) => {
    if (!Object.prototype.hasOwnProperty.call(config, key)) {
      next[key] = cloneValue(defaultValue);
      return;
    }

    const configValue = config[key];
    next[key] =
      isPlainRecord(defaultValue) && isPlainRecord(configValue)
        ? mergeMissingDefaults(defaultValue, configValue)
        : cloneValue(configValue);
  });

  Object.entries(config).forEach(([key, configValue]) => {
    if (Object.prototype.hasOwnProperty.call(next, key)) return;
    next[key] = cloneValue(configValue);
  });

  return next;
}

export function normalizeSessionConfig(args: {
  compiled: Pick<CompiledWidget, 'defaults' | 'normalization'>;
  config: Record<string, unknown>;
}): Record<string, unknown> {
  const merged = mergeMissingDefaults(args.compiled.defaults, args.config);
  return applyWidgetNormalizationRules(merged, args.compiled.normalization);
}
