import assert from 'node:assert/strict';
import test from 'node:test';
import { INTERNAL_SERVICE_HEADER, TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL } from '../auth.ts';
import type { Env } from '../types.ts';
import {
  handleListAccountAssetMetadata,
  handleResolveAccountAssetMetadata,
  handleUploadAccountAsset,
} from './assets-handlers.ts';

const ACCOUNT_ID = 'A1B2C3D4';

type StoredObject = {
  body: Uint8Array;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
  uploaded: Date;
};

function createTestEnv() {
  const objects = new Map<string, StoredObject>();
  let headCount = 0;
  const env = {
    TOKYO_DEV_JWT: 'test',
    TOKYO_PUBLIC_BASE_URL: 'https://clk.live',
    TOKYO_R2: {
      async put(key: string, value: ArrayBuffer | Uint8Array | string, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }) {
        const body =
          typeof value === 'string'
            ? new TextEncoder().encode(value)
            : value instanceof Uint8Array
              ? value
              : new Uint8Array(value);
        objects.set(key, {
          body,
          httpMetadata: options?.httpMetadata,
          customMetadata: options?.customMetadata,
          uploaded: new Date(),
        });
      },
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
          customMetadata: stored.customMetadata,
          size: stored.body.byteLength,
          uploaded: stored.uploaded,
        };
      },
      async head(key: string) {
        headCount += 1;
        const stored = objects.get(key);
        if (!stored) return null;
        return {
          httpMetadata: stored.httpMetadata,
          customMetadata: stored.customMetadata,
          size: stored.body.byteLength,
          uploaded: stored.uploaded,
        };
      },
      async list({ prefix }: { prefix?: string }) {
        const normalizedPrefix = prefix ?? '';
        return {
          objects: [...objects.entries()]
            .filter(([key]) => key.startsWith(normalizedPrefix))
            .map(([key, stored]) => ({
              key,
              httpMetadata: stored.httpMetadata,
              customMetadata: stored.customMetadata,
              size: stored.body.byteLength,
              uploaded: stored.uploaded,
            })),
          truncated: false,
        };
      },
      async delete(key: string) {
        objects.delete(key);
      },
    } as unknown as R2Bucket,
  } as Env;
  return {
    env,
    objects,
    getHeadCount: () => headCount,
  };
}

function authedRequest(path: string, init?: RequestInit & { filename?: string }): Request {
  const headers = new Headers(init?.headers);
  headers.set(INTERNAL_SERVICE_HEADER, TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL);
  headers.set('authorization', 'Bearer test');
  headers.set('x-account-id', ACCOUNT_ID);
  headers.set('x-source', 'api');
  if (init?.filename) headers.set('x-filename', init.filename);
  return new Request(`https://tokyo.test${path}`, {
    ...init,
    headers,
  });
}

async function jsonBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

