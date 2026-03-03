import { guessContentTypeFromExt, normalizeLocale, normalizeSha256Hex, prettyStableJson, sha256Hex } from '../index';
import type { Env } from '../index';

const UTF8_ENCODER = new TextEncoder();

export type LocalePolicy = {
  baseLocale: string;
  availableLocales: string[];
  ip: {
    enabled: boolean;
    countryToLocale: Record<string, string>;
  };
  switcher: {
    enabled: boolean;
  };
};

export type LiveRenderPointer = {
  v: 1;
  publicId: string;
  widgetType: string;
  configFp: string;
  localePolicy: LocalePolicy;
  l10n: {
    liveBase: string;
    packsBase: string;
  };
  seoGeo?: {
    metaLiveBase: string;
    metaPacksBase: string;
  };
};

export type L10nLivePointer = {
  v: 1;
  publicId: string;
  locale: string;
  textFp: string;
  updatedAt: string;
};

export type MetaLivePointer = {
  v: 1;
  publicId: string;
  locale: string;
  metaFp: string;
  updatedAt: string;
};

export type WriteConfigPackJob = {
  v: 1;
  kind: 'write-config-pack';
  publicId: string;
  widgetType: string;
  configFp: string;
  configPack: unknown;
};

export type WriteTextPackJob = {
  v: 1;
  kind: 'write-text-pack';
  publicId: string;
  locale: string;
  textPack: Record<string, string>;
};

export type WriteMetaPackJob = {
  v: 1;
  kind: 'write-meta-pack';
  publicId: string;
  locale: string;
  metaPack: Record<string, unknown>;
};

export type SyncLiveSurfaceJob = {
  v: 1;
  kind: 'sync-live-surface';
  publicId: string;
  live: boolean;
  widgetType?: string;
  configFp?: string;
  localePolicy?: LocalePolicy;
  seoGeo?: boolean;
};

export type EnforceLiveSurfaceJob = {
  v: 1;
  kind: 'enforce-live-surface';
  publicId: string;
  localePolicy: LocalePolicy;
  seoGeo: boolean;
};

export type DeleteInstanceMirrorJob = {
  v: 1;
  kind: 'delete-instance-mirror';
  publicId: string;
};

export type TokyoMirrorQueueJob =
  | WriteConfigPackJob
  | WriteTextPackJob
  | WriteMetaPackJob
  | SyncLiveSurfaceJob
  | EnforceLiveSurfaceJob
  | DeleteInstanceMirrorJob;

function encodeStableJson(value: unknown): Uint8Array {
  return UTF8_ENCODER.encode(prettyStableJson(value));
}

function jsonSha256Hex(value: unknown): Promise<string> {
  const bytes = encodeStableJson(value);
  return sha256Hex(bytes.buffer);
}

