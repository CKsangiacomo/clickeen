import assert from 'node:assert/strict';
import {
  isPageLocale,
  parseAccountPageSource,
  parsePageLocaleOverlay,
  parsePageServeState,
  parsePageServingOverlays,
} from '../src/domains/pages/contract';
import {
  createAccountPageSource,
  deleteAccountPageSource,
  markPagesReferencingInstanceNeedsUpdate,
  publishAccountPage,
  readAccountPage,
  saveAccountPageSource,
  unpublishAccountPage,
  writeAccountPageLocaleOverlay,
} from '../src/domains/pages/source';
import { PageOperationError } from '../src/domains/pages/types';

type StoredObject = {
  body: string;
  httpMetadata?: { contentType?: string };
};

const accountId = 'CLICKEEN';
const instanceId = 'QD1G068MX7';
const updatedAt = '2026-08-05T00:00:00.000Z';

function createEnv() {
  const objects = new Map<string, StoredObject>();
  let failOnceKey: string | null = null;
  return {
    objects,
    failOnce(key: string) {
      failOnceKey = key;
    },
    env: {
      TOKYO_R2: {
        async put(key: string, body: string | ArrayBuffer | ArrayBufferView, options?: { httpMetadata?: { contentType?: string } }) {
          if (key === failOnceKey) {
            failOnceKey = null;
            throw new Error('injected_write_failure');
          }
          const text = typeof body === 'string'
            ? body
            : new TextDecoder().decode(body instanceof ArrayBuffer ? body : new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
          objects.set(key, { body: text, httpMetadata: options?.httpMetadata });
          return {};
        },
        async get(key: string) {
          const object = objects.get(key);
          if (!object) return null;
          return {
            body: new Response(object.body).body,
            httpMetadata: object.httpMetadata,
            async text() {
              return object.body;
            },
            async json() {
              return JSON.parse(object.body);
            },
          };
        },
        async list(options?: { prefix?: string }) {
          const prefix = options?.prefix ?? '';
          return {
            objects: [...objects.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
            truncated: false,
          };
        },
        async delete(keys: string | string[]) {
          for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
        },
      },
      CLOUDFLARE_ZONE_ID: 'zone',
      CLOUDFLARE_CACHE_PURGE_TOKEN: 'token',
      PUBLIC_SERVING_BASE_URL: 'https://dev.clk.live',
    } as any,
  };
}

async function putJson(env: any, key: string, value: unknown): Promise<void> {
  await env.TOKYO_R2.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

async function putReferencedInstance(env: any): Promise<void> {
  await putJson(env, `accounts/${accountId}/instances/${instanceId}/instance.config.json`, {
    id: instanceId,
    accountId,
    widgetCode: 'FAQ',
    widgetType: 'faq',
    displayName: 'FAQ',
    config: {},
    baseLocale: 'en',
    createdAt: updatedAt,
    updatedAt,
  });
  await putJson(env, `accounts/${accountId}/instances/${instanceId}/serve-state.json`, {
    accountId,
    instanceId,
    status: 'published',
    publishedAt: updatedAt,
    updatedAt,
  });
}

const source = parseAccountPageSource({
  pageId: '7UZXTP3TOI',
  displayName: 'Summer page',
  isTemplate: false,
  baseLocale: 'en',
  values: {
    title: 'Summer',
    description: 'A summer page',
    socialTitle: 'Summer social',
  },
  robots: 'index-follow',
  placements: [{ placementId: 'hero', instanceId: 'QD1G068MX7' }],
});
assert.ok(source && !source.isTemplate);
assert.equal(isPageLocale('fil'), true, 'canonical three-letter Page locales must be accepted');
assert.ok(parseAccountPageSource({ ...source, baseLocale: 'fil' }), 'fil must be accepted as Page baseLocale');
assert.deepEqual(parsePageLocaleOverlay({
  values: {
    title: 'Estate',
    description: 'Una pagina estiva',
    socialTitle: 'Estate social',
  },
}, source), {
  values: {
    title: 'Estate',
    description: 'Una pagina estiva',
    socialTitle: 'Estate social',
  },
});
assert.equal(parsePageLocaleOverlay({ values: { title: 'Estate' } }, source), null, 'required translated fields must not be omitted');
assert.equal(parsePageLocaleOverlay({ values: { title: 'Estate', description: 'Test', socialTitle: 'Test', status: 'done' } }, source), null, 'overlay metadata must fail');
assert.equal(parseAccountPageSource({ ...source, version: 1 }), null, 'legacy Page fields must fail');
assert.equal(parsePageServeState({ published: false }), null, 'missing Page currency must not silently default');
assert.deepEqual(parsePageServeState({ published: false, needsUpdate: false }), { published: false, needsUpdate: false });
assert.equal(parsePageServeState({ published: false, needsUpdate: false, revision: 1 }), null, 'serve-state must remain exact');

const files = {
  indexHtml: '<!doctype html><html><body>Summer</body></html>',
  stylesCss: 'body { color: tomato; }',
  runtimeJs: 'window.__page = true;',
};
const overlaysJson = {
  it: {
    page: {
      title: 'Estate',
      description: 'Una pagina estiva',
      socialTitle: 'Estate social',
    },
    placements: {
      hero: {
        'header.title': 'Estate FAQ',
      },
    },
  },
};
assert.deepEqual(parsePageServingOverlays(overlaysJson, source), overlaysJson);
assert.equal(parsePageServingOverlays({ it: { ...overlaysJson.it, placements: {} } }, source), null, 'serving overlay placement set must be exact');

const purgedFiles: string[] = [];
let failPurgeOnce = false;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body || '{}')) as { files?: string[] };
  purgedFiles.push(...(body.files ?? []));
  if (failPurgeOnce) {
    failPurgeOnce = false;
    return new Response(JSON.stringify({ success: false }), { status: 500 });
  }
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}) as typeof fetch;

