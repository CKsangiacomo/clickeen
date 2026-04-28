import type { Env } from '../../types';
import { accountInstanceRenderLivePointerKey, accountInstanceSavedConfigPackKey, accountInstanceSavedPointerKey } from './keys';
import { ensureSavedRenderL10nBase } from './localization';
import { normalizeLiveRenderPointer, normalizeSavedRenderPointer, resolveSavedRenderValidationReason } from './normalize';
import { loadJson, putJson } from './storage';
import type { InstanceServeState, LiveRenderPointer, SavedRenderDocumentReadFailure, SavedRenderDocumentReadResult, SavedRenderL10nFailure, SavedRenderL10nStatus, SavedRenderPointer } from './types';
import { jsonSha256Hex, normalizeFingerprint, normalizeLocaleList, normalizePublicId, normalizeSavedL10nFailures } from './utils';

export async function writeSavedRenderConfig(args: {
  env: Env;
  publicId: string;
  accountId: string;
  widgetType: string;
  config: Record<string, unknown>;
  displayName?: unknown;
  source?: unknown;
  meta?: unknown;
  l10n?:
    | {
        baseFingerprint?: string | null;
        summary?: {
          baseLocale: string;
          desiredLocales: string[];
        } | null;
      }
    | null;
}): Promise<{ pointer: SavedRenderPointer; previousBaseFingerprint: string | null }> {
  const publicId = args.publicId;
  const accountId = args.accountId;
  const config = args.config;
  const widgetType = args.widgetType;

  const configFp = await jsonSha256Hex(config);
  const packKey = accountInstanceSavedConfigPackKey(accountId, publicId, configFp);
  await putJson(args.env, packKey, config);

  const displayName =
    typeof args.displayName === 'string' ? args.displayName.trim() || null : null;
  const source =
    args.source === 'curated' ? 'curated' : 'account';
  const meta =
    args.meta === null
      ? null
      : args.meta && typeof args.meta === 'object' && !Array.isArray(args.meta)
        ? (args.meta as Record<string, unknown>)
        : null;
  const existingPointer = normalizeSavedRenderPointer(
    await loadJson(args.env, accountInstanceSavedPointerKey(accountId, publicId)),
  );
  const previousBaseFingerprint = existingPointer?.l10n?.baseFingerprint ?? null;
  const l10nBase = await ensureSavedRenderL10nBase({
    env: args.env,
    accountId,
    publicId,
    widgetType,
    config,
    existingBaseFingerprint:
      typeof args.l10n?.baseFingerprint === 'string'
        ? args.l10n.baseFingerprint
        : existingPointer?.l10n?.baseFingerprint ?? null,
  });
  const requestedSummary = args.l10n?.summary ?? undefined;
  const carriedSummary =
    requestedSummary === null
      ? null
      : requestedSummary ?? existingPointer?.l10n?.summary ?? null;
  const l10n = {
    baseFingerprint: l10nBase.baseFingerprint,
    ...(carriedSummary ? { summary: carriedSummary } : {}),
  } satisfies NonNullable<SavedRenderPointer['l10n']>;

  const pointer: SavedRenderPointer = {
    v: 1,
    publicId,
    accountId,
    widgetType,
    displayName,
    source,
    meta,
    configFp,
    updatedAt: new Date().toISOString(),
    l10n,
  };
  await putJson(args.env, accountInstanceSavedPointerKey(accountId, publicId), pointer);
  return {
    pointer,
    previousBaseFingerprint,
  };
}

export async function readSavedRenderPointer(args: {
  env: Env;
  publicId: string;
  accountId: string;
}): Promise<
  | {
      ok: true;
      value: SavedRenderPointer;
    }
  | SavedRenderDocumentReadFailure
> {
  const publicId = normalizePublicId(args.publicId);
  const accountId = normalizePublicId(args.accountId);
  if (!publicId || !accountId) {
    return {
      ok: false,
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.render.invalid',
    };
  }

  const pointerRaw = await loadJson(args.env, accountInstanceSavedPointerKey(accountId, publicId));
  if (!pointerRaw) {
    return {
      ok: false,
      kind: 'NOT_FOUND',
      reasonKey: 'tokyo.errors.render.notFound',
    };
  }
  const pointer = normalizeSavedRenderPointer(pointerRaw);
  if (!pointer) {
    return {
      ok: false,
      kind: 'VALIDATION',
      reasonKey: resolveSavedRenderValidationReason(pointerRaw),
    };
  }
  if (pointer.publicId !== publicId) {
    return {
      ok: false,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.config.invalid',
    };
  }
  if (pointer.accountId !== accountId) {
    return {
      ok: false,
      kind: 'NOT_FOUND',
      reasonKey: 'tokyo.errors.render.notFound',
    };
  }

  return { ok: true, value: pointer };
}

export async function readSavedRenderConfig(args: {
  env: Env;
  publicId: string;
  accountId: string;
}): Promise<SavedRenderDocumentReadResult> {
  const publicId = normalizePublicId(args.publicId);
  const accountId = normalizePublicId(args.accountId);
  if (!publicId || !accountId) {
    return {
      ok: false,
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.render.invalid',
    };
  }

  const pointerResult = await readSavedRenderPointer(args);
  if (!pointerResult.ok) return pointerResult;
  const pointer = pointerResult.value;

  const config =
    (await loadJson<Record<string, unknown>>(
      args.env,
      accountInstanceSavedConfigPackKey(accountId, publicId, pointer.configFp),
    )) ?? null;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {
      ok: false,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.config.invalid',
    };
  }
  return { ok: true, value: { pointer, config } };
}

