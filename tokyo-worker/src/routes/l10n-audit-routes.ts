import { isUuid } from '@clickeen/ck-contracts';
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
  accountInstanceRenderLivePointerKey,
  accountInstanceSavedPointerKey,
  normalizeSavedRenderPointer,
  normalizeTextPointer,
  publicProjectionL10nLivePointerKey,
  publicProjectionRenderLivePointerKey,
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

export async function tryHandleL10nAuditRoutes(args: TokyoRouteArgs): Promise<Response | null> {
  const match = args.pathname.match(/^\/renders\/ops\/l10n-audit\/([^/]+)$/);
  if (!match) return null;

  if (args.req.method !== 'GET') {
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
