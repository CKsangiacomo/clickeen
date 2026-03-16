import { HttpError } from './http';
import type { Env } from './types';

export function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s ? s : null;
}

export function assertInternalAuth(request: Request, env: Env): void {
  const expected = asTrimmedString(env.CK_INTERNAL_SERVICE_JWT);
  if (!expected) {
    throw new HttpError(500, {
      code: 'PROVIDER_ERROR',
      provider: 'sanfrancisco',
      message: 'Missing CK_INTERNAL_SERVICE_JWT',
    });
  }
  const auth = asTrimmedString(request.headers.get('Authorization'));
  const [scheme, token] = auth ? auth.split(' ') : [];
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    throw new HttpError(401, { code: 'CAPABILITY_DENIED', message: 'Missing auth token' });
  }
  if (token.trim() !== expected) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: 'Invalid auth token' });
  }
}
