import { normalizeLocaleToken } from '@clickeen/l10n';
import { json } from '../http';
import type { Env } from '../types';
import { normalizePublicId, normalizeSha256Hex } from '../asset-utils';
import { writeMetaPack, writeTextPack } from './render';

type LayerKind = 'locale' | 'user';
type L10nOp = { op: 'set'; path: string; value: string };
type LayerIndexEntry = {
  keys: string[];
  geoTargets?: Record<string, string[]>;
};
type LayerIndex = {
  v: 1;
  publicId: string;
  layers: Partial<Record<LayerKind, LayerIndexEntry>>;
};

const L10N_LAYER_ALLOWED = new Set<LayerKind>(['locale', 'user']);
const L10N_PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const UTF8_ENCODER = new TextEncoder();

function encodeJson(payload: unknown): Uint8Array {
  return UTF8_ENCODER.encode(JSON.stringify(payload));
}

function layerIndexKey(publicId: string): string {
  return `l10n/instances/${publicId}/index.json`;
}

function layerBaseSnapshotKey(publicId: string, baseFingerprint: string): string {
  return `l10n/instances/${publicId}/bases/${baseFingerprint}.snapshot.json`;
}

function layerOverlayPrefix(publicId: string, layer: LayerKind, layerKey: string): string {
  return `l10n/instances/${publicId}/${layer}/${layerKey}/`;
}