test('account asset upload stores safe bytes at a stable account asset ref', async () => {
  const { env, objects } = createTestEnv();
  const first = await handleUploadAccountAsset(
    authedRequest('/__internal/assets/account/upload', {
      method: 'POST',
      filename: 'logo.png',
      headers: { 'content-type': 'image/png' },
      body: new Uint8Array([1, 2, 3]),
    }),
    env,
  );

  assert.equal(first.status, 200);
  assert.equal((await jsonBody(first)).assetRef, 'logo.png');
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/assets/logo.png`), true);

  const second = await handleUploadAccountAsset(
    authedRequest('/__internal/assets/account/upload', {
      method: 'POST',
      filename: 'logo.png',
      headers: { 'content-type': 'image/png' },
      body: new Uint8Array([4, 5]),
    }),
    env,
  );

  assert.equal(second.status, 200);
  assert.equal((await jsonBody(second)).assetRef, 'logo.png');
  assert.equal(objects.get(`accounts/${ACCOUNT_ID}/assets/logo.png`)?.body.byteLength, 2);
});

test('account asset list and resolve share the same account asset truth', async () => {
  const { env, getHeadCount } = createTestEnv();
  await handleUploadAccountAsset(
    authedRequest('/__internal/assets/account/upload', {
      method: 'POST',
      filename: 'hero.jpg',
      headers: { 'content-type': 'image/jpeg' },
      body: new Uint8Array([7, 8, 9]),
    }),
    env,
  );

  const list = await handleListAccountAssetMetadata(authedRequest('/__internal/assets/account/A1B2C3D4', { method: 'GET' }), env, ACCOUNT_ID);
  const listed = await jsonBody(list);
  assert.equal(list.status, 200);
  assert.equal(Array.isArray(listed.assets), true);
  assert.equal((listed.assets as Array<Record<string, unknown>>)[0]?.assetRef, 'hero.jpg');
  assert.equal(getHeadCount(), 1);

  const resolve = await handleResolveAccountAssetMetadata(
    authedRequest('/__internal/assets/account/A1B2C3D4/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assetRefs: ['hero.jpg', 'missing.png'] }),
    }),
    env,
    ACCOUNT_ID,
  );
  const resolved = await jsonBody(resolve);
  assert.equal(resolve.status, 200);
  assert.equal((resolved.assets as Array<Record<string, unknown>>)[0]?.url, 'https://clk.live/assets/account/A1B2C3D4/hero.jpg');
  assert.deepEqual(resolved.missingAssetRefs, ['missing.png']);
});

test('account asset list is a direct metadata list and hides legacy manifest assets', async () => {
  const { env, objects, getHeadCount } = createTestEnv();
  const uploaded = new Date();
  objects.set(`accounts/${ACCOUNT_ID}/assets/logo.png`, {
    body: new Uint8Array([1, 2, 3]),
    httpMetadata: { contentType: 'image/png' },
    customMetadata: {
      filename: 'logo.png',
      originalFilename: 'logo.png',
      source: 'api',
      createdAt: uploaded.toISOString(),
      sizeBytes: '3',
    },
    uploaded,
  });
  objects.set(`accounts/${ACCOUNT_ID}/assets/legacy-asset/manifest.json`, {
    body: new TextEncoder().encode('{}'),
    httpMetadata: { contentType: 'application/json' },
    customMetadata: {},
    uploaded,
  });
  objects.set(`accounts/${ACCOUNT_ID}/assets/legacy-asset/blob/original.jpg`, {
    body: new Uint8Array([4, 5]),
    httpMetadata: { contentType: 'image/jpeg' },
    customMetadata: {},
    uploaded,
  });
  objects.set(`accounts/${ACCOUNT_ID}/assets/folder/hero.jpg`, {
    body: new Uint8Array([6]),
    httpMetadata: { contentType: 'image/jpeg' },
    customMetadata: {},
    uploaded,
  });

  const list = await handleListAccountAssetMetadata(authedRequest('/__internal/assets/account/A1B2C3D4', { method: 'GET' }), env, ACCOUNT_ID);
  const listed = await jsonBody(list);
  assert.equal(list.status, 200);
  assert.deepEqual(
    (listed.assets as Array<Record<string, unknown>>).map((asset) => asset.assetRef),
    ['logo.png'],
  );
  assert.equal(listed.storageBytesUsed, 3);
  assert.equal(getHeadCount(), 0);
});

test('account asset upload rejects unsafe names and scriptable file types', async () => {
  const { env, objects } = createTestEnv();
  const traversal = await handleUploadAccountAsset(
    authedRequest('/__internal/assets/account/upload', {
      method: 'POST',
      filename: '../logo.png',
      headers: { 'content-type': 'image/png' },
      body: new Uint8Array([1]),
    }),
    env,
  );
  assert.equal(traversal.status, 422);

  const scriptable = await handleUploadAccountAsset(
    authedRequest('/__internal/assets/account/upload', {
      method: 'POST',
      filename: 'logo.svg',
      headers: { 'content-type': 'image/svg+xml' },
      body: new Uint8Array([1]),
    }),
    env,
  );
  assert.equal(scriptable.status, 422);
  assert.equal(objects.size, 0);
});
