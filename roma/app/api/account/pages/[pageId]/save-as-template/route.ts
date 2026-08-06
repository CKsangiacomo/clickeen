import { isRecord } from '@clickeen/ck-contracts';
import { createCompactPageId, isCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import { parseCatalogPresentation, type CatalogPresentation } from '@clickeen/ck-contracts/catalog';
import type { AccountPageTemplate } from '@clickeen/ck-contracts/pages';
import { resolvePageProductPolicy } from '@roma/lib/account-page-policy';
import { createAccountPage, listAccountPageSources, readAccountPage } from '@roma/lib/account-pages';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ pageId: string }> };

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

function capacityUpgradeRequired(current: number, limit: number): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      kind: 'UPGRADE_REQUIRED',
      upgrade: {
        gate: 'pages.max',
        action: 'save_page',
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
  const { pageId: rawPageId } = await context.params;
  const pageId = rawPageId?.trim();
  if (!isCompactPageId(pageId)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.invalidPageId' } },
        { status: 422 },
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

  const source = await readAccountPage({
    accountId,
    pageId,
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
  if (source.value.source.pageId !== pageId) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.page.invalidPayload',
            detail: 'Tokyo Page source coordinate does not match',
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }
  if (source.value.source.isTemplate || source.value.source.displayName === templateName) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const inventory = await listAccountPageSources({
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
  const access = resolvePageProductPolicy(current.value.authzPayload, 'save_page');
  if (!access.ok) {
    return withSession(
      request,
      NextResponse.json(access.payload, { status: access.status }),
      current.value.setCookies,
    );
  }
  if (access.limit !== null && inventory.value.sources.length >= access.limit) {
    return withSession(
      request,
      capacityUpgradeRequired(inventory.value.sources.length, access.limit),
      current.value.setCookies,
    );
  }

  let templateId = createCompactPageId();
  while (templateId === pageId || inventory.value.sources.some((entry) => entry.pageId === templateId)) {
    templateId = createCompactPageId();
  }
  const ordinarySource = source.value.source;
  const templateSource: AccountPageTemplate = {
    pageId: templateId,
    displayName: templateName,
    isTemplate: true,
    values: ordinarySource.values,
    robots: ordinarySource.robots,
    placements: ordinarySource.placements,
    ...(catalogPresentation ? { catalogPresentation } : {}),
  };
  const created = await createAccountPage({
    accountId,
    source: templateSource,
    files: source.value.files,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  return withSession(
    request,
    created.ok
      ? NextResponse.json(
          {
            accountId,
            sourcePageId: pageId,
            templateId: created.value.source.pageId,
            templateName: created.value.source.displayName,
          },
          { status: 201 },
        )
      : NextResponse.json({ error: created.error }, { status: created.status }),
    current.value.setCookies,
  );
}
