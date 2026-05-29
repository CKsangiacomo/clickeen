import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../types.ts';
import { tryHandleInternalInstanceRoutes } from './internal-instance-routes.ts';
import { createInternalRouteTestEnv } from './internal-route-test-utils.test.ts';

const ACCOUNT_ID = 'A1B2C3D4';

async function callInstanceRoute(args: {
  env: Env;
  pathname: string;
  method?: string;
  headers?: HeadersInit;
}): Promise<Response | null> {
  const url = new URL(`https://tokyo.test${args.pathname}`);
  return tryHandleInternalInstanceRoutes({
    req: new Request(url, { method: args.method ?? 'GET', headers: args.headers }),
    env: args.env,
    pathname: url.pathname,
    url,
    respond: (response) => response,
  });
}

test('instance routes own account instance list with devstudio auth unchanged', async () => {
  const { env } = createInternalRouteTestEnv();
  const response = await callInstanceRoute({
    env,
    pathname: `/__internal/accounts/${ACCOUNT_ID}/instances`,
    headers: {
      authorization: 'Bearer test',
      'x-account-id': ACCOUNT_ID,
      'x-ck-internal-service': 'devstudio.local',
    },
  });

  assert.equal(response?.status, 200);
  const payload = await response?.json() as Record<string, unknown>;
  assert.equal(payload.ok, true);
  assert.equal(payload.accountId, ACCOUNT_ID);
  assert.deepEqual(payload.accountInstances, []);
  assert.equal(payload.publishedCount, 0);
});

test('instance routes reject account mismatch before domain operations', async () => {
  const { env } = createInternalRouteTestEnv();
  const response = await callInstanceRoute({
    env,
    pathname: `/__internal/accounts/${ACCOUNT_ID}/instances`,
    headers: {
      authorization: 'Bearer test',
      'x-account-id': 'ZZZZZZZZ',
      'x-ck-internal-service': 'devstudio.local',
    },
  });

  assert.equal(response?.status, 403);
});