function normalizePublicId(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function normalizeFingerprint(value: unknown): string | null {
  return normalizeSha256Hex(value);
}

function renderLivePointerKey(publicId: string): string {
  return `renders/instances/${publicId}/live/r.json`;
}

function renderConfigPackKey(publicId: string, configFp: string): string {
  return `renders/instances/${publicId}/config/${configFp}/config.json`;
}

function renderMetaLivePointerKey(publicId: string, locale: string): string {
  return `renders/instances/${publicId}/live/meta/${locale}.json`;
}

function renderMetaPackKey(publicId: string, locale: string, metaFp: string): string {
  return `renders/instances/${publicId}/meta/${locale}/${metaFp}.json`;
}

function l10nLivePointerKey(publicId: string, locale: string): string {
  return `l10n/instances/${publicId}/live/${locale}.json`;
}

function l10nTextPackKey(publicId: string, locale: string, textFp: string): string {
  return `l10n/instances/${publicId}/packs/${locale}/${textFp}.json`;
}

async function putJson(env: Env, key: string, payload: unknown): Promise<void> {
  const bytes = encodeStableJson(payload);
  await env.TOKYO_R2.put(key, bytes, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

async function loadJson<T>(env: Env, key: string): Promise<T | null> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return null;
  const json = (await obj.json().catch(() => null)) as T | null;
  return json ?? null;
}

async function deletePrefix(env: Env, prefix: string): Promise<void> {
  let cursor: string | undefined = undefined;
  do {
    const listed = await env.TOKYO_R2.list({ prefix, cursor });
    const keys = listed.objects.map((obj) => obj.key).filter((key) => Boolean(key));
    if (keys.length) {
      await env.TOKYO_R2.delete(keys);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

function normalizeLocalePolicy(raw: unknown): LocalePolicy | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  const baseLocale = normalizeLocale(payload.baseLocale) ?? '';
  const availableLocalesRaw = Array.isArray(payload.availableLocales) ? payload.availableLocales : [];
  const availableLocales = availableLocalesRaw
    .map((value) => normalizeLocale(value))
    .filter((value): value is string => Boolean(value));
  if (!baseLocale || !availableLocales.length) return null;
  if (!availableLocales.includes(baseLocale)) return null;
  const outAvailableLocales = Array.from(new Set(availableLocales));

  // Back-compat while PRD54 is executing: accept legacy {mode:'ip'|'switcher', ip:{countryToLocale}} pointers.
  const legacyModeRaw = typeof payload.mode === 'string' ? payload.mode.trim().toLowerCase() : '';
  const legacyMode = legacyModeRaw === 'ip' ? 'ip' : legacyModeRaw === 'switcher' ? 'switcher' : null;

  let ipEnabled = false;
  let switcherEnabled = true;
  const ipRaw = payload.ip;
  const ipRecord = ipRaw && typeof ipRaw === 'object' && !Array.isArray(ipRaw) ? (ipRaw as Record<string, unknown>) : null;
  const switcherRaw = payload.switcher;
  const switcherRecord =
    switcherRaw && typeof switcherRaw === 'object' && !Array.isArray(switcherRaw) ? (switcherRaw as Record<string, unknown>) : null;

  if (legacyMode) {
    ipEnabled = legacyMode === 'ip';
    switcherEnabled = legacyMode === 'switcher';
  } else {
    ipEnabled = typeof ipRecord?.enabled === 'boolean' ? ipRecord.enabled : false;
    switcherEnabled = typeof switcherRecord?.enabled === 'boolean' ? switcherRecord.enabled : true;
  }

  const countryToLocaleRaw = ipRecord?.countryToLocale;
  const countryToLocale: Record<string, string> = {};
  if (countryToLocaleRaw && typeof countryToLocaleRaw === 'object' && !Array.isArray(countryToLocaleRaw)) {
    for (const [country, locale] of Object.entries(countryToLocaleRaw as Record<string, unknown>)) {
      if (!/^[A-Z]{2}$/.test(country)) continue;
      const normalized = normalizeLocale(locale);
      if (!normalized) continue;
      if (!outAvailableLocales.includes(normalized)) continue;
      countryToLocale[country] = normalized;
    }
  }

  return {
    baseLocale,
    availableLocales: outAvailableLocales,
    ip: { enabled: ipEnabled, countryToLocale },
    switcher: { enabled: switcherEnabled },
  };
}

function normalizeLiveRenderPointer(raw: unknown): LiveRenderPointer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1) return null;
  const publicId = normalizePublicId(payload.publicId) ?? '';
  const widgetType = typeof payload.widgetType === 'string' ? payload.widgetType.trim() : '';
  const configFp = normalizeFingerprint(payload.configFp) ?? '';
  const localePolicy = normalizeLocalePolicy(payload.localePolicy);
  if (!publicId || !widgetType || !configFp || !localePolicy) return null;
  const l10n = payload.l10n;
  const liveBase =
    l10n && typeof l10n === 'object' && !Array.isArray(l10n) && typeof (l10n as any).liveBase === 'string'
      ? String((l10n as any).liveBase).trim()
      : '';
  const packsBase =
    l10n && typeof l10n === 'object' && !Array.isArray(l10n) && typeof (l10n as any).packsBase === 'string'
      ? String((l10n as any).packsBase).trim()
      : '';
  if (!liveBase || !packsBase) return null;
  const seoGeoRaw = payload.seoGeo;
  const seoGeo =
    seoGeoRaw &&
    typeof seoGeoRaw === 'object' &&
    !Array.isArray(seoGeoRaw) &&
    typeof (seoGeoRaw as any).metaLiveBase === 'string' &&
    typeof (seoGeoRaw as any).metaPacksBase === 'string'
      ? {
          metaLiveBase: String((seoGeoRaw as any).metaLiveBase).trim(),
          metaPacksBase: String((seoGeoRaw as any).metaPacksBase).trim(),
        }
      : undefined;
  return {
    v: 1,
    publicId,
    widgetType,
    configFp,
    localePolicy,
    l10n: { liveBase, packsBase },
    seoGeo: seoGeo?.metaLiveBase && seoGeo?.metaPacksBase ? seoGeo : undefined,
  };
}

function normalizeTextPointer(raw: unknown): L10nLivePointer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1) return null;
  const publicId = normalizePublicId(payload.publicId) ?? '';
  const locale = normalizeLocale(payload.locale) ?? '';
  const textFp = normalizeFingerprint(payload.textFp) ?? '';
  const updatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt.trim() : '';
  if (!publicId || !locale || !textFp || !updatedAt) return null;
  return { v: 1, publicId, locale, textFp, updatedAt };
}

