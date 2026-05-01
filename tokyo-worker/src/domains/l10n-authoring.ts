import { normalizeLocaleToken } from '@clickeen/l10n';
import type { Env } from '../types';
import { normalizeSha256Hex } from '../asset-utils';
import { writeMetaPack, writeTextPack } from './render';

type LayerKind = 'locale';
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

const L10N_LAYER_ALLOWED = new Set<LayerKind>(['locale']);
const UTF8_ENCODER = new TextEncoder();

function encodeJson(payload: unknown): Uint8Array {
  return UTF8_ENCODER.encode(JSON.stringify(payload));
}

function layerIndexKey(accountId: string, publicId: string): string {
  return `accounts/${accountId}/instances/${publicId}/l10n/index.json`;
}

function layerOverlayPrefix(accountId: string, publicId: string, layer: LayerKind, layerKey: string): string {
  return `accounts/${accountId}/instances/${publicId}/l10n/overlays/${layer}/${layerKey}/`;
}

function layerOverlayKey(
  accountId: string,
  publicId: string,
  layer: LayerKind,
  layerKey: string,
  baseFingerprint: string,
): string {
  return `${layerOverlayPrefix(accountId, publicId, layer, layerKey)}${baseFingerprint}.ops.json`;
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

function normalizeLayerKey(_layer: LayerKind, raw: unknown): string | null {
  return normalizeLocaleToken(raw);
}

function normalizeGeoTargets(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw
    .map((value) => String(value || '').trim().toUpperCase())
    .filter((value) => /^[A-Z]{2}$/.test(value));
  if (!out.length) return null;
  return Array.from(new Set(out));
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

async function loadIndex(env: Env, accountId: string, publicId: string): Promise<LayerIndex> {
  const payload = await loadJson<LayerIndex>(env, layerIndexKey(accountId, publicId));
  return normalizeIndex(payload, publicId);
}

async function writeIndex(env: Env, accountId: string, index: LayerIndex): Promise<void> {
  const nextLayers = Object.fromEntries(
    Object.entries(index.layers).filter(([, entry]) => Array.isArray(entry?.keys) && entry.keys.length > 0),
  ) as LayerIndex['layers'];
  if (Object.keys(nextLayers).length === 0) {
    await env.TOKYO_R2.delete(layerIndexKey(accountId, index.publicId));
    return;
  }
  await putJson(env, layerIndexKey(accountId, index.publicId), {
    v: 1,
    publicId: index.publicId,
    layers: nextLayers,
  } satisfies LayerIndex);
}

export async function upsertL10nOverlay(args: {
  env: Env;
  accountId: string;
  publicId: string;
  layer: LayerKind;
  layerKey: string;
  baseFingerprint: string;
  baseUpdatedAt?: string | null;
  ops: L10nOp[];
  geoTargets?: string[] | null;
  textPack?: Record<string, string> | null;
  metaPack?: Record<string, unknown> | null;
}): Promise<void> {
  const overlayKey = layerOverlayKey(args.accountId, args.publicId, args.layer, args.layerKey, args.baseFingerprint);
  await putJson(args.env, overlayKey, {
    v: 1,
    baseFingerprint: args.baseFingerprint,
    baseUpdatedAt: asTrimmedString(args.baseUpdatedAt),
    ops: args.ops,
  });
  await deletePrefix(args.env, layerOverlayPrefix(args.accountId, args.publicId, args.layer, args.layerKey), overlayKey);

  const index = await loadIndex(args.env, args.accountId, args.publicId);
  const currentEntry = index.layers[args.layer] ?? { keys: [] };
  const nextKeys = Array.from(new Set([...(currentEntry.keys || []), args.layerKey])).sort((left, right) =>
    left.localeCompare(right),
  );
  const nextEntry: LayerIndexEntry = { keys: nextKeys };
  if (args.layer === 'locale') {
    const nextGeoTargets = { ...(currentEntry.geoTargets || {}) };
    if (args.geoTargets) nextGeoTargets[args.layerKey] = args.geoTargets;
    if (Object.keys(nextGeoTargets).length > 0) nextEntry.geoTargets = nextGeoTargets;
  }
  index.layers[args.layer] = nextEntry;
  await writeIndex(args.env, args.accountId, index);

  const textPack = normalizeTextPack(args.textPack);
  if (textPack) {
    await writeTextPack(args.env, {
      v: 1,
      kind: 'write-text-pack',
      publicId: args.publicId,
      accountId: args.accountId,
      locale: args.layerKey,
      baseFingerprint: args.baseFingerprint,
      textPack,
    });
  }

  const metaPack = normalizeMetaPack(args.metaPack);
  if (metaPack) {
    await writeMetaPack(args.env, {
      v: 1,
      kind: 'write-meta-pack',
      publicId: args.publicId,
      accountId: args.accountId,
      locale: args.layerKey,
      metaPack,
    });
  }
}
