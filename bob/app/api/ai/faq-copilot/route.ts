import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST() {
  return NextResponse.json(
    {
      error: 'GONE',
      message: 'This endpoint has been replaced by /api/ai/widget-copilot.',
    },
    { status: 410 },
  );
}
