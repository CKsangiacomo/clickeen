import { after, NextRequest, NextResponse } from 'next/server';
import {
  deleteSavedConfigFromTokyo,
  loadTokyoPreferredAccountInstance,
  validatePersistableConfig,
  writeSavedConfigToTokyo,
} from '../../../../../lib/account-instance-direct';
import {
  createAccountInstanceRow,
  deleteAccountInstanceRow,
  getAccountInstanceCoreRow,
} from '../../../../../lib/michael';
import { authorizeRequestAccountRoleFromCapsule } from '../../../../../lib/account-authz-capsule';
import { runAccountSaveAftermath } from '../../../../../lib/account-save-aftermath';
import {
  applySessionCookies,
  resolveSessionBearer,
  type SessionCookieSpec,
} from '../../../../../lib/auth/session';
import { resolveTokyoBaseUrl } from '../../../../../lib/env/tokyo';

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

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}

function withSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  return withNoStore(applySessionCookies(response, request, setCookies));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

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
    console.warn(
      '[roma widgets duplicate route] failed to rollback Michael row',
      michaelRollback.reason,
    );
  }
  if (tokyoRollback.status === 'rejected' && process.env.NODE_ENV === 'development') {
    console.warn(
      '[roma widgets duplicate route] failed to rollback Tokyo saved config',
      tokyoRollback.reason,
    );
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

  const sourceCore = await getAccountInstanceCoreRow(
    args.accountId,
    args.publicId,
    args.berlinAccessToken,
  );
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

  const source = await loadTokyoPreferredAccountInstance({
    accountId: sourceCore.row.accountId,
    publicId: args.publicId,
    tokyoBaseUrl: resolveTokyoBaseUrl(),
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
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  let body: { accountId?: unknown; sourcePublicId?: unknown } | null = null;
  try {
    body = (await request.json()) as { accountId?: unknown; sourcePublicId?: unknown } | null;
  } catch {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const accountId = asTrimmedString(body?.accountId);
  const sourcePublicId = asTrimmedString(body?.sourcePublicId);
  if (!accountId || !isUuid(accountId) || !sourcePublicId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId,
    minRole: 'editor',
  });
  if (!authz.ok) {
    return withSession(
      request,
      NextResponse.json({ error: authz.error }, { status: authz.status }),
      session.setCookies,
    );
  }

  const source = await loadDuplicateSource({
    accountId,
    publicId: sourcePublicId,
    tokyoAccessToken: session.accessToken,
    berlinAccessToken: session.accessToken,
    accountCapsule: authz.token,
  });
  if (!source.ok) {
    return withSession(
      request,
      NextResponse.json({ error: source.error }, { status: source.status }),
      session.setCookies,
    );
  }

  const validatedConfig = validatePersistableConfig(source.value.config, accountId);
  if (!validatedConfig.ok) {
    return withSession(
      request,
      NextResponse.json({ error: validatedConfig.error }, { status: validatedConfig.status }),
      session.setCookies,
    );
  }

  const publicId = createUserInstancePublicId(source.value.widgetType);
  const createdRow = await createAccountInstanceRow({
    accountId,
    publicId,
    widgetType: source.value.widgetType,
    config: validatedConfig.value.config,
    berlinAccessToken: session.accessToken,
    status: 'unpublished',
  });
  if (!createdRow.ok) {
    const status = createdRow.status === 401 ? 401 : createdRow.status;
    const kind =
      status === 401
        ? 'AUTH'
        : status === 403
          ? 'DENY'
          : status === 409
            ? 'VALIDATION'
            : status === 422
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
      session.setCookies,
    );
  }

  if (!createdRow.row) {
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
      session.setCookies,
    );
  }

  const created = createdRow.row;
  try {
    await writeSavedConfigToTokyo({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      tokyoAccessToken: session.accessToken,
      accountId,
      publicId,
      accountCapsule: authz.token,
      widgetType: created.widgetType,
      config: validatedConfig.value.config,
      displayName: created.displayName,
      source: created.source,
      meta: created.meta ?? null,
    });
  } catch (error) {
    await rollbackDuplicateCreate({
      accountId,
      publicId,
      tokyoAccessToken: session.accessToken,
      berlinAccessToken: session.accessToken,
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
      session.setCookies,
    );
  }

  after(async () => {
    try {
      await runAccountSaveAftermath({
        accessToken: session.accessToken,
        accountId,
        publicId,
        policyProfile: authz.payload.profile,
        accountCapsule: authz.token,
        previousConfig: null,
      });
    } catch (error) {
      console.error('[roma widgets duplicate route] create aftermath failed', {
        publicId,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });

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
    session.setCookies,
  );
}
