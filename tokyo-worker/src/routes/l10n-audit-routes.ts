import { isUuid } from '@clickeen/ck-contracts';
import { normalizeLocaleToken } from '@clickeen/l10n';
import {
  INTERNAL_SERVICE_HEADER,
  requireDevAuth,
  TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL,
} from '../auth';
import { json } from '../http';
import {
  respondMethodNotAllowed,
  respondValidation,
  type TokyoRouteArgs,
} from '../route-helpers';
import type { Env } from '../types';
import {
  accountInstanceL10nBaseSnapshotKey,
  accountInstanceL10nLivePointerKey,
  accountInstanceL10nTextPackKey,
  accountInstanceRenderLivePointerKey,
  accountInstanceSavedPointerKey,
  normalizeSavedRenderPointer,
  normalizeTextPointer,
  publicProjectionL10nLivePointerKey,
  publicProjectionL10nTextPackKey,
  publicProjectionRenderLivePointerKey,
  readSavedRenderPointer,
  writeSavedRenderL10nStatus,
} from '../domains/render';
import { loadAccountTranslationsPanelData } from '../domains/account-localization-state';

type PrefixAudit = {
  prefix: string;
  count: number;
  truncated: boolean;
  sampleKeys: string[];
};

type JsonAudit = {
  key: string;
  exists: boolean;
  validJson?: boolean;
  summary?: unknown;
};

const MAX_PUBLIC_IDS = 25;
const MAX_LISTED_KEYS = 40;
const MAX_COUNTED_KEYS = 5000;

function normalizePublicId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 160) return null;
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(normalized)) return null;
  return normalized;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function uniqueLocales(locales: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of locales) {
    const locale = normalizeLocaleToken(value);
    if (!locale || seen.has(locale)) continue;
    seen.add(locale);
    out.push(locale);
  }
  return out;
}

function compactPointerSummary(raw: unknown): unknown {
  const saved = normalizeSavedRenderPointer(raw);
  if (saved) {
    return {
      publicId: saved.publicId,
      accountId: saved.accountId,
      widgetType: saved.widgetType,
      source: saved.source,
      configFp: saved.configFp,
      updatedAt: saved.updatedAt,
      l10n: saved.l10n
        ? {
            baseFingerprint: saved.l10n.baseFingerprint,
            baseLocale: saved.l10n.summary?.baseLocale ?? null,
            desiredLocales: saved.l10n.summary?.desiredLocales ?? [],
            status: saved.l10n.status ?? null,
            readyLocales: saved.l10n.readyLocales ?? [],
            failedLocales: saved.l10n.failedLocales ?? [],
            generationId: saved.l10n.generationId ?? null,
            updatedAt: saved.l10n.updatedAt ?? null,
            startedAt: saved.l10n.startedAt ?? null,
            finishedAt: saved.l10n.finishedAt ?? null,
            lastError: saved.l10n.lastError ?? null,
          }
        : null,
    };
  }

  const textPointer = normalizeTextPointer(raw);
  if (textPointer) {
    return {
      publicId: textPointer.publicId,
      locale: textPointer.locale,
      textFp: textPointer.textFp,
      baseFingerprint: textPointer.baseFingerprint,
      updatedAt: textPointer.updatedAt,
    };
  }

  const record = asRecord(raw);
  if (!record) return null;
  return {
    keys: Object.keys(record).sort().slice(0, 20),
  };
}

async function readJsonAudit(env: Env, key: string): Promise<JsonAudit> {
  const object = await env.TOKYO_R2.get(key);
  if (!object) return { key, exists: false };

  const raw = await object.json().catch(() => null);
  if (raw == null) return { key, exists: true, validJson: false };

  return {
    key,
    exists: true,
    validJson: true,
    summary: compactPointerSummary(raw),
  };
}

async function readJson<T>(env: Env, key: string): Promise<T | null> {
  const object = await env.TOKYO_R2.get(key);
  if (!object) return null;
  return ((await object.json().catch(() => null)) as T | null) ?? null;
}

