import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../types.ts';
import { attachTestInstanceRegistry } from '../test-utils/instance-registry.ts';
import { tryHandleInternalPageRoutes } from './internal-page-routes.ts';
import { createInternalRouteTestEnv, type StoredObject } from './internal-route-test-utils.test.ts';

const ACCOUNT_ID = 'A1B2C3D4';
const INSTANCE_ID = 'I1B2C3D4E5';
const SECOND_INSTANCE_ID = 'J1B2C3D4E5';
const PAGE_ID = 'P1B2C3D4E5';

function devHeaders(): HeadersInit {
  return {
    authorization: 'Bearer test',
    'x-account-id': ACCOUNT_ID,
    'x-ck-internal-service': 'devstudio.local',
  };
}

function seedInstances(env: Env, instanceIds = [INSTANCE_ID]): void {
  attachTestInstanceRegistry(
    env,
    instanceIds.map((instanceId, index) => ({
      id: instanceId,
      account_id: ACCOUNT_ID,
      widget_type: index === 0 ? 'hero' : 'faq',
      publish_status: 'unpublished',
      translation_status: 'idle',
      created_at: '2026-06-03T00:00:00.000Z',
      edited_at: `2026-06-03T00:00:0${index}.000Z`,
    })),
  );
}

async function callPageRoute(args: {
  env: Env;
  pathname: string;
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
}): Promise<Response | null> {
  const url = new URL(`https://tokyo.test${args.pathname}`);
  return tryHandleInternalPageRoutes({
    req: new Request(url, {
      method: args.method ?? 'GET',
      headers: args.headers ?? devHeaders(),
      ...(args.body !== undefined ? { body: JSON.stringify(args.body) } : {}),
    }),
    env: args.env,
    pathname: url.pathname,
    url,
    respond: (response) => response,
  });
}

function jsonPayload(objects: Map<string, StoredObject>, key: string): unknown {
  const stored = objects.get(key);
  assert.equal(stored?.kind, 'json');
  return stored.payload;
}

function textPayload(objects: Map<string, StoredObject>, key: string): string {
  const stored = objects.get(key);
  assert.equal(stored?.kind, 'bytes');
  return stored?.kind === 'bytes' ? new TextDecoder().decode(stored.body) : '';
}

function pageSource(placements = [{ instanceId: INSTANCE_ID }]) {
  return {
    v: 1,
    id: PAGE_ID,
    head: {
      title: 'Home',
      description: '',
      robots: 'index,follow',
    },
    placements,
  };
}

function pagePackage(label = 'stored page') {
  return {
    v: 1 as const,
    indexHtml: `<!doctype html><html><head><link rel="stylesheet" href="./styles.css"></head><body><main data-ck-page="${PAGE_ID}">${label}</main><script src="./runtime.js" defer></script></body></html>`,
    stylesCss: '.ck-page{display:block}',
    runtimeJs: 'window.CK_WIDGETS = Object.assign({}, window.CK_WIDGETS || {});',
  };
}

function saveBody(source = pageSource(), label?: string) {
  return {
    source,
    pagePackage: pagePackage(label),
  };
}

