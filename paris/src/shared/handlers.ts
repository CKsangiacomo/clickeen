import type { Env } from './types';
import { json } from './http';
import { assertDevAuth } from './auth';

export async function handleHealthz(): Promise<Response> {
  return json({ up: true });
}

export async function handleNotImplemented(req: Request, env: Env, feature: string): Promise<Response> {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;
  return json({ error: 'NOT_IMPLEMENTED', feature }, { status: 501 });
}
