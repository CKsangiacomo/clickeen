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
import type { Env } from '../../types';
import {
  accountInstanceOverlayObjectKey,
  accountInstanceOverlayObjectPrefix,
  accountInstancePublishKey,
  accountInstanceSelectedOverlayKey,
  accountInstanceSelectedOverlayPrefix,
} from './keys';
import { normalizePublishDocument } from './normalize';
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

function normalizeSelectedOverlayPointer(raw: unknown): SelectedOverlayPointerDocument | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1 || typeof payload.overlayId !== 'string') return null;
  return { v: 1, overlayId: payload.overlayId };
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

async function listSelectedOverlayIds(env: Env, coordinate: OverlayCoordinate): Promise<string[]> {
  const prefix = accountInstanceSelectedOverlayPrefix(coordinate.accountId, coordinate.widgetCode, coordinate.instanceId);
  const ids: string[] = [];
  let cursor: string | undefined = undefined;
  do {
    const listed = await env.TOKYO_R2.list({ prefix, cursor });
    for (const object of listed.objects) {
      const pointer = normalizeSelectedOverlayPointer(await loadJson(env, object.key));
      if (pointer) ids.push(pointer.overlayId);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return ids;
}

export async function readSelectedOverlayProjection(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
}): Promise<PublishedOverlayProjection> {
  const prefix = accountInstanceSelectedOverlayPrefix(args.accountId, args.widgetCode, args.instanceId);
  const languages: Record<string, string> = {};
  let cursor: string | undefined = undefined;
  do {
    const listed = await args.env.TOKYO_R2.list({ prefix, cursor });
    for (const object of listed.objects) {
      const pointer = normalizeSelectedOverlayPointer(await loadJson(args.env, object.key));
      if (!pointer) continue;
      const parsed = parseOverlayId(pointer.overlayId);
      if (!parsed.ok) continue;
      languages[parsed.value.languageCode] = pointer.overlayId;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return { languages };
}

async function isOverlayIdReferenced(args: {
  env: Env;
  coordinate: OverlayCoordinate;
  overlayId: string;
}): Promise<boolean> {
  const selectedIds = await listSelectedOverlayIds(args.env, args.coordinate);
  if (selectedIds.includes(args.overlayId)) return true;
  const publish = normalizePublishDocument(
    await loadJson(
      args.env,
      accountInstancePublishKey(args.coordinate.accountId, args.coordinate.widgetCode, args.coordinate.instanceId),
    ),
  );
  return Object.values(publish?.overlays?.languages ?? {}).includes(args.overlayId);
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
  const pointer = { v: 1, overlayId: args.overlayId } satisfies SelectedOverlayPointerDocument;
  await putJson(
    args.env,
    accountInstanceSelectedOverlayKey(
      parsed.value.accountPublicId,
      parsed.value.widgetCode,
      parsed.value.instanceId,
      parsed.value.languageCode,
      parsed.value.experiment,
      parsed.value.personalization,
    ),
    pointer,
  );
  return pointer;
}

export async function deleteSelectedOverlayPointer(args: {
  env: Env;
  coordinate: Omit<OverlayCoordinate, 'experiment' | 'personalization'> & {
    experiment?: string | null;
    personalization?: string | null;
  };
}): Promise<void> {
  const coordinate = normalizeCoordinate(args.coordinate);
  await args.env.TOKYO_R2.delete(
    accountInstanceSelectedOverlayKey(
      coordinate.accountId,
      coordinate.widgetCode,
      coordinate.instanceId,
      coordinate.languageCode,
      coordinate.experiment,
      coordinate.personalization,
    ),
  );
}

export async function readSelectedOverlayPointer(args: {
  env: Env;
  coordinate: Omit<OverlayCoordinate, 'experiment' | 'personalization'> & {
    experiment?: string | null;
    personalization?: string | null;
  };
}): Promise<SelectedOverlayPointerDocument | null> {
  const coordinate = normalizeCoordinate(args.coordinate);
  return normalizeSelectedOverlayPointer(
    await loadJson(
      args.env,
      accountInstanceSelectedOverlayKey(
        coordinate.accountId,
        coordinate.widgetCode,
        coordinate.instanceId,
        coordinate.languageCode,
        coordinate.experiment,
        coordinate.personalization,
      ),
    ),
  );
}
