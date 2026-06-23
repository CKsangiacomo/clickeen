import { normalizeLocale } from '../../asset-utils';
import type { Env } from '../../types';
import {
  accountInstanceLocaleOverlayKey,
  accountInstanceLocaleOverlaysPrefix,
} from '../account-instances/keys';
import { loadJson, putJson } from '../storage';
import type { LocaleOverlayDocument } from '../account-instances/types';
import type { SavedTextField } from '@clickeen/ck-contracts/translated-value-primitives';

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

export function normalizeLocaleOverlayDocument(raw: unknown): LocaleOverlayDocument | null {
  const payload = isRecord(raw) ? raw : null;
  if (!payload || payload.v !== 1) return null;
  const values = normalizeValues(payload.values);
  if (!values) return null;
  const allowedKeys = new Set(['v', 'values']);
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) return null;
  }
  return {
    v: 1,
    values,
  };
}

export function assertLocaleOverlayValuesMatchSavedTextFields(args: {
  fields: SavedTextField[];
  values: Record<string, string>;
}): void {
  const fieldPaths = new Set(args.fields.map((field) => field.path));
  for (const path of fieldPaths) {
    if (typeof args.values[path] !== 'string') {
      throw new Error(`tokyo.translation.value_missing:${path}`);
    }
  }
  for (const path of Object.keys(args.values)) {
    if (!fieldPaths.has(path)) {
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
  const key = accountInstanceLocaleOverlayKey(
    args.accountId,
    args.widgetCode,
    args.instanceId,
    locale,
  );
  const raw = await loadJson(args.env, key);
  if (!raw) return null;
  const overlay = normalizeLocaleOverlayDocument(raw);
  if (!overlay) throw new Error(`coreui.errors.instance.overlay.invalid:${key}`);
  return overlay;
}

export async function writeLocaleOverlay(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  locale: string;
  overlay: LocaleOverlayDocument;
}): Promise<LocaleOverlayDocument> {
  const locale = normalizeLocale(args.locale);
  if (!locale) throw new Error('tokyo.translation.locale.invalid');
  await putJson(
    args.env,
    accountInstanceLocaleOverlayKey(
      args.accountId,
      args.widgetCode,
      args.instanceId,
      locale,
    ),
    args.overlay,
  );
  return args.overlay;
}

export async function listLocaleOverlays(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
}): Promise<Array<{ locale: string; overlay: LocaleOverlayDocument }>> {
  const prefix = accountInstanceLocaleOverlaysPrefix(
    args.accountId,
    args.widgetCode,
    args.instanceId,
  );
  const overlays: Array<{ locale: string; overlay: LocaleOverlayDocument }> = [];
  let cursor: string | undefined;
  do {
    const listed = await args.env.TOKYO_R2.list({ prefix, cursor } as R2ListOptions);
    for (const object of listed.objects) {
      if (!object.key.endsWith('.json')) continue;
      const overlay = normalizeLocaleOverlayDocument(await loadJson(args.env, object.key));
      if (!overlay) throw new Error(`coreui.errors.instance.overlay.invalid:${object.key}`);
      const locale = normalizeLocale(object.key.slice(prefix.length).replace(/\.json$/, ''));
      if (!locale) throw new Error(`coreui.errors.instance.overlay.invalid:${object.key}`);
      overlays.push({ locale, overlay });
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return overlays.sort((left, right) => left.locale.localeCompare(right.locale));
}

export async function listLocaleOverlaysStrict(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
}): Promise<Array<{ locale: string; overlay: LocaleOverlayDocument }>> {
  const prefix = accountInstanceLocaleOverlaysPrefix(
    args.accountId,
    args.widgetCode,
    args.instanceId,
  );
  const overlays: Array<{ locale: string; overlay: LocaleOverlayDocument }> = [];
  let cursor: string | undefined;
  do {
    const listed = await args.env.TOKYO_R2.list({ prefix, cursor } as R2ListOptions);
    for (const object of listed.objects) {
      if (!object.key.endsWith('.json')) continue;
      const overlay = await readLocaleOverlay({
        env: args.env,
        accountId: args.accountId,
        widgetCode: args.widgetCode,
        instanceId: args.instanceId,
        locale: object.key.slice(prefix.length).replace(/\.json$/, ''),
      });
      if (!overlay) throw new Error(`coreui.errors.instance.overlay.invalid:${object.key}`);
      const locale = normalizeLocale(object.key.slice(prefix.length).replace(/\.json$/, ''));
      if (!locale) throw new Error(`coreui.errors.instance.overlay.invalid:${object.key}`);
      overlays.push({ locale, overlay });
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return overlays.sort((left, right) => left.locale.localeCompare(right.locale));
}

export function localeOverlayByLocale(
  overlays: Array<{ locale: string; overlay: LocaleOverlayDocument }>,
): Map<string, LocaleOverlayDocument> {
  return new Map(overlays.map((entry) => [entry.locale, entry.overlay]));
}
