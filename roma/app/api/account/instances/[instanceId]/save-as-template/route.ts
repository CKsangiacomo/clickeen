import { isRecord } from '@clickeen/ck-contracts';
import { createCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import { parseCatalogPresentation, type CatalogPresentation } from '@clickeen/ck-contracts/catalog';
import { resolvePolicyFromEntitlementsSnapshot } from '@clickeen/ck-policy';
import {
  createAccountInstanceInTokyo,
  listAccountWidgetInstanceIds,
  loadTokyoAccountInstancePublicPackage,
  loadTokyoAccountInstanceSourceSnapshot,
} from '@roma/lib/account-instance-direct';
import { readJsonPayloadOrValidation, requireInstanceIdParam } from '@roma/lib/route-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

function readTemplateInput(payload: unknown, accountId: string): {
  templateName: string;
  catalogPresentation?: CatalogPresentation;
} | null {
  if (!isRecord(payload)) return null;
  const requiresPresentation = accountId === 'CLICKEEN';
  const expectedKeys = requiresPresentation
    ? ['catalogPresentation', 'templateName']
    : ['templateName'];
  if (Object.keys(payload).sort().join('|') !== expectedKeys.join('|')) return null;
  const name = typeof payload.templateName === 'string' ? payload.templateName.trim() : '';
  const catalogPresentation = requiresPresentation
    ? parseCatalogPresentation(payload.catalogPresentation)
    : null;
  return name && name.length <= 120 && (!requiresPresentation || catalogPresentation)
    ? { templateName: name, ...(catalogPresentation ? { catalogPresentation } : {}) }
    : null;
}

function readWidgetCapacityLimit(limits: Record<string, unknown>): number | null {
  const value = limits['widgets.instances.max'];
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : null;
}

function capacityUpgradeRequired(current: number, limit: number): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      kind: 'UPGRADE_REQUIRED',
      upgrade: {
        gate: 'widgets.instances.max',
        action: 'create_instance',
        current,
        limit,
      },
    },
    { status: 402 },
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;
  const accountId = current.value.authzPayload.accountPublicId;
  const instanceId = await requireInstanceIdParam(context, { mode: 'normalized' });
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json(
        { error: instanceId.error },
        { status: instanceId.status },
      ),
      current.value.setCookies,
    );
  }
  const body = await readJsonPayloadOrValidation<unknown>(request);
  if (!body.ok) {
    return withSession(
      request,
      NextResponse.json({ error: body.error }, { status: body.status }),
      current.value.setCookies,
    );
  }
  const templateInput = readTemplateInput(body.payload, accountId);
  if (!templateInput) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  const { templateName, catalogPresentation } = templateInput;

  const source = await loadTokyoAccountInstanceSourceSnapshot({
    accountId,
    instanceId,
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
  if (source.value.row.isTemplate || source.value.row.displayName === templateName) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const inventory = await listAccountWidgetInstanceIds({
    accountId,
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
  const policy = resolvePolicyFromEntitlementsSnapshot({
    profile: current.value.authzPayload.profile,
    role: current.value.authzPayload.role,
    entitlements: current.value.authzPayload.entitlements ?? null,
  });
  const limit = readWidgetCapacityLimit(policy.limits);
  if (limit == null) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'roma.errors.policy.invalidEntitlement',
            detail: 'widgets.instances.max',
          },
        },
        { status: 500 },
      ),
      current.value.setCookies,
    );
  }
  if (inventory.value.instanceIds.length >= limit) {
    return withSession(
      request,
      capacityUpgradeRequired(inventory.value.instanceIds.length, limit),
      current.value.setCookies,
    );
  }

  const sourcePackage = await loadTokyoAccountInstancePublicPackage({
    accountId,
    instanceId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!sourcePackage.ok) {
    return withSession(
      request,
      NextResponse.json({ error: sourcePackage.error }, { status: sourcePackage.status }),
      current.value.setCookies,
    );
  }

  let templateId = createCompactInstanceId();
  while (templateId === instanceId || inventory.value.instanceIds.includes(templateId)) {
    templateId = createCompactInstanceId();
  }
  const created = await createAccountInstanceInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    instanceId: templateId,
    widgetType: source.value.row.widgetType,
    displayName: templateName,
    isTemplate: true,
    ...(catalogPresentation ? { catalogPresentation } : {}),
    config: source.value.config,
    content: { ...source.value.content, id: templateId },
    publicPackage: sourcePackage.value.publicPackage,
    requestId: current.value.requestId,
  });
  return withSession(
    request,
    created.ok
      ? NextResponse.json(
          {
            accountId,
            sourceInstanceId: instanceId,
            templateId: created.value.row.instanceId,
            templateName: created.value.row.displayName,
          },
          { status: 201 },
        )
      : NextResponse.json({ error: created.error }, { status: created.status }),
    current.value.setCookies,
  );
}