const store = createEnv();
await putReferencedInstance(store.env);
const created = await createAccountPageSource({
  env: store.env,
  accountId,
  pageId: source.pageId,
  source,
  files,
  overlaysJson,
});
assert.deepEqual(created, { source, files, overlaysJson, serveState: { published: false, needsUpdate: false } });

const pageRoot = `accounts/${accountId}/pages/${source.pageId}`;
assert.deepEqual(
  [...store.objects.keys()].filter((key) => key.startsWith(`${pageRoot}/`)).sort(),
  [
    `${pageRoot}/index.html`,
    `${pageRoot}/overlays.json`,
    `${pageRoot}/runtime.js`,
    `${pageRoot}/serve-state.json`,
    `${pageRoot}/source.json`,
    `${pageRoot}/styles.css`,
  ],
  'ordinary Page create must write only the exact six root artifacts',
);
assert.equal(store.objects.get(`${pageRoot}/index.html`)?.body, files.indexHtml);
assert.equal(store.objects.get(`${pageRoot}/index.html`)?.httpMetadata?.contentType, 'text/html; charset=utf-8');
assert.deepEqual(JSON.parse(store.objects.get(`${pageRoot}/serve-state.json`)?.body ?? 'null'), { published: false, needsUpdate: false });
assert.deepEqual(await readAccountPage({ env: store.env, accountId, pageId: source.pageId }), created);

assert.deepEqual(await publishAccountPage({ env: store.env, accountId, pageId: source.pageId }), { published: true, changed: true });
assert.ok(purgedFiles.includes(`https://dev.clk.live/${accountId}/pages/${source.pageId}/it`));
assert.deepEqual(await publishAccountPage({ env: store.env, accountId, pageId: source.pageId }), { published: true, changed: false });

