import { NextResponse } from 'next/server';
import { parisFetch } from '@venice/lib/paris';

export const runtime = process.env.NODE_ENV === 'development' ? 'nodejs' : 'edge';
export const dynamic = 'force-dynamic';

async function signUsageEvent(args: { publicId: string; tier: string }): Promise<string | null> {
  const secret = (process.env.USAGE_EVENT_HMAC_SECRET || '').trim();
  if (!secret) return null;
  const message = `usage.v1|${args.publicId}|${args.tier}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const publicId = url.searchParams.get('widget');
  const event = url.searchParams.get('event');
  const tier = (url.searchParams.get('tier') || '').trim().toLowerCase();

  if (!publicId || !event || event !== 'view') {
    return new NextResponse(null, { status: 204 });
  }

  const sig = tier ? await signUsageEvent({ publicId, tier }) : null;
  if (!tier || !sig) {
    return new NextResponse(null, { status: 204 });
  }

  await parisFetch('/api/usage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicId,
      event: 'view',
      tier,
      sig,
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
