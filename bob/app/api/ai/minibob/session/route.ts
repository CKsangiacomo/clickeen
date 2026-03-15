import { NextResponse } from 'next/server';
import { mintMinibobSessionToken } from '../../../../../lib/ai/minibob';

export const runtime = 'edge';

export async function POST() {
  try {
    const minted = await mintMinibobSessionToken();
    const response = NextResponse.json(minted);
    response.headers.set('cache-control', 'no-store');
    response.headers.set('cdn-cache-control', 'no-store');
    response.headers.set('cloudflare-cdn-cache-control', 'no-store');
    return response;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const response = NextResponse.json({ message: detail || 'Minibob session is unavailable.' }, { status: 503 });
    response.headers.set('cache-control', 'no-store');
    response.headers.set('cdn-cache-control', 'no-store');
    response.headers.set('cloudflare-cdn-cache-control', 'no-store');
    return response;
  }
}
