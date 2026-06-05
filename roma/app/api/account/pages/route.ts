import { NextRequest, NextResponse } from 'next/server';
import { isRecord } from '@clickeen/ck-contracts';
import {
  createCompactPageId,
  isCompactInstanceId,
} from '@clickeen/ck-contracts/overlay-identity';
import {
  createAccountPageInTokyo,
  listAccountPagesInTokyo,
} from '@roma/lib/account-page-direct';
import type {
  TokyoAccountPageHead,
  TokyoAccountPagePlacement,
  TokyoAccountPageSource,
} from '@roma/lib/account-page-direct';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../_lib/current-account-route';

export const runtime = 'edge';

function normalizeCreatePageHead(raw: unknown): TokyoAccountPageHead {
  if (!isRecord(raw)) {
    return { title: 'Untitled page', description: '', robots: 'noindex,nofollow' };
  }
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Untitled page';
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  const robots = raw.robots === 'index,follow' || raw.robots === 'noindex,nofollow'
    ? raw.robots
    : 'noindex,nofollow';
  return { title, description, robots };
}

function normalizeCreatePagePlacements(raw: unknown): TokyoAccountPagePlacement[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const placements: TokyoAccountPagePlacement[] = [];
  for (const value of raw) {
    if (!isRecord(value)) return null;
    const instanceId = typeof value.instanceId === 'string' ? value.instanceId.trim().toUpperCase() : '';
    if (!isCompactInstanceId(instanceId)) return null;
    placements.push({ instanceId });
  }
  return placements;
}

function createPageSourceFromRequestBody(raw: unknown): TokyoAccountPageSource | null {
  const body = isRecord(raw) ? raw : {};
  const placements = normalizeCreatePagePlacements(body.placements);
  if (!placements) return null;
  return {
    v: 1,
    id: createCompactPageId(),
    head: normalizeCreatePageHead(body.head),
    placements,
  };
}

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountPublicId;
  const result = await listAccountPagesInTokyo({
    accountId,
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
    NextResponse.json({ accountId, pages: result.value.pages }),
    current.value.setCookies,
  );
}

export async function POST(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const bodyResult = await readJsonPayloadOrValidation<{ head?: unknown; placements?: unknown } | null>(request);
  if (!bodyResult.ok) {
    return withSession(
      request,
      NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }),
      current.value.setCookies,
    );
  }

  const accountId = current.value.authzPayload.accountPublicId;
  const source = createPageSourceFromRequestBody(bodyResult.payload);
  if (!source) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.sourceInvalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const result = await createAccountPageInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    source,
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
    NextResponse.json(
      {
        accountId,
        pageId: result.value.source.id,
        source: result.value.source,
        summary: result.value.summary,
      },
      { status: 201 },
    ),
    current.value.setCookies,
  );
}
