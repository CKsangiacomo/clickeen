import { BerlinAuthTicketDO } from '../auth/ticket-store';
import { AUTH_ROUTES } from '../auth/routes';
import { BerlinAuthConfigError } from '../auth/config';
import { ACCOUNT_MANAGEMENT_ROUTES } from '../account-management/routes';
import { BOOTSTRAP_ROUTES } from '../bootstrap/routes';
import { SESSION_ROUTES } from '../session/routes';
import { authError, internalError, json, methodNotAllowed } from './response';
import { type BerlinRoute } from './routing';
import { type Env } from '../types';

export { BerlinAuthTicketDO };

const BERLIN_ROUTES: BerlinRoute[] = [
  ...SESSION_ROUTES,
  ...AUTH_ROUTES,
  ...ACCOUNT_MANAGEMENT_ROUTES,
  ...BOOTSTRAP_ROUTES,
];

export async function dispatchBerlinRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  for (const route of BERLIN_ROUTES) {
    const match = pathname.match(route.pattern);
    if (!match) continue;
    const handler = route.methods[request.method];
    if (!handler) return methodNotAllowed();
    return await handler({ request, env, match });
  }

  return json({ error: 'NOT_FOUND' }, { status: 404 });
}

export function unexpectedBerlinErrorResponse(error: unknown): Response {
  if (error instanceof BerlinAuthConfigError) {
    return authError(error.reasonKey, 503, error.detail);
  }
  const detail = error instanceof Error ? error.message : String(error);
  return internalError('berlin.errors.unexpected', detail);
}
