import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(_req: Request) {
  // Instance creation is currently disabled in this workspace snapshot.
  // When reintroduced, creation will be driven by an external widget/preset
  // service (outside Paris) and a workspace-aware flow.
  return NextResponse.json(
    [{ path: 'endpoint', message: 'Instance creation is disabled in this environment' }],
    { status: 422 },
  );
}
