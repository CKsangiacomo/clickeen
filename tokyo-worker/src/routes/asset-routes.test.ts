import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../types.ts';
import { tryHandleAssetRoutes } from './asset-routes.ts';

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
      httpMetadata: ext === 'css'
        ? { contentType: 'text/css; charset=utf-8' }
        : ext === 'js'
          ? { contentType: 'text/javascript; charset=utf-8' }
          : ext === 'svg'
            ? { contentType: 'image/svg+xml; charset=utf-8' }
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

async function callAssetRoute(args: {
  env: Env;
  pathname: string;
  method?: string;
}): Promise<Response | null> {
  const url = new URL(`https://tokyo.clickeen.com${args.pathname}`);
  return tryHandleAssetRoutes({
    req: new Request(url, { method: args.method ?? 'GET' }),
    env: args.env,
    pathname: url.pathname,
    url,
    respond: (response) => response,
  });
}

test('serves deploy-managed Tokyo static files that Prague and Bob depend on', async () => {
  const { env } = createTestEnv({
    'dieter/tokens/tokens.css': ':root{--color-system-black:#000}',
    'product/widgets/faq/spec.json': '{"v":1}',
    'fonts/inter.woff2': 'font',
    'prague/assets/hero.svg': '<svg />',
  });

  const tokens = await callAssetRoute({ env, pathname: '/dieter/tokens/tokens.css' });
  assert.equal(tokens?.status, 200);
  assert.equal(tokens?.headers.get('content-type'), 'text/css; charset=utf-8');
  assert.equal(await tokens?.text(), ':root{--color-system-black:#000}');

  const widgetSpec = await callAssetRoute({ env, pathname: '/widgets/faq/spec.json' });
  assert.equal(widgetSpec?.status, 200);
  assert.equal(widgetSpec?.headers.get('content-type'), 'application/json; charset=utf-8');

  const font = await callAssetRoute({ env, pathname: '/fonts/inter.woff2' });
  assert.equal(font?.status, 200);
  assert.equal(font?.headers.get('content-type'), 'font/woff2');

  const pragueAsset = await callAssetRoute({ env, pathname: '/prague/assets/hero.svg' });
  assert.equal(pragueAsset?.status, 200);
  assert.equal(pragueAsset?.headers.get('content-type'), 'image/svg+xml; charset=utf-8');
});

test('supports HEAD for deploy-managed Tokyo static files', async () => {
  const { env } = createTestEnv({
    'dieter/tokens/tokens.css': ':root{}',
  });

  const response = await callAssetRoute({ env, pathname: '/dieter/tokens/tokens.css', method: 'HEAD' });
  assert.equal(response?.status, 200);
  assert.equal(await response?.text(), '');
});
