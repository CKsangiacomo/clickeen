import type { CkErrorResponse } from './types';
import { json } from './http';

export function ckError(error: CkErrorResponse['error'], status: number) {
  return json({ error } satisfies CkErrorResponse, { status });
}

export function apiError(code: string, message: string, status: number, detail?: unknown) {
  return json({ error: { code, message, detail } }, { status });
}
