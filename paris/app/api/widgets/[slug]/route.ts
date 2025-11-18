import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug ?? 'unknown';
  const widgetJson = {
    widgetName: slug,
    defaults: {},
    metadata: {
      slug,
    },
  };
  return NextResponse.json(widgetJson, {
    headers: { 'Cache-Control': 'public, max-age=60' },
  });
}
