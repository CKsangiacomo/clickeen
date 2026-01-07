import { NextRequest, NextResponse } from 'next/server';
import { resolveTokyoBaseUrl } from '../../../../lib/env/tokyo';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-workspace-id, x-filename, x-variant',
} as const;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const workspaceId = (request.headers.get('x-workspace-id') || '').trim();
  if (!workspaceId || !isUuid(workspaceId)) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } },
      { status: 422, headers: CORS_HEADERS }
    );
  }

  const filename = (request.headers.get('x-filename') || '').trim() || 'upload.bin';
  const variant = (request.headers.get('x-variant') || '').trim() || 'original';

  const tokyoBase = resolveTokyoBaseUrl().replace(/\/$/, '');
  const tokyoUrl = `${tokyoBase}/workspace-assets/upload`;

  try {
    const body = await request.arrayBuffer();
    if (!body || body.byteLength === 0) {
      return NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } },
        { status: 422, headers: CORS_HEADERS }
      );
    }

    const contentType = (request.headers.get('content-type') || '').trim() || 'application/octet-stream';
    const res = await fetch(`${tokyoUrl}?_t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'content-type': contentType,
        'x-workspace-id': workspaceId,
        'x-filename': filename,
        'x-variant': variant,
      },
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

