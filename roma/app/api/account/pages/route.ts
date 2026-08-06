import { isRecord } from '@clickeen/ck-contracts';
import type { AccountPageSource } from '@clickeen/ck-contracts/pages';
import { createCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import { NextRequest, NextResponse } from 'next/server';
import { parseAccountPageSource } from '@roma/lib/account-page-contract';
import { resolvePageProductPolicy } from '@roma/lib/account-page-policy';
import {
  createAccountPage,
  listAccountPageSources,
  type PageGeneratedFiles,
  type PageServingOverlays,
} from '@roma/lib/account-pages';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';

const CREATE_KEYS = ['displayName', 'isTemplate', 'values', 'robots', 'placements'] as const;

function parseGeneratedFiles(raw: unknown): PageGeneratedFiles | null {
  if (!isRecord(raw)) return null;
  return typeof raw.indexHtml === 'string' &&
    typeof raw.stylesCss === 'string' &&
    typeof raw.runtimeJs === 'string'
    ? { indexHtml: raw.indexHtml, stylesCss: raw.stylesCss, runtimeJs: raw.runtimeJs }
    : null;
}

function parseOrdinaryPageDraft(raw: unknown): Omit<Extract<AccountPageSource, { isTemplate: false }>, 'pageId' | 'baseLocale'> | null {
  if (!isRecord(raw) || Object.keys(raw).length !== CREATE_KEYS.length || !CREATE_KEYS.every((key) => Object.prototype.hasOwnProperty.call(raw, key))) return null;
  const source = parseAccountPageSource({
    pageId: '0000000000',
    displayName: raw.displayName,
    isTemplate: raw.isTemplate,
    baseLocale: 'en',
    values: raw.values,
    robots: raw.robots,
    placements: raw.placements,
  });
  if (!source || source.isTemplate) return null;
  return {
    displayName: source.displayName,
    isTemplate: false,
    values: source.values,
    robots: source.robots,
    placements: source.placements,
  };
}

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;
  const result = await listAccountPageSources({
    accountId: current.value.authzPayload.accountPublicId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  return withSession(
    request,
    result.ok
      ? NextResponse.json({ accountId: result.value.accountId, sources: result.value.sources })
      : NextResponse.json({ error: result.error }, { status: result.status }),
    current.value.setCookies,
  );
}

export async function POST(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;
  const bodyResult = await readJsonPayloadOrValidation<{
    source?: unknown;
    files?: unknown;
    overlaysJson?: unknown;
  } | null>(request);
  if (!bodyResult.ok) {
    return withSession(request, NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }), current.value.setCookies);
  }
  const draft = parseOrdinaryPageDraft(bodyResult.payload?.source);
  const files = parseGeneratedFiles(bodyResult.payload?.files);
  const overlaysJson = bodyResult.payload?.overlaysJson;
  if (!draft || !files || !isRecord(overlaysJson)) {
    return withSession(request, NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.sourceInvalid' } }, { status: 422 }), current.value.setCookies);
  }

  const accountId = current.value.authzPayload.accountPublicId;
  const existing = await listAccountPageSources({ accountId, accountCapsule: current.value.authzToken, requestId: current.value.requestId });
  if (!existing.ok) {
    return withSession(request, NextResponse.json({ error: existing.error }, { status: existing.status }), current.value.setCookies);
  }
  const access = resolvePageProductPolicy(current.value.authzPayload, 'save_page');
  if (!access.ok) {
    return withSession(request, NextResponse.json(access.payload, { status: access.status }), current.value.setCookies);
  }
  const limit = access.limit;
  if (limit !== null && existing.value.sources.length >= limit) {
    return withSession(request, NextResponse.json({
      ok: false,
      kind: 'UPGRADE_REQUIRED',
      upgrade: { gate: 'pages.max', action: 'create_page', current: existing.value.sources.length, limit },
    }, { status: 402 }), current.value.setCookies);
  }

  const locales = await loadCurrentAccountLocalesState({
    accessToken: current.value.accessToken,
    accountId: current.value.authzPayload.accountId,
    requestId: current.value.requestId,
  });
  if (!locales.ok) {
    return withSession(request, NextResponse.json(locales.payload ?? {
      error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.auth.contextUnavailable', detail: locales.detail },
    }, { status: locales.status }), current.value.setCookies);
  }
  const source: AccountPageSource = {
    pageId: createCompactPageId(),
    ...draft,
    isTemplate: false,
    baseLocale: locales.localePolicy.baseLocale,
  };
  const created = await createAccountPage({
    accountId,
    source,
    files,
    overlaysJson: overlaysJson as PageServingOverlays,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  return withSession(
    request,
    created.ok
      ? NextResponse.json({ accountId, source: created.value.source }, { status: 201 })
      : NextResponse.json({ error: created.error }, { status: created.status }),
    current.value.setCookies,
  );
}
