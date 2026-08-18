import { isRecord } from '@clickeen/ck-contracts';
import { getEntitlementsMatrix } from './matrix';
import type { Policy } from './types';

export type FlagLimit = {
  kind: 'flag';
  key: string;
  messageId: string;
  paths: string[];
  mode: 'boolean' | 'nonempty-string';
  deny: boolean | 'nonempty';
};

export type NumericLimit = {
  kind: 'limit';
  key: string;
  messageId: string;
  path: string;
  metric: 'count' | 'count-total' | 'chars';
};

export type LimitEntry = FlagLimit | NumericLimit;

export type LimitsSpec = {
  limits: LimitEntry[];
};

export type LimitViolation = {
  key: string;
  messageId: string;
  path: string;
  required: boolean | number;
  reasonKey: string;
  detail?: string;
};

function readPath(value: unknown, key: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`[ck-policy] Limit ${key} path must be a non-empty string`);
  if (/\s/.test(value)) throw new Error(`[ck-policy] Limit ${key} has invalid path`);
  const parts = value.split('.');
  for (const part of parts) {
    if (!part || !part.trim() || part === '[]' || (part.includes('[]') && !part.endsWith('[]')))
      throw new Error(`[ck-policy] Limit ${key} has invalid path`);
  }
  return value;
}

function readPaths(entry: { path?: unknown; paths?: unknown; key?: string }): string[] {
  const hasPath = Object.prototype.hasOwnProperty.call(entry, 'path');
  const hasPaths = Object.prototype.hasOwnProperty.call(entry, 'paths');
  if (hasPath && hasPaths)
    throw new Error(`[ck-policy] Flag limit ${entry.key ?? ''} must specify path or paths`);
  if (hasPath) {
    return [readPath(entry.path, entry.key ?? '')];
  }
  if (!hasPaths) return [];
  if (!Array.isArray(entry.paths))
    throw new Error(`[ck-policy] Flag limit ${entry.key ?? ''} paths must be an array`);
  return entry.paths.map((path) => readPath(path, entry.key ?? ''));
}

function requireMatrixKind(key: string, expected: LimitEntry['kind']) {
  const matrix = getEntitlementsMatrix();
  const entry = matrix.entitlements[key];
  if (!entry) {
    throw new Error(`[ck-policy] Limits spec references unknown entitlement key: ${key}`);
  }
  if (entry.kind !== expected) {
    throw new Error(
      `[ck-policy] Limits spec key ${key} expected kind ${expected} but matrix is ${entry.kind}`,
    );
  }
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

  return {
    ...limit,
    paths,
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
    throw new Error(
      `[ck-policy] Numeric limit ${limit.key} metric ${limit.metric} requires [] in path`,
    );
  }
  return { ...limit, path };
}

export function parseLimitsSpec(raw: unknown): LimitsSpec {
  if (!isRecord(raw)) {
    throw new Error('[ck-policy] limits.json must be an object');
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
    const messageId = typeof entry.messageId === 'string' ? entry.messageId.trim() : '';
    if (!key) {
      throw new Error('[ck-policy] limits.json entries must include key');
    }
    if (!messageId) {
      throw new Error(`[ck-policy] limits.json entry ${key} must include messageId`);
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
        messageId,
        paths: readPaths(entry),
        mode: entry.mode as FlagLimit['mode'],
        deny: entry.deny as FlagLimit['deny'],
      });
    }
    if (
      Object.prototype.hasOwnProperty.call(entry, 'path') &&
      Object.prototype.hasOwnProperty.call(entry, 'paths')
    ) {
      throw new Error(`[ck-policy] Limit ${key} must specify path or paths`);
    }
    return normalizeNumericLimit({
      kind: 'limit',
      key,
      messageId,
      path: entry.path as string,
      metric: entry.metric as NumericLimit['metric'],
    });
  });

  return { limits };
}

function parseSegments(path: string): string[] {
  const segments: string[] = [];
  const parts = path.split('.');
  for (const part of parts) {
    if (!part) throw new Error('[ck-policy] Limit has invalid path');
    if (part.endsWith('[]')) {
      const base = part.slice(0, -2);
      if (!base) throw new Error('[ck-policy] Limit has invalid path');
      segments.push(base, '[]');
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

function flagDeniedValueCount(config: Record<string, unknown>, limit: FlagLimit): number {
  let count = 0;
  for (const path of limit.paths) {
    const values = collectValues(config, parseSegments(path));
    for (const value of values) {
      if (limit.mode === 'boolean' ? value === limit.deny : typeof value === 'string' && value.trim()) {
        count += 1;
      }
    }
  }
  return count;
}

function numericUsage(config: Record<string, unknown>, limit: NumericLimit): number[] {
  const segments = parseSegments(limit.path);
  if (limit.metric === 'chars') {
    return collectValues(config, segments).map((value) =>
      typeof value === 'string' ? value.length : 0,
    );
  }

  const counts = collectArrays(config, segments).map((items) => items.length);
  if (limit.metric === 'count-total') {
    return [counts.reduce((total, count) => total + count, 0)];
  }
  return counts;
}

function increasedUsagePastLimit(
  before: number[],
  candidate: number[],
  max: number,
): number | null {
  const beforeOverage = before.filter((value) => value > max).sort((left, right) => right - left);
  const candidateOverage = candidate
    .filter((value) => value > max)
    .sort((left, right) => right - left);
  const increased = candidateOverage.filter(
    (value, index) => value > (beforeOverage[index] ?? max),
  );
  return increased.length ? Math.max(...increased) : null;
}

export function evaluateEditLimits(args: {
  before: Record<string, unknown>;
  candidate: Record<string, unknown>;
  limits: LimitsSpec;
  policy: Policy;
}): LimitViolation[] {
  const violations: LimitViolation[] = [];

  for (const limit of args.limits.limits) {
    if (limit.kind === 'flag') {
      if (args.policy.flags[limit.key] === true) continue;
      if (flagDeniedValueCount(args.candidate, limit) <= flagDeniedValueCount(args.before, limit)) {
        continue;
      }
      violations.push({
        key: limit.key,
        messageId: limit.messageId,
        path: limit.paths[0],
        required: true,
        reasonKey: reasonKeyForLimit(limit),
      });
      continue;
    }

    const max = args.policy.limits[limit.key];
    if (max === null) continue;
    const required = increasedUsagePastLimit(
      numericUsage(args.before, limit),
      numericUsage(args.candidate, limit),
      max,
    );
    if (required === null) continue;
    violations.push({
      key: limit.key,
      messageId: limit.messageId,
      path: limit.path,
      required,
      reasonKey: reasonKeyForLimit(limit),
    });
  }

  return violations;
}
