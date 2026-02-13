import type {
  WidgetNormalizationCoerceRule,
  WidgetNormalizationIdRule,
  WidgetNormalizationScalarType,
  WidgetNormalizationSpec,
} from '../../types';

const FORBIDDEN_PATH_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSafePathKey(value: string): boolean {
  if (!value) return false;
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) return false;
  if (FORBIDDEN_PATH_KEYS.has(value)) return false;
  return true;
}

function splitPath(path: string, allowArraySuffixOnLast: boolean): string[] {
  const raw = String(path || '').trim();
  if (!raw) throw new Error('[BobCompiler] normalization path must be a non-empty string');

  const segments = raw.split('.').map((segment) => segment.trim());
  if (segments.some((segment) => !segment)) {
    throw new Error(`[BobCompiler] normalization path "${raw}" contains empty segments`);
  }

  return segments.map((segment, index) => {
    const hasArraySuffix = segment.endsWith('[]');
    const key = hasArraySuffix ? segment.slice(0, -2) : segment;
    if (!isSafePathKey(key)) {
      throw new Error(`[BobCompiler] normalization path segment "${segment}" is invalid`);
    }
    if (hasArraySuffix && index === segments.length - 1 && !allowArraySuffixOnLast) {
      throw new Error(`[BobCompiler] normalization path "${raw}" cannot end with []`);
    }
    return hasArraySuffix ? `${key}[]` : key;
  });
}

function slugifyIdPart(input: unknown): string {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!value) return '';
  const slug = value
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, 48);
}

function uniqueId(base: string, used: Set<string>): string {
  const seed = base || 'item';
  let next = seed;
  let suffix = 2;
  while (used.has(next)) {
    next = `${seed}-${suffix}`;
    suffix += 1;
  }
  used.add(next);
  return next;
}

function coerceValue(
  value: unknown,
  type: WidgetNormalizationScalarType,
  fallback: unknown,
): unknown {
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (typeof fallback === 'boolean') return fallback;
    return value;
  }
  if (type === 'number') {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback;
    return value;
  }
  if (typeof value === 'string') return value;
  if (typeof fallback === 'string') return fallback;
  return value;
}

function parseIdRule(ruleRaw: unknown, index: number): WidgetNormalizationIdRule {
  if (!isPlainRecord(ruleRaw)) {
    throw new Error(`[BobCompiler] normalization.idRules[${index}] must be an object`);
  }
  const arrayPathRaw = ruleRaw.arrayPath;
  if (typeof arrayPathRaw !== 'string' || !arrayPathRaw.trim()) {
    throw new Error(`[BobCompiler] normalization.idRules[${index}].arrayPath must be a non-empty string`);
  }
  const arrayPath = splitPath(arrayPathRaw, true).join('.');

  const idKeyRaw = ruleRaw.idKey;
  if (typeof idKeyRaw !== 'string' || !isSafePathKey(idKeyRaw.trim())) {
    throw new Error(`[BobCompiler] normalization.idRules[${index}].idKey must be a safe key`);
  }

  const seedKeyRaw = ruleRaw.seedKey;
  const seedKey =
    typeof seedKeyRaw === 'string' && seedKeyRaw.trim()
      ? (() => {
          const key = seedKeyRaw.trim();
          if (!isSafePathKey(key)) {
            throw new Error(`[BobCompiler] normalization.idRules[${index}].seedKey must be a safe key`);
          }
          return key;
        })()
      : undefined;

  const fallbackPrefixRaw = ruleRaw.fallbackPrefix;
  const fallbackPrefix =
    typeof fallbackPrefixRaw === 'string' && fallbackPrefixRaw.trim()
      ? fallbackPrefixRaw.trim()
      : undefined;

  return {
    arrayPath,
    idKey: idKeyRaw.trim(),
    ...(seedKey ? { seedKey } : {}),
    ...(fallbackPrefix ? { fallbackPrefix } : {}),
  };
}

function parseCoerceRule(ruleRaw: unknown, index: number): WidgetNormalizationCoerceRule {
  if (!isPlainRecord(ruleRaw)) {
    throw new Error(`[BobCompiler] normalization.coerceRules[${index}] must be an object`);
  }
  const pathRaw = ruleRaw.path;
  if (typeof pathRaw !== 'string' || !pathRaw.trim()) {
    throw new Error(`[BobCompiler] normalization.coerceRules[${index}].path must be a non-empty string`);
  }
  const path = splitPath(pathRaw, false).join('.');

  const typeRaw = ruleRaw.type;
  if (typeRaw !== 'string' && typeRaw !== 'number' && typeRaw !== 'boolean') {
    throw new Error(`[BobCompiler] normalization.coerceRules[${index}].type must be string|number|boolean`);
  }

  const fallback = ruleRaw.default;
  if (fallback !== undefined) {
    if (typeRaw === 'string' && typeof fallback !== 'string') {
      throw new Error(`[BobCompiler] normalization.coerceRules[${index}].default must be a string`);
    }
    if (typeRaw === 'number' && (typeof fallback !== 'number' || !Number.isFinite(fallback))) {
      throw new Error(`[BobCompiler] normalization.coerceRules[${index}].default must be a finite number`);
    }
    if (typeRaw === 'boolean' && typeof fallback !== 'boolean') {
      throw new Error(`[BobCompiler] normalization.coerceRules[${index}].default must be a boolean`);
    }
  }

  return {
    path,
    type: typeRaw,
    ...(fallback !== undefined ? { default: fallback } : {}),
  };
}

