const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/;
const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

export type AllowlistEntry = { path: string; type?: 'string' | 'richtext' };
export type AllowlistItem = { path: string; type: 'string' | 'richtext' };
export type AllowlistValue = { path: string; type: 'string' | 'richtext'; value: string };

export const LAYER_ORDER = ['base', 'locale', 'geo', 'industry', 'experiment', 'account', 'behavior', 'user'] as const;
export const LAYER_SELECTION = {
  locale: 'single',
  geo: 'single',
  industry: 'single',
  experiment: 'multi',
  account: 'single',
  behavior: 'multi',
  user: 'locale+global',
} as const;
export const LAYER_MULTI_KEY_ORDER = {
  experiment: 'expId-asc',
  behavior: 'lex',
} as const;
export const USER_FALLBACK_ORDER = ['locale', 'global'] as const;
export const GEO_TARGETS_SEMANTICS = 'locale-selection-only' as const;

export type CkL10nStatus = 'base' | 'fresh' | 'stale';

export function normalizeLocaleToken(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/_/g, '-') : '';
  if (!value) return null;
  if (!LOCALE_PATTERN.test(value)) return null;
  return value;
}

export function localeCandidates(raw: unknown, supported?: Iterable<string>): string[] {
  const normalized = normalizeLocaleToken(raw);
  if (!normalized) return [];
  const base = normalized.split('-')[0] || '';
  if (!base) return [];

  const candidates = normalized === base ? [base] : [normalized, base];
  if (!supported) return candidates;

  const allowed = new Set(
    Array.from(supported)
      .map((value) => normalizeLocaleToken(value))
      .filter((value): value is string => Boolean(value)),
  );

  return candidates.filter((value) => allowed.has(value));
}

export type CanonicalLocaleEntry = {
  code: string;
  nativeLabel?: string;
  labels?: Record<string, string>;
};

export function normalizeCanonicalLocalesFile(raw: unknown): CanonicalLocaleEntry[] {
  if (!Array.isArray(raw)) return [];

  const out: CanonicalLocaleEntry[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (typeof entry === 'string') {
      const code = normalizeLocaleToken(entry);
      if (!code || seen.has(code)) continue;
      seen.add(code);
      out.push({ code });
      continue;
    }

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const code = normalizeLocaleToken((entry as any).code);
    if (!code || seen.has(code)) continue;

    const nativeLabelRaw = typeof (entry as any).nativeLabel === 'string' ? (entry as any).nativeLabel.trim() : '';
    const nativeLabel = nativeLabelRaw ? nativeLabelRaw : undefined;

    const labelsRaw = (entry as any).labels;
    const labels: Record<string, string> = {};
    if (labelsRaw && typeof labelsRaw === 'object' && !Array.isArray(labelsRaw)) {
      for (const [rawKey, rawValue] of Object.entries(labelsRaw)) {
        const key = normalizeLocaleToken(rawKey);
        const value = typeof rawValue === 'string' ? rawValue.trim() : '';
        if (!key || !value) continue;
        labels[key] = value;
      }
    }

    seen.add(code);
    out.push({
      code,
      nativeLabel,
      labels: Object.keys(labels).length ? labels : undefined,
    });
  }

  return out;
}

export function resolveLocaleLabel(args: {
  locales: CanonicalLocaleEntry[];
  uiLocale: string;
  targetLocale: string;
}): string {
  const target = normalizeLocaleToken(args.targetLocale);
  if (!target) return String(args.targetLocale || '').trim() || 'Unknown';

  const ui = normalizeLocaleToken(args.uiLocale) ?? 'en';
  const entry = args.locales.find((item) => normalizeLocaleToken(item.code) === target) ?? null;

  const candidates = entry?.labels ? localeCandidates(ui, Object.keys(entry.labels)) : [];
  for (const candidate of candidates) {
    const label = entry?.labels?.[candidate];
    if (label) return label;
  }

  if (entry?.nativeLabel) return entry.nativeLabel;

  try {
    const display = new Intl.DisplayNames([ui], { type: 'language' });
    const label = display.of(target);
    return label || target;
  } catch {
    return target;
  }
}

