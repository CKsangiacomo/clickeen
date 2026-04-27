import { normalizeLocaleToken } from '@clickeen/l10n';
import { normalizePublicId, normalizeSha256Hex, prettyStableJson } from '../asset-utils';
import type { Env } from '../types';

const UTF8_ENCODER = new TextEncoder();

export type WidgetTranslationStatus = 'accepted' | 'working' | 'ready' | 'failed';

export type WidgetTranslationFailure = {
  locale: string;
  reasonKey: string;
  detail?: string;
};

export type WidgetTranslationState = {
  v: 1;
  publicId: string;
  accountId: string;
  widgetType: string;
  baseLocale: string;
  requestedLocales: string[];
  baseFingerprint: string;
  generationId: string;
  status: WidgetTranslationStatus;
  readyLocales: string[];
  failedLocales: WidgetTranslationFailure[];
  acceptedAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  lastError?: string;
};

type PutStateArgs = {
  env: Env;
  state: WidgetTranslationState;
};

function widgetL10nStateCurrentKey(publicId: string): string {
  return `l10n/instances/${publicId}/state/current.json`;
}

function widgetL10nStateRevisionKey(publicId: string, baseFingerprint: string): string {
  return `l10n/instances/${publicId}/state/${baseFingerprint}.json`;
}

function encodeStableJson(value: unknown): Uint8Array {
  return UTF8_ENCODER.encode(prettyStableJson(value));
}

