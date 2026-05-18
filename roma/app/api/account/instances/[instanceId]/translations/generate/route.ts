import { NextRequest, NextResponse } from 'next/server';
import { loadTokyoAccountInstanceDocument } from '@roma/lib/account-instance-direct';
import { loadAccountInstanceLocaleOverlayInventory } from '@roma/lib/account-instance-locale-overlays';
import { loadAccountTranslationLanguagePolicy } from '@roma/lib/account-translation-policy';
import { runInstanceTranslationFollowupAfterSave } from '@roma/lib/account-instance-translation-followup';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

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

  const policy = await loadAccountTranslationLanguagePolicy({
    accessToken: current.value.accessToken,
    accountId: current.value.authzPayload.accountId,
    requestId: current.value.requestId,
  });
  if (!policy.ok) {
    return withSession(
      request,
      NextResponse.json({ error: policy.error }, { status: policy.status }),
      current.value.setCookies,
    );
  }

  const baseLocale = policy.value.baseLocale;
  const targetLocales = policy.value.desiredLocales.filter((locale) => locale !== baseLocale);
  if (!targetLocales.length) {
    return withSession(
      request,
      NextResponse.json({
        ok: true,
        translation: {
          ok: true,
          baseLocale,
          results: [],
        },
      }),
      current.value.setCookies,
    );
  }

  const inventory = await loadAccountInstanceLocaleOverlayInventory({
    accountId,
    instanceId,
    baseLocale,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!inventory.ok) {
    return withSession(
      request,
      NextResponse.json({ error: inventory.error }, { status: inventory.status }),
      current.value.setCookies,
    );
  }

  const readyLocales = new Set(inventory.value.overlays.map((overlay) => overlay.locale));
  const nextLocale = targetLocales.find((locale) => !readyLocales.has(locale));
  if (!nextLocale) {
    return withSession(
      request,
      NextResponse.json({
        ok: true,
        translation: {
          ok: true,
          baseLocale,
          results: [],
        },
      }),
      current.value.setCookies,
    );
  }

  const translation = await runInstanceTranslationFollowupAfterSave({
    authz: current.value.authzPayload,
    accessToken: current.value.accessToken,
    accountCapsule: current.value.authzToken,
    accountPublicId: accountId,
    instanceId,
    widgetType: instance.value.row.widgetType,
    config: instance.value.config,
    previousConfig: null,
    translateAllCurrentFields: true,
    targetLocales: [nextLocale],
    requestId: current.value.requestId,
  });

  return withSession(
    request,
    NextResponse.json({
      ok: translation.ok,
      translation,
    }, { status: translation.ok ? 200 : 502 }),
    current.value.setCookies,
  );
}
