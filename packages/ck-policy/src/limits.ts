import { isRecord } from '@clickeen/ck-contracts';
import { getEntitlementsMatrix } from './matrix';
import type { Policy } from './types';

export type LimitContext = 'ops' | 'load' | 'publish';
export type LimitEnforcement = 'reject' | 'ignore';

export type FlagLimit = {
  kind: 'flag';
  key: string;
  paths: string[];
  mode: 'boolean' | 'nonempty-string';
  deny: boolean | 'nonempty';
  enforce?: Partial<Record<LimitContext, LimitEnforcement>>;
};

export type NumericLimit = {
  kind: 'limit';
  key: string;
  path: string;
  metric: 'count' | 'count-total' | 'chars';
  enforce?: Partial<Record<LimitContext, LimitEnforcement>>;
};

export type LimitEntry = FlagLimit | NumericLimit;

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

const DEFAULT_LIMIT_ENFORCE: Record<LimitContext, LimitEnforcement> = {
  ops: 'reject',
  publish: 'reject',
  load: 'ignore',
};

const DEFAULT_FLAG_ENFORCE: Record<LimitContext, LimitEnforcement> = {
  ops: 'reject',
  publish: 'reject',
  load: 'ignore',
};

function readPath(value: unknown, key: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`[ck-policy] Limit ${key} path must be a non-empty string`);
  if (/\s/.test(value)) throw new Error(`[ck-policy] Limit ${key} has invalid path`);
  const parts = value.split('.');
  for (const part of parts) {
    if (!part || !part.trim() || part === '[]' || (part.includes('[]') && !part.endsWith('[]'))) throw new Error(`[ck-policy] Limit ${key} has invalid path`);
  }
  return value;
}

function readPaths(entry: { path?: unknown; paths?: unknown; key?: string }): string[] {
  const hasPath = Object.prototype.hasOwnProperty.call(entry, 'path');
  const hasPaths = Object.prototype.hasOwnProperty.call(entry, 'paths');
  if (hasPath && hasPaths) throw new Error(`[ck-policy] Flag limit ${entry.key ?? ''} must specify path or paths`);
  if (hasPath) {
    return [readPath(entry.path, entry.key ?? '')];
  }
  if (!hasPaths) return [];
  if (!Array.isArray(entry.paths)) throw new Error(`[ck-policy] Flag limit ${entry.key ?? ''} paths must be an array`);
  return entry.paths.map((path) => readPath(path, entry.key ?? ''));
}

function requireMatrixKind(key: string, expected: LimitEntry['kind']) {
  const matrix = getEntitlementsMatrix();
  const entry = matrix.entitlements[key];
  if (!entry) {
    throw new Error(`[ck-policy] Limits spec references unknown entitlement key: ${key}`);
  }
  if (entry.kind !== expected) {
    throw new Error(`[ck-policy] Limits spec key ${key} expected kind ${expected} but matrix is ${entry.kind}`);
  }
}

function assertEnforce(enforce: Record<string, unknown>, key: string): void {
  for (const [context, value] of Object.entries(enforce)) {
    if (!['ops', 'load', 'publish'].includes(context) || (value !== 'reject' && value !== 'ignore')) throw new Error(`[ck-policy] Limit ${key} has invalid enforce`);
  }
}

function readEnforce(enforce: unknown, key: string): Partial<Record<LimitContext, LimitEnforcement>> | undefined {
  if (enforce === undefined) return undefined;
  if (!isRecord(enforce)) throw new Error(`[ck-policy] Limit ${key} has invalid enforce`);
  assertEnforce(enforce, key);
  return enforce as Partial<Record<LimitContext, LimitEnforcement>>;
}

function normalizeFlag(limit: FlagLimit): FlagLimit {
  const paths = limit.paths.length ? limit.paths : readPaths(limit);
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

  const enforce = { ...DEFAULT_FLAG_ENFORCE, ...readEnforce(limit.enforce, limit.key) };

  return {
    ...limit,
    paths,
    enforce,
  };
}

function normalizeNumericLimit(limit: NumericLimit): NumericLimit {
  const path = readPath(limit.path, limit.key);
  if (!path) {
    throw new Error(`[ck-policy] Numeric limit ${limit.key} must specify path`);
  }
  if (limit.metric !== 'count' && limit.metric !== 'count-total' && limit.metric !== 'chars') {
    throw new Error(`[ck-policy] Numeric limit ${limit.key} has invalid metric`);
  }
  if ((limit.metric === 'count' || limit.metric === 'count-total') && !path.includes('[]')) {
    throw new Error(`[ck-policy] Numeric limit ${limit.key} metric ${limit.metric} requires [] in path`);
  }
  const enforce = { ...DEFAULT_LIMIT_ENFORCE, ...readEnforce(limit.enforce, limit.key) };
  return { ...limit, path, enforce };
}

export function parseLimitsSpec(raw: unknown): LimitsSpec {
  if (!isRecord(raw)) {
    throw new Error('[ck-policy] limits.json must be an object');
  }
  if (raw.v !== 1) {
    throw new Error('[ck-policy] limits.json v must be 1');
  }
  if (!Array.isArray(raw.limits)) {
    throw new Error('[ck-policy] limits.json limits must be an array');
  }
  if (raw.limits.length === 0) {
    throw new Error('[ck-policy] limits.json limits must not be empty');
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
    if (kind !== 'flag' && kind !== 'limit') {
      throw new Error(`[ck-policy] limits.json entry ${key} has invalid kind`);
    }
    requireMatrixKind(key, kind);
    if (Object.prototype.hasOwnProperty.call(entry, 'sanitizeTo')) {
      throw new Error(`[ck-policy] Limit ${key} has deleted sanitizeTo`);
    }
    if (kind === 'flag') {
      return normalizeFlag({
        kind: 'flag',
        key,
        paths: readPaths(entry),
        mode: entry.mode as FlagLimit['mode'],
        deny: entry.deny as FlagLimit['deny'],
        enforce: entry.enforce as FlagLimit['enforce'],
      });
    }
    if (Object.prototype.hasOwnProperty.call(entry, 'path') && Object.prototype.hasOwnProperty.call(entry, 'paths')) {
      throw new Error(`[ck-policy] Limit ${key} must specify path or paths`);
    }
    return normalizeNumericLimit({
      kind: 'limit',
      key,
      path: entry.path as string,
      metric: entry.metric as NumericLimit['metric'],
      enforce: entry.enforce as NumericLimit['enforce'],
    });
  });

  return { v: 1, limits };
}

function parseSegments(path: string): string[] {
  const segments: string[] = [];
  const parts = path.split('.');
  for (const part of parts) {
    if (!part) throw new Error('[ck-policy] Limit has invalid path');
    if (part.endsWith('[]')) {
      const base = part.slice(0, -2);
      if (!base) throw new Error('[ck-policy] Limit has invalid path');
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

function reasonKeyForLimit(limit: LimitEntry): string {
  if (limit.kind === 'limit') return 'coreui.upsell.reason.limitReached';
  return 'coreui.upsell.reason.flagBlocked';
}

export function evaluateLimits(args: {
  config: Record<string, unknown>;
  limits: LimitsSpec;
  policy: Policy;
  context: LimitContext;
}): LimitViolation[] {
  const { config, limits, policy, context } = args;

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

    const enforcement = limit.enforce?.[context] ?? DEFAULT_LIMIT_ENFORCE[context];
    if (enforcement !== 'reject') continue;
    const max = policy.limits[limit.key];
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
