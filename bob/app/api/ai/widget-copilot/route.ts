import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST() {
  return NextResponse.json(
    {
      message: 'Copilot requests must run through Roma. Reopen Builder from Roma and try again.',
    },
    {
      status: 409,
      headers: { 'cache-control': 'no-store' },
    },
  );
}
