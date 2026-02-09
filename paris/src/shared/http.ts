export function json(body: unknown, init?: ResponseInit) {
  const status = typeof init?.status === 'number' ? init.status : 200;
  const headers = new Headers(init?.headers);
  if (!headers.has('Access-Control-Allow-Origin')) headers.set('Access-Control-Allow-Origin', '*');
  // Some statuses are not allowed to include a response body in the Fetch/Workers runtime.
  if (status === 101 || status === 204 || status === 205 || status === 304) {
    headers.delete('Content-Type');
    return new Response(null, { ...init, status, headers });
  }

  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, status, headers });
}

export function corsPreflight(req: Request, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has('Access-Control-Allow-Origin')) headers.set('Access-Control-Allow-Origin', '*');

  const reqMethod = req.headers.get('Access-Control-Request-Method') || 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
  const reqHeaders = req.headers.get('Access-Control-Request-Headers') || 'content-type,authorization';

  if (!headers.has('Access-Control-Allow-Methods')) headers.set('Access-Control-Allow-Methods', reqMethod);
  if (!headers.has('Access-Control-Allow-Headers')) headers.set('Access-Control-Allow-Headers', reqHeaders);
  if (!headers.has('Access-Control-Max-Age')) headers.set('Access-Control-Max-Age', '86400');
  if (!headers.has('Vary')) {
    headers.set('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  }

  return json(null, { ...init, status: 204, headers });
}

export async function readJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
