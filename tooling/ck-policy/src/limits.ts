import { getEntitlementsMatrix } from './matrix';
import type { Policy } from './types';

export type LimitContext = 'ops' | 'load' | 'publish';
export type LimitEnforcement = 'reject' | 'sanitize' | 'ignore';

export type FlagLimit = {
  kind: 'flag';
  key: string;
  paths: string[];
  mode: 'boolean' | 'nonempty-string';
  deny: boolean | 'nonempty';
  sanitizeTo?: unknown;
  enforce?: Partial<Record<LimitContext, LimitEnforcement>>;
};

export type CapLimit = {
  kind: 'cap';
  key: string;
  path: string;
  metric: 'count' | 'count-total' | 'chars';
  enforce?: Partial<Record<LimitContext, Exclude<LimitEnforcement, 'sanitize'>>>;
};

export type LimitEntry = FlagLimit | CapLimit;

export type LimitsSpec = {
  v: 1;
  limits: LimitEntry[];
};

export type LimitViolation = {
  key: string;
  path: string;
  reasonKey: string;
  detail?: string;
};

const DEFAULT_CAP_ENFORCE: Record<LimitContext, Exclude<LimitEnforcement, 'sanitize'>> = {
  ops: 'reject',
  publish: 'reject',
  load: 'ignore',
};

