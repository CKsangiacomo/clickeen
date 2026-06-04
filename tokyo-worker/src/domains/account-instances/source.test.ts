import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../../types.ts';
import {
  publishAccountInstanceTransition,
  saveAccountInstanceTransition,
  unpublishAccountInstanceTransition,
} from './operations.ts';
import { writeInstancePublicPackage } from './package-files.ts';
import {
  listAccountInstances,
  readAccountInstanceContentDocument,
  readAccountInstanceSource,
  renameAccountInstanceDisplay,
  writeAccountInstanceSource,
} from './source.ts';
import {
  readAccountInstanceCurrentTranslatedLocaleValues,
  writeAccountInstanceTranslatedLocaleValues,
} from '../account-translations/values.ts';
import { readInstanceServeState } from './serve-state.ts';
import { attachTestInstanceRegistry } from '../../test-utils/instance-registry.ts';
import { resolveWidgetDefaults } from '../widget-definitions.ts';

const ACCOUNT_ID = 'A1B2C3D4';
const INSTANCE_ID = 'Z9Y8X7W6V5';
const SECOND_INSTANCE_ID = 'Q1W2E3R4T5';

type StoredObject =
  | { kind: 'json'; payload: unknown }
  | { kind: 'bytes'; body: Uint8Array; httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> };

function createJsonObject(payload: unknown) {
  return {
    httpEtag: '"test"',
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
            return { key };
          }
          if (value instanceof Uint8Array) {
            objects.set(key, { kind: 'bytes', body: value, httpMetadata: options.httpMetadata, customMetadata: options.customMetadata });
            return { key };
          }
          if (value instanceof ReadableStream) {
            const response = new Response(value);
            objects.set(key, { kind: 'bytes', body: new Uint8Array(await response.arrayBuffer()), httpMetadata: options.httpMetadata, customMetadata: options.customMetadata });
            return { key };
          }
        }
        const body = typeof value === 'string' ? value : value instanceof Uint8Array ? new TextDecoder().decode(value) : await new Response(value).text();
        objects.set(key, { kind: 'json', payload: JSON.parse(body) });
        return { key };
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
  const registryRows = attachTestInstanceRegistry(env);
  return { env, objects, writes, registryRows };
}

function putText(objects: Map<string, StoredObject>, key: string, body: string, contentType: string): void {
  objects.set(key, {
    kind: 'bytes',
    body: new TextEncoder().encode(body),
    httpMetadata: { contentType },
  });
}