function normalizeMetaPointer(raw: unknown): MetaLivePointer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1) return null;
  const publicId = normalizePublicId(payload.publicId) ?? '';
  const locale = normalizeLocale(payload.locale) ?? '';
  const metaFp = normalizeFingerprint(payload.metaFp) ?? '';
  const updatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt.trim() : '';
  if (!publicId || !locale || !metaFp || !updatedAt) return null;
  return { v: 1, publicId, locale, metaFp, updatedAt };
}

export function isTokyoMirrorJob(value: unknown): value is TokyoMirrorQueueJob {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const job = value as Record<string, unknown>;
  if (job.v !== 1) return false;
  if (typeof job.kind !== 'string') return false;
  if (!job.kind) return false;
  if (typeof job.publicId !== 'string') return false;
  return (
    job.kind === 'write-config-pack' ||
    job.kind === 'write-text-pack' ||
    job.kind === 'write-meta-pack' ||
    job.kind === 'sync-live-surface' ||
    job.kind === 'enforce-live-surface' ||
    job.kind === 'delete-instance-mirror'
  );
}

export async function handleGetR2Object(env: Env, key: string, cacheControl: string): Promise<Response> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  const ext = key.split('.').pop() || '';
  const contentType = obj.httpMetadata?.contentType || guessContentTypeFromExt(ext);
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', cacheControl);
  return new Response(obj.body, { status: 200, headers });
}

