import type { OutputFormat } from './core/resolver';

export type OptimizationRule = {
  maxLength: number;
  strategy: 'truncate';
};

export type FormatOptimizations = Record<string, OptimizationRule>;

export const FORMAT_OPTIMIZATIONS: Record<OutputFormat, FormatOptimizations> = {
  web: {},
  email: {},
  ad: {
    headline: { maxLength: 30, strategy: 'truncate' },
    subheadline: { maxLength: 20, strategy: 'truncate' },
  },
  social: {
    headline: { maxLength: 40, strategy: 'truncate' },
  },
};

function truncate(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength).trimEnd();
}

export function optimizeContentForOutput<T extends Record<string, unknown>>(content: T, format: OutputFormat): T {
  const rules = FORMAT_OPTIMIZATIONS[format];
  if (!rules || Object.keys(rules).length === 0) return content;
  const next: Record<string, unknown> = { ...content };
  for (const [key, rule] of Object.entries(rules)) {
    const value = next[key];
    if (typeof value !== 'string') continue;
    if (rule.strategy === 'truncate') {
      next[key] = truncate(value, rule.maxLength);
    }
  }
  return next as T;
}
