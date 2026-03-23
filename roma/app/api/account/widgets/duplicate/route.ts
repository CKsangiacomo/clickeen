import { NextRequest, NextResponse } from 'next/server';
import {
  deleteSavedConfigFromTokyo,
  loadTokyoAccountInstanceDocument,
  writeSavedConfigToTokyo,
} from '@roma/lib/account-instance-direct';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { normalizeDesiredAccountLocales } from '@roma/lib/account-locales';
import { enqueueAccountInstanceSync } from '@roma/lib/account-instance-sync';
import { resolveTokyoBaseUrl } from '@roma/lib/env/tokyo';
import {
  createAccountInstanceRow,
  deleteAccountInstanceRow,
  getAccountInstanceCoreRow,
} from '@roma/lib/michael';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../_lib/current-account-route';

export const runtime = 'edge';

type DuplicateSource =
  | {
      widgetType: string;
      config: Record<string, unknown>;
      source: 'account';
    }
  | {
      widgetType: string;
      config: Record<string, unknown>;
      source: 'curated';
    };

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function createUserInstancePublicId(widgetType: string): string {
  const normalized = widgetType
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const stem = normalized || 'instance';
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `wgt_${stem}_u_${suffix}`;
}

function classifyDuplicateSourcePublicId(publicId: string): 'user' | 'main' | 'curated' | null {
  const normalized = publicId.trim().toLowerCase();
  if (!normalized.startsWith('wgt_')) return null;
  if (normalized.includes('_u_')) return 'user';
  if (normalized.startsWith('wgt_main_')) return 'main';
  if (normalized.startsWith('wgt_curated_')) return 'curated';
  return null;
}

async function rollbackDuplicateCreate(args: {
  accountId: string;
  publicId: string;
  tokyoAccessToken: string;
  berlinAccessToken: string;
}) {
  const [michaelRollback, tokyoRollback] = await Promise.allSettled([
    deleteAccountInstanceRow({
      accountId: args.accountId,
      publicId: args.publicId,
      berlinAccessToken: args.berlinAccessToken,
    }),
    deleteSavedConfigFromTokyo({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      tokyoAccessToken: args.tokyoAccessToken,
      accountId: args.accountId,
      publicId: args.publicId,
    }),
  ]);

  if (michaelRollback.status === 'rejected' && process.env.NODE_ENV === 'development') {
    console.warn('[roma account widgets duplicate route] failed to rollback Michael row', michaelRollback.reason);
  }
  if (tokyoRollback.status === 'rejected' && process.env.NODE_ENV === 'development') {
    console.warn('[roma account widgets duplicate route] failed to rollback Tokyo saved config', tokyoRollback.reason);
  }
}

async function loadDuplicateSource(args: {
  accountId: string;
  publicId: string;
  tokyoAccessToken: string;
  berlinAccessToken: string;
  accountCapsule?: string | null;
}): Promise<
  | { ok: true; value: DuplicateSource }
  | { ok: false; status: number; error: { kind: string; reasonKey: string; detail?: string } }
> {
  const publicIdKind = classifyDuplicateSourcePublicId(args.publicId);
  if (!publicIdKind) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'duplicate_source_public_id_invalid',
      },
    };
  }

  const sourceCore = await getAccountInstanceCoreRow(args.accountId, args.publicId, args.berlinAccessToken);
  if (!sourceCore.ok) {
    return {
      ok: false,
      status: sourceCore.status,
      error: {
        kind: sourceCore.status === 404 ? 'NOT_FOUND' : 'UPSTREAM_UNAVAILABLE',
        reasonKey: sourceCore.reasonKey,
        detail: sourceCore.detail,
      },
    };
  }
  if (!sourceCore.row) {
    return {
      ok: false,
      status: 404,
      error: {
        kind: 'NOT_FOUND',
        reasonKey: 'coreui.errors.instance.notFound',
      },
    };
  }

  const source = await loadTokyoAccountInstanceDocument({
    accountId: sourceCore.row.accountId,
    publicId: args.publicId,
    tokyoAccessToken: args.tokyoAccessToken,
    accountCapsule: args.accountCapsule,
  });
  if (!source.ok) {
    return {
      ok: false,
      status: source.status,
      error: {
        kind: source.error.kind,
        reasonKey: source.error.reasonKey,
        detail: source.error.detail,
      },
    };
  }

  return {
    ok: true,
    value: {
      widgetType: source.value.row.widgetType,
      config: source.value.config,
      source: sourceCore.row.source === 'account' ? 'account' : 'curated',
    },
  };
}