function publicPackage(instanceId = INSTANCE_ID, title = 'FAQ') {
  return {
    v: 1 as const,
    indexHtml: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div data-ck-widget="faq" data-role="root" data-ck-instance-id="${instanceId}">
      <section data-role="faq"><h2>${title}</h2></section>
    </div>
    <script src="./runtime.js" defer></script>
  </body>
</html>`,
    stylesCss: `/* ck-style-module:faq-widget-css */
.ck-faq{}
/* ck-style-module:end */`,
    runtimeJs: `/* ck-runtime-payload:start */
(function () {
  window.CK_WIDGETS = Object.assign({}, window.CK_WIDGETS || {});
  window.CK_WIDGETS["${instanceId}"] = { instanceId: "${instanceId}", state: {} };
})();
/* ck-runtime-payload:end */
/* ck-runtime-module:faq-widget-client-js */
window.__FAQ_CLIENT_INCLUDED__ = true;
/* ck-runtime-module:end */`,
  };
}

async function writePublicPackageForInstance(env: Env, instanceId = INSTANCE_ID): Promise<void> {
  const written = await writeInstancePublicPackage({
    env,
    accountId: ACCOUNT_ID,
    instanceId,
    publicPackage: publicPackage(instanceId),
  });
  assert.equal(written.ok, true);
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
  putText(objects, 'product/widgets/shared/socialShare.css', '.ck-socialShare{}', 'text/css; charset=utf-8');
  putText(objects, 'product/widgets/shared/socialShare.js', 'window.__SOCIAL_SHARE_INCLUDED__ = true;', 'text/javascript; charset=utf-8');
  putText(objects, 'product/widgets/faq/limits.json', JSON.stringify({
    v: 1,
    limits: [
      {
        kind: 'flag',
        key: 'widget.socialShare.enabled',
        path: 'behavior.socialShare.enabled',
        mode: 'boolean',
        deny: true,
        sanitizeTo: false,
        enforce: { load: 'sanitize', ops: 'reject', publish: 'reject' },
      },
    ],
  }), 'application/json; charset=utf-8');
  putText(
    objects,
    'product/widgets/faq/widget.client.js',
    `const root = document.querySelector('[data-ck-widget="faq"]');
const instanceId = root && root.getAttribute('data-ck-instance-id');
window.__FAQ_STATE__ = instanceId && window.CK_WIDGETS && window.CK_WIDGETS[instanceId] ? window.CK_WIDGETS[instanceId].state : null;`,
    'text/javascript; charset=utf-8',
  );
}

function generatedPublicKeys(objects: Map<string, StoredObject>, instanceId = INSTANCE_ID): string[] {
  const root = `accounts/${ACCOUNT_ID}/instances/${instanceId}/`;
  return [...objects.keys()]
    .filter((key) => key.startsWith(root))
    .map((key) => key.slice(root.length))
    .filter((name) => /^(index|[a-z0-9-]+)\.html$/.test(name) || /^styles(?:\.v[1-9][0-9]*)?\.css$/.test(name) || /^script(?:\.[a-z0-9-]+|\.v[1-9][0-9]*(?:\.[a-z0-9-]+)?)?\.js$/.test(name) || name === 'runtime.js')
    .sort();
}

function jsonPayload(objects: Map<string, StoredObject>, key: string): Record<string, unknown> {
  const stored = objects.get(key);
  assert.equal(stored?.kind, 'json');
  return (stored as Extract<StoredObject, { kind: 'json' }>).payload as Record<string, unknown>;
}

test('saved instance writes split source files under the instance folder', async () => {
  const { env, objects, writes } = createTestEnv();

  const created = await writeAccountInstanceSource({
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
  assert.equal(objects.has(instanceKey), false);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/config.json`), false);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.config.json`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.content.json`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/publish.json`), false);
  assert.equal(writes.includes(instanceKey), false);

  const configSource = jsonPayload(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.config.json`);
  assert.deepEqual(configSource.config, { question: 'Q1', answer: 'A1' });
  const contentSource = jsonPayload(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.content.json`);
  assert.deepEqual(contentSource.fields, {});

  const saved = await readAccountInstanceSource({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.deepEqual(saved.value.config, { question: 'Q1', answer: 'A1' });
  assert.equal(Object.prototype.hasOwnProperty.call(saved.value.pointer, 'sourceVersion'), false);
});

test('saved instance source writes FAQ editable text fields as string content', async () => {
  const { env, objects } = createTestEnv();

  await writeAccountInstanceSource({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    displayName: 'FAQ',
    meta: null,
    config: {
      header: { enabled: true, title: 'FAQs', subtitleHtml: { html: 'bad shape' } },
      cta: { label: 42 },
      sections: [
        {
          id: 'general',
          title: ['bad shape'],
          faqs: [{ id: 'pricing', question: 'What does it cost?', answer: { html: 'bad shape' }, defaultOpen: false }],
        },
      ],
    },
  });

  const contentSource = jsonPayload(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.content.json`);
  const fields = contentSource.fields as Record<string, { value: unknown; status: unknown }>;
  assert.equal(fields['header.title']?.value, 'FAQs');
  assert.equal(fields['header.subtitleHtml']?.value, '');
  assert.equal(fields['cta.label']?.value, '');
  assert.equal(fields['sections.0.title']?.value, '');
  assert.equal(fields['sections.0.faqs.0.question']?.value, 'What does it cost?');
  assert.equal(fields['sections.0.faqs.0.answer']?.value, '');

  const configSource = jsonPayload(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.config.json`);
  const sourceConfig = configSource.config as Record<string, unknown>;
  const header = sourceConfig.header as Record<string, unknown>;
  const cta = sourceConfig.cta as Record<string, unknown>;
  const sections = sourceConfig.sections as Array<Record<string, unknown>>;
  const faqs = sections[0]?.faqs as Array<Record<string, unknown>>;
  assert.equal(header.title, undefined);
  assert.equal(header.subtitleHtml, undefined);
  assert.equal(cta.label, undefined);
  assert.equal(sections[0]?.title, undefined);
  assert.equal(faqs[0]?.question, undefined);
  assert.equal(faqs[0]?.answer, undefined);

  const saved = await readAccountInstanceSource({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const savedHeader = saved.value.config.header as Record<string, unknown>;
  const savedCta = saved.value.config.cta as Record<string, unknown>;
  const savedSections = saved.value.config.sections as Array<Record<string, unknown>>;
  const savedFaqs = savedSections[0]?.faqs as Array<Record<string, unknown>>;
  assert.equal(savedHeader.title, 'FAQs');
  assert.equal(savedHeader.subtitleHtml, '');
  assert.equal(savedCta.label, '');
  assert.equal(savedSections[0]?.title, '');
  assert.equal(savedFaqs[0]?.question, 'What does it cost?');
  assert.equal(savedFaqs[0]?.answer, '');
});

test('saved instance source preserves nested repeated translations by identity across reorder', async () => {
  const { env } = createTestEnv();
  const config = resolveWidgetDefaults('logoshowcase');
  assert(config);
  await writeAccountInstanceSource({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'logoshowcase',
    config,
    displayName: 'Logo Showcase',
    meta: null,
  });
  const initialContent = await readAccountInstanceContentDocument({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'logoshowcase',
  });
  assert.equal(initialContent.ok, true);
  await writeAccountInstanceTranslatedLocaleValues({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'logoshowcase',
    locale: 'it',
    values: Object.fromEntries(
      Object.entries(initialContent.ok ? initialContent.value.fields : {}).map(([fieldPath, field]) => [
        fieldPath,
        `${field.value} IT`,
      ]),
    ),
  });

  const reordered = structuredClone(config);
  const strip = (reordered.strips as Array<{ logos: unknown[] }>)[0];
  strip.logos = [strip.logos[1], strip.logos[0], ...strip.logos.slice(2)];
  await writeAccountInstanceSource({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'logoshowcase',
    config: reordered,
    displayName: 'Logo Showcase',
    meta: null,
  });

  const values = await readAccountInstanceCurrentTranslatedLocaleValues({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'logoshowcase',
    locale: 'it',
  });
  assert.equal(values.ok, true);
  assert.equal(values.ok ? values.value.values['strips.0.logos.0.name'] : '', 'BMW IT');
  assert.equal(values.ok ? values.value.values['strips.0.logos.1.name'] : '', 'Audi IT');
});

test('saved instance source removes deleted repeated translations by identity', async () => {
  const { env } = createTestEnv();
  const config = resolveWidgetDefaults('logoshowcase');
  assert(config);
  await writeAccountInstanceSource({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'logoshowcase',
    config,
    displayName: 'Logo Showcase',
    meta: null,
  });
  const initialContent = await readAccountInstanceContentDocument({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'logoshowcase',
  });
  assert.equal(initialContent.ok, true);
  await writeAccountInstanceTranslatedLocaleValues({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'logoshowcase',
    locale: 'it',
    values: Object.fromEntries(
      Object.entries(initialContent.ok ? initialContent.value.fields : {}).map(([fieldPath, field]) => [
        fieldPath,
        `${field.value} IT`,
      ]),
    ),
  });

  const deleted = structuredClone(config);
  const strip = (deleted.strips as Array<{ logos: unknown[] }>)[0];
  strip.logos = strip.logos.slice(1);
  await writeAccountInstanceSource({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'logoshowcase',
    config: deleted,
    displayName: 'Logo Showcase',
    meta: null,
  });

  const values = await readAccountInstanceCurrentTranslatedLocaleValues({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'logoshowcase',
    locale: 'it',
  });
  assert.equal(values.ok, true);
  assert.equal(values.ok ? values.value.values['strips.0.logos.0.name'] : '', 'BMW IT');
  assert.equal(Object.values(values.ok ? values.value.values : {}).includes('Audi IT'), false);
});

test('save updates source, stores submitted package files, and publish gates serving state', async () => {
  const { env, objects } = createTestEnv();
  seedProductSources(objects);
  await writeAccountInstanceSource({
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
    publicPackage: publicPackage(INSTANCE_ID),
    hasDisplayName: false,
    hasMeta: false,
  });
  assert.equal(Object.prototype.hasOwnProperty.call(saved.pointer, 'sourceVersion'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(saved.pointer, 'generation'), false);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/publish.json`), false);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/runtime.js`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/styles.css`), true);
  assert.equal(await readInstanceServeState({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID }), 'unpublished');

  const published = await publishAccountInstanceTransition({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
  });
  assert.equal(published.status, 'published');
  assert.equal(generatedPublicKeys(objects).some((key) => /^script\.v[1-9][0-9]*\.js$/.test(key)), false);
  assert.equal(generatedPublicKeys(objects).some((key) => /^styles\.v[1-9][0-9]*\.css$/.test(key)), false);

  assert.equal(await readInstanceServeState({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID }), 'published');
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.json`), false);
  const savedAfterPublish = await readAccountInstanceSource({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(savedAfterPublish.ok, true);
  if (!savedAfterPublish.ok) return;
  assert.equal(savedAfterPublish.value.pointer.publishStatus, 'published');
  assert.deepEqual(savedAfterPublish.value.config, { question: 'Q2', answer: 'A2' });
});

test('save stores submitted page-composable package bytes without Tokyo rendering widget internals', async () => {
  const { env, objects } = createTestEnv();
  seedProductSources(objects);
  await writeAccountInstanceSource({
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
    config: {
      question: 'Q2',
      answer: 'A2',
      behavior: { socialShare: { enabled: true } },
    },
    publicPackage: {
      ...publicPackage(INSTANCE_ID),
      stylesCss: `${publicPackage(INSTANCE_ID).stylesCss}\n.ck-socialShare{position:absolute}`,
      runtimeJs: `${publicPackage(INSTANCE_ID).runtimeJs}\nwindow.__SOCIAL_SHARE_INCLUDED__ = true;`,
    },
    hasDisplayName: false,
    hasMeta: false,
  });

  assert.equal(saved.ok, true);
  const index = objects.get(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`);
  const styles = objects.get(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/styles.css`);
  const runtime = objects.get(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/runtime.js`);
  assert.equal(index?.kind, 'bytes');
  assert.equal(styles?.kind, 'bytes');
  assert.equal(runtime?.kind, 'bytes');
  assert.doesNotMatch(new TextDecoder().decode(index && index.kind === 'bytes' ? index.body : new Uint8Array()), /product\/widgets/);
  assert.match(new TextDecoder().decode(styles && styles.kind === 'bytes' ? styles.body : new Uint8Array()), /ck-socialShare/);
  assert.match(new TextDecoder().decode(runtime && runtime.kind === 'bytes' ? runtime.body : new Uint8Array()), /SOCIAL_SHARE/);
});

