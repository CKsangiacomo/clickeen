export default {
  async fetch(req: Request): Promise<Response> {
    const headers = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
    });

    if (req.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'content-type');
      headers.delete('Content-Type');
      return new Response(null, { status: 204, headers });
    }

    const pathname = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    if (pathname === '/api/healthz') {
      if (req.method !== 'GET') {
        return new Response(
          JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.method.notAllowed' } }),
          { status: 405, headers },
        );
      }
      return new Response(JSON.stringify({ up: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.route.notFound' } }), {
      status: 404,
      headers,
    });
  },
};