function resolveArrayTargets(root: Record<string, unknown>, path: string): unknown[][] {
  const segments = splitPath(path, true);
  let candidates: unknown[] = [root];

  segments.forEach((segment) => {
    const isArraySegment = segment.endsWith('[]');
    const key = isArraySegment ? segment.slice(0, -2) : segment;
    const next: unknown[] = [];

    candidates.forEach((candidate) => {
      if (!isPlainRecord(candidate)) return;
      const value = candidate[key];
      if (isArraySegment) {
        if (Array.isArray(value)) next.push(...value);
        return;
      }
      next.push(value);
    });

    candidates = next;
  });

  return candidates.filter((candidate): candidate is unknown[] => Array.isArray(candidate));
}

function resolveLeafTargets(root: Record<string, unknown>, path: string): Array<{ node: Record<string, unknown>; key: string }> {
  const segments = splitPath(path, false);
  const leaf = segments[segments.length - 1];
  const parents = segments.slice(0, -1);

  let candidates: unknown[] = [root];
  parents.forEach((segment) => {
    const isArraySegment = segment.endsWith('[]');
    const key = isArraySegment ? segment.slice(0, -2) : segment;
    const next: unknown[] = [];

    candidates.forEach((candidate) => {
      if (!isPlainRecord(candidate)) return;
      const value = candidate[key];
      if (isArraySegment) {
        if (Array.isArray(value)) next.push(...value);
        return;
      }
      next.push(value);
    });

    candidates = next;
  });

  return candidates
    .filter((candidate): candidate is Record<string, unknown> => isPlainRecord(candidate))
    .map((node) => ({ node, key: leaf }));
}

function applyIdRule(config: Record<string, unknown>, rule: WidgetNormalizationIdRule): boolean {
  const arrays = resolveArrayTargets(config, rule.arrayPath);
  if (!arrays.length) return false;

  const used = new Set<string>();
  let changed = false;
  const fallbackPrefix = slugifyIdPart(rule.fallbackPrefix ?? rule.idKey) || 'item';

  arrays.forEach((array) => {
    array.forEach((item, index) => {
      if (!isPlainRecord(item)) return;

      const idValue = item[rule.idKey];
      const rawId = typeof idValue === 'string' ? idValue.trim() : '';
      const seedSource = rule.seedKey ? item[rule.seedKey] : undefined;
      const seed = rawId || slugifyIdPart(seedSource) || `${fallbackPrefix}-${index + 1}`;
      const nextId = uniqueId(seed, used);
      if (nextId === rawId) return;

      item[rule.idKey] = nextId;
      changed = true;
    });
  });

  return changed;
}

function applyCoerceRule(config: Record<string, unknown>, rule: WidgetNormalizationCoerceRule): boolean {
  const targets = resolveLeafTargets(config, rule.path);
  if (!targets.length) return false;

  let changed = false;
  targets.forEach(({ node, key }) => {
    const current = node[key];
    const next = coerceValue(current, rule.type, rule.default);
    if (Object.is(current, next)) return;
    node[key] = next;
    changed = true;
  });

  return changed;
}

export function normalizeWidgetNormalizationSpec(raw: unknown): WidgetNormalizationSpec | undefined {
  if (raw == null) return undefined;
  if (!isPlainRecord(raw)) {
    throw new Error('[BobCompiler] normalization must be an object');
  }

  const idRulesRaw = raw.idRules;
  if (idRulesRaw != null && !Array.isArray(idRulesRaw)) {
    throw new Error('[BobCompiler] normalization.idRules must be an array');
  }
  const coerceRulesRaw = raw.coerceRules;
  if (coerceRulesRaw != null && !Array.isArray(coerceRulesRaw)) {
    throw new Error('[BobCompiler] normalization.coerceRules must be an array');
  }

  const idRules = (idRulesRaw ?? []).map((rule, index) => parseIdRule(rule, index));
  const coerceRules = (coerceRulesRaw ?? []).map((rule, index) => parseCoerceRule(rule, index));

  if (!idRules.length && !coerceRules.length) return undefined;
  return {
    ...(idRules.length ? { idRules } : {}),
    ...(coerceRules.length ? { coerceRules } : {}),
  };
}

export function applyWidgetNormalizationRules(
  config: Record<string, unknown>,
  normalization: WidgetNormalizationSpec | undefined,
): Record<string, unknown> {
  if (!normalization) return config;

  normalization.idRules?.forEach((rule) => {
    applyIdRule(config, rule);
  });
  normalization.coerceRules?.forEach((rule) => {
    applyCoerceRule(config, rule);
  });
  return config;
}
