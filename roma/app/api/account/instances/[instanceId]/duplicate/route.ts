import { NextRequest, NextResponse } from 'next/server';
import { createCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import {
  createAccountInstanceInTokyo,
  loadTokyoAccountInstanceDocument,
} from '@roma/lib/account-instance-direct';
import {
  compileWidgetForInstancePackage,
  materializeAccountInstancePublicPackage,
} from '@roma/lib/account-instance-public-package';
import { materializeAccountInstanceSourceArtifacts } from '@roma/lib/account-instance-source-artifacts';
import { validateAccountInstanceSavePolicy } from '@roma/lib/account-instance-save-policy';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountPublicId;
  const sourceInstanceId = await requireInstanceIdParam(context, { mode: 'normalized' });
  if (typeof sourceInstanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: sourceInstanceId.error }, { status: sourceInstanceId.status }),
      current.value.setCookies,
    );
  }

  const source = await loadTokyoAccountInstanceDocument({
    accountId,
    instanceId: sourceInstanceId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!source.ok) {
    return withSession(
      request,
      NextResponse.json({ error: source.error }, { status: source.status }),
      current.value.setCookies,
    );
  }

  const accountLocales = await loadCurrentAccountLocalesState({
    accessToken: current.value.accessToken,
    accountId: current.value.authzPayload.accountId,
    requestId: current.value.requestId,
  });
  if (!accountLocales.ok) {
    return withSession(
      request,
      NextResponse.json(
        accountLocales.payload ?? {
          error: {
            kind: accountLocales.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
            reasonKey:
              accountLocales.status === 401
                ? 'coreui.errors.auth.required'
                : 'coreui.errors.auth.contextUnavailable',
            detail: accountLocales.detail,
          },
        },
        { status: accountLocales.status },
      ),
      current.value.setCookies,
    );
  }

  const widgetType = source.value.row.widgetType;
  const baseLocale = accountLocales.localePolicy.baseLocale;

  const instanceId = createCompactInstanceId();
  const compiled = await compileWidgetForInstancePackage(request, widgetType);
  if (!compiled.ok) {
    return withSession(
      request,
      NextResponse.json({ error: compiled.error }, { status: compiled.status }),
      current.value.setCookies,
    );
  }
  const policyGate = validateAccountInstanceSavePolicy({
    config: source.value.config,
    authz: current.value.authzPayload,
    limits: compiled.value.limits,
    context: 'publish',
  });
  if (!policyGate.ok) {
    return withSession(
      request,
      NextResponse.json({ error: policyGate.error }, { status: policyGate.status }),
      current.value.setCookies,
    );
  }
  const publicPackage = await materializeAccountInstancePublicPackage({
    compiled: compiled.value,
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
    instanceId,
    baseLocale,
    displayName: null,
    config: source.value.config,
  });
  if (!publicPackage.ok) {
    return withSession(
      request,
      NextResponse.json({ error: publicPackage.error }, { status: publicPackage.status }),
      current.value.setCookies,
    );
  }
  const sourceArtifacts = materializeAccountInstanceSourceArtifacts({
    accountId,
    instanceId,
    widgetType,
    config: source.value.config,
    editableFields: compiled.value.editableFields ?? null,
    initialStatus: 'ok',
  });
  if (!sourceArtifacts.ok) {
    return withSession(
      request,
      NextResponse.json({ error: sourceArtifacts.error }, { status: sourceArtifacts.status }),
      current.value.setCookies,
    );
  }

  const duplicate = await createAccountInstanceInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    instanceId,
    widgetType,
    displayName: null,
    config: sourceArtifacts.value.config,
    content: sourceArtifacts.value.content,
    publicPackage: publicPackage.value,
    baseLocale,
    meta: null,
    requestId: current.value.requestId,
  });
  if (!duplicate.ok) {
    return withSession(
      request,
      NextResponse.json({ error: duplicate.error }, { status: duplicate.status }),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json(
      {
        accountId: duplicate.value.row.accountId,
        sourceInstanceId,
        sourceAccountId: duplicate.value.row.accountId,
        instanceId: duplicate.value.row.instanceId,
        widgetType: duplicate.value.row.widgetType,
        status: 'unpublished',
      },
      { status: 201 },
    ),
    current.value.setCookies,
  );
}
