import { NextRequest, NextResponse } from 'next/server';
import { isRecord } from '@clickeen/ck-contracts';
import {
  readAccountInstanceTranslationValues,
  writeAccountInstanceTranslationValues,
} from '@roma/lib/account-instance-translations';
import { readJsonPayloadOrValidation, requireInstanceIdParam } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string; locale: string }> };

function normalizeValues(raw: unknown): Record<string, string> | null {
  if (!isRecord(raw)) return null;
  const values: Record<string, string> = {};
  for (const [path, value] of Object.entries(raw)) {
    if (!path || typeof value !== 'string') return null;
    values[path] = value;
  }
  return values;
}

async function requireLocaleParam(context: RouteContext): Promise<string | null> {
  const params = await context.params;
  const locale = String(params.locale || '').trim();
  return locale || null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
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
  const locale = await requireLocaleParam(context);
  if (!locale) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid', detail: 'locale_missing' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const result = await readAccountInstanceTranslationValues({
    accountId,
    instanceId,
    locale,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });

  if (!result.ok) {
    return withSession(
      request,
      NextResponse.json({ error: result.error }, { status: result.status }),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json(result.value),
    current.value.setCookies,
  );
}

export async function PUT(request: NextRequest, context: RouteContext) {
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
  const locale = await requireLocaleParam(context);
  if (!locale) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid', detail: 'locale_missing' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const bodyResult = await readJsonPayloadOrValidation<{ values?: unknown } | null>(request);
  if (!bodyResult.ok) {
    return withSession(
      request,
      NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }),
      current.value.setCookies,
    );
  }
  const values = normalizeValues(bodyResult.payload?.values);
  if (!values) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid', detail: 'values_invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const result = await writeAccountInstanceTranslationValues({
    accountId,
    instanceId,
    locale,
    values,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });

  if (!result.ok) {
    return withSession(
      request,
      NextResponse.json({ error: result.error }, { status: result.status }),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({ ok: true, v: 1, locale: result.value.locale }),
    current.value.setCookies,
  );
}