export async function POST(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  let body: { sourcePublicId?: unknown } | null = null;
  try {
    body = (await request.json()) as { sourcePublicId?: unknown } | null;
  } catch {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const accountId = current.value.authzPayload.accountId;
  const sourcePublicId = asTrimmedString(body?.sourcePublicId);
  if (!sourcePublicId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const source = await loadDuplicateSource({
    accountId,
    publicId: sourcePublicId,
    tokyoAccessToken: current.value.accessToken,
    berlinAccessToken: current.value.accessToken,
    accountCapsule: current.value.authzToken,
  });
  if (!source.ok) {
    return withSession(
      request,
      NextResponse.json({ error: source.error }, { status: source.status }),
      current.value.setCookies,
    );
  }

  const accountLocalesState = await loadCurrentAccountLocalesState({
    accessToken: current.value.accessToken,
    accountId,
  });
  if (!accountLocalesState.ok) {
    const status =
      accountLocalesState.status === 401
        ? 401
        : accountLocalesState.status === 403
          ? 403
          : 502;
    const kind =
      status === 401
        ? 'AUTH'
        : status === 403
          ? 'DENY'
          : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind,
            reasonKey:
              status === 401
                ? 'coreui.errors.auth.required'
                : status === 403
                  ? 'coreui.errors.auth.forbidden'
                  : 'coreui.errors.auth.contextUnavailable',
            detail:
              accountLocalesState.detail ||
              `berlin_account_http_${accountLocalesState.status}`,
          },
        },
        { status },
      ),
      current.value.setCookies,
    );
  }

  const publicId = createUserInstancePublicId(source.value.widgetType);
  try {
    await writeSavedConfigToTokyo({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      tokyoAccessToken: current.value.accessToken,
      accountId,
      publicId,
      accountCapsule: current.value.authzToken,
      widgetType: source.value.widgetType,
      config: source.value.config,
      displayName: null,
      source: 'account',
      meta: null,
      l10n: {
        summary: {
          baseLocale: accountLocalesState.policy.baseLocale,
          desiredLocales: normalizeDesiredAccountLocales({
            baseLocale: accountLocalesState.policy.baseLocale,
            locales: accountLocalesState.locales,
          }),
        },
      },
    });
  } catch (error) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail: error instanceof Error ? error.message : String(error),
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }

  const createdRow = await createAccountInstanceRow({
    accountId,
    publicId,
    widgetType: source.value.widgetType,
    berlinAccessToken: current.value.accessToken,
    status: 'unpublished',
  });
  if (!createdRow.ok) {
    await rollbackDuplicateCreate({
      accountId,
      publicId,
      tokyoAccessToken: current.value.accessToken,
      berlinAccessToken: current.value.accessToken,
    });
    const status = createdRow.status === 401 ? 401 : createdRow.status;
    const kind =
      status === 401
        ? 'AUTH'
        : status === 403
          ? 'DENY'
          : status === 409 || status === 422
            ? 'VALIDATION'
            : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind,
            reasonKey: createdRow.reasonKey,
            detail: createdRow.detail,
          },
        },
        { status },
      ),
      current.value.setCookies,
    );
  }

  if (!createdRow.row) {
    await rollbackDuplicateCreate({
      accountId,
      publicId,
      tokyoAccessToken: current.value.accessToken,
      berlinAccessToken: current.value.accessToken,
    });
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail: 'instance_create_empty',
          },
        },
        { status: 500 },
      ),
      current.value.setCookies,
    );
  }

  const created = createdRow.row;
  try {
    await enqueueAccountInstanceSync({
      accessToken: current.value.accessToken,
      accountId,
      publicId,
      accountCapsule: current.value.authzToken,
      live: false,
      l10nIntent: {
        baseLocale: accountLocalesState.policy.baseLocale,
        desiredLocales: normalizeDesiredAccountLocales({
          baseLocale: accountLocalesState.policy.baseLocale,
          locales: accountLocalesState.locales,
        }),
        countryToLocale: accountLocalesState.policy.ip.countryToLocale,
      },
    });
  } catch (error) {
    await rollbackDuplicateCreate({
      accountId,
      publicId,
      tokyoAccessToken: current.value.accessToken,
      berlinAccessToken: current.value.accessToken,
    });
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail: error instanceof Error ? error.message : String(error),
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json(
      {
        accountId,
        sourcePublicId,
        publicId: created.publicId,
        widgetType: created.widgetType,
        status: created.status,
        source: source.value.source,
      },
      { status: 201 },
    ),
    current.value.setCookies,
  );
}