async function putJson(env: Env, key: string, payload: unknown): Promise<void> {
  await env.TOKYO_R2.put(key, encodeStableJson(payload), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

async function loadJson<T>(env: Env, key: string): Promise<T | null> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return null;
  return (await obj.json().catch(() => null)) as T | null;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeLocaleList(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : [];
  return Array.from(
    new Set(
      values
        .map((entry) => normalizeLocaleToken(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
}

function normalizeRequestedLocales(args: {
  baseLocale: string;
  requestedLocales: unknown;
}): string[] {
  const baseLocale = normalizeLocaleToken(args.baseLocale) ?? '';
  const locales = normalizeLocaleList(args.requestedLocales);
  return Array.from(new Set([baseLocale, ...locales].filter(Boolean)));
}

function normalizeFailedLocales(raw: unknown): WidgetTranslationFailure[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const payload = entry as Record<string, unknown>;
    const locale = normalizeLocaleToken(payload.locale);
    const reasonKey = asTrimmedString(payload.reasonKey);
    if (!locale || !reasonKey) return [];
    const detail = asTrimmedString(payload.detail);
    return [
      {
        locale,
        reasonKey,
        ...(detail ? { detail } : {}),
      },
    ];
  });
}

export function normalizeWidgetTranslationState(raw: unknown): WidgetTranslationState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1) return null;
  const publicId = normalizePublicId(payload.publicId) ?? '';
  const accountId = normalizePublicId(payload.accountId) ?? '';
  const widgetType = asTrimmedString(payload.widgetType) ?? '';
  const baseLocale = normalizeLocaleToken(payload.baseLocale) ?? '';
  const requestedLocales = normalizeRequestedLocales({
    baseLocale,
    requestedLocales: payload.requestedLocales,
  });
  const readyLocales = normalizeLocaleList(payload.readyLocales);
  const baseFingerprint = normalizeSha256Hex(payload.baseFingerprint) ?? '';
  const generationId = asTrimmedString(payload.generationId) ?? '';
  const status =
    payload.status === 'accepted' ||
    payload.status === 'working' ||
    payload.status === 'ready' ||
    payload.status === 'failed'
      ? payload.status
      : null;
  const acceptedAt = asTrimmedString(payload.acceptedAt) ?? '';
  const updatedAt = asTrimmedString(payload.updatedAt) ?? '';
  const startedAt = asTrimmedString(payload.startedAt);
  const finishedAt = asTrimmedString(payload.finishedAt);
  const lastError = asTrimmedString(payload.lastError);
  const failedLocales = normalizeFailedLocales(payload.failedLocales);

  if (
    !publicId ||
    !accountId ||
    !widgetType ||
    !baseLocale ||
    !requestedLocales.includes(baseLocale) ||
    !readyLocales.includes(baseLocale) ||
    !baseFingerprint ||
    !generationId ||
    !status ||
    !acceptedAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    v: 1,
    publicId,
    accountId,
    widgetType,
    baseLocale,
    requestedLocales,
    baseFingerprint,
    generationId,
    status,
    readyLocales: Array.from(new Set(readyLocales)),
    failedLocales,
    acceptedAt,
    updatedAt,
    ...(startedAt ? { startedAt } : {}),
    ...(finishedAt ? { finishedAt } : {}),
    ...(lastError ? { lastError } : {}),
  };
}

async function putWidgetTranslationState(args: PutStateArgs): Promise<WidgetTranslationState> {
  const state = normalizeWidgetTranslationState(args.state);
  if (!state) throw new Error('[tokyo] invalid widget translation state');
  await Promise.all([
    putJson(args.env, widgetL10nStateCurrentKey(state.publicId), state),
    putJson(args.env, widgetL10nStateRevisionKey(state.publicId, state.baseFingerprint), state),
  ]);
  return state;
}

export async function readCurrentWidgetTranslationState(args: {
  env: Env;
  publicId: string;
  accountId: string;
}): Promise<WidgetTranslationState | null> {
  const publicId = normalizePublicId(args.publicId);
  const accountId = normalizePublicId(args.accountId);
  if (!publicId || !accountId) return null;
  const state = normalizeWidgetTranslationState(
    await loadJson(args.env, widgetL10nStateCurrentKey(publicId)),
  );
  if (!state || state.accountId !== accountId) return null;
  return state;
}

export async function acceptWidgetTranslationState(args: {
  env: Env;
  publicId: string;
  accountId: string;
  widgetType: string;
  baseLocale: string;
  requestedLocales: string[];
  baseFingerprint: string;
}): Promise<WidgetTranslationState> {
  const publicId = normalizePublicId(args.publicId);
  const accountId = normalizePublicId(args.accountId);
  const widgetType = asTrimmedString(args.widgetType) ?? '';
  const baseLocale = normalizeLocaleToken(args.baseLocale) ?? '';
  const requestedLocales = normalizeRequestedLocales({
    baseLocale,
    requestedLocales: args.requestedLocales,
  });
  const baseFingerprint = normalizeSha256Hex(args.baseFingerprint) ?? '';
  if (!publicId || !accountId || !widgetType || !baseLocale || !requestedLocales.length || !baseFingerprint) {
    throw new Error('[tokyo] accept-widget-translation-state invalid input');
  }
  const now = new Date().toISOString();
  const onlyBaseLocale = requestedLocales.every((locale) => locale === baseLocale);
  return putWidgetTranslationState({
    env: args.env,
    state: {
      v: 1,
      publicId,
      accountId,
      widgetType,
      baseLocale,
      requestedLocales,
      baseFingerprint,
      generationId: crypto.randomUUID(),
      status: onlyBaseLocale ? 'ready' : 'accepted',
      readyLocales: [baseLocale],
      failedLocales: [],
      acceptedAt: now,
      updatedAt: now,
      ...(onlyBaseLocale ? { finishedAt: now } : {}),
    },
  });
}

export async function isCurrentWidgetTranslationGeneration(args: {
  env: Env;
  publicId: string;
  accountId: string;
  generationId: string;
}): Promise<boolean> {
  const current = await readCurrentWidgetTranslationState(args);
  return Boolean(current && current.generationId === args.generationId);
}

export async function markWidgetTranslationWorking(args: {
  env: Env;
  publicId: string;
  accountId: string;
  generationId: string;
}): Promise<WidgetTranslationState | null> {
  const current = await readCurrentWidgetTranslationState(args);
  if (!current || current.generationId !== args.generationId) return null;
  if (current.status === 'ready' || current.status === 'failed') return current;
  const now = new Date().toISOString();
  return putWidgetTranslationState({
    env: args.env,
    state: {
      ...current,
      status: 'working',
      startedAt: current.startedAt ?? now,
      updatedAt: now,
    },
  });
}

export async function markWidgetTranslationFinished(args: {
  env: Env;
  publicId: string;
  accountId: string;
  generationId: string;
  readyLocales: string[];
  failedLocales?: WidgetTranslationFailure[];
  lastError?: string | null;
}): Promise<WidgetTranslationState | null> {
  const current = await readCurrentWidgetTranslationState(args);
  if (!current || current.generationId !== args.generationId) return null;
  const readyLocales = normalizeRequestedLocales({
    baseLocale: current.baseLocale,
    requestedLocales: args.readyLocales,
  }).filter((locale) => current.requestedLocales.includes(locale));
  const failedLocales = normalizeFailedLocales(args.failedLocales ?? []);
  const requestedSet = new Set(current.requestedLocales);
  const readySet = new Set(readyLocales);
  const missingLocales = Array.from(requestedSet)
    .filter((locale) => !readySet.has(locale))
    .map((locale) => ({
      locale,
      reasonKey: 'tokyo_translation_locale_not_ready',
    }));
  const allFailedLocales = [
    ...failedLocales,
    ...missingLocales.filter(
      (missing) => !failedLocales.some((failed) => failed.locale === missing.locale),
    ),
  ].filter((failure) => failure.locale !== current.baseLocale);
  const status = allFailedLocales.length ? 'failed' : 'ready';
  const now = new Date().toISOString();
  const lastError = asTrimmedString(args.lastError);
  return putWidgetTranslationState({
    env: args.env,
    state: {
      ...current,
      status,
      readyLocales,
      failedLocales: allFailedLocales,
      updatedAt: now,
      finishedAt: now,
      ...(lastError ? { lastError } : {}),
    },
  });
}

export async function markWidgetTranslationFailed(args: {
  env: Env;
  publicId: string;
  accountId: string;
  generationId: string;
  reasonKey: string;
  detail?: string | null;
}): Promise<WidgetTranslationState | null> {
  const current = await readCurrentWidgetTranslationState(args);
  if (!current || current.generationId !== args.generationId) return null;
  const reasonKey = asTrimmedString(args.reasonKey) ?? 'tokyo_translation_failed';
  const detail = asTrimmedString(args.detail);
  const readySet = new Set(current.readyLocales);
  const failedLocales = current.requestedLocales
    .filter((locale) => locale !== current.baseLocale && !readySet.has(locale))
    .map((locale) => ({
      locale,
      reasonKey,
      ...(detail ? { detail } : {}),
    }));
  const now = new Date().toISOString();
  return putWidgetTranslationState({
    env: args.env,
    state: {
      ...current,
      status: 'failed',
      failedLocales,
      updatedAt: now,
      finishedAt: now,
      lastError: detail ?? reasonKey,
    },
  });
}