const DEFAULT_FLAG_ENFORCE: Record<LimitContext, LimitEnforcement> = {
  ops: 'reject',
  publish: 'reject',
  load: 'ignore',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizePaths(entry: { path?: string; paths?: unknown }): string[] {
  if (typeof entry.path === 'string' && entry.path.trim()) {
    return [entry.path.trim()];
  }
  if (Array.isArray(entry.paths)) {
    const paths = entry.paths
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter(Boolean);
    if (paths.length > 0) return paths;
  }
  return [];
}

function requireMatrixKind(key: string, expected: LimitEntry['kind']) {
  const matrix = getEntitlementsMatrix();
  const entry = matrix.capabilities[key];
  if (!entry) {
    throw new Error(`[ck-policy] Limits spec references unknown entitlement key: ${key}`);
  }
  if (entry.kind !== expected) {
    throw new Error(`[ck-policy] Limits spec key ${key} expected kind ${expected} but matrix is ${entry.kind}`);
  }
}

function defaultSanitizeValue(limit: FlagLimit): unknown {
  if (limit.mode === 'nonempty-string') return '';
  if (limit.deny === true) return false;
  if (limit.deny === false) return true;
  return '';
}

function normalizeFlag(limit: FlagLimit): FlagLimit {
  const paths = limit.paths.length ? limit.paths : normalizePaths(limit);
  if (paths.length === 0) {
    throw new Error(`[ck-policy] Flag limit ${limit.key} must specify paths`);
  }
  if (limit.mode !== 'boolean' && limit.mode !== 'nonempty-string') {
    throw new Error(`[ck-policy] Flag limit ${limit.key} has invalid mode`);
  }
  if (limit.mode === 'boolean' && typeof limit.deny !== 'boolean') {
    throw new Error(`[ck-policy] Flag limit ${limit.key} deny must be boolean`);
  }
  if (limit.mode === 'nonempty-string' && limit.deny !== 'nonempty') {
    throw new Error(`[ck-policy] Flag limit ${limit.key} deny must be "nonempty"`);
  }

  const enforce = { ...DEFAULT_FLAG_ENFORCE, ...(limit.enforce ?? {}) };
  const sanitizeTo = limit.sanitizeTo ?? (enforce.load === 'sanitize' ? defaultSanitizeValue(limit) : limit.sanitizeTo);

  return {
    ...limit,
    paths,
    enforce,
    sanitizeTo,
  };
}

function normalizeCap(limit: CapLimit): CapLimit {
  const path = typeof limit.path === 'string' ? limit.path.trim() : '';
  if (!path) {
    throw new Error(`[ck-policy] Cap limit ${limit.key} must specify path`);
  }
  if (limit.metric !== 'count' && limit.metric !== 'count-total' && limit.metric !== 'chars') {
    throw new Error(`[ck-policy] Cap limit ${limit.key} has invalid metric`);
  }
  if ((limit.metric === 'count' || limit.metric === 'count-total') && !path.includes('[]')) {
    throw new Error(`[ck-policy] Cap limit ${limit.key} metric ${limit.metric} requires [] in path`);
  }
  const enforce = { ...DEFAULT_CAP_ENFORCE, ...(limit.enforce ?? {}) };
  return { ...limit, path, enforce };
}

export function parseLimitsSpec(raw: unknown): LimitsSpec | null {
  if (raw == null) return null;
  if (!isRecord(raw)) {
    throw new Error('[ck-policy] limits.json must be an object');
  }
  if (raw.v !== 1) {
    throw new Error('[ck-policy] limits.json v must be 1');
  }
  if (!Array.isArray(raw.limits)) {
    throw new Error('[ck-policy] limits.json limits must be an array');
  }

  const limits: LimitEntry[] = raw.limits.map((entry: unknown) => {
    if (!isRecord(entry)) {
      throw new Error('[ck-policy] limits.json entries must be objects');
    }
    const kind = entry.kind;
    const key = typeof entry.key === 'string' ? entry.key.trim() : '';
    if (!key) {
      throw new Error('[ck-policy] limits.json entries must include key');
    }
    if (kind !== 'flag' && kind !== 'cap') {
      throw new Error(`[ck-policy] limits.json entry ${key} has invalid kind`);
    }
    requireMatrixKind(key, kind);
    if (kind === 'flag') {
      return normalizeFlag({
        kind: 'flag',
        key,
        paths: normalizePaths(entry),
        mode: entry.mode as FlagLimit['mode'],
        deny: entry.deny as FlagLimit['deny'],
        sanitizeTo: entry.sanitizeTo,
        enforce: entry.enforce as FlagLimit['enforce'],
      });
    }
    return normalizeCap({
      kind: 'cap',
      key,
      path: typeof entry.path === 'string' ? entry.path : '',
      metric: entry.metric as CapLimit['metric'],
      enforce: entry.enforce as CapLimit['enforce'],
    });
  });

  return { v: 1, limits };
}

function parseSegments(path: string): string[] {
  const segments: string[] = [];
  const parts = path.split('.');
  for (const part of parts) {
    if (!part) continue;
    if (part.endsWith('[]')) {
      const base = part.slice(0, -2);
      if (base) segments.push(base);
      segments.push('[]');
    } else {
      segments.push(part);
    }
  }
  return segments;
}

function collectArrays(root: unknown, segments: string[], idx = 0): unknown[][] {
  if (idx >= segments.length) return [];
  const seg = segments[idx];
  if (seg === '[]') {
    if (!Array.isArray(root)) return [];
    if (idx === segments.length - 1) return [root];
    return root.flatMap((item) => collectArrays(item, segments, idx + 1));
  }
  if (!isRecord(root)) return [];
  return collectArrays(root[seg], segments, idx + 1);
}

function collectValues(root: unknown, segments: string[], idx = 0): unknown[] {
  if (idx >= segments.length) return [root];
  const seg = segments[idx];
  if (seg === '[]') {
    if (!Array.isArray(root)) return [];
    return root.flatMap((item) => collectValues(item, segments, idx + 1));
  }
  if (!isRecord(root)) return [];
  return collectValues(root[seg], segments, idx + 1);
}

function collectPaths(root: unknown, segments: string[], idx = 0, prefix = ''): string[] {
  if (idx >= segments.length) return [prefix];
  const seg = segments[idx];
  if (seg === '[]') {
    if (!Array.isArray(root)) return [];
    return root.flatMap((item, i) => collectPaths(item, segments, idx + 1, joinPath(prefix, String(i))));
  }
  if (!isRecord(root)) return [];
  return collectPaths(root[seg], segments, idx + 1, joinPath(prefix, seg));
}

function joinPath(base: string, next: string): string {
  return base ? `${base}.${next}` : next;
}

function setAt(obj: unknown, path: string, value: unknown): unknown {
  if (!path) return value;
  const parts = path.split('.');
  const root = Array.isArray(obj) ? [...obj] : { ...(obj as Record<string, unknown>) };
  let cur: any = root;
  for (let i = 0; i < parts.length; i += 1) {
    const key = parts[i];
    const isLast = i === parts.length - 1;
    const index = /^\d+$/.test(key) ? Number(key) : null;
    const nextKey = index != null ? index : key;
    if (isLast) {
      cur[nextKey] = value;
      break;
    }
    const next = cur[nextKey];
    const clone = Array.isArray(next) ? [...next] : isRecord(next) ? { ...next } : {};
    cur[nextKey] = clone;
    cur = clone;
  }
  return root;
}

function reasonKeyForLimit(limit: LimitEntry): string {
  if (limit.kind === 'cap') return 'coreui.upsell.reason.capReached';
  if (limit.key === 'seoGeo.enabled') return 'coreui.upsell.reason.embed.seoGeo';
  if (limit.key === 'context.websiteUrl.enabled') return 'coreui.upsell.reason.context.websiteUrl';
  return 'coreui.upsell.reason.flagBlocked';
}

export function evaluateLimits(args: {
  config: Record<string, unknown>;
  limits: LimitsSpec | null | undefined;
  policy: Policy;
  context: LimitContext;
}): LimitViolation[] {
  const { config, limits, policy, context } = args;
  if (!limits) return [];

  const violations: LimitViolation[] = [];
  for (const limit of limits.limits) {
    if (limit.kind === 'flag') {
      const enforcement = limit.enforce?.[context] ?? DEFAULT_FLAG_ENFORCE[context];
      if (enforcement !== 'reject') continue;
      if (policy.flags[limit.key] === true) continue;
      const denyValue = limit.deny;
      for (const path of limit.paths) {
        const segments = parseSegments(path);
        const values = collectValues(config, segments);
        for (const value of values) {
          if (limit.mode === 'boolean') {
            if (value === denyValue) {
              violations.push({
                key: limit.key,
                path,
                reasonKey: reasonKeyForLimit(limit),
              });
              break;
            }
          } else {
            if (typeof value === 'string' && value.trim()) {
              violations.push({
                key: limit.key,
                path,
                reasonKey: reasonKeyForLimit(limit),
              });
              break;
            }
          }
        }
      }
      continue;
    }

    const enforcement = limit.enforce?.[context] ?? DEFAULT_CAP_ENFORCE[context];
    if (enforcement !== 'reject') continue;
    const max = policy.caps[limit.key];
    if (max == null || typeof max !== 'number') continue;

    const segments = parseSegments(limit.path);
    if (limit.metric === 'chars') {
      const values = collectValues(config, segments);
      for (const value of values) {
        if (typeof value === 'string' && value.length > max) {
          violations.push({
            key: limit.key,
            path: limit.path,
            reasonKey: reasonKeyForLimit(limit),
            detail: `${limit.key} exceeded (max=${max}, current=${value.length}).`,
          });
          break;
        }
      }
      continue;
    }

    const arrays = collectArrays(config, segments);
    if (limit.metric === 'count-total') {
      const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
      if (total > max) {
        violations.push({
          key: limit.key,
          path: limit.path,
          reasonKey: reasonKeyForLimit(limit),
          detail: `${limit.key} exceeded (max=${max}, current=${total}).`,
        });
      }
      continue;
    }

    for (const arr of arrays) {
      if (arr.length > max) {
        violations.push({
          key: limit.key,
          path: limit.path,
          reasonKey: reasonKeyForLimit(limit),
          detail: `${limit.key} exceeded (max=${max}, current=${arr.length}).`,
        });
        break;
      }
    }
  }

  return violations;
}

export function sanitizeConfig(args: {
  config: Record<string, unknown>;
  limits: LimitsSpec | null | undefined;
  policy: Policy;
  context: LimitContext;
}): Record<string, unknown> {
  const { config, limits, policy, context } = args;
  if (!limits) return config;
  let next = config;

  for (const limit of limits.limits) {
    if (limit.kind !== 'flag') continue;
    const enforcement = limit.enforce?.[context] ?? DEFAULT_FLAG_ENFORCE[context];
    if (enforcement !== 'sanitize') continue;
    if (policy.flags[limit.key] === true) continue;

    const sanitizeValue = limit.sanitizeTo ?? defaultSanitizeValue(limit);
    for (const path of limit.paths) {
      const segments = parseSegments(path);
      const concretePaths = collectPaths(next, segments);
      for (const concrete of concretePaths) {
        next = setAt(next, concrete, sanitizeValue) as Record<string, unknown>;
      }
    }
  }

  return next;
}
