import { normalizeLocale } from '../../asset-utils';
import type { Env } from '../../types';
import {
  accountInstanceLocaleOverlayKey,
  accountInstanceLocaleOverlaysPrefix,
} from '../account-instances/keys';
import { loadJson, putJson } from '../storage';
import type {
  AccountInstanceContentDocument,
  LocaleOverlayDocument,
  LocaleOverlayStatus,
} from '../account-instances/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeValues(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const values: Record<string, string> = {};
  for (const [path, text] of Object.entries(value)) {
    if (!path || typeof text !== 'string') return null;
    values[path] = text;
  }
  return values;
}

function normalizeStatus(value: unknown): LocaleOverlayStatus | null {
  return value === 'inSync' || value === 'outOfSync' || value === 'failed' ? value : null;
}

export function normalizeLocaleOverlayDocument(raw: unknown): LocaleOverlayDocument | null {
  const payload = isRecord(raw) ? raw : null;
  if (!payload || payload.v !== 1) return null;
  const locale = normalizeLocale(payload.locale);
  const baseContentMarker = typeof payload.baseContentMarker === 'string' ? payload.baseContentMarker.trim() : '';
  const widgetContractHash = typeof payload.widgetContractHash === 'string' ? payload.widgetContractHash.trim() : '';
  const status = normalizeStatus(payload.status);
  const values = normalizeValues(payload.values);
  const updatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt.trim() : '';
  if (!locale || !baseContentMarker || !widgetContractHash || !status || !values || !updatedAt) return null;
  return {
    v: 1,
    locale,
    baseContentMarker,
    widgetContractHash,
    status,
    values,
    updatedAt,
    ...(typeof payload.reasonKey === 'string' && payload.reasonKey.trim() ? { reasonKey: payload.reasonKey.trim() } : {}),
    ...(typeof payload.detail === 'string' && payload.detail.trim() ? { detail: payload.detail.trim() } : {}),
  };
}

export function localeOverlayHasCompleteValues(args: {
  content: AccountInstanceContentDocument;
  overlay: LocaleOverlayDocument | null;
}): boolean {
  if (!args.overlay) return false;
  const paths = Object.keys(args.content.fields);
  return paths.length > 0 && paths.every((path) => typeof args.overlay?.values[path] === 'string');
}

export function assertLocaleOverlayValuesMatchContent(args: {
  content: AccountInstanceContentDocument;
  values: Record<string, string>;
}): void {
  const contentPaths = new Set(Object.keys(args.content.fields));
  for (const path of contentPaths) {
    if (typeof args.values[path] !== 'string') {
      throw new Error(`tokyo.translation.value_missing:${path}`);
    }
  }
  for (const path of Object.keys(args.values)) {
    if (!contentPaths.has(path)) {
      throw new Error(`tokyo.translation.value_unexpected:${path}`);
    }
  }
}

export async function readLocaleOverlay(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  locale: string;
}): Promise<LocaleOverlayDocument | null> {
  const locale = normalizeLocale(args.locale);
  if (!locale) return null;
  return normalizeLocaleOverlayDocument(
    await loadJson(args.env, accountInstanceLocaleOverlayKey(args.accountId, args.widgetCode, args.instanceId, locale)),
  );
}

export async function writeLocaleOverlay(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  overlay: LocaleOverlayDocument;
}): Promise<LocaleOverlayDocument> {
  await putJson(
    args.env,
    accountInstanceLocaleOverlayKey(args.accountId, args.widgetCode, args.instanceId, args.overlay.locale),
    args.overlay,
  );
  return args.overlay;
}

export async function listLocaleOverlays(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
}): Promise<LocaleOverlayDocument[]> {
  const prefix = accountInstanceLocaleOverlaysPrefix(args.accountId, args.widgetCode, args.instanceId);
  const overlays: LocaleOverlayDocument[] = [];
  let cursor: string | undefined;
  do {
    const listed = await args.env.TOKYO_R2.list({ prefix, cursor } as R2ListOptions);
    for (const object of listed.objects) {
      if (!object.key.endsWith('.json')) continue;
      const overlay = normalizeLocaleOverlayDocument(await loadJson(args.env, object.key));
      if (overlay) overlays.push(overlay);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return overlays.sort((left, right) => left.locale.localeCompare(right.locale));
}

export function localeOverlayByLocale(overlays: LocaleOverlayDocument[]): Map<string, LocaleOverlayDocument> {
  return new Map(overlays.map((overlay) => [overlay.locale, overlay]));
}