async function putJson(env: Env, key: string, payload: unknown): Promise<void> {
  await env.TOKYO_R2.put(key, JSON.stringify(payload), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

async function copyR2Object(args: {
  env: Env;
  sourceKey: string;
  targetKey: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const object = await args.env.TOKYO_R2.get(args.sourceKey);
  if (!object) return { ok: false, reason: 'source_missing' };
  const bytes = await object.arrayBuffer();
  await args.env.TOKYO_R2.put(args.targetKey, bytes, {
    httpMetadata: object.httpMetadata,
  });
  return { ok: true };
}

function withReadyLocales(pointer: unknown, readyLocales: string[]): unknown {
  const record = asRecord(pointer);
  if (!record) return pointer;
  const localePolicy = asRecord(record.localePolicy);
  if (!localePolicy) return pointer;
  return {
    ...record,
    localePolicy: {
      ...localePolicy,
      readyLocales,
    },
  };
}

async function listPrefixAudit(env: Env, prefix: string): Promise<PrefixAudit> {
  let cursor: string | undefined;
  let count = 0;
  const sampleKeys: string[] = [];

  do {
    const page = await env.TOKYO_R2.list({
      prefix,
      cursor,
      limit: 1000,
    });
    for (const object of page.objects) {
      count += 1;
      if (sampleKeys.length < MAX_LISTED_KEYS) sampleKeys.push(object.key);
      if (count >= MAX_COUNTED_KEYS) break;
    }
    cursor = page.truncated && count < MAX_COUNTED_KEYS ? page.cursor : undefined;
  } while (cursor);

  return {
    prefix,
    count,
    truncated: count >= MAX_COUNTED_KEYS,
    sampleKeys,
  };
}

function buildInstancePrefixes(accountId: string, publicId: string): string[] {
  return [
    `accounts/${accountId}/instances/${publicId}/l10n/bases/`,
    `accounts/${accountId}/instances/${publicId}/l10n/live/`,
    `accounts/${accountId}/instances/${publicId}/l10n/packs/`,
    `accounts/${accountId}/instances/${publicId}/l10n/overlays/`,
    `public/instances/${publicId}/l10n/live/`,
    `public/instances/${publicId}/l10n/packs/`,
    `l10n/instances/${publicId}/`,
    `admin-owned/l10n/instances/${publicId}/`,
    `widgets/${publicId}/l10n/`,
  ];
}

async function auditInstance(args: {
  env: Env;
  accountId: string;
  publicId: string;
  probeLocales: string[];
}) {
  const savedPointer = await readJsonAudit(
    args.env,
    accountInstanceSavedPointerKey(args.accountId, args.publicId),
  );
  const accountRenderLive = await readJsonAudit(
    args.env,
    accountInstanceRenderLivePointerKey(args.accountId, args.publicId),
  );
  const publicRenderLive = await readJsonAudit(
    args.env,
    publicProjectionRenderLivePointerKey(args.publicId),
  );
  const panel = await loadAccountTranslationsPanelData({
    env: args.env,
    accountId: args.accountId,
    publicId: args.publicId,
  }).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }));

  const localePointers = await Promise.all(
    args.probeLocales.flatMap((locale) => [
      readJsonAudit(
        args.env,
        accountInstanceL10nLivePointerKey(args.accountId, args.publicId, locale),
      ),
      readJsonAudit(
        args.env,
        publicProjectionL10nLivePointerKey(args.publicId, locale),
      ),
    ]),
  );

  const baseFingerprint = (() => {
    const summary = asRecord(savedPointer.summary);
    const l10n = asRecord(summary?.l10n);
    return typeof l10n?.baseFingerprint === 'string' ? l10n.baseFingerprint : null;
  })();
  const baseSnapshot =
    baseFingerprint && /^[a-f0-9]{64}$/i.test(baseFingerprint)
      ? await readJsonAudit(
          args.env,
          accountInstanceL10nBaseSnapshotKey(
            args.accountId,
            args.publicId,
            baseFingerprint,
          ),
        )
      : null;

  const prefixes = await Promise.all(
    buildInstancePrefixes(args.accountId, args.publicId).map((prefix) =>
      listPrefixAudit(args.env, prefix),
    ),
  );

  return {
    publicId: args.publicId,
    panel,
    savedPointer,
    accountRenderLive,
    publicRenderLive,
    baseSnapshot,
    localePointers,
    prefixes,
  };
}