export async function writeConfigPack(env: Env, job: WriteConfigPackJob): Promise<void> {
  const publicId = normalizePublicId(job.publicId);
  if (!publicId) throw new Error('[tokyo] write-config-pack missing publicId');
  const configFp = normalizeFingerprint(job.configFp);
  if (!configFp) throw new Error('[tokyo] write-config-pack invalid configFp');
  const widgetType = typeof job.widgetType === 'string' ? job.widgetType.trim() : '';
  if (!widgetType) throw new Error('[tokyo] write-config-pack missing widgetType');

  const fingerprint = await jsonSha256Hex(job.configPack);
  if (fingerprint !== configFp) {
    throw new Error(`[tokyo] write-config-pack fingerprint mismatch expected=${configFp} got=${fingerprint}`);
  }

  const bytes = encodeStableJson(job.configPack);
  await env.TOKYO_R2.put(renderConfigPackKey(publicId, configFp), bytes, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

export async function writeTextPack(env: Env, job: WriteTextPackJob): Promise<void> {
  const publicId = normalizePublicId(job.publicId);
  if (!publicId) throw new Error('[tokyo] write-text-pack missing publicId');
  const locale = normalizeLocale(job.locale);
  if (!locale) throw new Error('[tokyo] write-text-pack invalid locale');
  if (!job.textPack || typeof job.textPack !== 'object' || Array.isArray(job.textPack)) {
    throw new Error('[tokyo] write-text-pack textPack must be an object');
  }

  const textFp = await jsonSha256Hex(job.textPack);
  const packBytes = encodeStableJson(job.textPack);
  const packKey = l10nTextPackKey(publicId, locale, textFp);
  await env.TOKYO_R2.put(packKey, packBytes, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });

  const pointerKey = l10nLivePointerKey(publicId, locale);
  const existing = normalizeTextPointer(await loadJson(env, pointerKey));
  const previousTextFp = existing?.textFp ?? null;

  await putJson(env, pointerKey, {
    v: 1,
    publicId,
    locale,
    textFp,
    updatedAt: new Date().toISOString(),
  } satisfies L10nLivePointer);

  if (previousTextFp && previousTextFp !== textFp) {
    await env.TOKYO_R2.delete(l10nTextPackKey(publicId, locale, previousTextFp));
  }
}

export async function writeMetaPack(env: Env, job: WriteMetaPackJob): Promise<void> {
  const publicId = normalizePublicId(job.publicId);
  if (!publicId) throw new Error('[tokyo] write-meta-pack missing publicId');
  const locale = normalizeLocale(job.locale);
  if (!locale) throw new Error('[tokyo] write-meta-pack invalid locale');
  if (!job.metaPack || typeof job.metaPack !== 'object' || Array.isArray(job.metaPack)) {
    throw new Error('[tokyo] write-meta-pack metaPack must be an object');
  }

  const metaFp = await jsonSha256Hex(job.metaPack);
  const packBytes = encodeStableJson(job.metaPack);
  const packKey = renderMetaPackKey(publicId, locale, metaFp);
  await env.TOKYO_R2.put(packKey, packBytes, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });

  const pointerKey = renderMetaLivePointerKey(publicId, locale);
  const existing = normalizeMetaPointer(await loadJson(env, pointerKey));
  const previousMetaFp = existing?.metaFp ?? null;

  await putJson(env, pointerKey, {
    v: 1,
    publicId,
    locale,
    metaFp,
    updatedAt: new Date().toISOString(),
  } satisfies MetaLivePointer);

  if (previousMetaFp && previousMetaFp !== metaFp) {
    await env.TOKYO_R2.delete(renderMetaPackKey(publicId, locale, previousMetaFp));
  }
}

async function ensureR2KeyExists(env: Env, key: string, label: string): Promise<void> {
  const obj = await env.TOKYO_R2.head(key);
  if (!obj) throw new Error(`[tokyo] missing required ${label} (${key})`);
}

async function deleteLocaleTextMirror(env: Env, publicId: string, locale: string): Promise<void> {
  const pointerKey = l10nLivePointerKey(publicId, locale);
  const pointer = normalizeTextPointer(await loadJson(env, pointerKey));
  await env.TOKYO_R2.delete(pointerKey);
  if (pointer?.textFp) {
    await env.TOKYO_R2.delete(l10nTextPackKey(publicId, locale, pointer.textFp));
  }
}

async function deleteLocaleMetaMirror(env: Env, publicId: string, locale: string): Promise<void> {
  const pointerKey = renderMetaLivePointerKey(publicId, locale);
  const pointer = normalizeMetaPointer(await loadJson(env, pointerKey));
  await env.TOKYO_R2.delete(pointerKey);
  if (pointer?.metaFp) {
    await env.TOKYO_R2.delete(renderMetaPackKey(publicId, locale, pointer.metaFp));
  }
}