test('page routes save source and maintain list and reverse placement indexes', async () => {
  const { env, objects } = createInternalRouteTestEnv();
  seedInstances(env);

  const response = await callPageRoute({
    env,
    pathname: `/__internal/pages/${PAGE_ID}`,
    method: 'PUT',
    body: saveBody(),
  });

  assert.equal(response?.status, 200);
  const payload = await response?.json() as Record<string, unknown>;
  assert.equal(payload.ok, true);
  assert.equal(payload.accountId, ACCOUNT_ID);
  assert.equal(payload.pageId, PAGE_ID);

  assert.deepEqual(
    jsonPayload(objects, `accounts/${ACCOUNT_ID}/website/pages/${PAGE_ID}/source.json`),
    pageSource(),
  );
  assert.deepEqual(
    jsonPayload(objects, `accounts/${ACCOUNT_ID}/website/indexes/placements/${INSTANCE_ID}.json`),
    {
      v: 1,
      accountId: ACCOUNT_ID,
      instanceId: INSTANCE_ID,
      pageIds: [PAGE_ID],
      updatedAt: (payload.summary as { updatedAt: string }).updatedAt,
    },
  );
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/website/publishes/${PAGE_ID}/index.html`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/website/publishes/${PAGE_ID}/styles.css`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/website/publishes/${PAGE_ID}/runtime.js`), true);
  assert.equal(
    textPayload(objects, `accounts/${ACCOUNT_ID}/website/publishes/${PAGE_ID}/index.html`),
    pagePackage().indexHtml,
  );

  const listResponse = await callPageRoute({
    env,
    pathname: `/__internal/accounts/${ACCOUNT_ID}/pages`,
  });
  assert.equal(listResponse?.status, 200);
  const listPayload = await listResponse?.json() as Record<string, unknown>;
  assert.equal(Array.isArray(listPayload.pages), true);
  assert.equal((listPayload.pages as Array<{ id: string }>)[0]?.id, PAGE_ID);
});

test('page routes allow the same widget instance in multiple placements', async () => {
  const { env, objects } = createInternalRouteTestEnv();
  seedInstances(env);
  const source = pageSource([
    { instanceId: INSTANCE_ID },
    { instanceId: INSTANCE_ID },
  ]);

  const response = await callPageRoute({
    env,
    pathname: `/__internal/pages/${PAGE_ID}`,
    method: 'PUT',
    body: saveBody(source, 'duplicate placement package'),
  });

  assert.equal(response?.status, 200);
  const payload = await response?.json() as Record<string, unknown>;
  assert.deepEqual(
    jsonPayload(objects, `accounts/${ACCOUNT_ID}/website/pages/${PAGE_ID}/source.json`),
    source,
  );
  assert.deepEqual(
    jsonPayload(objects, `accounts/${ACCOUNT_ID}/website/indexes/placements/${INSTANCE_ID}.json`),
    {
      v: 1,
      accountId: ACCOUNT_ID,
      instanceId: INSTANCE_ID,
      pageIds: [PAGE_ID],
      updatedAt: (payload.summary as { updatedAt: string }).updatedAt,
    },
  );
  assert.equal(
    textPayload(objects, `accounts/${ACCOUNT_ID}/website/publishes/${PAGE_ID}/index.html`),
    pagePackage('duplicate placement package').indexHtml,
  );
});

test('page routes reject placements that are not account instances', async () => {
  const { env } = createInternalRouteTestEnv();

  const response = await callPageRoute({
    env,
    pathname: `/__internal/pages/${PAGE_ID}`,
    method: 'PUT',
    body: saveBody(pageSource()),
  });

  assert.equal(response?.status, 422);
  const payload = await response?.json() as { error?: { reasonKey?: string; paths?: string[] } };
  assert.equal(payload.error?.reasonKey, 'tokyo.errors.page.placementInstanceInvalid');
  assert.deepEqual(payload.error?.paths, ['placements.0.instanceId']);
});

test('page routes update reverse placement indexes without scanning page folders', async () => {
  const { env, objects } = createInternalRouteTestEnv();
  seedInstances(env, [INSTANCE_ID, SECOND_INSTANCE_ID]);

  assert.equal((await callPageRoute({
    env,
    pathname: `/__internal/pages/${PAGE_ID}`,
    method: 'PUT',
    body: saveBody(pageSource([{ instanceId: INSTANCE_ID }]), 'first package'),
  }))?.status, 200);

  const movedSource = pageSource([{ instanceId: SECOND_INSTANCE_ID }]);
  assert.equal((await callPageRoute({
    env,
    pathname: `/__internal/pages/${PAGE_ID}`,
    method: 'PUT',
    body: saveBody(movedSource, 'moved package'),
  }))?.status, 200);

  assert.deepEqual(
    (jsonPayload(objects, `accounts/${ACCOUNT_ID}/website/indexes/placements/${INSTANCE_ID}.json`) as { pageIds: string[] }).pageIds,
    [],
  );
  assert.deepEqual(
    (jsonPayload(objects, `accounts/${ACCOUNT_ID}/website/indexes/placements/${SECOND_INSTANCE_ID}.json`) as { pageIds: string[] }).pageIds,
    [PAGE_ID],
  );
});

test('page routes publish and unpublish through page serve state', async () => {
  const { env, objects } = createInternalRouteTestEnv();
  const purgeCalls: Array<{ url: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).startsWith('https://api.cloudflare.com/')) {
      return originalFetch(input, init);
    }
    purgeCalls.push({ url: String(input), body: String(init?.body ?? '') });
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  env.CLOUDFLARE_ZONE_ID = 'zone-1';
  env.CLOUDFLARE_API_TOKEN = 'token-1';
  env.PUBLIC_SERVING_BASE_URL = 'https://clk.live';
  seedInstances(env);

  try {
    const saveResponse = await callPageRoute({
      env,
      pathname: `/__internal/pages/${PAGE_ID}`,
      method: 'PUT',
      body: saveBody(),
    });
    assert.equal(saveResponse?.status, 200);

    const publishResponse = await callPageRoute({
      env,
      pathname: `/__internal/pages/${PAGE_ID}/publish`,
      method: 'POST',
    });
    assert.equal(publishResponse?.status, 200);
    const publishPayload = await publishResponse?.json() as Record<string, unknown>;
    assert.equal(publishPayload.publishStatus, 'published');
    const publishedState = jsonPayload(objects, `accounts/${ACCOUNT_ID}/website/pages/${PAGE_ID}/serve-state.json`) as {
      accountId: string;
      pageId: string;
      status: string;
      publishedAt: string;
      updatedAt: string;
    };
    assert.equal(publishedState.accountId, ACCOUNT_ID);
    assert.equal(publishedState.pageId, PAGE_ID);
    assert.equal(publishedState.status, 'published');
    assert.equal(typeof publishedState.publishedAt, 'string');
    assert.equal(typeof publishedState.updatedAt, 'string');

    const unpublishResponse = await callPageRoute({
      env,
      pathname: `/__internal/pages/${PAGE_ID}/unpublish`,
      method: 'POST',
    });
    assert.equal(unpublishResponse?.status, 200);
    const unpublishPayload = await unpublishResponse?.json() as Record<string, unknown>;
    assert.equal(unpublishPayload.publishStatus, 'unpublished');
    assert.equal(
      (jsonPayload(objects, `accounts/${ACCOUNT_ID}/website/pages/${PAGE_ID}/serve-state.json`) as { status: string }).status,
      'unpublished',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(purgeCalls.length, 2);
  const purgedFiles = purgeCalls.flatMap((call) => {
    const body = JSON.parse(call.body) as { files: string[] };
    return body.files;
  });
  assert.ok(purgedFiles.includes(`https://clk.live/${ACCOUNT_ID}/pages/${PAGE_ID}`));
  assert.ok(purgedFiles.includes(`https://clk.live/${ACCOUNT_ID}/pages/${PAGE_ID}/embed.js`));
});

