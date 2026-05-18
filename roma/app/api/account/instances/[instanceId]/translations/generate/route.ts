import { NextRequest, NextResponse } from 'next/server';
import { loadTokyoAccountInstanceDocument } from '@roma/lib/account-instance-direct';
import { runInstanceTranslationFollowupAfterSave } from '@roma/lib/account-instance-translation-followup';
import { getOptionalCloudflareRequestContext } from '@roma/lib/cloudflare-request-context';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };
type CloudflareContextWithWaitUntil = {
  env?: unknown;
  ctx?: {
    waitUntil?: (promise: Promise<unknown>) => void;
  };
  waitUntil?: (promise: Promise<unknown>) => void;
};
type TranslationFollowupResult = Awaited<
  ReturnType<typeof runInstanceTranslationFollowupAfterSave>
>;
type TranslationFollowupResults = TranslationFollowupResult['results'];

function attachTranslationFollowupToRequestLifetime(promise: Promise<unknown>): void {
  const context = getOptionalCloudflareRequestContext<CloudflareContextWithWaitUntil>();
  const waitUntil = context?.ctx?.waitUntil ?? context?.waitUntil;
  if (typeof waitUntil === 'function') {
    waitUntil.call(context?.ctx ?? context, promise);
    return;
  }
  void promise;
}

function logTranslationGenerateFailure(args: {
  accountId: string;
  instanceId: string;
  requestId?: string | null;
  results?: TranslationFollowupResults;
  detail?: string;
}): void {
  console.warn('[roma account instance translations generate] translation follow-up failed', {
    accountId: args.accountId,
    instanceId: args.instanceId,
    requestId: args.requestId,
    ...(args.results ? { results: args.results } : {}),
    ...(args.detail ? { detail: args.detail } : {}),
  });
}

function startTranslationGenerate(args: {
  authz: Parameters<typeof runInstanceTranslationFollowupAfterSave>[0]['authz'];
  accessToken: string;
  accountCapsule: string;
  accountPublicId: string;
  instanceId: string;
  widgetType: string;
  config: Record<string, unknown>;
  requestId?: string | null;
}): void {
  const promise = runInstanceTranslationFollowupAfterSave({
    ...args,
    previousConfig: null,
    translateAllCurrentFields: true,
  })
    .then((translation) => {
      if (!translation.ok) {
        logTranslationGenerateFailure({
          accountId: args.accountPublicId,
          instanceId: args.instanceId,
          requestId: args.requestId,
          results: translation.results,
        });
      }
    })
    .catch((error) => {
      logTranslationGenerateFailure({
        accountId: args.accountPublicId,
        instanceId: args.instanceId,
        requestId: args.requestId,
        detail: error instanceof Error ? error.message : String(error),
      });
    });

  attachTranslationFollowupToRequestLifetime(promise);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountPublicId;
  const instanceId = await requireInstanceIdParam(context, { mode: 'normalized' });
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: instanceId.error }, { status: instanceId.status }),
      current.value.setCookies,
    );
  }

  const instance = await loadTokyoAccountInstanceDocument({
    accountId,
    instanceId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!instance.ok) {
    return withSession(
      request,
      NextResponse.json({ error: instance.error }, { status: instance.status }),
      current.value.setCookies,
    );
  }

  startTranslationGenerate({
    authz: current.value.authzPayload,
    accessToken: current.value.accessToken,
    accountCapsule: current.value.authzToken,
    accountPublicId: accountId,
    instanceId,
    widgetType: instance.value.row.widgetType,
    config: instance.value.config,
    requestId: current.value.requestId,
  });

  return withSession(request, NextResponse.json({ ok: true }), current.value.setCookies);
}
