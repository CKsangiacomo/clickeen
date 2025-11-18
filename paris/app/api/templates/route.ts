import { NextResponse } from 'next/server';
import { getTemplates } from '@paris/lib/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const widgetType = url.searchParams.get('widgetType') ?? undefined;
  const templates = getTemplates(widgetType ?? undefined);

  return NextResponse.json({ templates }, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