async function repairInstanceFromLegacyL10n(args: {
  env: Env;
  accountId: string;
  publicId: string;
  requestedLocales: string[];
  dryRun: boolean;
}) {
  const savedResult = await readSavedRenderPointer({
    env: args.env,
    accountId: args.accountId,
    publicId: args.publicId,
  });
  if (!savedResult.ok) {
    return {
      publicId: args.publicId,
      ok: false,
      error:
        savedResult.kind === 'NOT_FOUND'
          ? 'tokyo_saved_not_found'
          : savedResult.reasonKey,
    };
  }

  const saved = savedResult.value;
  const l10n = saved.l10n;
  const baseFingerprint = l10n?.baseFingerprint ?? null;
  const baseLocale = l10n?.summary?.baseLocale ?? null;
  const desiredLocales = uniqueLocales(
    args.requestedLocales.length
      ? args.requestedLocales
      : (l10n?.summary?.desiredLocales ?? []),
  );
  if (!baseFingerprint || !baseLocale || !desiredLocales.includes(baseLocale)) {
    return {
      publicId: args.publicId,
      ok: false,
      error: 'tokyo_saved_l10n_summary_missing',
    };
  }

  const migrated: string[] = [];
  const skipped: Array<{ locale: string; reason: string; detail?: string }> = [];
  const readyLocales = new Set<string>([baseLocale]);
  for (const locale of desiredLocales) {
    if (locale === baseLocale) continue;
    const legacyPointerKey = `l10n/instances/${args.publicId}/live/${locale}.json`;
    const legacyPointer = normalizeTextPointer(
      await readJson(args.env, legacyPointerKey),
    );
    if (!legacyPointer) {
      skipped.push({ locale, reason: 'legacy_pointer_missing' });
      continue;
    }
    if (legacyPointer.baseFingerprint !== baseFingerprint) {
      skipped.push({
        locale,
        reason: 'legacy_base_fingerprint_mismatch',
        detail: legacyPointer.baseFingerprint ?? 'null',
      });
      continue;
    }

    const legacyPackKey = `l10n/instances/${args.publicId}/packs/${locale}/${legacyPointer.textFp}.json`;
    const accountPackKey = accountInstanceL10nTextPackKey(
      args.accountId,
      args.publicId,
      locale,
      legacyPointer.textFp,
    );
    const publicPackKey = publicProjectionL10nTextPackKey(
      args.publicId,
      locale,
      legacyPointer.textFp,
    );
    const accountPointerKey = accountInstanceL10nLivePointerKey(
      args.accountId,
      args.publicId,
      locale,
    );
    const publicPointerKey = publicProjectionL10nLivePointerKey(args.publicId, locale);

    if (!args.dryRun) {
      const accountCopy = await copyR2Object({
        env: args.env,
        sourceKey: legacyPackKey,
        targetKey: accountPackKey,
      });
      if (!accountCopy.ok) {
        skipped.push({ locale, reason: accountCopy.reason, detail: legacyPackKey });
        continue;
      }
      const publicCopy = await copyR2Object({
        env: args.env,
        sourceKey: legacyPackKey,
        targetKey: publicPackKey,
      });
      if (!publicCopy.ok) {
        skipped.push({ locale, reason: publicCopy.reason, detail: legacyPackKey });
        continue;
      }
      await Promise.all([
        putJson(args.env, accountPointerKey, legacyPointer),
        putJson(args.env, publicPointerKey, legacyPointer),
      ]);
    }

    readyLocales.add(locale);
    migrated.push(locale);
  }

  const orderedReadyLocales = desiredLocales.filter((locale) => readyLocales.has(locale));
  const missingLocales = desiredLocales.filter((locale) => !readyLocales.has(locale));
  const status = missingLocales.length ? 'failed' : 'ready';
  const generationId =
    l10n?.generationId ??
    `legacy-repair-${baseFingerprint.slice(0, 12)}-${Date.now().toString(36)}`;

  if (!args.dryRun) {
    await writeSavedRenderL10nStatus({
      env: args.env,
      publicId: args.publicId,
      accountId: args.accountId,
      generationId,
      status,
      baseFingerprint,
      readyLocales: orderedReadyLocales,
      failedLocales: missingLocales.map((locale) => ({
        locale,
        reasonKey: 'tokyo_translation_locale_not_ready',
      })),
      finishedAt: status === 'ready' ? new Date().toISOString() : null,
    });

    const accountLivePointerKey = accountInstanceRenderLivePointerKey(args.accountId, args.publicId);
    const publicLivePointerKey = publicProjectionRenderLivePointerKey(args.publicId);
    const [accountLive, publicLive] = await Promise.all([
      readJson(args.env, accountLivePointerKey),
      readJson(args.env, publicLivePointerKey),
    ]);
    if (accountLive) {
      await putJson(args.env, accountLivePointerKey, withReadyLocales(accountLive, orderedReadyLocales));
    }
    if (publicLive) {
      await putJson(args.env, publicLivePointerKey, withReadyLocales(publicLive, orderedReadyLocales));
    }
  }

  return {
    publicId: args.publicId,
    ok: missingLocales.length === 0,
    dryRun: args.dryRun,
    baseFingerprint,
    requestedLocales: desiredLocales,
    readyLocales: orderedReadyLocales,
    migrated,
    skipped,
    status,
  };
}