const savedSource = { ...source, displayName: 'Saved summer page' };
const savedFiles = { ...files, stylesCss: 'body { color: rebeccapurple; }' };
const savedOverlays = {
  de: {
    page: { title: 'Sommer', description: 'Eine Sommerseite', socialTitle: 'Sommer sozial' },
    placements: { hero: { 'header.title': 'Sommer FAQ' } },
  },
};
purgedFiles.length = 0;
const saved = await saveAccountPageSource({
  env: store.env,
  accountId,
  pageId: source.pageId,
  source: savedSource,
  files: savedFiles,
  overlaysJson: savedOverlays,
  operation: 'save',
});
assert.deepEqual(saved, { source: savedSource, files: savedFiles, overlaysJson: savedOverlays, serveState: { published: true, needsUpdate: false } });
assert.ok(purgedFiles.includes(`https://dev.clk.live/${accountId}/pages/${source.pageId}/it`), 'save must purge the removed locale');
assert.ok(purgedFiles.includes(`https://dev.clk.live/${accountId}/pages/${source.pageId}/de`), 'save must purge the new locale');
assert.deepEqual(JSON.parse(store.objects.get(`${pageRoot}/serve-state.json`)?.body ?? 'null'), { published: true, needsUpdate: false }, 'save must preserve Page serving state');

await markPagesReferencingInstanceNeedsUpdate({ env: store.env, accountId, instanceId: 'ZZZZ123456' });
assert.deepEqual(
  JSON.parse(store.objects.get(`${pageRoot}/serve-state.json`)?.body ?? 'null'),
  { published: true, needsUpdate: false },
  'an unrelated Instance must not change Page currency',
);
await markPagesReferencingInstanceNeedsUpdate({ env: store.env, accountId, instanceId });
assert.deepEqual(JSON.parse(store.objects.get(`${pageRoot}/serve-state.json`)?.body ?? 'null'), { published: true, needsUpdate: true });
await assert.rejects(
  publishAccountPage({ env: store.env, accountId, pageId: source.pageId }),
  (error: unknown) => error instanceof PageOperationError && error.reasonKey === 'tokyo.errors.page.needsUpdate',
  'Publish must block while the Page needs Update',
);
await assert.rejects(
  saveAccountPageSource({
    env: store.env,
    accountId,
    pageId: source.pageId,
    source: savedSource,
    files: savedFiles,
    overlaysJson: savedOverlays,
    operation: 'save',
  }),
  (error: unknown) => error instanceof PageOperationError && error.reasonKey === 'tokyo.errors.page.needsUpdate',
  'ordinary Save must block while the Page needs Update',
);
store.failOnce(`${pageRoot}/index.html`);
await assert.rejects(
  saveAccountPageSource({
    env: store.env,
    accountId,
    pageId: source.pageId,
    source: savedSource,
    files: savedFiles,
    overlaysJson: savedOverlays,
    operation: 'update',
  }),
  /injected_write_failure/,
);
assert.deepEqual(
  JSON.parse(store.objects.get(`${pageRoot}/serve-state.json`)?.body ?? 'null'),
  { published: true, needsUpdate: true },
  'failed Update must retain Needs update',
);
store.failOnce(`${pageRoot}/serve-state.json`);
await assert.rejects(
  saveAccountPageSource({
    env: store.env,
    accountId,
    pageId: source.pageId,
    source: savedSource,
    files: savedFiles,
    overlaysJson: savedOverlays,
    operation: 'update',
  }),
  /injected_write_failure/,
);
assert.deepEqual(
  JSON.parse(store.objects.get(`${pageRoot}/serve-state.json`)?.body ?? 'null'),
  { published: true, needsUpdate: true },
  'Update must not report Current when clearing the stored flag fails',
);
failPurgeOnce = true;
await assert.rejects(
  saveAccountPageSource({
    env: store.env,
    accountId,
    pageId: source.pageId,
    source: savedSource,
    files: savedFiles,
    overlaysJson: savedOverlays,
    operation: 'update',
  }),
  /purge/i,
);
assert.deepEqual(
  JSON.parse(store.objects.get(`${pageRoot}/serve-state.json`)?.body ?? 'null'),
  { published: true, needsUpdate: true },
  'Update must retain Needs update when required cache purge fails',
);
const updated = await saveAccountPageSource({
  env: store.env,
  accountId,
  pageId: source.pageId,
  source: savedSource,
  files: savedFiles,
  overlaysJson: savedOverlays,
  operation: 'update',
});
assert.deepEqual(updated.serveState, { published: true, needsUpdate: false });
assert.deepEqual(JSON.parse(store.objects.get(`${pageRoot}/serve-state.json`)?.body ?? 'null'), { published: true, needsUpdate: false });
await writeAccountPageLocaleOverlay({
  env: store.env,
  accountId,
  pageId: source.pageId,
  locale: 'it',
  overlay: { values: { title: 'Estate', description: 'Una pagina estiva', socialTitle: 'Estate social' } },
});
assert.deepEqual(
  JSON.parse(store.objects.get(`${pageRoot}/serve-state.json`)?.body ?? 'null'),
  { published: true, needsUpdate: false },
  'Page-owned locale edits must not change Page currency',
);
await markPagesReferencingInstanceNeedsUpdate({ env: store.env, accountId, instanceId });
assert.deepEqual(await unpublishAccountPage({ env: store.env, accountId, pageId: source.pageId }), { published: false, changed: true });
assert.deepEqual(
  JSON.parse(store.objects.get(`${pageRoot}/serve-state.json`)?.body ?? 'null'),
  { published: false, needsUpdate: true },
  'Unpublish must preserve Needs update',
);
const updatedWhileUnpublished = await saveAccountPageSource({
  env: store.env,
  accountId,
  pageId: source.pageId,
  source: savedSource,
  files: savedFiles,
  overlaysJson: savedOverlays,
  operation: 'update',
});
assert.deepEqual(updatedWhileUnpublished.serveState, { published: false, needsUpdate: false });
assert.deepEqual(await publishAccountPage({ env: store.env, accountId, pageId: source.pageId }), { published: true, changed: true });

