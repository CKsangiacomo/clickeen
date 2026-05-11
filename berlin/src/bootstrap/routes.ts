import { json } from '../http';
import { exact, type BerlinRoute } from '../http/routing';
import { buildBootstrapPayload } from './capsule';
import { resolvePrincipalState } from './route-context';
import { type Env } from '../types';

async function handleSessionBootstrap(request: Request, env: Env): Promise<Response> {
  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const payload = await buildBootstrapPayload({
    env,
    state: resolved.state,
    session: resolved.principal.session,
  });
  if (!payload.ok) return payload.response;

  return json(payload.value);
}

export const BOOTSTRAP_ROUTES: BerlinRoute[] = [
  exact('/v1/session/bootstrap', {
    GET: ({ request, env }) => handleSessionBootstrap(request, env),
  }),
];
