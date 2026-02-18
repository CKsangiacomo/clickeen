import { NextRequest, NextResponse } from 'next/server';
import { resolveTokyoBaseUrl } from '../../../../lib/env/tokyo';
import { resolveSessionBearer, type SessionCookieSpec } from '../../../../lib/auth/session';
import { applySessionCookies } from '../../../../lib/api/paris/proxy-helpers';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, content-type, x-account-id, x-workspace-id, x-public-id, x-widget-type, x-filename, x-variant, x-source',
} as const;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function safeJsonParse(text: string): unknown | null {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function normalizeTokyoUploadUrl(
  tokyoBase: string,
  payload: Record<string, unknown>,
  expectedAccountId: string,
): string | null {
  const base = tokyoBase.replace(/\/+$/, '');
  const direct = typeof payload.url === 'string' ? payload.url.trim() : '';
  if (!direct) return null;

  const parseCanonicalPath = (pathname: string): string | null => {
    const match = String(pathname || '').match(/^\/arsenale\/o\/([^/]+)\/([^/]+)\/(?:[^/]+\/)?[^/]+$/);
    if (!match) return null;
    const accountId = decodeURIComponent(match[1] || '').trim();
    const assetId = decodeURIComponent(match[2] || '').trim();
    if (!isUuid(accountId) || !isUuid(assetId)) return null;
    if (expectedAccountId && accountId !== expectedAccountId) return null;
    return pathname;
  };

  if (/^https?:\/\//i.test(direct)) {
    try {
      const parsed = new URL(direct);
      const canonicalPath = parseCanonicalPath(parsed.pathname);
      if (!canonicalPath) return null;
      return `${base}${canonicalPath}`;
    } catch {
      return null;
    }
  }

  if (!direct.startsWith('/')) return null;
  const canonicalPath = parseCanonicalPath(direct);
  if (!canonicalPath) return null;
  return `${base}${canonicalPath}`;
}

function isPublicId(value: string): boolean {
  if (!value) return false;
  if (/^wgt_curated_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$/i.test(value)) return true;
  if (/^wgt_[a-z0-9][a-z0-9_-]*_(main|tmpl_[a-z0-9][a-z0-9_-]*|u_[a-z0-9][a-z0-9_-]*)$/i.test(value)) return true;
  return /^wgt_main_[a-z0-9][a-z0-9_-]*$/i.test(value);
}

function isWidgetType(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(value);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function withCorsAndSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  const next = applySessionCookies(response, request, setCookies);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => next.headers.set(key, value));
  return next;
}

export async function POST(request: NextRequest) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) {
    return withCorsAndSession(request, session.response);
  }

  const accountId = (request.headers.get('x-account-id') || '').trim();
  if (!accountId || !isUuid(accountId)) {
    return withCorsAndSession(request, NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
      { status: 422 },
    ), session.setCookies);
  }

  const workspaceId = (request.headers.get('x-workspace-id') || '').trim();
  if (!workspaceId || !isUuid(workspaceId)) {
    return withCorsAndSession(request, NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } },
      { status: 422 },
    ), session.setCookies);
  }

  const filename = (request.headers.get('x-filename') || '').trim() || 'upload.bin';
  const variant = (request.headers.get('x-variant') || '').trim() || 'original';

  let tokyoBase = '';
  try {
    tokyoBase = resolveTokyoBaseUrl().replace(/\/$/, '');
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    return withCorsAndSession(request, NextResponse.json(
      { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail: messageText } },
      { status: 500 },
    ), session.setCookies);
  }

  const headers = new Headers();
  headers.set('authorization', `Bearer ${session.accessToken}`);
  headers.set('x-account-id', accountId);
  headers.set('x-workspace-id', workspaceId);

  const publicId = (request.headers.get('x-public-id') || '').trim();
  if (publicId) {
    if (!isPublicId(publicId)) {
      return withCorsAndSession(request, NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } },
        { status: 422 },
      ), session.setCookies);
    }
    headers.set('x-public-id', publicId);
  }

  const widgetType = (request.headers.get('x-widget-type') || '').trim().toLowerCase();
  if (widgetType) {
    if (!isWidgetType(widgetType)) {
      return withCorsAndSession(request, NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' } },
        { status: 422 },
      ), session.setCookies);
    }
    headers.set('x-widget-type', widgetType);
  }

  const source = (request.headers.get('x-source') || '').trim();
  if (source) {
    headers.set('x-source', source);
  }

  try {
    const body = await request.arrayBuffer();
    if (!body || body.byteLength === 0) {
      return withCorsAndSession(request, NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } },
        { status: 422 },
      ), session.setCookies);
    }

    const contentType = (request.headers.get('content-type') || '').trim() || 'application/octet-stream';
    headers.set('content-type', contentType);
    headers.set('x-filename', filename);
    headers.set('x-variant', variant);

    const tokyoUrl = `${tokyoBase}/assets/upload`;
    const res = await fetch(`${tokyoUrl}?_t=${Date.now()}`, {
      method: 'POST',
      headers,
      body,
    });

    const text = await res.text().catch(() => '');
    const payload = safeJsonParse(text);
    if (!res.ok) {
      if (payload && typeof payload === 'object' && (payload as any).error) {
        return withCorsAndSession(request, NextResponse.json(payload, { status: res.status }), session.setCookies);
      }
      return withCorsAndSession(request, NextResponse.json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.assets.uploadFailed',
            detail: text || `tokyo upload failed (HTTP ${res.status})`,
          },
        },
        { status: 502 },
      ), session.setCookies);
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return withCorsAndSession(request, NextResponse.json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.assets.uploadFailed',
            detail: 'tokyo upload response missing JSON payload',
          },
        },
        { status: 502 },
      ), session.setCookies);
    }

    const normalizedUrl = normalizeTokyoUploadUrl(tokyoBase, payload as Record<string, unknown>, accountId);
    if (!normalizedUrl) {
      return withCorsAndSession(request, NextResponse.json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.assets.uploadFailed',
            detail: 'tokyo upload response missing url',
          },
        },
        { status: 502 },
      ), session.setCookies);
    }

    return withCorsAndSession(request, NextResponse.json(
      { ...(payload as Record<string, unknown>), url: normalizedUrl },
      { status: 200 },
    ), session.setCookies);
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    return withCorsAndSession(request, NextResponse.json(
      { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.assets.uploadFailed', detail: messageText } },
      { status: 502 },
    ), session.setCookies);
  }
}
