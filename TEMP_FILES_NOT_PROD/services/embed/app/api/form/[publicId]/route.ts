export const runtime = 'edge';

/* PHASE1-GUARD: service-role must not run in Edge. Temporarily blocked for security. */
export async function GET() {
  return new Response('Service unavailable on edge (Phase1 guard)', { status: 503 });
}

export async function POST() {
  return new Response('Service unavailable on edge (Phase1 guard)', { status: 503 });
}
