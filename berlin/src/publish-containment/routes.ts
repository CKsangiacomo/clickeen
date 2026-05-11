import { json } from '../http';
import { capture, type BerlinRoute } from '../http/routing';
import { resolveAccountRouteContext } from '../bootstrap/route-context';
import { type Env } from '../types';
import { loadAccountPublishContainment } from './account-publish-containment';

async function handleAccountPublishContainment(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const resolved = await resolveAccountRouteContext(request, env, accountIdRaw);
  if (!resolved.ok) return resolved.response;

  const containment = await loadAccountPublishContainment({ env, account: resolved.account });
  if (!containment.ok) return containment.response;

  return json({ accountId: resolved.accountId, containment: containment.value });
}

export const PUBLISH_CONTAINMENT_ROUTES: BerlinRoute[] = [
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/publish-containment$/,
    methods: {
      GET: ({ request, env, match }) => handleAccountPublishContainment(request, env, capture(match, 1)),
    },
  },
];
