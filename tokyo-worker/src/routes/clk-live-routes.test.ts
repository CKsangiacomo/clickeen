import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../types.ts';
import { writeInstanceServeState, writeSavedRenderConfig } from '../domains/render/saved-config.ts';
import { attachTestInstanceRegistry } from '../domains/render/test-instance-registry.ts';
import { dispatchTokyoRoute } from '../route-dispatch.ts';
import { tryHandleClkLiveStaticRoutes } from './clk-live-routes.ts';

const ACCOUNT_ID = 'A1B2C3D4';
const INSTANCE_ID = 'Z9Y8X7W6V5';

type StoredObject = {
  body: Uint8Array;
  httpMetadata?: { contentType?: string };
};

function createTestEnv(
  initialObjects: Record<string, string> = {},
  options: { attachRegistry?: boolean } = {},
) {
  const objects = new Map<string, StoredObject>();
  for (const [key, value] of Object.entries(initialObjects)) {
    const ext = key.split('.').pop();
    objects.set(key, {
      body: new TextEncoder().encode(value),
      httpMetadata: ext === 'html'
        ? { contentType: 'text/html; charset=utf-8' }
        : ext === 'css'
          ? { contentType: 'text/css; charset=utf-8' }
          : ext === 'js'
            ? { contentType: 'text/javascript; charset=utf-8' }
            : undefined,
    });
  }
  const env = {
    TOKYO_DEV_JWT: 'test',
    TOKYO_R2: {
      async get(key: string) {
        const stored = objects.get(key);
        if (!stored) return null;
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
      },
      async put(key: string, value: string | Uint8Array | ReadableStream | null, options?: { httpMetadata?: { contentType?: string } }) {
        const text = typeof value === 'string'
          ? value
          : value instanceof Uint8Array
            ? new TextDecoder().decode(value)
            : await new Response(value).text();
        objects.set(key, {
          body: new TextEncoder().encode(text),
          httpMetadata: options?.httpMetadata,
        });
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
    } as unknown as R2Bucket,
  } as Env;
  if (options.attachRegistry !== false) {
    attachTestInstanceRegistry(env);
  }
  return { env, objects };
}

async function seedInstance(args: {
  env: Env;
  publishStatus: 'published' | 'unpublished';
}): Promise<void> {
  await writeSavedRenderConfig({
    env: args.env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    displayName: 'FAQ',
    meta: null,
    config: { question: 'Q1', answer: 'A1' },
  });
  if (args.publishStatus === 'published') {
    await writeInstanceServeState({
      env: args.env,
      accountId: ACCOUNT_ID,
      instanceId: INSTANCE_ID,
      status: 'published',
    });
  }
}

async function callPublicRoute(args: {
  env: Env;
  pathname: string;
  method?: string;
  origin?: string;
}): Promise<Response | null> {
  const origin = args.origin ?? 'https://clk.live';
  const url = new URL(`${origin}${args.pathname}`);
  return tryHandleClkLiveStaticRoutes({
    req: new Request(url, { method: args.method ?? 'GET' }),
    env: args.env,
    pathname: url.pathname.replace(/\/+$/, '') || '/',
    url,
    respond: (response) => response,
  });
}

test('clk.live canonical route serves instance index.html from account storage', async () => {
  const { env } = createTestEnv({
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`]: '<h1>FAQ</h1>',
  });
  await seedInstance({ env, publishStatus: 'published' });

  const response = await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}` });
  assert.equal(response?.status, 200);
  assert.equal(response?.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(await response?.text(), '<h1>FAQ</h1>');
});

test('clk.live serves only allowlisted materialized support files', async () => {
  const { env } = createTestEnv({
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`]: '<h1>FAQ</h1>',
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/styles.css`]: '.faq{}',
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/script.it.js`]: 'console.log("it")',
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/private.txt`]: 'secret',
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.json`]: '{}',
  });
  await seedInstance({ env, publishStatus: 'published' });

  const css = await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}/styles.css` });
  assert.equal(css?.status, 200);
  assert.equal(await css?.text(), '.faq{}');

  const localeScript = await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}/script.it.js` });
  assert.equal(localeScript?.status, 200);
  assert.equal(await localeScript?.text(), 'console.log("it")');

  const privateJson = await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}/instance.json` });
  assert.equal(privateJson, null);

  const unknown = await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}/private.txt` });
  assert.equal(unknown, null);
});

test('clk.live rejects invalid coordinates, directories, and traversal', async () => {
  const { env } = createTestEnv({
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`]: '<h1>FAQ</h1>',
  });
  await seedInstance({ env, publishStatus: 'published' });

  assert.equal(await callPublicRoute({ env, pathname: `/a1b2c3d4/${INSTANCE_ID}` }), null);
  assert.equal(await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/short` }), null);
  assert.equal(await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}/overlays/en.json` }), null);
  assert.equal(await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}/%2e%2e/instance.json` }), null);
});

test('clk.live availability is the materialized public artifact output', async () => {
  const { env } = createTestEnv({
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/styles.css`]: '.faq{}',
  }, { attachRegistry: false });

  const canonical = await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}` });
  assert.equal(canonical?.status, 404);

  const support = await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}/styles.css` });
  assert.equal(support?.status, 200);
  assert.equal(await support?.text(), '.faq{}');
});

test('clk.live supports HEAD for allowed files and redirects canonical http to https', async () => {
  const { env } = createTestEnv({
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`]: '<h1>FAQ</h1>',
  });
  await seedInstance({ env, publishStatus: 'published' });

  const head = await callPublicRoute({ env, method: 'HEAD', pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}` });
  assert.equal(head?.status, 200);
  assert.equal(await head?.text(), '');

  const redirect = await callPublicRoute({
    env,
    pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}`,
    origin: 'http://clk.live',
  });
  assert.equal(redirect?.status, 301);
  assert.equal(redirect?.headers.get('location'), `https://clk.live/${ACCOUNT_ID}/${INSTANCE_ID}`);

  const devRedirect = await callPublicRoute({
    env,
    pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}`,
    origin: 'http://dev.clk.live',
  });
  assert.equal(devRedirect?.status, 301);
  assert.equal(devRedirect?.headers.get('location'), `https://dev.clk.live/${ACCOUNT_ID}/${INSTANCE_ID}`);
});

test('public serving hosts do not expose Tokyo operational routes', async () => {
  const { env } = createTestEnv();
  for (const pathname of ['/healthz', '/__internal/accounts/A1B2C3D4/serving/restore-paid', '/widgets/faq/spec.json']) {
    const url = new URL(`https://dev.clk.live${pathname}`);
    const response = await dispatchTokyoRoute({
      req: new Request(url),
      env,
      pathname: url.pathname.replace(/\/+$/, '') || '/',
      url,
      respond: (nextResponse) => nextResponse,
    });
    assert.equal(response.status, 404, pathname);
  }
});
