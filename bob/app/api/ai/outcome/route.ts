import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: 'Copilot outcomes must be attached through Roma. Reopen Builder from Roma and try again.',
    },
    {
      status: 409,
      headers: { 'cache-control': 'no-store' },
    },
  );
}
