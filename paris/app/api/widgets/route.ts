import { NextResponse } from 'next/server';
import { getWidgets } from '@paris/lib/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export async function GET() {
  const widgets = getWidgets();
  return NextResponse.json({ widgets }, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