test('page routes require a submitted page package before saving source', async () => {
  const { env, objects } = createInternalRouteTestEnv();
  seedInstances(env);

  const failedSave = await callPageRoute({
    env,
    pathname: `/__internal/pages/${PAGE_ID}`,
    method: 'PUT',
    body: { source: pageSource() },
  });
  assert.equal(failedSave?.status, 409);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/website/pages/${PAGE_ID}/source.json`), false);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/website/indexes/placements/${INSTANCE_ID}.json`), false);

  const failedPublish = await callPageRoute({
    env,
    pathname: `/__internal/pages/${PAGE_ID}/publish`,
    method: 'POST',
  });
  assert.equal(failedPublish?.status, 404);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/website/pages/${PAGE_ID}/serve-state.json`), false);
});

test('page routes reject publishing an empty page', async () => {
  const { env, objects } = createInternalRouteTestEnv();
  seedInstances(env);

  assert.equal((await callPageRoute({
    env,
    pathname: `/__internal/pages/${PAGE_ID}`,
    method: 'PUT',
    body: saveBody(pageSource([]), 'empty package'),
  }))?.status, 200);

  const publishResponse = await callPageRoute({
    env,
    pathname: `/__internal/pages/${PAGE_ID}/publish`,
    method: 'POST',
  });

  assert.equal(publishResponse?.status, 409);
  const payload = await publishResponse?.json() as { error?: { reasonKey?: string } };
  assert.equal(payload.error?.reasonKey, 'tokyo.errors.page.empty');
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/website/pages/${PAGE_ID}/serve-state.json`), false);
});

test('page routes delete source and clean reverse placement index', async () => {
  const { env, objects } = createInternalRouteTestEnv();
  seedInstances(env);

  assert.equal((await callPageRoute({
    env,
    pathname: `/__internal/pages/${PAGE_ID}`,
    method: 'PUT',
    body: saveBody(),
  }))?.status, 200);

  const response = await callPageRoute({
    env,
    pathname: `/__internal/pages/${PAGE_ID}`,
    method: 'DELETE',
  });

  assert.equal(response?.status, 200);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/website/pages/${PAGE_ID}/source.json`), false);
  assert.deepEqual(
    (jsonPayload(objects, `accounts/${ACCOUNT_ID}/website/indexes/placements/${INSTANCE_ID}.json`) as { pageIds: string[] }).pageIds,
    [],
  );
});
