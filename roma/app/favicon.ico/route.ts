import { NextResponse } from 'next/server';

export function GET() {
  // Roma does not ship a dedicated favicon yet; return 204 to avoid noisy 404s in dev.
  return new NextResponse(null, { status: 204 });
}
