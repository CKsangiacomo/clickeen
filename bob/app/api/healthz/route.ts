export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(JSON.stringify({ up: true, route: '/bob', ts: Date.now() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Allow Dieter Admin (different origin) to probe this health endpoint without CORS errors
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

