import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../../types.ts';
import {
  publishAccountInstanceTransition,
  readSavedRenderConfig,
  saveAccountInstanceTransition,
  unpublishAccountInstanceTransition,
  writeSavedRenderConfig,
} from './index.ts';

const ACCOUNT_ID = 'A1B2C3D4';
const INSTANCE_ID = 'Z9Y8X7W6V5';

type StoredObject =
  | { kind: 'json'; payload: unknown }
  | { kind: 'bytes'; body: Uint8Array; httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> };

function createJsonObject(payload: unknown) {
  return {
    async json() {
      return payload;
    },
  };
}

function createBytesObject(stored: Extract<StoredObject, { kind: 'bytes' }>) {
  return {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(stored.body);
        controller.close();
      },
    }),
    httpMetadata: stored.httpMetadata,
    customMetadata: stored.customMetadata,
  };
}

function createTestEnv() {
  const objects = new Map<string, StoredObject>();
  const writes: string[] = [];
  const env = {
    TOKYO_DEV_JWT: 'test',
    TOKYO_R2: {
      async get(key: string) {
        const stored = objects.get(key);
        if (!stored) return null;
        return stored.kind === 'json' ? createJsonObject(stored.payload) : createBytesObject(stored);
      },
      async put(key: string, value: string | Uint8Array | ReadableStream | null, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }) {
        writes.push(key);
        if (options?.httpMetadata?.contentType && !options.httpMetadata.contentType.includes('json')) {
          if (typeof value === 'string') {
            objects.set(key, { kind: 'bytes', body: new TextEncoder().encode(value), httpMetadata: options.httpMetadata, customMetadata: options.customMetadata });
            return;
          }
          if (value instanceof Uint8Array) {
            objects.set(key, { kind: 'bytes', body: value, httpMetadata: options.httpMetadata, customMetadata: options.customMetadata });
            return;
          }
          if (value instanceof ReadableStream) {
            const response = new Response(value);
            objects.set(key, { kind: 'bytes', body: new Uint8Array(await response.arrayBuffer()), httpMetadata: options.httpMetadata, customMetadata: options.customMetadata });
            return;
          }
        }
        const body = typeof value === 'string' ? value : value instanceof Uint8Array ? new TextDecoder().decode(value) : await new Response(value).text();
        objects.set(key, { kind: 'json', payload: JSON.parse(body) });
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
  return { env, objects, writes };
}

function putHtml(objects: Map<string, StoredObject>, key: string, body: string): void {
  objects.set(key, {
    kind: 'bytes',
    body: new TextEncoder().encode(body),
    httpMetadata: { contentType: 'text/html; charset=utf-8' },
  });
}

function jsonPayload(objects: Map<string, StoredObject>, key: string): Record<string, unknown> {
  const stored = objects.get(key);
  assert.equal(stored?.kind, 'json');
  return (stored as Extract<StoredObject, { kind: 'json' }>).payload as Record<string, unknown>;
}

test('saved instance writes one source document under the instance folder', async () => {
  const { env, objects, writes } = createTestEnv();

  const created = await writeSavedRenderConfig({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    displayName: 'FAQ',
    meta: { styleName: 'Help' },
    config: { question: 'Q1', answer: 'A1' },
  });

  assert.equal(created.pointer.sourceVersion, 1);
  assert.equal(created.pointer.generation.translations.status, 'queued');
  assert.equal(created.pointer.generation.embed.status, 'queued');

  const instanceKey = `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.json`;
  assert.equal(objects.has(instanceKey), true);
  const instance = jsonPayload(objects, instanceKey);
  assert.equal(instance.accountPublicId, ACCOUNT_ID);
  assert.equal(instance.baseLocale, 'en');
  assert.deepEqual(instance.targetLocales, []);
  assert.deepEqual(instance.embedBuildShape, {
    rendering: 'html',
    seoMode: 'off',
    locales: ['en'],
    clientSide: 'minimal-js',
  });
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/config.json`), false);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/publish.json`), false);
  assert.equal(writes.includes(instanceKey), true);

  const saved = await readSavedRenderConfig({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.deepEqual(saved.value.config, { question: 'Q1', answer: 'A1' });
  assert.equal(saved.value.pointer.sourceVersion, 1);
});

test('save increments sourceVersion and publish does not create publish.json', async () => {
  const { env, objects } = createTestEnv();
  await writeSavedRenderConfig({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    displayName: 'FAQ',
    meta: null,
    config: { question: 'Q1', answer: 'A1' },
  });

  const saved = await saveAccountInstanceTransition({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    submittedWidgetType: 'faq',
    config: { question: 'Q2', answer: 'A2' },
    hasDisplayName: false,
    hasMeta: false,
  });
  assert.equal(saved.pointer.sourceVersion, 2);
  assert.equal(saved.pointer.generation.translations.sourceVersion, 2);
  assert.equal(saved.pointer.generation.embed.sourceVersion, 2);

  putHtml(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`, '<h1>Ready</h1>');
  const published = await publishAccountInstanceTransition({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
  });
  assert.equal(published.status, 'published');
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/publish.json`), false);

  const instance = jsonPayload(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.json`);
  assert.equal(instance.publishStatus, 'published');
  assert.deepEqual(instance.config, { question: 'Q2', answer: 'A2' });
});

test('publish and unpublish use index.html physical presence as availability', async () => {
  const { env, objects } = createTestEnv();
  await writeSavedRenderConfig({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    displayName: 'FAQ',
    meta: null,
    config: { question: 'Q1', answer: 'A1' },
  });

  const missingBuild = await publishAccountInstanceTransition({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
  }).then(
    () => null,
    (error) => error as Error & { status?: number; reasonKey?: string },
  );
  assert.equal(missingBuild?.status, 409);
  assert.equal(missingBuild?.reasonKey, 'coreui.errors.instance.embedNotReady');

  putHtml(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`, '<h1>Ready</h1>');
  const published = await publishAccountInstanceTransition({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(published.status, 'published');
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), true);

  const unpublished = await unpublishAccountInstanceTransition({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(unpublished.status, 'unpublished');
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), false);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html.off`), true);

  const republished = await publishAccountInstanceTransition({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(republished.status, 'published');
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html.off`), false);
});
