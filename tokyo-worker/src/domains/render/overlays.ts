import {
  DEFAULT_OVERLAY_EXPERIMENT,
  DEFAULT_OVERLAY_PERSONALIZATION,
  buildOverlayId,
  isOverlayExperimentCode,
  isOverlayLanguageCode,
  isOverlayPersonalizationCode,
  isOverlayVersion,
  parseOverlayId,
} from '@clickeen/ck-contracts/overlay-identity';
import { resolveLocaleForLanguageOverlayCode } from '@clickeen/ck-contracts/overlay-codebooks';
import {
  extractTextPrimitiveValues,
  validateOverlayValuesForTextPrimitives,
} from '@clickeen/ck-contracts/overlay-primitives';
import type { Env } from '../../types';
import {
  resolveWidgetCatalogEntry,
  resolveWidgetTypeFromCode,
} from '../widget-catalog';
import {
  accountInstanceOverlayObjectKey,
  accountInstanceOverlayObjectPrefix,
} from './keys';
import { readSavedRenderConfig } from './saved-config';
import { loadJson, putJson } from './storage';
import type {
  OverlayObjectDocument,
  PublishedOverlayProjection,
  SelectedOverlayPointerDocument,
} from './types';

export type OverlayCoordinate = {
  accountId: string;
  widgetCode: string;
  instanceId: string;
  languageCode: string;
  experiment: string;
  personalization: string;
};

export type LocaleOverlayInventoryEntry = {
  locale: string;
  overlayId: string;
};

export type OverlayCompletenessResult =
  | { ok: true }
  | {
      ok: false;
      reasonKey: string;
      detail: string;
      path?: string;
    };

function assertValues(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('tokyo.overlay.values_invalid');
  }
  return value as Record<string, unknown>;
}

function normalizeCoordinate(input: {
  accountId: string;
  widgetCode: string;
  instanceId: string;
  languageCode: string;
  experiment?: string | null;
  personalization?: string | null;
}): OverlayCoordinate {
  const languageCode = String(input.languageCode || '').trim().toUpperCase();
  const experiment = String(input.experiment || DEFAULT_OVERLAY_EXPERIMENT).trim().toUpperCase();
  const personalization = String(input.personalization || DEFAULT_OVERLAY_PERSONALIZATION).trim().toUpperCase();
  if (!isOverlayLanguageCode(languageCode) || !isOverlayExperimentCode(experiment) || !isOverlayPersonalizationCode(personalization)) {
    throw new Error('tokyo.overlay.coordinate_invalid');
  }
  return {
    accountId: input.accountId,
    widgetCode: input.widgetCode,
    instanceId: input.instanceId,
    languageCode,
    experiment,
    personalization,
  };
}

function normalizeOverlayObject(raw: unknown): OverlayObjectDocument | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1) return null;
  return { v: 1, values: assertValues(payload.values) };
}

function coordinatePrefix(coordinate: OverlayCoordinate): string {
  return `${coordinate.accountId}${coordinate.widgetCode}${coordinate.instanceId}${coordinate.languageCode}${coordinate.experiment}${coordinate.personalization}`;
}

function buildCoordinateOverlayId(coordinate: OverlayCoordinate, version: string): string {
  return buildOverlayId({
    accountPublicId: coordinate.accountId,
    widgetCode: coordinate.widgetCode,
    instanceId: coordinate.instanceId,
    languageCode: coordinate.languageCode,
    experiment: coordinate.experiment,
    personalization: coordinate.personalization,
    version,
  });
}