export async function tryHandleL10nAuditRoutes(args: TokyoRouteArgs): Promise<Response | null> {
  const auditMatch = args.pathname.match(/^\/renders\/ops\/l10n-audit\/([^/]+)$/);
  const repairMatch = args.pathname.match(/^\/renders\/ops\/l10n-legacy-repair\/([^/]+)$/);
  const match = auditMatch ?? repairMatch;
  if (!match) return null;

  if (auditMatch && args.req.method !== 'GET') {
    return respondMethodNotAllowed(args.respond);
  }
  if (repairMatch && args.req.method !== 'POST') {
    return respondMethodNotAllowed(args.respond);
  }

  const accountId = match[1];
  if (!isUuid(accountId)) {
    return respondValidation(args.respond, 'tokyo.errors.account.invalid');
  }

  const auth = requireDevAuth(args.req, args.env, {
    allowTrustedInternalServices: [TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL],
  });
  if (auth) return args.respond(auth);

  const internalService = args.req.headers.get(INTERNAL_SERVICE_HEADER);
  const publicIds = args.url.searchParams
    .getAll('publicId')
    .map(normalizePublicId)
    .filter((value): value is string => Boolean(value));
  const probeLocales = args.url.searchParams
    .getAll('locale')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[a-z][a-z0-9-]*$/i.test(value))
    .slice(0, 60);

  if (!publicIds.length || publicIds.length > MAX_PUBLIC_IDS) {
    return args.respond(
      json(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: 'tokyo.errors.audit.publicIdsRequired',
          },
        },
        { status: 422 },
      ),
    );
  }

  if (repairMatch) {
    const dryRun = args.url.searchParams.get('dryRun') === '1';
    const repairs = await Promise.all(
      publicIds.map((publicId) =>
        repairInstanceFromLegacyL10n({
          env: args.env,
          accountId,
          publicId,
          requestedLocales: probeLocales,
          dryRun,
        }),
      ),
    );
    return args.respond(
      json({
        ok: repairs.every((repair) => repair.ok),
        accountId,
        internalService,
        dryRun,
        repairs,
      }),
    );
  }

  const instances = await Promise.all(
    publicIds.map((publicId) =>
      auditInstance({
        env: args.env,
        accountId,
        publicId,
        probeLocales: probeLocales.length ? probeLocales : ['en', 'es', 'fr', 'de', 'it', 'ja'],
      }),
    ),
  );

  return args.respond(
    json({
      ok: true,
      accountId,
      internalService,
      instances,
    }),
  );
}
