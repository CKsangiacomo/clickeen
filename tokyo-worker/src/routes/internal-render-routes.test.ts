import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../types.ts';
import {
  writeInstanceServeState,
  writeSavedRenderConfig,
} from '../domains/render/saved-config.ts';
import { attachTestInstanceRegistry } from '../domains/render/test-instance-registry.ts';
import { tryHandleInternalRenderRoutes } from './internal-render-routes.ts';

const ACCOUNT_ID = 'A1B2C3D4';
const INSTANCE_ID = 'Z9Y8X7W6V5';

type StoredObject =
  | { kind: 'json'; payload: unknown }
  | { kind: 'bytes'; body: Uint8Array; httpMetadata?: { contentType?: string } };

function createJsonObject(payload: unknown) {
  return {
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    },
  };
}

function createBytesObject(stored: Extract<StoredObject, { kind: 'bytes' }>) {
  const text = new TextDecoder().decode(stored.body);
  return {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(stored.body);
        controller.close();
      },
    }),
    httpMetadata: stored.httpMetadata,
    async json() {
      return JSON.parse(text) as unknown;
    },
    async text() {
      return text;
    },
  };
}

function createTestEnv() {
  const objects = new Map<string, StoredObject>();
  const env = {
    TOKYO_DEV_JWT: 'test',
    TOKYO_R2: {
      async get(key: string) {
        const stored = objects.get(key);
        if (!stored) return null;
        return stored.kind === 'json' ? createJsonObject(stored.payload) : createBytesObject(stored);
      },
      async put(key: string, value: string | Uint8Array | ReadableStream | null, options?: { httpMetadata?: { contentType?: string } }) {
        const text = typeof value === 'string'
          ? value
          : value instanceof Uint8Array
            ? new TextDecoder().decode(value)
            : await new Response(value).text();
        if (options?.httpMetadata?.contentType && !options.httpMetadata.contentType.includes('json')) {
          objects.set(key, { kind: 'bytes', body: new TextEncoder().encode(text), httpMetadata: options.httpMetadata });
          return;
        }
        objects.set(key, { kind: 'json', payload: JSON.parse(text) });
      },
      async list({ prefix }: { prefix?: string }) {
        const normalizedPrefix = prefix ?? '';
        return {
          objects: [...objects.keys()]
            .filter((key) => key.startsWith(normalizedPrefix))
            .map((key) => ({ key })),
          truncated: false,
        };
      },
      async delete(key: string) {
        objects.delete(key);
      },
    } as unknown as R2Bucket,
  } as Env;
  attachTestInstanceRegistry(env);
  return { env, objects };
}

function putText(objects: Map<string, StoredObject>, key: string, body: string, contentType: string): void {
  objects.set(key, {
    kind: 'bytes',
    body: new TextEncoder().encode(body),
    httpMetadata: { contentType },
  });
}

function seedProductSources(objects: Map<string, StoredObject>): void {
  putText(objects, 'product/widgets/faq/widget.html', `<!doctype html>
<html><head>
<link rel="stylesheet" href="./widget.css" />
</head><body>
<div data-ck-widget="faq" data-role="root">
  <section data-role="faq"></section>
  <script src="./widget.client.js" defer></script>
</div>
</body></html>`, 'text/html; charset=utf-8');
  putText(objects, 'product/widgets/faq/widget.css', '.ck-faq{}', 'text/css; charset=utf-8');
  putText(objects, 'product/widgets/faq/widget.client.js', 'window.__FAQ_STATE__ = window.CK_WIDGET.state;', 'text/javascript; charset=utf-8');
}

async function callInternalRoute(args: {
  env: Env;
  pathname: string;
  method?: string;
  headers?: HeadersInit;
}): Promise<Response | null> {
  const url = new URL(`https://tokyo.test${args.pathname}`);
  return tryHandleInternalRenderRoutes({
    req: new Request(url, { method: args.method ?? 'GET', headers: args.headers }),
    env: args.env,
    pathname: url.pathname,
    url,
    respond: (response) => response,
  });
}

test('restore paid serving route materializes published rows without exposing source mirrors', async () => {
  const { env, objects } = createTestEnv();
  seedProductSources(objects);
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

  const blocked = await callInternalRoute({
    env,
    pathname: `/__internal/accounts/${ACCOUNT_ID}/serving/restore-paid`,
    method: 'POST',
    headers: { 'x-account-id': ACCOUNT_ID },
  });
  assert.equal(blocked?.status, 401);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), false);

  const restored = await callInternalRoute({
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
