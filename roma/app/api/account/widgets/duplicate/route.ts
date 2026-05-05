import { NextRequest, NextResponse } from 'next/server';
import {
  loadTokyoAccountInstanceDocument,
  loadTokyoAccountInstanceIndex,
  recordTokyoAccountInstanceProjectionGap,
  writeSavedConfigToTokyo,
} from '@roma/lib/account-instance-direct';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { normalizeDesiredAccountLocales } from '@roma/lib/account-locales';
import { enqueueAccountInstanceSync } from '@roma/lib/account-instance-sync';
import { createAccountInstanceProjectionRow } from '@roma/lib/michael';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../_lib/current-account-route';

export const runtime = 'edge';

type DuplicateSource = {
  accountId: string;
  widgetType: string;
  config: Record<string, unknown>;
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

function classifyDuplicateSourcePublicId(publicId: string): 'user' | 'main' | 'system' | null {
  const normalized = publicId.trim().toLowerCase();
  if (!normalized.startsWith('wgt_')) return null;
  if (normalized.includes('_u_')) return 'user';
  if (normalized.startsWith('wgt_main_')) return 'main';
  if (normalized.startsWith('wgt_system_')) return 'system';
  return null;
}

async function loadDuplicateSource(args: {
  accountId: string;
  publicId: string;
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

  const index = await loadTokyoAccountInstanceIndex({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
  });
  if (!index.ok) {
    return {
      ok: false,
      status: index.status,
      error: {
        kind: index.error.kind,
        reasonKey: index.error.reasonKey,
        detail: index.error.detail,
      },
    };
  }

  const sourceEntry =
    index.value.accountInstances.find((entry) => entry.publicId === args.publicId) ??
    index.value.listedInstances.find((entry) => entry.publicId === args.publicId);
  if (!sourceEntry) {
    return {
      ok: false,
      status: 404,
      error: {
        kind: 'NOT_FOUND',
        reasonKey: 'coreui.errors.instance.notFound',
      },
    };
  }
  if (sourceEntry.accountId !== args.accountId && !sourceEntry.duplicable) {
    return {
      ok: false,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.forbidden',
        detail: 'source_instance_not_duplicable',
      },
    };
  }

  const source = await loadTokyoAccountInstanceDocument({
    accountId: sourceEntry.accountId,
    publicId: args.publicId,
    accountCapsule: sourceEntry.accountId === args.accountId ? args.accountCapsule : undefined,
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
      accountId: sourceEntry.accountId,
      widgetType: source.value.row.widgetType,
      config: source.value.config,
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
      accountId,
      publicId,
      accountCapsule: current.value.authzToken,
      widgetType: source.value.widgetType,
      config: source.value.config,
      displayName: null,
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

  const createdRow = await createAccountInstanceProjectionRow({
    accountId,
    publicId,
    widgetType: source.value.widgetType,
    berlinAccessToken: current.value.accessToken,
  });
  const projectionFollowup = createdRow.ok && createdRow.row
    ? { ok: true as const }
    : {
        ok: false as const,
        reasonKey: createdRow.ok ? 'coreui.errors.db.writeFailed' : createdRow.reasonKey,
        detail: createdRow.ok ? 'instance_projection_create_empty' : createdRow.detail,
        status: createdRow.ok ? 500 : createdRow.status,
      };
  if (!projectionFollowup.ok) {
    console.error('[roma account widgets duplicate route] projection create failed after Tokyo duplicate', {
      accountId,
      publicId,
      reasonKey: projectionFollowup.reasonKey,
      detail: projectionFollowup.detail,
    });
    const projectionGap = await recordTokyoAccountInstanceProjectionGap({
      accountId,
      publicId,
      action: 'create',
      reasonKey: projectionFollowup.reasonKey,
      detail: projectionFollowup.detail,
      status: projectionFollowup.status,
      accountCapsule: current.value.authzToken,
    });
    if (!projectionGap.ok) {
      console.error('[roma account widgets duplicate route] projection gap recording failed', {
        accountId,
        publicId,
        detail: projectionGap.error.detail ?? projectionGap.error.reasonKey,
      });
    }
  }

  let syncFollowup:
    | { ok: true }
    | { ok: false; reasonKey: string; detail: string } = { ok: true };
  try {
    await enqueueAccountInstanceSync({
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
    const detail = error instanceof Error ? error.message : String(error);
    syncFollowup = {
      ok: false,
      reasonKey: 'coreui.errors.translations.acceptanceFailed',
      detail,
    };
    console.error('[roma account widgets duplicate route] sync follow-up failed after Tokyo duplicate', {
      accountId,
      publicId,
      detail,
    });
  }

  return withSession(
    request,
    NextResponse.json(
      {
        accountId,
        sourcePublicId,
        sourceAccountId: source.value.accountId,
        publicId,
        widgetType: source.value.widgetType,
        status: 'unpublished',
        projectionFollowup,
        syncFollowup,
      },
      { status: 201 },
    ),
    current.value.setCookies,
  );
}
