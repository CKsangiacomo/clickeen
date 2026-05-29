import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../types.ts';
import { tryHandleInternalTranslationRoutes } from './internal-translation-routes.ts';
import { createInternalRouteTestEnv } from './internal-route-test-utils.test.ts';

const ACCOUNT_ID = 'A1B2C3D4';
const INSTANCE_ID = 'Z9Y8X7W6V5';

async function callTranslationRoute(args: {
  env: Env;
  pathname: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
}): Promise<Response | null> {
  const url = new URL(`https://tokyo.test${args.pathname}`);
  return tryHandleInternalTranslationRoutes({
    req: new Request(url, { method: args.method ?? 'GET', headers: args.headers, body: args.body }),
    env: args.env,
    pathname: url.pathname,
    url,
    respond: (response) => response,
  });
}

test('translation routes keep San Francisco as the completion boundary', async () => {
  const { env } = createInternalRouteTestEnv();

  const forbidden = await callTranslationRoute({
    env,
    pathname: `/__internal/instances/${INSTANCE_ID}/translations/it/complete`,
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-account-id': ACCOUNT_ID,
    },
    body: JSON.stringify({ values: { title: 'Ciao' } }),
  });
  assert.equal(forbidden?.status, 403);

  const invalidPayload = await callTranslationRoute({
    env,
    pathname: `/__internal/instances/${INSTANCE_ID}/translations/it/complete`,
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-account-id': ACCOUNT_ID,
      'x-ck-internal-service': 'sanfrancisco.translation',
    },
    body: JSON.stringify({ values: null }),
  });
  assert.equal(invalidPayload?.status, 422);
});

test('translation route precedence keeps generation summary distinct from locale values', async () => {
  const { env } = createInternalRouteTestEnv();
  const response = await callTranslationRoute({
    env,
    pathname: `/__internal/instances/${INSTANCE_ID}/translations/generation`,
    method: 'POST',
    headers: { 'x-account-id': ACCOUNT_ID },
  });

  assert.equal(response?.status, 405);
});
