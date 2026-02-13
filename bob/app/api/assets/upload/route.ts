import { NextRequest, NextResponse } from 'next/server';
import { resolveTokyoBaseUrl } from '../../../../lib/env/tokyo';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers':
    'content-type, x-account-id, x-workspace-id, x-public-id, x-widget-type, x-filename, x-variant, x-source',
} as const;

const TOKYO_DEV_JWT = process.env.TOKYO_DEV_JWT;

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
  payload: Record<string, unknown>
): string | null {
  const direct = typeof payload.url === 'string' ? payload.url.trim() : '';
  if (direct) return direct;
  const key =
    typeof payload.key === 'string'
      ? payload.key.trim()
      : typeof payload.relativePath === 'string'
        ? payload.relativePath.trim()
        : '';
  if (!key) return null;
  if (/^https?:\/\//i.test(key)) return key;
  return `${tokyoBase.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`;
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

export async function POST(request: NextRequest) {
  const accountId = (request.headers.get('x-account-id') || '').trim();
  if (!accountId || !isUuid(accountId)) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
      { status: 422, headers: CORS_HEADERS }
    );
  }
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
  headers.set('x-account-id', accountId);

  const workspaceId = (request.headers.get('x-workspace-id') || '').trim();
  if (workspaceId) {
    if (!isUuid(workspaceId)) {
      return NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } },
        { status: 422, headers: CORS_HEADERS }
      );
    }
    headers.set('x-workspace-id', workspaceId);
  }

  const publicId = (request.headers.get('x-public-id') || '').trim();
  if (publicId) {
    if (!isPublicId(publicId)) {
      return NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } },
        { status: 422, headers: CORS_HEADERS }
      );
    }
    headers.set('x-public-id', publicId);
  }

  const widgetType = (request.headers.get('x-widget-type') || '').trim().toLowerCase();
  if (widgetType) {
    if (!isWidgetType(widgetType)) {
      return NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' } },
        { status: 422, headers: CORS_HEADERS }
      );
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
      return NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } },
        { status: 422, headers: CORS_HEADERS }
      );
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
        return NextResponse.json(payload, { status: res.status, headers: CORS_HEADERS });
      }
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

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.assets.uploadFailed',
            detail: 'tokyo upload response missing JSON payload',
          },
        },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    const normalizedUrl = normalizeTokyoUploadUrl(tokyoBase, payload as Record<string, unknown>);
    if (!normalizedUrl) {
      return NextResponse.json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.assets.uploadFailed',
            detail: 'tokyo upload response missing url',
          },
        },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { ...(payload as Record<string, unknown>), url: normalizedUrl },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.assets.uploadFailed', detail: messageText } },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
