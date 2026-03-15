import { NextRequest, NextResponse } from 'next/server';
import { startMinibobHandoff } from '../../../../../lib/minibob-handoff';

export const runtime = 'edge';

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> | null = null;
  try {
    const parsed = (await request.json()) as unknown;
    body = isRecord(parsed) ? parsed : null;
  } catch {
    body = null;
  }

  if (!body) {
    return withNoStore(
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
    );
  }

  const result = await startMinibobHandoff({
    sourcePublicId: typeof body.sourcePublicId === 'string' ? body.sourcePublicId : '',
    widgetType: typeof body.widgetType === 'string' ? body.widgetType : null,
    draftConfig: isRecord(body.draftConfig) ? body.draftConfig : null,
  });
  if (!result.ok) {
    return withNoStore(NextResponse.json({ error: result.error }, { status: result.status }));
  }

  return withNoStore(NextResponse.json(result.value, { status: 201 }));
}
