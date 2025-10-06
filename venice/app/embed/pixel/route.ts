import { NextResponse } from 'next/server';
import { parisFetch } from '@venice/lib/paris';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const publicId = url.searchParams.get('widget');
  const event = url.searchParams.get('event');
  const ts = url.searchParams.get('ts');

  if (!publicId || !event) {
    return new NextResponse(null, { status: 204 });
  }

  const timestamp = ts ? new Date(Number(ts)).toISOString() : new Date().toISOString();
  const idempotencyKey = `${event}-${publicId}-${timestamp}`;

  await parisFetch('/api/usage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicId,
      event,
      timestamp,
      idempotencyKey,
    }),
    cache: 'no-store',
  }).catch(() => undefined);

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
