import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../types.ts';
import { tryHandleClkLiveStaticRoutes } from './clk-live-routes.ts';

const ACCOUNT_ID = 'A1B2C3D4';
const INSTANCE_ID = 'Z9Y8X7W6V5';

type StoredObject = {
  body: Uint8Array;
  httpMetadata?: { contentType?: string };
};

function createTestEnv(initialObjects: Record<string, string> = {}) {
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
        return {
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(stored.body);
              controller.close();
            },
          }),
          httpMetadata: stored.httpMetadata,
        };
      },
    } as unknown as R2Bucket,
  } as Env;
  return { env, objects };
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

  const response = await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}` });
  assert.equal(response?.status, 200);
  assert.equal(response?.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(await response?.text(), '<h1>FAQ</h1>');
});

test('clk.live serves only allowlisted support files while index.html exists', async () => {
  const { env } = createTestEnv({
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`]: '<h1>FAQ</h1>',
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/styles.css`]: '.faq{}',
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/script.v2.it.js`]: 'console.log("it")',
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/private.txt`]: 'secret',
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.json`]: '{}',
  });

  const css = await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}/styles.css` });
  assert.equal(css?.status, 200);
  assert.equal(await css?.text(), '.faq{}');

  const localeScript = await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}/script.v2.it.js` });
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

  assert.equal(await callPublicRoute({ env, pathname: `/a1b2c3d4/${INSTANCE_ID}` }), null);
  assert.equal(await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/short` }), null);
  assert.equal(await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}/overlays/en.json` }), null);
  assert.equal(await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}/%2e%2e/instance.json` }), null);
});

test('clk.live availability is controlled by index.html physical presence', async () => {
  const { env } = createTestEnv({
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/styles.css`]: '.faq{}',
  });

  const canonical = await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}` });
  assert.equal(canonical?.status, 404);

  const support = await callPublicRoute({ env, pathname: `/${ACCOUNT_ID}/${INSTANCE_ID}/styles.css` });
  assert.equal(support?.status, 404);
});

test('clk.live supports HEAD for allowed files and redirects canonical http to https', async () => {
  const { env } = createTestEnv({
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`]: '<h1>FAQ</h1>',
  });

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
});
