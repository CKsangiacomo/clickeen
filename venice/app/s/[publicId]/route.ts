import { NextResponse } from 'next/server';
import { parisFetch } from '@venice/lib/paris';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { publicId: string } }) {
  const forwardedHeaders: HeadersInit = {
    'Content-Type': req.headers.get('content-type') ?? 'application/json',
  };

  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (auth) forwardedHeaders['Authorization'] = auth;
  const embedToken = req.headers.get('x-embed-token') ?? req.headers.get('X-Embed-Token');
  if (embedToken) forwardedHeaders['X-Embed-Token'] = embedToken;

  const body = await req.text();

  const response = await parisFetch(`/api/submit/${encodeURIComponent(params.publicId)}`, {
    method: 'POST',
    headers: forwardedHeaders,
    body,
    cache: 'no-store',
  });

  const resultBody = await response.text();
  const headers = new Headers();
  const contentType = response.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'no-store');

  return new NextResponse(resultBody, {
    status: response.status,
    headers,
  });
}
