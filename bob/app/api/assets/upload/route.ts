import { NextRequest, NextResponse } from 'next/server';
import { resolveTokyoBaseUrl } from '../../../../lib/env/tokyo';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-workspace-id, x-public-id, x-widget-type, x-filename, x-variant',
} as const;

const TOKYO_DEV_JWT = process.env.TOKYO_DEV_JWT;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isCuratedPublicId(value: string): boolean {
  if (!value) return false;
  if (/^wgt_curated_/.test(value)) return true;
  return /^wgt_main_[a-z0-9][a-z0-9_-]*$/i.test(value);
}

function isWidgetType(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(value);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const scope = (url.searchParams.get('scope') || 'workspace').trim().toLowerCase();

  const filename = (request.headers.get('x-filename') || '').trim() || 'upload.bin';
  const variant = (request.headers.get('x-variant') || '').trim() || 'original';

  let tokyoBase = '';
  try {
    tokyoBase = resolveTokyoBaseUrl().replace(/\/$/, '');
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail: messageText } },
      { status: 500, headers: CORS_HEADERS }
    );
  }
  const headers = new Headers();
  if (TOKYO_DEV_JWT) headers.set('authorization', `Bearer ${TOKYO_DEV_JWT}`);

  let tokyoPath = '';
  if (scope === 'workspace') {
    const workspaceId = (request.headers.get('x-workspace-id') || '').trim();
    if (!workspaceId || !isUuid(workspaceId)) {
      return NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } },
        { status: 422, headers: CORS_HEADERS }
      );
    }
    headers.set('x-workspace-id', workspaceId);
    tokyoPath = '/workspace-assets/upload';
  } else if (scope === 'curated') {
    const publicId = (request.headers.get('x-public-id') || '').trim();
    if (!publicId || !isCuratedPublicId(publicId)) {
      return NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } },
        { status: 422, headers: CORS_HEADERS }
      );
    }
    const widgetType = (request.headers.get('x-widget-type') || '').trim().toLowerCase();
    if (!widgetType || !isWidgetType(widgetType)) {
      return NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' } },
        { status: 422, headers: CORS_HEADERS }
      );
    }
    headers.set('x-public-id', publicId);
    headers.set('x-widget-type', widgetType);
    tokyoPath = '/curated-assets/upload';
  } else {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assets.scope.invalid' } },
      { status: 422, headers: CORS_HEADERS }
    );
  }

  try {
    const body = await request.arrayBuffer();
    if (!body || body.byteLength === 0) {
      return NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } },
        { status: 422, headers: CORS_HEADERS }
      );
    }

    const contentType = (request.headers.get('content-type') || '').trim() || 'application/octet-stream';
    headers.set('content-type', contentType);
    headers.set('x-filename', filename);
    headers.set('x-variant', variant);

    const tokyoUrl = `${tokyoBase}${tokyoPath}`;
    const res = await fetch(`${tokyoUrl}?_t=${Date.now()}`, {
      method: 'POST',
      headers,
      body,
    });

    const text = await res.text().catch(() => '');
    if (!res.ok) {
      return NextResponse.json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.assets.uploadFailed',
            detail: text || `tokyo upload failed (HTTP ${res.status})`,
          },
        },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    return new NextResponse(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.assets.uploadFailed', detail: messageText } },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