test('product instance list reads registry rows without account index handoff', async () => {
  const { env, objects, registryRows } = createTestEnv();
  registryRows.set(`${ACCOUNT_ID}/${INSTANCE_ID}`, {
    id: INSTANCE_ID,
    account_id: ACCOUNT_ID,
    widget_type: 'faq',
    publish_status: 'unpublished',
    translation_status: 'idle',
    created_at: '2026-01-01T00:00:00.000Z',
    edited_at: '2026-01-01T00:00:00.000Z',
  });
  await writeAccountInstanceSource({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    displayName: 'FAQ',
    meta: null,
    config: { question: 'Q1', answer: 'A1' },
  });
  const instances = await listAccountInstances({ env, accountId: ACCOUNT_ID });

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

test('product instance list does not inspect FAQ content fields', async () => {
  const { env, objects, registryRows } = createTestEnv();
  registryRows.set(`${ACCOUNT_ID}/${INSTANCE_ID}`, {
    id: INSTANCE_ID,
    account_id: ACCOUNT_ID,
    widget_type: 'faq',
    publish_status: 'unpublished',
    translation_status: 'idle',
    created_at: '2026-01-01T00:00:00.000Z',
    edited_at: '2026-01-01T00:00:00.000Z',
  });
  objects.set(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.config.json`, {
    kind: 'json',
      payload: {
        id: INSTANCE_ID,
        accountId: ACCOUNT_ID,
        widgetCode: 'FAQ',
        widgetType: 'faq',
        displayName: 'FAQ with rich subtitle',
      meta: null,
        config: {},
        baseLocale: 'en',
        targetLocales: [],
        publishStatus: 'unpublished',
        createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  });
  objects.set(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.content.json`, {
    kind: 'json',
    payload: {
      id: INSTANCE_ID,
      accountId: ACCOUNT_ID,
      widgetType: 'faq',
      fields: {
        'header.subtitleHtml': {
          value: { html: 'Wrong shape from an old authoring save' },
          status: 'changed',
        },
      },
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  });

  const instances = await listAccountInstances({ env, accountId: ACCOUNT_ID });

  assert.deepEqual(instances, [
    {
      accountId: ACCOUNT_ID,
      instanceId: INSTANCE_ID,
      widgetCode: 'FAQ',
      widgetType: 'faq',
      displayName: 'FAQ with rich subtitle',
      publishStatus: 'unpublished',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
});

test('product instance list ignores legacy instance.json files', async () => {
  const { env, objects } = createTestEnv();
  objects.set(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.json`, {
    kind: 'json',
    payload: {
      v: 1,
      id: INSTANCE_ID,
      accountId: ACCOUNT_ID,
      widgetCode: 'FAQ',
      widgetType: 'faq',
      displayName: 'Compatibility file only',
      meta: null,
      config: {},
      baseLocale: 'en',
      targetLocales: [],
      publishStatus: 'unpublished',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  });

  assert.deepEqual(await listAccountInstances({ env, accountId: ACCOUNT_ID }), []);
});

test('rename updates display state without rewriting content status', async () => {
  const { env, objects } = createTestEnv();
  await writeAccountInstanceSource({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    displayName: 'FAQ',
    meta: null,
    config: { question: 'Q1', answer: 'A1' },
  });

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
  const configAfterRename = jsonPayload(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.config.json`);
  assert.equal(configAfterRename.displayName, 'Renamed FAQ');
  assert.equal(Object.prototype.hasOwnProperty.call(configAfterRename, 'sourceVersion'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(configAfterRename, 'generation'), false);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.json`), false);
  assert.deepEqual(
    jsonPayload(objects, `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.content.json`),
    beforeContent,
  );
});

test('publish and unpublish change serving state without deleting composition package files', async () => {
  const { env, objects } = createTestEnv();
  seedProductSources(objects);
  await writeAccountInstanceSource({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    displayName: 'FAQ',
    meta: null,
    config: { question: 'Q1', answer: 'A1' },
  });
  await writePublicPackageForInstance(env, INSTANCE_ID);

  const published = await publishAccountInstanceTransition({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(published.status, 'published');
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), true);

  const unpublished = await unpublishAccountInstanceTransition({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(unpublished.status, 'unpublished');
  assert.equal(await readInstanceServeState({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID }), 'unpublished');
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/runtime.js`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/styles.css`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html.off`), false);

  const republished = await publishAccountInstanceTransition({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(republished.status, 'published');
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), true);
});
