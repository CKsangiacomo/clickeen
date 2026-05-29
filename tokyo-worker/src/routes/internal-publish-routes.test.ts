import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../types.ts';
import {
  writeInstanceServeState,
  writeSavedRenderConfig,
} from '../domains/render/saved-config.ts';
import { tryHandleInternalPublishRoutes } from './internal-publish-routes.ts';
import {
  createInternalRouteTestEnv,
  seedFaqProductSources,
} from './internal-route-test-utils.test.ts';

const ACCOUNT_ID = 'A1B2C3D4';
const INSTANCE_ID = 'Z9Y8X7W6V5';

async function callPublishRoute(args: {
  env: Env;
  pathname: string;
  method?: string;
  headers?: HeadersInit;
}): Promise<Response | null> {
  const url = new URL(`https://tokyo.test${args.pathname}`);
  return tryHandleInternalPublishRoutes({
    req: new Request(url, { method: args.method ?? 'GET', headers: args.headers }),
    env: args.env,
    pathname: url.pathname,
    url,
    respond: (response) => response,
  });
}

test('publish routes own restore-paid auth and materialization', async () => {
  const { env, objects } = createInternalRouteTestEnv();
  seedFaqProductSources(objects);
  await writeSavedRenderConfig({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    displayName: 'FAQ',
    config: { header: { title: 'FAQ' } },
    meta: null,
  });
  await writeInstanceServeState({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID, status: 'published' });

  const blocked = await callPublishRoute({
    env,
    pathname: `/__internal/accounts/${ACCOUNT_ID}/serving/restore-paid`,
    method: 'POST',
    headers: { 'x-account-id': ACCOUNT_ID },
  });
  assert.equal(blocked?.status, 401);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), false);

  const restored = await callPublishRoute({
    env,
    pathname: `/__internal/accounts/${ACCOUNT_ID}/serving/restore-paid`,
    method: 'POST',
    headers: {
      authorization: 'Bearer test',
      'x-account-id': ACCOUNT_ID,
      'x-ck-internal-service': 'devstudio.local',
    },
  });
  assert.equal(restored?.status, 200);
  const payload = await restored?.json() as Record<string, unknown>;
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.materializedInstanceIds, [INSTANCE_ID]);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.json`), false);
});