await assert.rejects(
  deleteAccountPageSource({ env: store.env, accountId, pageId: source.pageId }),
  (error: unknown) => error instanceof PageOperationError && error.kind === 'DENY' && error.reasonKey === 'tokyo.errors.page.deletePublished',
);
assert.ok(store.objects.has(`${pageRoot}/source.json`), 'denied delete must retain the Page');
assert.deepEqual(await unpublishAccountPage({ env: store.env, accountId, pageId: source.pageId }), { published: false, changed: true });
assert.deepEqual(await unpublishAccountPage({ env: store.env, accountId, pageId: source.pageId }), { published: false, changed: false });
assert.deepEqual(await deleteAccountPageSource({ env: store.env, accountId, pageId: source.pageId }), { existed: true });
assert.equal([...store.objects.keys()].some((key) => key.startsWith(`${pageRoot}/`)), false);

const emptyPageId = '8UZXTP3TOJ';
const emptySource = { ...source, pageId: emptyPageId, placements: [] };
await createAccountPageSource({
  env: store.env,
  accountId,
  pageId: emptyPageId,
  source: emptySource,
  files: { ...files, stylesCss: '' },
  overlaysJson: {},
});
await assert.rejects(
  publishAccountPage({ env: store.env, accountId, pageId: emptyPageId }),
  (error: unknown) => error instanceof PageOperationError && error.reasonKey === 'tokyo.errors.page.publishInvalid',
);

const retryPageId = '9UZXTP3TOK';
const retrySource = { ...source, pageId: retryPageId };
const retrySourceKey = `accounts/${accountId}/pages/${retryPageId}/source.json`;
store.failOnce(retrySourceKey);
await assert.rejects(
  createAccountPageSource({ env: store.env, accountId, pageId: retryPageId, source: retrySource, files, overlaysJson }),
  /injected_write_failure/,
);
assert.equal(store.objects.has(retrySourceKey), false, 'failed create must not expose source before all other artifacts exist');
await createAccountPageSource({ env: store.env, accountId, pageId: retryPageId, source: retrySource, files, overlaysJson });

store.objects.delete(`accounts/${accountId}/pages/${retryPageId}/runtime.js`);
await assert.rejects(
  readAccountPage({ env: store.env, accountId, pageId: retryPageId }),
  (error: unknown) => error instanceof PageOperationError && error.reasonKey === 'tokyo.errors.page.sourceInvalid',
  'missing runtime truth must be corruption, not absence',
);

console.log('Tokyo Page contract verification passed.');
globalThis.fetch = originalFetch;
