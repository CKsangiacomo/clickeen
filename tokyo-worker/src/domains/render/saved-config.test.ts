import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../../types.ts';
import {
  listAccountInstancesBySource,
  publishAccountInstanceTransition,
  readSavedRenderConfig,
  renameAccountInstanceDisplay,
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
  const text = new TextDecoder().decode(stored.body);
  return {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(stored.body);
        controller.close();
      },
    }),
    httpMetadata: stored.httpMetadata,
    customMetadata: stored.customMetadata,
    async text() {
      return text;
    },
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

function jsonPayload(objects: Map<string, StoredObject>, key: string): Record<string, unknown> {
  const stored = objects.get(key);
  assert.equal(stored?.kind, 'json');
  return (stored as Extract<StoredObject, { kind: 'json' }>).payload as Record<string, unknown>;
}

test('saved instance writes split source files under the instance folder', async () => {
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

  assert.equal(Object.prototype.hasOwnProperty.call(created.pointer, 'sourceVersion'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(created.pointer, 'generation'), false);

  const instanceKey = `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.json`;
  assert.equal(objects.has(instanceKey), true);
  const instance = jsonPayload(objects, instanceKey);
  assert.equal(instance.accountPublicId, ACCOUNT_ID);
  assert.equal(Object.prototype.hasOwnProperty.call(instance, 'sourceVersion'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(instance, 'generation'), false);
  assert.equal(instance.baseLocale, 'en');
  assert.deepEqual(instance.targetLocales, []);
  assert.deepEqual(instance.embedBuildShape, {
    rendering: 'html',
    seoMode: 'off',
    locales: ['en'],
    clientSide: 'minimal-js',
  });
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/config.json`), false);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.config.json`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.content.json`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/publish.json`), false);
  assert.equal(writes.includes(instanceKey), true);

  const configSource = jsonPayload(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.config.json`);
  assert.deepEqual(configSource.config, { question: 'Q1', answer: 'A1' });
  const contentSource = jsonPayload(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.content.json`);
  assert.deepEqual(contentSource.fields, {});

  const saved = await readSavedRenderConfig({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.deepEqual(saved.value.config, { question: 'Q1', answer: 'A1' });
  assert.equal(Object.prototype.hasOwnProperty.call(saved.value.pointer, 'sourceVersion'), false);
});

test('save updates source and publish materializes public artifacts without publish.json', async () => {
  const { env, objects } = createTestEnv();
  seedProductSources(objects);
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
  assert.equal(Object.prototype.hasOwnProperty.call(saved.pointer, 'sourceVersion'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(saved.pointer, 'generation'), false);

  const published = await publishAccountInstanceTransition({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
  });
  assert.equal(published.status, 'published');
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/publish.json`), false);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/script.js`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/styles.css`), true);

  const instance = jsonPayload(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.json`);
  assert.equal(instance.publishStatus, 'published');
  assert.deepEqual(instance.config, { question: 'Q2', answer: 'A2' });
});

test('product instance list reads source files without account index handoff', async () => {
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
  objects.delete(`accounts/${ACCOUNT_ID}/instances/index.json`);

  const instances = await listAccountInstancesBySource({ env, accountId: ACCOUNT_ID });

  assert.deepEqual(instances, [
    {
      accountId: ACCOUNT_ID,
      instanceId: INSTANCE_ID,
      widgetCode: 'FAQ',
      widgetType: 'faq',
      displayName: 'FAQ',
      publishStatus: 'unpublished',
      updatedAt: instances[0]?.updatedAt,
    },
  ]);
});

test('rename updates display state without rewriting content status', async () => {
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

  const before = jsonPayload(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.json`);
  const beforeContent = jsonPayload(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.content.json`);
  const renamed = await renameAccountInstanceDisplay({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    displayName: 'Renamed FAQ',
  });

  assert.deepEqual(renamed, {
    instanceId: INSTANCE_ID,
    displayName: 'Renamed FAQ',
    updatedAt: renamed.updatedAt,
  });
  const after = jsonPayload(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.json`);
  assert.equal(after.displayName, 'Renamed FAQ');
  assert.equal(Object.prototype.hasOwnProperty.call(after, 'sourceVersion'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(before, 'sourceVersion'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(after, 'generation'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(before, 'generation'), false);
  assert.deepEqual(
    jsonPayload(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.content.json`),
    beforeContent,
  );
});

test('publish materializes artifacts and unpublish changes state only', async () => {
  const { env, objects } = createTestEnv();
  seedProductSources(objects);
  await writeSavedRenderConfig({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    displayName: 'FAQ',
    meta: null,
    config: { question: 'Q1', answer: 'A1' },
  });

  const published = await publishAccountInstanceTransition({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(published.status, 'published');
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), true);

  const unpublished = await unpublishAccountInstanceTransition({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(unpublished.status, 'unpublished');
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html.off`), false);

  const republished = await publishAccountInstanceTransition({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(republished.status, 'published');
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), true);
});
