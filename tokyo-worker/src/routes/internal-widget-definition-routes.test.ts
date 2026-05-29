import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../types.ts';
import { tryHandleInternalWidgetDefinitionRoutes } from './internal-widget-definition-routes.ts';
import { createInternalRouteTestEnv } from './internal-route-test-utils.test.ts';

const ACCOUNT_ID = 'A1B2C3D4';

async function callWidgetDefinitionRoute(args: {
  env: Env;
  pathname: string;
  method?: string;
  headers?: HeadersInit;
}): Promise<Response | null> {
  const url = new URL(`https://tokyo.test${args.pathname}`);
  return tryHandleInternalWidgetDefinitionRoutes({
    req: new Request(url, { method: args.method ?? 'GET', headers: args.headers }),
    env: args.env,
    pathname: url.pathname,
    url,
    respond: (response) => response,
  });
}

test('widget definition routes remain read-only and account scoped', async () => {
  const { env } = createInternalRouteTestEnv();

  const missingAccount = await callWidgetDefinitionRoute({
    env,
    pathname: '/__internal/widgets/definitions',
  });
  assert.equal(missingAccount?.status, 422);

  const wrongMethod = await callWidgetDefinitionRoute({
    env,
    pathname: '/__internal/widgets/definitions',
    method: 'POST',
    headers: { 'x-account-id': ACCOUNT_ID },
  });
  assert.equal(wrongMethod?.status, 405);

  const missingCapsule = await callWidgetDefinitionRoute({
    env,
    pathname: '/__internal/widgets/definitions',
    headers: {
      'x-account-id': ACCOUNT_ID,
      'x-ck-internal-service': 'roma.edge',
    },
  });
  assert.equal(missingCapsule?.status, 403);
});
