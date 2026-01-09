import { tokyoFetch } from './tokyo';

export type LocalizationOp = { op: 'set'; path: string; value: unknown };

export type InstanceOverlay = {
  v: 1;
  baseUpdatedAt?: string | null;
  ops: LocalizationOp[];
};

type L10nManifest = {
  v: 1;
  gitSha: string;
  instances: Record<string, Record<string, { file: string; baseUpdatedAt?: string | null }>>;
};

const manifestCache = new Map<string, Promise<L10nManifest>>();

const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function hasProhibitedSegment(path: string): boolean {
  return path
    .split('.')
    .some((segment) => segment && PROHIBITED_SEGMENTS.has(segment));
}

function isIndex(segment: string): boolean {
  return /^\d+$/.test(segment);
}

function setAt(obj: unknown, path: string, value: unknown): unknown {
  const parts = String(path || '')
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean);

  const root = Array.isArray(obj) ? [...obj] : ({ ...(obj as any) } as any);
  let current: any = root;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const key: any = isIndex(part) ? Number(part) : part;
    const isLast = i === parts.length - 1;
    if (isLast) {
      current[key] = value;
      break;
    }
    const next = current[key];
    const clone = Array.isArray(next) ? [...next] : next && typeof next === 'object' ? { ...next } : {};
    current[key] = clone;
    current = clone;
  }
  return root;
}

function applySetOps(config: Record<string, unknown>, ops: LocalizationOp[]): Record<string, unknown> {
  let working: unknown = config;
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    if (op.op !== 'set') continue;
    if (typeof op.path !== 'string' || !op.path.trim()) continue;
    if (hasProhibitedSegment(op.path)) continue;
    if (op.value === undefined) continue;
    working = setAt(working, op.path, op.value);
  }
  return (working && typeof working === 'object' && !Array.isArray(working) ? (working as Record<string, unknown>) : config);
}

function localeCandidates(locale: string): string[] {
  const normalized = String(locale || '').trim().toLowerCase().replace(/_/g, '-');
  if (!normalized) return [];
  const base = normalized.split('-')[0] || '';
  if (!base) return [];
  if (base === normalized) return [base];
  return [normalized, base];
}

async function loadL10nManifest(): Promise<L10nManifest> {
  const url = `/l10n/manifest.json`;
  const cached = manifestCache.get(url);
  if (cached) return cached;

  const promise = (async () => {
    const res = await tokyoFetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`[VeniceL10n] Failed to load l10n manifest (${res.status})`);
    const json = (await res.json().catch(() => null)) as L10nManifest | null;
    if (!json || typeof json !== 'object' || json.v !== 1 || typeof json.gitSha !== 'string') {
      throw new Error('[VeniceL10n] Invalid l10n manifest');
    }
    if (!json.instances || typeof json.instances !== 'object') {
      throw new Error('[VeniceL10n] Invalid l10n manifest.instances');
    }
    return json;
  })();

  manifestCache.set(url, promise);
  return promise;
}

async function fetchOverlay(publicId: string, locale: string): Promise<InstanceOverlay | null> {
  let manifest: L10nManifest;
  try {
    manifest = await loadL10nManifest();
  } catch {
    return null;
  }

  const entries = manifest.instances?.[publicId];
  if (!entries || typeof entries !== 'object') return null;

  for (const candidate of localeCandidates(locale)) {
    const meta = entries[candidate];
    const file = meta?.file ? String(meta.file).trim() : '';
    if (!file) continue;

    const res = await tokyoFetch(`/l10n/instances/${encodeURIComponent(publicId)}/${encodeURIComponent(file)}`, {
      method: 'GET',
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as InstanceOverlay | null;
    if (!json || typeof json !== 'object' || json.v !== 1 || !Array.isArray(json.ops)) return null;
    return json;
  }

  return null;
}

export async function applyTokyoInstanceOverlay(args: {
  publicId: string;
  locale: string;
  baseUpdatedAt?: string | null;
  config: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const locale = String(args.locale || '').trim().toLowerCase();
  if (!locale) return args.config;

  const overlay = await fetchOverlay(args.publicId, locale);
  if (!overlay) return args.config;

  if (overlay.baseUpdatedAt && args.baseUpdatedAt && overlay.baseUpdatedAt !== args.baseUpdatedAt) {
    return args.config;
  }

  const ops = overlay.ops.filter((o) => o && typeof o === 'object' && o.op === 'set') as LocalizationOp[];
  return applySetOps(args.config, ops);
}
