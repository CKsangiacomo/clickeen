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
  AccountPageMetadata,
  AccountPagePlacement,
  AccountPageSource,
} from '@roma/lib/account-page-direct';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../_lib/current-account-route';

export const runtime = 'edge';

function createPlacementId(index: number): string {
  return `P${String(index + 1).padStart(3, '0')}`;
}

function normalizeCreatePageMetadata(raw: unknown): AccountPageMetadata | null {
  if (raw == null) {
    return { title: 'Untitled page', description: '', robots: 'noindex,nofollow' };
  }
  if (!isRecord(raw)) return null;
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Untitled page';
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  const robots = Object.prototype.hasOwnProperty.call(raw, 'robots') ? raw.robots : 'noindex,nofollow';
  if (robots !== 'index,follow' && robots !== 'noindex,nofollow') return null;
  const canonicalUrl = typeof raw.canonicalUrl === 'string' && raw.canonicalUrl.trim() ? raw.canonicalUrl.trim() : undefined;
  return { title, description, robots, ...(canonicalUrl ? { canonicalUrl } : {}) };
}

function normalizeCreatePagePlacements(raw: unknown): AccountPagePlacement[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const placements: AccountPagePlacement[] = [];
  for (const [index, value] of raw.entries()) {
    if (!isRecord(value)) return null;
    const placementId = typeof value.placementId === 'string' && value.placementId.trim()
      ? value.placementId.trim().toUpperCase()
      : createPlacementId(index);
    const instanceId = typeof value.instanceId === 'string' ? value.instanceId.trim().toUpperCase() : '';
    if (!isCompactInstanceId(instanceId)) return null;
    placements.push({ placementId, instanceId });
  }
  return placements;
}

function createPageSourceFromRequestBody(raw: unknown, accountId: string): AccountPageSource | null {
  const body = isRecord(raw) ? raw : {};
  const placements = normalizeCreatePagePlacements(body.placements);
  if (!placements) return null;
  const pageId = createCompactPageId();
  const now = new Date().toISOString();
  const metadata = normalizeCreatePageMetadata(body.metadata);
  if (!metadata) return null;
  return {
    schemaVersion: 1,
    pageId,
    accountPublicId: accountId,
    displayName: typeof body.displayName === 'string' && body.displayName.trim() ? body.displayName.trim() : metadata.title,
    metadata,
    localization: {
      defaultLocale: 'en',
      ipLocalizationEnabled: false,
      countryLocaleRules: [],
      languageSwitcherEnabled: false,
      missingLocaleBehavior: 'block_publish',
    },
    placements,
    version: 1,
    updatedAt: now,
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

  const bodyResult = await readJsonPayloadOrValidation<{ metadata?: unknown; placements?: unknown; displayName?: unknown } | null>(request);
  if (!bodyResult.ok) {
    return withSession(
      request,
      NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }),
      current.value.setCookies,
    );
  }

  const accountId = current.value.authzPayload.accountPublicId;
  const source = createPageSourceFromRequestBody(bodyResult.payload, accountId);
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
        pageId: result.value.source.pageId,
        source: result.value.source,
        summary: result.value.summary,
      },
      { status: 201 },
    ),
    current.value.setCookies,
  );
}
