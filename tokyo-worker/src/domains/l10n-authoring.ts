import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';
import { normalizeLocaleToken } from '@clickeen/l10n';
import type { Env } from '../types';
import {
  accountInstanceL10nOverlayKey,
  accountInstanceL10nOverlayPrefix,
  resolveAccountInstanceLocation,
  writeMetaPack,
  writeTextPack,
} from './render';

type LayerKind = 'locale';
type L10nOp = { op: 'set'; path: string; value: string };

const L10N_LAYER_ALLOWED = new Set<LayerKind>(['locale']);
const UTF8_ENCODER = new TextEncoder();

function encodeJson(payload: unknown): Uint8Array {
  return UTF8_ENCODER.encode(JSON.stringify(payload));
}

function normalizeLayer(raw: unknown): LayerKind | null {
  const normalized = String(raw || '').trim().toLowerCase();
  if (!normalized || !L10N_LAYER_ALLOWED.has(normalized as LayerKind)) return null;
  return normalized as LayerKind;
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

export async function upsertL10nOverlay(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  layer: LayerKind;
  layerKey: string;
  baseFingerprint: string;
  baseUpdatedAt?: string | null;
  ops: L10nOp[];
  geoTargets?: string[] | null;
  textPack?: Record<string, string> | null;
  metaPack?: Record<string, unknown> | null;
}): Promise<void> {
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!location) throw new Error('[tokyo] l10n-overlay missing instance location');
  const overlayKey = accountInstanceL10nOverlayKey(
    location.accountId,
    location.widgetType,
    location.instanceId,
    args.layerKey,
  );
  await putJson(args.env, overlayKey, {
    v: 1,
    type: 'l10n',
    locale: args.layerKey,
    baseFingerprint: args.baseFingerprint,
    status: 'ready',
    ops: args.ops,
    ...(normalizeTextPack(args.textPack) ? { textPack: normalizeTextPack(args.textPack) } : {}),
    updatedAt: new Date().toISOString(),
  });
  await deletePrefix(
    args.env,
    accountInstanceL10nOverlayPrefix(location.accountId, location.widgetType, location.instanceId, args.layerKey),
    overlayKey,
  );

  const textPack = normalizeTextPack(args.textPack);
  if (textPack) {
    await writeTextPack(args.env, {
      v: 1,
      kind: 'write-text-pack',
      instanceId: args.instanceId,
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
      instanceId: args.instanceId,
      accountId: args.accountId,
      locale: args.layerKey,
      metaPack,
    });
  }
}
