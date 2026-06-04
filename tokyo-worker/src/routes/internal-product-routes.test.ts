import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../types.ts';
import { tryHandleInternalProductRoutes } from './internal-product-routes.ts';
import { createInternalRouteTestEnv } from './internal-route-test-utils.test.ts';

const ACCOUNT_ID = 'A1B2C3D4';

async function callInternalRoute(args: {
  env: Env;
  pathname: string;
  method?: string;
  headers?: HeadersInit;
}): Promise<Response | null> {
  const url = new URL(`https://tokyo.test${args.pathname}`);
  return tryHandleInternalProductRoutes({
    req: new Request(url, { method: args.method ?? 'GET', headers: args.headers }),
    env: args.env,
    pathname: url.pathname,
    url,
    respond: (response) => response,
  });
}

test('internal product aggregator delegates known internal route groups', async () => {
  const { env } = createInternalRouteTestEnv();
  const response = await callInternalRoute({
    env,
    pathname: `/__internal/accounts/${ACCOUNT_ID}/instances`,
    headers: {
      authorization: 'Bearer test',
      'x-account-id': ACCOUNT_ID,
      'x-ck-internal-service': 'devstudio.local',
    },
  });

  assert.equal(response?.status, 200);
});

test('internal product aggregator returns null for unknown internal paths', async () => {
  const { env } = createInternalRouteTestEnv();
  const response = await callInternalRoute({
    env,
    pathname: '/__internal/unknown',
  });

  assert.equal(response, null);
});
