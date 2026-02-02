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

export async function readJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
