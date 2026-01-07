export type ErrorBody =
  | { code: 'BAD_REQUEST'; message: string }
  | { code: 'CAPABILITY_DENIED'; message: string }
  | { code: 'PROVIDER_ERROR'; provider: string; message: string };

export class HttpError extends Error {
  status: number;
  error: ErrorBody;
  constructor(status: number, error: ErrorBody) {
    super(error.message);
    this.status = status;
    this.error = error;
  }
}

export function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s ? s : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  });
}

export function noStore(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('cache-control', 'no-store');
  return new Response(res.body, { status: res.status, headers });
}