export async function readInstanceServeState(args: {
  env: Env;
  accountId: string;
  publicId: string;
}): Promise<InstanceServeState> {
  const publicId = normalizePublicId(args.publicId);
  const accountId = normalizePublicId(args.accountId);
  if (!publicId) {
    throw new Error('tokyo.errors.render.invalid');
  }
  if (!accountId) {
    throw new Error('tokyo.errors.render.invalid');
  }

  const pointer = normalizeLiveRenderPointer(
    await loadJson<LiveRenderPointer>(args.env, accountInstanceRenderLivePointerKey(accountId, publicId)),
  );
  return pointer ? 'published' : 'unpublished';
}

export async function writeSavedRenderL10nState(args: {
  env: Env;
  publicId: string;
  accountId: string;
  baseFingerprint: string;
  summary?: {
    baseLocale: string;
    desiredLocales: string[];
  } | null;
}): Promise<SavedRenderPointer> {
  const pointerResult = await readSavedRenderPointer({
    env: args.env,
    publicId: args.publicId,
    accountId: args.accountId,
  });
  if (!pointerResult.ok) {
    throw new Error(
      pointerResult.kind === 'NOT_FOUND' ? 'tokyo_saved_not_found' : pointerResult.reasonKey,
    );
  }

  const pointer: SavedRenderPointer = {
    ...pointerResult.value,
    l10n: {
      ...(pointerResult.value.l10n ?? {}),
      baseFingerprint: args.baseFingerprint,
      ...(args.summary ? { summary: args.summary } : {}),
    },
  };
  await putJson(args.env, accountInstanceSavedPointerKey(args.accountId, args.publicId), pointer);
  return pointer;
}

export async function writeSavedRenderL10nStatus(args: {
  env: Env;
  publicId: string;
  accountId: string;
  generationId: string;
  status: SavedRenderL10nStatus;
  baseFingerprint?: string | null;
  readyLocales?: string[];
  failedLocales?: SavedRenderL10nFailure[];
  lastError?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  guardCurrentGeneration?: boolean;
}): Promise<SavedRenderPointer | null> {
  const pointerResult = await readSavedRenderPointer({
    env: args.env,
    publicId: args.publicId,
    accountId: args.accountId,
  });
  if (!pointerResult.ok) {
    throw new Error(
      pointerResult.kind === 'NOT_FOUND' ? 'tokyo_saved_not_found' : pointerResult.reasonKey,
    );
  }

  const current = pointerResult.value.l10n;
  const baseFingerprint = normalizeFingerprint(args.baseFingerprint) ?? current?.baseFingerprint ?? '';
  const generationId = typeof args.generationId === 'string' ? args.generationId.trim() : '';
  if (!current || !baseFingerprint || !generationId) {
    throw new Error('tokyo_saved_l10n_base_missing');
  }
  if (args.guardCurrentGeneration === true && current.generationId !== generationId) {
    return null;
  }

  const now = new Date().toISOString();
  const readyLocales = args.readyLocales
    ? normalizeLocaleList(args.readyLocales)
    : current.readyLocales ?? [];
  const failedLocales = args.failedLocales
    ? normalizeSavedL10nFailures(args.failedLocales)
    : current.failedLocales ?? [];
  const lastError = typeof args.lastError === 'string' ? args.lastError.trim() : '';
  const startedAt = typeof args.startedAt === 'string' ? args.startedAt.trim() : '';
  const finishedAt = typeof args.finishedAt === 'string' ? args.finishedAt.trim() : '';

  const pointer: SavedRenderPointer = {
    ...pointerResult.value,
    l10n: {
      baseFingerprint,
      ...(current.summary ? { summary: current.summary } : {}),
      generationId,
      status: args.status,
      readyLocales,
      failedLocales,
      updatedAt: now,
      ...(startedAt ? { startedAt } : {}),
      ...(finishedAt ? { finishedAt } : {}),
      ...(lastError ? { lastError } : {}),
    },
  };
  await putJson(args.env, accountInstanceSavedPointerKey(args.accountId, args.publicId), pointer);
  return pointer;
}

export async function deleteSavedRenderConfig(args: {
  env: Env;
  publicId: string;
  accountId: string;
}): Promise<
  | { ok: true; deleted: true }
  | SavedRenderDocumentReadFailure
> {
  const publicId = normalizePublicId(args.publicId);
  const accountId = normalizePublicId(args.accountId);
  if (!publicId || !accountId) {
    return {
      ok: false,
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.render.invalid',
    };
  }

  const saved = await readSavedRenderConfig({ env: args.env, publicId, accountId });
  if (!saved.ok) return saved;

  await Promise.all([
    args.env.TOKYO_R2.delete(accountInstanceSavedPointerKey(accountId, publicId)),
    args.env.TOKYO_R2.delete(accountInstanceSavedConfigPackKey(accountId, publicId, saved.value.pointer.configFp)),
  ]);
  return { ok: true, deleted: true };
}
