import { NextRequest, NextResponse } from 'next/server';
import { createAccountInstanceInTokyo } from '@roma/lib/account-instance-direct';
import { loadAccountL10nIntent } from '@roma/lib/account-l10n-intent';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../_lib/current-account-route';

export const runtime = 'edge';

function normalizeDisplayName(value: unknown): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= 120 ? trimmed : undefined;
}

export async function POST(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  let body: { widgetType?: unknown; displayName?: unknown } | null = null;
  try {
    body = (await request.json()) as { widgetType?: unknown; displayName?: unknown } | null;
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

  const widgetType = typeof body?.widgetType === 'string' ? body.widgetType.trim() : '';
  const hasDisplayName = Boolean(body && Object.prototype.hasOwnProperty.call(body, 'displayName'));
  const displayName = hasDisplayName ? normalizeDisplayName(body?.displayName) : undefined;
  if (!widgetType || (hasDisplayName && displayName === undefined)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const accountId = current.value.authzPayload.accountId;
  const l10nIntent = await loadAccountL10nIntent({
    accessToken: current.value.accessToken,
    accountId,
  });
  if (!l10nIntent.ok) {
    return withSession(
      request,
      NextResponse.json({ error: l10nIntent.error }, { status: l10nIntent.status }),
      current.value.setCookies,
    );
  }
  const created = await createAccountInstanceInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    widgetType,
    displayName,
    l10n: {
      summary: {
        baseLocale: l10nIntent.value.baseLocale,
        desiredLocales: l10nIntent.value.desiredLocales,
      },
    },
  });
  if (!created.ok) {
    return withSession(
      request,
      NextResponse.json({ error: created.error }, { status: created.status }),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json(
      {
        accountId,
        instanceId: created.value.row.instanceId,
        widgetType: created.value.row.widgetType,
        displayName: created.value.row.displayName,
        status: 'unpublished',
      },
      { status: 201 },
    ),
    current.value.setCookies,
  );
}