async function listOverlayIdsForCoordinate(env: Env, coordinate: OverlayCoordinate): Promise<string[]> {
  const prefix = accountInstanceOverlayObjectPrefix(
    coordinate.accountId,
    coordinate.widgetCode,
    coordinate.instanceId,
    coordinatePrefix(coordinate),
  );
  const ids: string[] = [];
  let cursor: string | undefined = undefined;
  do {
    const listed = await env.TOKYO_R2.list({ prefix, cursor });
    for (const object of listed.objects) {
      const id = object.key.slice(prefix.lastIndexOf('/') + 1).replace(/\.json$/, '');
      const parsed = parseOverlayId(id);
      if (parsed.ok) ids.push(id);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return Array.from(new Set(ids));
}

function overlayVersionValue(overlayId: string): number {
  const parsed = parseOverlayId(overlayId);
  return parsed.ok ? Number.parseInt(parsed.value.version, 10) : -1;
}

function pickLatestOverlayId(ids: string[]): string | null {
  return ids.sort((left, right) => overlayVersionValue(right) - overlayVersionValue(left))[0] ?? null;
}

export async function validateOverlayObjectForSavedInstance(args: {
  env: Env;
  overlayId: string;
  values: unknown;
}): Promise<OverlayCompletenessResult> {
  const parsed = parseOverlayId(args.overlayId);
  if (!parsed.ok) {
    return {
      ok: false,
      reasonKey: 'tokyo.overlay.id_invalid',
      detail: parsed.reason,
    };
  }
  const widgetType = resolveWidgetTypeFromCode(parsed.value.widgetCode);
  if (!widgetType) {
    return {
      ok: false,
      reasonKey: 'tokyo.overlay.widget_unknown',
      detail: `No widget type for overlay widget code ${parsed.value.widgetCode}`,
    };
  }
  const saved = await readSavedRenderConfig({
    env: args.env,
    accountId: parsed.value.accountPublicId,
    instanceId: parsed.value.instanceId,
    widgetType,
  });
  if (!saved.ok) {
    return {
      ok: false,
      reasonKey: saved.reasonKey,
      detail: saved.reasonKey,
    };
  }
  const catalogEntry = resolveWidgetCatalogEntry(saved.value.pointer.widgetType);
  if (!catalogEntry) {
    return {
      ok: false,
      reasonKey: 'tokyo.overlay.widget_contract_missing',
      detail: `Missing widget overlay contract for ${saved.value.pointer.widgetType}`,
    };
  }

  let requiredItems;
  try {
    requiredItems = extractTextPrimitiveValues({
      spec: { overlays: catalogEntry.overlays },
      config: saved.value.config,
    });
  } catch (error) {
    return {
      ok: false,
      reasonKey: 'tokyo.overlay.widget_contract_invalid',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const validation = validateOverlayValuesForTextPrimitives(requiredItems, args.values);
  if (!validation.ok) {
    return {
      ok: false,
      reasonKey: `tokyo.overlay.${validation.reason}`,
      detail: `overlay values ${validation.reason}: ${validation.path}`,
      path: validation.path,
    };
  }
  return { ok: true };
}

async function isCompleteOverlayObject(args: {
  env: Env;
  overlayId: string;
}): Promise<boolean> {
  const object = await readOverlayObject({ env: args.env, overlayId: args.overlayId });
  if (!object) return false;
  const validation = await validateOverlayObjectForSavedInstance({
    env: args.env,
    overlayId: args.overlayId,
    values: object.values,
  });
  return validation.ok;
}

async function pickLatestCompleteOverlayId(args: {
  env: Env;
  ids: string[];
}): Promise<string | null> {
  const sorted = [...args.ids].sort((left, right) => overlayVersionValue(right) - overlayVersionValue(left));
  for (const overlayId of sorted) {
    if (await isCompleteOverlayObject({ env: args.env, overlayId })) return overlayId;
  }
  return null;
}

export async function readSelectedOverlayProjection(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
}): Promise<PublishedOverlayProjection> {
  const prefix = accountInstanceOverlayObjectPrefix(args.accountId, args.widgetCode, args.instanceId);
  const byLanguage: Record<string, string[]> = {};
  let cursor: string | undefined = undefined;
  do {
    const listed = await args.env.TOKYO_R2.list({ prefix, cursor });
    for (const object of listed.objects) {
      const overlayId = object.key.slice(object.key.lastIndexOf('/') + 1).replace(/\.json$/, '');
      const parsed = parseOverlayId(overlayId);
      if (!parsed.ok) continue;
      byLanguage[parsed.value.languageCode] = [...(byLanguage[parsed.value.languageCode] ?? []), overlayId];
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  const languages: Record<string, string> = {};
  for (const [languageCode, ids] of Object.entries(byLanguage)) {
    const selected = await pickLatestCompleteOverlayId({ env: args.env, ids });
    if (selected) languages[languageCode] = selected;
  }
  return { languages };
}

export async function listLocaleOverlayInventory(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<LocaleOverlayInventoryEntry[]> {
  const prefix = accountInstanceOverlayObjectPrefix(args.accountId, '', args.instanceId);
  const byLanguage: Record<string, string[]> = {};
  let cursor: string | undefined = undefined;
  do {
    const listed = await args.env.TOKYO_R2.list({ prefix, cursor });
    for (const object of listed.objects) {
      const overlayId = object.key.slice(object.key.lastIndexOf('/') + 1).replace(/\.json$/, '');
      const parsed = parseOverlayId(overlayId);
      if (!parsed.ok) continue;
      if (parsed.value.accountPublicId !== args.accountId || parsed.value.instanceId !== args.instanceId) continue;
      const locale = resolveLocaleForLanguageOverlayCode(parsed.value.languageCode);
      if (!locale) continue;
      byLanguage[parsed.value.languageCode] = [...(byLanguage[parsed.value.languageCode] ?? []), overlayId];
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  const inventory: LocaleOverlayInventoryEntry[] = [];
  for (const [languageCode, ids] of Object.entries(byLanguage)) {
      const overlayId = await pickLatestCompleteOverlayId({ env: args.env, ids });
      const locale = resolveLocaleForLanguageOverlayCode(languageCode);
      if (overlayId && locale) inventory.push({ locale, overlayId });
  }
  return inventory.sort((left, right) => left.locale.localeCompare(right.locale));
}

async function isOverlayIdReferenced(args: {
  env: Env;
  coordinate: OverlayCoordinate;
  overlayId: string;
}): Promise<boolean> {
  const current = await readSelectedOverlayPointer({ env: args.env, coordinate: args.coordinate });
  return current?.overlayId === args.overlayId;
}

export async function allocateOverlayId(args: {
  env: Env;
  coordinate: Omit<OverlayCoordinate, 'experiment' | 'personalization'> & {
    experiment?: string | null;
    personalization?: string | null;
  };
  maxVersions: number;
}): Promise<string> {
  const coordinate = normalizeCoordinate(args.coordinate);
  const existing = new Set(await listOverlayIdsForCoordinate(args.env, coordinate));
  const maxVersions = Math.max(1, Math.min(100, Math.floor(args.maxVersions)));
  if (existing.size < maxVersions) {
    for (let index = 0; index < 100; index += 1) {
      const version = String(index).padStart(2, '0');
      if (!isOverlayVersion(version)) continue;
      const overlayId = buildCoordinateOverlayId(coordinate, version);
      if (!existing.has(overlayId)) return overlayId;
    }
  }
  for (let index = 0; index < 100; index += 1) {
    const version = String(index).padStart(2, '0');
    if (!isOverlayVersion(version)) continue;
    const overlayId = buildCoordinateOverlayId(coordinate, version);
    if (!existing.has(overlayId)) continue;
    if (!(await isOverlayIdReferenced({ env: args.env, coordinate, overlayId }))) return overlayId;
  }
  throw new Error('tokyo.overlay.version_slots_exhausted');
}

export async function writeOverlayObject(args: {
  env: Env;
  overlayId: string;
  values: Record<string, unknown>;
}): Promise<OverlayObjectDocument> {
  const parsed = parseOverlayId(args.overlayId);
  if (!parsed.ok) throw new Error(`tokyo.overlay.id_invalid:${parsed.reason}`);
  const existing = await loadJson(
    args.env,
    accountInstanceOverlayObjectKey(
      parsed.value.accountPublicId,
      parsed.value.widgetCode,
      parsed.value.instanceId,
      args.overlayId,
    ),
  );
  if (existing && await isOverlayIdReferenced({
    env: args.env,
    coordinate: {
      accountId: parsed.value.accountPublicId,
      widgetCode: parsed.value.widgetCode,
      instanceId: parsed.value.instanceId,
      languageCode: parsed.value.languageCode,
      experiment: parsed.value.experiment,
      personalization: parsed.value.personalization,
    },
    overlayId: args.overlayId,
  })) {
    throw new Error('tokyo.overlay.referenced_overwrite_denied');
  }
  const body = { v: 1, values: assertValues(args.values) } satisfies OverlayObjectDocument;
  await putJson(
    args.env,
    accountInstanceOverlayObjectKey(
      parsed.value.accountPublicId,
      parsed.value.widgetCode,
      parsed.value.instanceId,
      args.overlayId,
    ),
    body,
  );
  return body;
}

export async function readOverlayObject(args: {
  env: Env;
  overlayId: string;
}): Promise<OverlayObjectDocument | null> {
  const parsed = parseOverlayId(args.overlayId);
  if (!parsed.ok) throw new Error(`tokyo.overlay.id_invalid:${parsed.reason}`);
  return normalizeOverlayObject(
    await loadJson(
      args.env,
      accountInstanceOverlayObjectKey(
        parsed.value.accountPublicId,
        parsed.value.widgetCode,
        parsed.value.instanceId,
        args.overlayId,
      ),
    ),
  );
}

export async function writeSelectedOverlayPointer(args: {
  env: Env;
  overlayId: string;
}): Promise<SelectedOverlayPointerDocument> {
  const parsed = parseOverlayId(args.overlayId);
  if (!parsed.ok) throw new Error(`tokyo.overlay.id_invalid:${parsed.reason}`);
  void args.env;
  return { v: 1, overlayId: args.overlayId };
}

export async function deleteSelectedOverlayPointer(args: {
  env: Env;
  coordinate: Omit<OverlayCoordinate, 'experiment' | 'personalization'> & {
    experiment?: string | null;
    personalization?: string | null;
  };
}): Promise<void> {
  const coordinate = normalizeCoordinate(args.coordinate);
  const ids = await listOverlayIdsForCoordinate(args.env, coordinate);
  const keys = ids.map((overlayId) =>
    accountInstanceOverlayObjectKey(
      coordinate.accountId,
      coordinate.widgetCode,
      coordinate.instanceId,
      overlayId,
    ),
  );
  if (keys.length) await args.env.TOKYO_R2.delete(keys);
}

export async function readSelectedOverlayPointer(args: {
  env: Env;
  coordinate: Omit<OverlayCoordinate, 'experiment' | 'personalization'> & {
    experiment?: string | null;
    personalization?: string | null;
  };
}): Promise<SelectedOverlayPointerDocument | null> {
  const coordinate = normalizeCoordinate(args.coordinate);
  const selected = await pickLatestCompleteOverlayId({
    env: args.env,
    ids: await listOverlayIdsForCoordinate(args.env, coordinate),
  });
  return selected ? { v: 1, overlayId: selected } : null;
}