function layerOverlayKey(
  publicId: string,
  layer: LayerKind,
  layerKey: string,
  baseFingerprint: string,
): string {
  return `${layerOverlayPrefix(publicId, layer, layerKey)}${baseFingerprint}.ops.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeLayer(raw: unknown): LayerKind | null {
  const normalized = String(raw || '').trim().toLowerCase();
  if (!normalized || !L10N_LAYER_ALLOWED.has(normalized as LayerKind)) return null;
  return normalized as LayerKind;
}

function normalizeLayerKey(layer: LayerKind, raw: unknown): string | null {
  const normalized = normalizeLocaleToken(raw);
  if (normalized) return normalized;
  if (layer === 'user') {
    const global = String(raw || '').trim().toLowerCase();
    if (global === 'global') return 'global';
  }
  return null;
}

function normalizeGeoTargets(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw
    .map((value) => String(value || '').trim().toUpperCase())
    .filter((value) => /^[A-Z]{2}$/.test(value));
  if (!out.length) return null;
  return Array.from(new Set(out));
}

function hasProhibitedSegment(pathStr: string): boolean {
  return String(pathStr || '')
    .split('.')
    .some((segment) => segment && L10N_PROHIBITED_SEGMENTS.has(segment));
}

function normalizeL10nOps(raw: unknown): { ok: true; ops: L10nOp[] } | { ok: false; detail: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, detail: 'ops must be an array' };
  }

  const ops: L10nOp[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const entry = raw[index];
    if (!isRecord(entry)) {
      return { ok: false, detail: `ops[${index}] must be an object` };
    }
    if (entry.op !== 'set') {
      return { ok: false, detail: `ops[${index}].op must be "set"` };
    }
    const path = asTrimmedString(entry.path);
    if (!path) {
      return { ok: false, detail: `ops[${index}].path is required` };
    }
    if (hasProhibitedSegment(path)) {
      return { ok: false, detail: `ops[${index}].path contains prohibited segment` };
    }
    if (typeof entry.value !== 'string') {
      return { ok: false, detail: `ops[${index}].value must be a string` };
    }
    ops.push({ op: 'set', path, value: entry.value });
  }

  return { ok: true, ops };
}

function normalizeTextPack(raw: unknown): Record<string, string> | null {
  if (!isRecord(raw)) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const path = asTrimmedString(key);
    if (!path || typeof value !== 'string') continue;
    out[path] = value;
  }
  return out;
}

function normalizeMetaPack(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  return raw;
}

async function loadJson<T>(env: Env, key: string): Promise<T | null> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return null;
  const payload = (await obj.json().catch(() => null)) as T | null;
  return payload ?? null;
}

async function putJson(env: Env, key: string, payload: unknown): Promise<void> {
  await env.TOKYO_R2.put(key, encodeJson(payload), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

async function deletePrefix(env: Env, prefix: string, exceptKey?: string | null): Promise<void> {
  let cursor: string | undefined;
  do {
    const listed = await env.TOKYO_R2.list({ prefix, cursor });
    const keys = listed.objects
      .map((entry) => entry.key)
      .filter((key) => Boolean(key))
      .filter((key) => !exceptKey || key !== exceptKey);
    if (keys.length > 0) {
      await env.TOKYO_R2.delete(keys);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

function normalizeIndex(raw: unknown, publicId: string): LayerIndex {
  const out: LayerIndex = { v: 1, publicId, layers: {} };
  if (!isRecord(raw)) return out;
  const layers = isRecord(raw.layers) ? raw.layers : null;
  if (!layers) return out;

  for (const [layerRaw, entryRaw] of Object.entries(layers)) {
    const layer = normalizeLayer(layerRaw);
    if (!layer || !isRecord(entryRaw)) continue;
    const keys = Array.isArray(entryRaw.keys)
      ? Array.from(
          new Set(
            entryRaw.keys
              .map((value) => normalizeLayerKey(layer, value))
              .filter((value): value is string => Boolean(value)),
          ),
        ).sort((left, right) => left.localeCompare(right))
      : [];
    if (!keys.length) continue;
    const entry: LayerIndexEntry = { keys };
    if (layer === 'locale' && isRecord(entryRaw.geoTargets)) {
      const geoTargets: Record<string, string[]> = {};
      for (const [layerKeyRaw, countriesRaw] of Object.entries(entryRaw.geoTargets)) {
        const layerKey = normalizeLayerKey('locale', layerKeyRaw);
        const countries = normalizeGeoTargets(countriesRaw);
        if (!layerKey || !countries) continue;
        geoTargets[layerKey] = countries;
      }
      if (Object.keys(geoTargets).length > 0) {
        entry.geoTargets = geoTargets;
      }
    }
    out.layers[layer] = entry;
  }

  return out;
}

async function loadIndex(env: Env, publicId: string): Promise<LayerIndex> {
  const payload = await loadJson<LayerIndex>(env, layerIndexKey(publicId));
  return normalizeIndex(payload, publicId);
}

async function writeIndex(env: Env, index: LayerIndex): Promise<void> {
  const nextLayers = Object.fromEntries(
    Object.entries(index.layers).filter(([, entry]) => Array.isArray(entry?.keys) && entry.keys.length > 0),
  ) as LayerIndex['layers'];
  if (Object.keys(nextLayers).length === 0) {
    await env.TOKYO_R2.delete(layerIndexKey(index.publicId));
    return;
  }
  await putJson(env, layerIndexKey(index.publicId), {
    v: 1,
    publicId: index.publicId,
    layers: nextLayers,
  } satisfies LayerIndex);
}

export async function handleWriteL10nBaseSnapshot(
  req: Request,
  env: Env,
  publicId: string,
  baseFingerprint: string,
): Promise<Response> {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isRecord(payload)) {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalidPayload' } },
      { status: 422 },
    );
  }
  const snapshot = isRecord(payload.snapshot) ? payload.snapshot : null;
  if (!snapshot) {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalidSnapshot' } },
      { status: 422 },
    );
  }

  const normalizedSnapshot: Record<string, string> = {};
  for (const [path, value] of Object.entries(snapshot)) {
    const normalizedPath = asTrimmedString(path);
    if (!normalizedPath || typeof value !== 'string') continue;
    normalizedSnapshot[normalizedPath] = value;
  }

  await putJson(env, layerBaseSnapshotKey(publicId, baseFingerprint), {
    v: 1,
    publicId,
    baseFingerprint,
    snapshot: normalizedSnapshot,
  });

  return json({ publicId, baseFingerprint, written: true });
}

export async function handleUpsertL10nOverlay(
  req: Request,
  env: Env,
  publicId: string,
  layer: LayerKind,
  layerKey: string,
): Promise<Response> {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isRecord(payload) || payload.v !== 1) {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalidPayload' } },
      { status: 422 },
    );
  }

  const baseFingerprint = normalizeSha256Hex(payload.baseFingerprint);
  if (!baseFingerprint) {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.baseFingerprintInvalid' } },
      { status: 422 },
    );
  }
  const normalizedOps = normalizeL10nOps(payload.ops);
  if (!normalizedOps.ok) {
    return json(
      {
        error: {
          kind: 'VALIDATION',
          reasonKey: 'tokyo.errors.l10n.invalidOps',
          detail: normalizedOps.detail,
        },
      },
      { status: 422 },
    );
  }

  const geoTargets = layer === 'locale' ? normalizeGeoTargets(payload.geoTargets) : null;
  const overlayKey = layerOverlayKey(publicId, layer, layerKey, baseFingerprint);
  await putJson(env, overlayKey, {
    v: 1,
    baseFingerprint,
    baseUpdatedAt: asTrimmedString(payload.baseUpdatedAt),
    ops: normalizedOps.ops,
  });
  await deletePrefix(env, layerOverlayPrefix(publicId, layer, layerKey), overlayKey);

  const index = await loadIndex(env, publicId);
  const currentEntry = index.layers[layer] ?? { keys: [] };
  const nextKeys = Array.from(new Set([...(currentEntry.keys || []), layerKey])).sort((left, right) =>
    left.localeCompare(right),
  );
  const nextEntry: LayerIndexEntry = { keys: nextKeys };
  if (layer === 'locale') {
    const nextGeoTargets = { ...(currentEntry.geoTargets || {}) };
    if (geoTargets) nextGeoTargets[layerKey] = geoTargets;
    if (Object.keys(nextGeoTargets).length > 0) nextEntry.geoTargets = nextGeoTargets;
  }
  index.layers[layer] = nextEntry;
  await writeIndex(env, index);

  const textPack = normalizeTextPack(payload.textPack);
  if (textPack) {
    await writeTextPack(env, {
      v: 1,
      kind: 'write-text-pack',
      publicId,
      locale: layerKey,
      baseFingerprint,
      textPack,
    });
  }

  const metaPack = normalizeMetaPack(payload.metaPack);
  if (metaPack) {
    await writeMetaPack(env, {
      v: 1,
      kind: 'write-meta-pack',
      publicId,
      locale: layerKey,
      metaPack,
    });
  }

  return json({
    publicId,
    layer,
    layerKey,
    baseFingerprint,
    written: true,
  });
}

export async function handleDeleteL10nOverlay(
  req: Request,
  env: Env,
  publicId: string,
  layer: LayerKind,
  layerKey: string,
): Promise<Response> {
  const payload = req.headers.get('content-length')
    ? ((await req.json().catch(() => null)) as Record<string, unknown> | null)
    : null;
  await deletePrefix(env, layerOverlayPrefix(publicId, layer, layerKey));

  const index = await loadIndex(env, publicId);
  const currentEntry = index.layers[layer];
  if (currentEntry) {
    const nextKeys = currentEntry.keys.filter((value) => value !== layerKey);
    if (nextKeys.length === 0) {
      delete index.layers[layer];
    } else {
      const nextEntry: LayerIndexEntry = { keys: nextKeys };
      if (layer === 'locale' && currentEntry.geoTargets) {
        const nextGeoTargets = { ...currentEntry.geoTargets };
        delete nextGeoTargets[layerKey];
        if (Object.keys(nextGeoTargets).length > 0) nextEntry.geoTargets = nextGeoTargets;
      }
      index.layers[layer] = nextEntry;
    }
    await writeIndex(env, index);
  }

  const textPack = normalizeTextPack(payload?.textPack);
  const baseFingerprint = normalizeSha256Hex(payload?.baseFingerprint);
  if (textPack && baseFingerprint) {
    await writeTextPack(env, {
      v: 1,
      kind: 'write-text-pack',
      publicId,
      locale: layerKey,
      baseFingerprint,
      textPack,
    });
  }

  const metaPack = normalizeMetaPack(payload?.metaPack);
  if (metaPack) {
    await writeMetaPack(env, {
      v: 1,
      kind: 'write-meta-pack',
      publicId,
      locale: layerKey,
      metaPack,
    });
  }

  return json({ publicId, layer, layerKey, deleted: true });
}
