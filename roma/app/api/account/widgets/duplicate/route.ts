import { NextRequest, NextResponse } from 'next/server';
import {
  loadTokyoAccountInstanceDocument,
  loadTokyoAccountInstanceIndex,
  writeSavedConfigToTokyo,
} from '@roma/lib/account-instance-direct';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { normalizeDesiredAccountLocales } from '@roma/lib/account-locales';
import { enqueueAccountInstanceSync } from '@roma/lib/account-instance-sync';
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

function createUserInstanceInstanceId(): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `ins_${suffix}`;
}

async function loadDuplicateSource(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
}): Promise<
  | { ok: true; value: DuplicateSource }
  | { ok: false; status: number; error: { kind: string; reasonKey: string; detail?: string } }
> {
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

  const sourceEntry = index.value.accountInstances.find((entry) => entry.instanceId === args.instanceId);
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
  const source = await loadTokyoAccountInstanceDocument({
    accountId: sourceEntry.accountId,
    instanceId: args.instanceId,
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
      accountId: sourceEntry.accountId,
      widgetType: source.value.row.widgetType,
      config: source.value.config,
    },
  };
}

export async function POST(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  let body: { sourceInstanceId?: unknown } | null = null;
  try {
    body = (await request.json()) as { sourceInstanceId?: unknown } | null;
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
  const sourceInstanceId = asTrimmedString(body?.sourceInstanceId);
  if (!sourceInstanceId) {
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
    instanceId: sourceInstanceId,
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

  const instanceId = createUserInstanceInstanceId();
  try {
    await writeSavedConfigToTokyo({
      accountId,
      instanceId,
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

  let syncFollowup:
    | { ok: true }
    | { ok: false; reasonKey: string; detail: string } = { ok: true };
  try {
    await enqueueAccountInstanceSync({
      accountId,
      instanceId,
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
      instanceId,
      detail,
    });
  }

  return withSession(
    request,
    NextResponse.json(
      {
        accountId,
        sourceInstanceId,
        sourceAccountId: source.value.accountId,
        instanceId,
        widgetType: source.value.widgetType,
        status: 'unpublished',
        syncFollowup,
      },
      { status: 201 },
    ),
    current.value.setCookies,
  );
}
