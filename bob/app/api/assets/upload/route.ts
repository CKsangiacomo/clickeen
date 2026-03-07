import { NextRequest, NextResponse } from 'next/server';
import { isUuid, isWidgetPublicId, parseCanonicalAssetRef, toCanonicalAssetVersionPath } from '@clickeen/ck-contracts';
import { resolveTokyoBaseUrl } from '../../../../lib/env/tokyo';
import {
  resolveSessionBearer,
} from '../../../../lib/auth/session';
import { withSessionAndCors } from '../../../../lib/api/paris/proxy-helpers';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, content-type, x-account-id, x-public-id, x-widget-type, x-filename, x-source, x-clickeen-surface',
} as const;

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
  const parsed = parseCanonicalAssetRef(direct);
  if (!parsed) return null;
  if (expectedAccountId && parsed.accountId !== expectedAccountId) return null;
  const canonicalPath = toCanonicalAssetVersionPath(parsed.versionKey);
  if (!canonicalPath) return null;
  return `${base}${canonicalPath}`;
}

function isWidgetType(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(value);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const stage = (process.env.ENV_STAGE ?? '').trim().toLowerCase();
  const localStage = stage === 'local';
  const session = localStage ? null : await resolveSessionBearer(request);
  if (!localStage && session && !session.ok) {
    return withSessionAndCors(request, session.response, undefined, CORS_HEADERS);
  }

  const surface = (request.headers.get('x-clickeen-surface') || '').trim();
  const allowedLocalSurface = surface === '' || surface === 'roma-assets' || surface === 'devstudio';
  if ((!localStage && surface !== 'roma-assets') || (localStage && !allowedLocalSurface)) {
    return withSessionAndCors(request, NextResponse.json(
      {
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.errors.auth.forbidden',
          detail: 'Asset upload is managed via Roma Assets.',
        },
      },
      { status: 403 },
    ), session && session.ok ? session.setCookies : undefined, CORS_HEADERS);
  }

  const accountId = (request.headers.get('x-account-id') || '').trim();
  if (!accountId || !isUuid(accountId)) {
    return withSessionAndCors(request, NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
      { status: 422 },
    ), session && session.ok ? session.setCookies : undefined, CORS_HEADERS);
  }

  const legacyVariant = (request.headers.get('x-variant') || '').trim();
  if (legacyVariant) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assets.variantUnsupported' } },
        { status: 422 },
      ),
      session && session.ok ? session.setCookies : undefined,
      CORS_HEADERS,
    );
  }

  const filename = (request.headers.get('x-filename') || '').trim() || 'upload.bin';

  let tokyoBase = '';
  try {
    tokyoBase = resolveTokyoBaseUrl().replace(/\/$/, '');
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    return withSessionAndCors(request, NextResponse.json(
      { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail: messageText } },
      { status: 500 },
    ), session && session.ok ? session.setCookies : undefined, CORS_HEADERS);
  }

  const headers = new Headers();
  if (localStage) {
    const tokyoDevJwt = String(process.env.TOKYO_DEV_JWT || '').trim();
    if (!tokyoDevJwt) {
      return withSessionAndCors(
        request,
        NextResponse.json(
          { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail: 'Missing TOKYO_DEV_JWT.' } },
          { status: 500 },
        ),
        undefined,
        CORS_HEADERS,
      );
    }
    headers.set('authorization', `Bearer ${tokyoDevJwt}`);
  } else if (session && session.ok) {
    headers.set('authorization', `Bearer ${session.accessToken}`);
  }
  headers.set('x-account-id', accountId);

  const publicId = (request.headers.get('x-public-id') || '').trim();
  if (publicId) {
    if (!isWidgetPublicId(publicId)) {
      return withSessionAndCors(request, NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } },
        { status: 422 },
      ), session && session.ok ? session.setCookies : undefined, CORS_HEADERS);
    }
    headers.set('x-public-id', publicId);
  }

  const widgetType = (request.headers.get('x-widget-type') || '').trim().toLowerCase();
  if (widgetType) {
    if (!isWidgetType(widgetType)) {
      return withSessionAndCors(request, NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' } },
        { status: 422 },
      ), session && session.ok ? session.setCookies : undefined, CORS_HEADERS);
    }
    headers.set('x-widget-type', widgetType);
  }

  const source = (request.headers.get('x-source') || '').trim();
  if (source) {
    headers.set('x-source', source);
  }

  try {
    const contentLength = Number(request.headers.get('content-length') || '');
    if (Number.isFinite(contentLength) && contentLength <= 0) {
      return withSessionAndCors(request, NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } },
        { status: 422 },
      ), session && session.ok ? session.setCookies : undefined, CORS_HEADERS);
    }
    const bodyStream = request.body;
    if (!bodyStream) {
      return withSessionAndCors(request, NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } },
        { status: 422 },
      ), session && session.ok ? session.setCookies : undefined, CORS_HEADERS);
    }

    const contentType = (request.headers.get('content-type') || '').trim() || 'application/octet-stream';
    headers.set('content-type', contentType);
    headers.set('x-filename', filename);

    const tokyoUrl = `${tokyoBase}/assets/upload`;
    const res = await fetch(`${tokyoUrl}?_t=${Date.now()}`, {
      method: 'POST',
      headers,
      body: bodyStream,
    });

    const text = await res.text().catch(() => '');
    const payload = safeJsonParse(text);
    if (!res.ok) {
      if (payload && typeof payload === 'object' && (payload as any).error) {
        return withSessionAndCors(
          request,
          NextResponse.json(payload, { status: res.status }),
          session && session.ok ? session.setCookies : undefined,
          CORS_HEADERS,
        );
      }
      return withSessionAndCors(request, NextResponse.json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.assets.uploadFailed',
            detail: text || `tokyo upload failed (HTTP ${res.status})`,
          },
        },
        { status: 502 },
      ), session && session.ok ? session.setCookies : undefined, CORS_HEADERS);
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return withSessionAndCors(request, NextResponse.json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.assets.uploadFailed',
            detail: 'tokyo upload response missing JSON payload',
          },
        },
        { status: 502 },
      ), session && session.ok ? session.setCookies : undefined, CORS_HEADERS);
    }

    const normalizedUrl = normalizeTokyoUploadUrl(tokyoBase, payload as Record<string, unknown>, accountId);
    if (!normalizedUrl) {
      return withSessionAndCors(request, NextResponse.json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.assets.uploadFailed',
            detail: 'tokyo upload response missing url',
          },
        },
        { status: 502 },
      ), session && session.ok ? session.setCookies : undefined, CORS_HEADERS);
    }

    return withSessionAndCors(request, NextResponse.json(
      { ...(payload as Record<string, unknown>), url: normalizedUrl },
      { status: 200 },
    ), session && session.ok ? session.setCookies : undefined, CORS_HEADERS);
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    return withSessionAndCors(request, NextResponse.json(
      { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.assets.uploadFailed', detail: messageText } },
      { status: 502 },
    ), session && session.ok ? session.setCookies : undefined, CORS_HEADERS);
  }
}