export function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',');
  return `{${body}}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeBaseFingerprint(config: Record<string, unknown>): Promise<string> {
  return sha256Hex(stableStringify(config));
}

function joinPath(base: string, next: string): string {
  return base ? `${base}.${next}` : next;
}

function hasProhibitedSegment(pathStr: string): boolean {
  return String(pathStr || '')
    .split('.')
    .some((seg) => seg && PROHIBITED_SEGMENTS.has(seg));
}

function normalizeAllowlistEntries(entries: AllowlistEntry[]): AllowlistItem[] {
  return entries
    .map((entry) => {
      const path = typeof entry?.path === 'string' ? entry.path.trim() : '';
      const type: AllowlistItem['type'] = entry?.type === 'richtext' ? 'richtext' : 'string';
      return { path, type };
    })
    .filter((entry) => entry.path);
}

function collectEntriesForPath(args: {
  value: unknown;
  segments: string[];
  currentPath: string;
  type: 'string' | 'richtext';
  includeEmpty: boolean;
  out: AllowlistValue[];
}) {
  if (args.segments.length === 0) {
    if (typeof args.value === 'string') {
      const trimmed = args.value.trim();
      if (args.includeEmpty || trimmed) {
        args.out.push({ path: args.currentPath, type: args.type, value: args.value });
      }
    }
    return;
  }

  const [head, ...tail] = args.segments;
  if (!head || PROHIBITED_SEGMENTS.has(head)) return;

  if (head === '*') {
    if (!Array.isArray(args.value)) return;
    args.value.forEach((item, index) => {
      collectEntriesForPath({
        value: item,
        segments: tail,
        currentPath: joinPath(args.currentPath, String(index)),
        type: args.type,
        includeEmpty: args.includeEmpty,
        out: args.out,
      });
    });
    return;
  }

  if (Array.isArray(args.value) && /^\d+$/.test(head)) {
    const index = Number(head);
    collectEntriesForPath({
      value: args.value[index],
      segments: tail,
      currentPath: joinPath(args.currentPath, head),
      type: args.type,
      includeEmpty: args.includeEmpty,
      out: args.out,
    });
    return;
  }

  if (args.value == null || typeof args.value !== 'object') return;
  collectEntriesForPath({
    value: (args.value as Record<string, unknown>)[head],
    segments: tail,
    currentPath: joinPath(args.currentPath, head),
    type: args.type,
    includeEmpty: args.includeEmpty,
    out: args.out,
  });
}

export function collectAllowlistedEntries(
  config: Record<string, unknown>,
  allowlist: AllowlistEntry[],
  options?: { includeEmpty?: boolean },
): AllowlistValue[] {
  const normalized = normalizeAllowlistEntries(allowlist);
  const includeEmpty = options?.includeEmpty !== false;
  const out: AllowlistValue[] = [];

  for (const entry of normalized) {
    const path = entry.path.trim();
    if (!path || hasProhibitedSegment(path)) continue;
    const segments = path.split('.').map((seg) => seg.trim()).filter(Boolean);
    if (!segments.length) continue;
    collectEntriesForPath({
      value: config,
      segments,
      currentPath: '',
      type: entry.type,
      includeEmpty,
      out,
    });
  }

  const deduped: AllowlistValue[] = [];
  const seen = new Set<string>();
  for (const item of out) {
    if (item.path && !seen.has(item.path)) {
      seen.add(item.path);
      deduped.push(item);
    }
  }
  return deduped;
}

export function buildL10nSnapshot(config: Record<string, unknown>, allowlist: AllowlistEntry[]): Record<string, string> {
  const snapshot: Record<string, string> = {};
  collectAllowlistedEntries(config, allowlist, { includeEmpty: true }).forEach((entry) => {
    snapshot[entry.path] = entry.value;
  });
  return snapshot;
}

export async function computeL10nFingerprint(config: Record<string, unknown>, allowlist: AllowlistEntry[]): Promise<string> {
  const snapshot = buildL10nSnapshot(config, allowlist);
  return sha256Hex(stableStringify(snapshot));
}