export async function syncLiveSurface(env: Env, job: SyncLiveSurfaceJob): Promise<void> {
  const publicId = normalizePublicId(job.publicId);
  if (!publicId) throw new Error('[tokyo] sync-live-surface missing publicId');
  const key = renderLivePointerKey(publicId);

  if (!job.live) {
    await env.TOKYO_R2.delete(key);
    return;
  }

  const widgetType = typeof job.widgetType === 'string' ? job.widgetType.trim() : '';
  if (!widgetType) throw new Error('[tokyo] sync-live-surface missing widgetType');
  const configFp = normalizeFingerprint(job.configFp);
  if (!configFp) throw new Error('[tokyo] sync-live-surface invalid configFp');
  const localePolicy = normalizeLocalePolicy(job.localePolicy);
  if (!localePolicy) throw new Error('[tokyo] sync-live-surface invalid localePolicy');

  // Refuse to move the live pointer if the referenced bytes aren't present yet.
  await ensureR2KeyExists(env, renderConfigPackKey(publicId, configFp), 'config pack');
  for (const locale of localePolicy.availableLocales) {
    await ensureR2KeyExists(env, l10nLivePointerKey(publicId, locale), `text pointer (${locale})`);
    if (job.seoGeo) {
      await ensureR2KeyExists(env, renderMetaLivePointerKey(publicId, locale), `meta pointer (${locale})`);
    }
  }

  const previous = normalizeLiveRenderPointer(await loadJson(env, key));
  const previousConfigFp = previous?.configFp ?? null;
  const previousLocales = previous?.localePolicy.availableLocales ?? [];
  const previousSeoGeoEnabled = Boolean(previous?.seoGeo);

  const next: LiveRenderPointer = {
    v: 1,
    publicId,
    widgetType,
    configFp,
    localePolicy,
    l10n: {
      liveBase: `l10n/instances/${publicId}/live`,
      packsBase: `l10n/instances/${publicId}/packs`,
    },
    seoGeo: job.seoGeo
      ? {
          metaLiveBase: `renders/instances/${publicId}/live/meta`,
          metaPacksBase: `renders/instances/${publicId}/meta`,
        }
      : undefined,
  };

  await putJson(env, key, next);

  if (previousConfigFp && previousConfigFp !== configFp) {
    await env.TOKYO_R2.delete(renderConfigPackKey(publicId, previousConfigFp));
  }

  const nextLocales = new Set(localePolicy.availableLocales);
  const removedLocales = previousLocales.filter((locale) => !nextLocales.has(locale));
  for (const locale of removedLocales) {
    await deleteLocaleTextMirror(env, publicId, locale);
    if (previousSeoGeoEnabled) {
      await deleteLocaleMetaMirror(env, publicId, locale);
    }
  }

  if (previousSeoGeoEnabled && !job.seoGeo) {
    for (const locale of previousLocales) {
      await deleteLocaleMetaMirror(env, publicId, locale);
    }
  }
}

export async function enforceLiveSurface(env: Env, job: EnforceLiveSurfaceJob): Promise<void> {
  const publicId = normalizePublicId(job.publicId);
  if (!publicId) throw new Error('[tokyo] enforce-live-surface missing publicId');

  const localePolicy = normalizeLocalePolicy(job.localePolicy);
  if (!localePolicy) throw new Error('[tokyo] enforce-live-surface invalid localePolicy');
  const seoGeo = job.seoGeo === true;

  const key = renderLivePointerKey(publicId);
  const existing = normalizeLiveRenderPointer(await loadJson(env, key));
  if (!existing) {
    // Nothing is live in Tokyo; best-effort cleanup of SEO/meta prefixes to avoid drift.
    if (!seoGeo) {
      await Promise.all([
        deletePrefix(env, `renders/instances/${publicId}/live/meta/`),
        deletePrefix(env, `renders/instances/${publicId}/meta/`),
      ]);
    }
    return;
  }

  await syncLiveSurface(env, {
    v: 1,
    kind: 'sync-live-surface',
    publicId,
    live: true,
    widgetType: existing.widgetType,
    configFp: existing.configFp,
    localePolicy,
    seoGeo,
  });
}

export async function deleteInstanceMirror(env: Env, publicId: string): Promise<void> {
  const normalized = normalizePublicId(publicId);
  if (!normalized) throw new Error('[tokyo] delete-instance-mirror missing publicId');
  // Tokyo is a mirror, not an archive: if an instance is not live, its bytes must not exist.
  await Promise.all([
    deletePrefix(env, `renders/instances/${normalized}/`),
    deletePrefix(env, `l10n/instances/${normalized}/`),
  ]);
}

export {
  l10nLivePointerKey,
  l10nTextPackKey,
  renderConfigPackKey,
  renderLivePointerKey,
  renderMetaLivePointerKey,
  renderMetaPackKey,
};
