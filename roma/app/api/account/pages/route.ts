import { NextRequest, NextResponse } from 'next/server';
import { isRecord } from '@clickeen/ck-contracts';
import { createCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import {
  createAccountPageInTokyo,
  listAccountPagesInTokyo,
} from '@roma/lib/account-page-direct';
import type {
  AccountPageMetadata,
  AccountPageSource,
} from '@roma/lib/account-page-direct';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../_lib/current-account-route';

export const runtime = 'edge';

function exactString(value: unknown): string | null {
  return typeof value === 'string' && value === value.trim() ? value : null;
}

function isValidCanonicalUrl(value: string): boolean {
  if (value !== value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function defaultPageMetadata(): AccountPageMetadata {
  return { title: 'Untitled page', description: '', robots: 'index,follow' };
}

function pageMetadataFromCreatePayload(body: Record<string, unknown>): AccountPageMetadata | null {
  if (!Object.prototype.hasOwnProperty.call(body, 'metadata')) return defaultPageMetadata();
  const raw = body.metadata;
  if (!isRecord(raw)) return null;
  const title = Object.prototype.hasOwnProperty.call(raw, 'title') ? exactString(raw.title) : 'Untitled page';
  const description = Object.prototype.hasOwnProperty.call(raw, 'description') ? exactString(raw.description) : '';
  const robots = Object.prototype.hasOwnProperty.call(raw, 'robots') ? raw.robots : 'index,follow';
  if (!title || description == null || (robots !== 'index,follow' && robots !== 'noindex,nofollow')) return null;
  const canonicalUrl = Object.prototype.hasOwnProperty.call(raw, 'canonicalUrl') ? exactString(raw.canonicalUrl) : null;
  if (Object.prototype.hasOwnProperty.call(raw, 'canonicalUrl') && (!canonicalUrl || !isValidCanonicalUrl(canonicalUrl))) return null;
  return { title, description, robots, ...(canonicalUrl ? { canonicalUrl } : {}) };
}

function createPageSourceFromPayload(raw: unknown, accountId: string): AccountPageSource | null {
  if (!isRecord(raw)) return null;
  const metadata = pageMetadataFromCreatePayload(raw);
  if (!metadata) return null;
  const displayName = Object.prototype.hasOwnProperty.call(raw, 'displayName')
    ? exactString(raw.displayName)
    : metadata.title;
  if (!displayName) return null;
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    pageId: createCompactPageId(),
    accountPublicId: accountId,
    displayName,
    metadata,
    localization: {
      defaultLocale: 'en',
      ipLocalizationEnabled: false,
      countryLocaleRules: [],
      languageSwitcherEnabled: false,
      missingLocaleBehavior: 'block_publish',
    },
    placements: [],
    version: 1,
    createdAt: now,
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

  const bodyResult = await readJsonPayloadOrValidation<unknown>(request);
  if (!bodyResult.ok) {
    return withSession(
      request,
      NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }),
      current.value.setCookies,
    );
  }

  const accountId = current.value.authzPayload.accountPublicId;
  const source = createPageSourceFromPayload(bodyResult.payload, accountId);
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
        publishStatus: result.value.publishStatus,
      },
      { status: 201 },
    ),
    current.value.setCookies,
  );
}
