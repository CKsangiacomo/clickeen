import assert from 'node:assert/strict';
import {
  AccountInstanceTransitionError,
  buildClkLiveEntryCachePurgeFiles,
  createAccountInstanceFromSubmittedSource,
  deleteAccountInstanceTransition,
  publishAccountInstanceTransition,
  saveAccountInstanceTransition,
  unpublishAccountInstanceTransition,
} from '../src/domains/account-instances/operations';
import {
  deleteAccountInstanceTranslatedLocaleValues,
  writeAccountInstanceTranslatedLocaleValues,
} from '../src/domains/account-translations/values';
import { purgePublicServingFiles } from '../src/domains/public-cache';
import { createAccountPageSource } from '../src/domains/pages';

const accountId = 'CLICKEEN';
const instanceId = 'ABCD123456';
const publicPackage = {
  indexHtml: '<!doctype html><html lang="en"><body><div data-ck-widget="cards"></div></body></html>',
  stylesCss: '.cards{}',
  runtimeJs: 'window.__cards = true;',
};

type Stored = { body: string; httpMetadata?: { contentType?: string }; httpEtag: string };

function createEnv(events: string[]) {
  const objects = new Map<string, Stored>();
  let failOnceKey: string | null = null;
  return {
    failOnce(key: string) {
      failOnceKey = key;
    },
    TOKYO_R2: {
      async put(key: string, body: string | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
        if (key === failOnceKey) {
          failOnceKey = null;
          throw new Error('injected_page_currency_write_failure');
        }
        const text = typeof body === 'string' ? body : new TextDecoder().decode(body);
        objects.set(key, { body: text, httpMetadata: options?.httpMetadata, httpEtag: `etag-${objects.size + 1}` });
        if (key.endsWith('/serve-state.json')) {
          events.push(`state:${String((JSON.parse(text) as { status?: unknown }).status)}`);
        }
        return {};
      },
      async get(key: string) {
        const stored = objects.get(key);
        if (!stored) return null;
        return {
          body: new Response(stored.body).body,
          httpMetadata: stored.httpMetadata,
          httpEtag: stored.httpEtag,
          async text() { return stored.body; },
          async json() { return JSON.parse(stored.body); },
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
        events.push('delete');
      },
    },
    CLOUDFLARE_ZONE_ID: 'zone',
    CLOUDFLARE_CACHE_PURGE_TOKEN: 'token',
    PUBLIC_SERVING_BASE_URL: 'https://dev.clk.live',
  };
}

const events: string[] = [];
const env = createEnv(events) as any;
const purgeBodies: string[][] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  events.push('purge');
  const payload = JSON.parse(String(init?.body || '{}')) as { files?: string[] };
  purgeBodies.push(payload.files ?? []);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}) as typeof fetch;

try {
  await createAccountInstanceFromSubmittedSource({
    env,
    accountId,
    instanceId,
    widgetType: 'cards',
    displayName: 'Cards',
    config: {},
    content: { id: instanceId, accountId, widgetType: 'cards', fields: {}, updatedAt: new Date().toISOString() },
    isTemplate: false,
    baseLocale: 'en',
    publicPackage,
  });

  const pageId = 'PAGE123456';
  const unrelatedPageId = 'PAGE654321';
  const pageFiles = {
    indexHtml: '<!doctype html><html lang="en"><body>Page</body></html>',
    stylesCss: '.page{}',
    runtimeJs: '',
  };
  await createAccountPageSource({
    env,
    accountId,
    pageId,
    source: {
      pageId,
      displayName: 'Cards page',
      isTemplate: false,
      baseLocale: 'en',
      values: { title: 'Cards page' },
      robots: 'index-follow',
      placements: [{ placementId: 'cards', instanceId }],
    },
    files: pageFiles,
    overlaysJson: {},
  });
  await createAccountPageSource({
    env,
    accountId,
    pageId: unrelatedPageId,
    source: {
      pageId: unrelatedPageId,
      displayName: 'Empty page',
      isTemplate: false,
      baseLocale: 'en',
      values: { title: 'Empty page' },
      robots: 'index-follow',
      placements: [],
    },
    files: pageFiles,
    overlaysJson: {},
  });

  await env.TOKYO_R2.put(
    `accounts/${accountId}/instances/${instanceId}/overlays/locales/fr.json`,
    JSON.stringify({ values: {} }),
    { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
  );

  events.length = 0;
  purgeBodies.length = 0;
  await publishAccountInstanceTransition({ env, accountId, instanceId });
  assert.deepEqual(events.slice(0, 2), ['state:published', 'purge']);
  assert.ok(purgeBodies.flat().includes(`https://dev.clk.live/${accountId}/${instanceId}?locale=fr`));

  purgeBodies.length = 0;
  const saveInput = {
    env,
    accountId,
    instanceId,
    submittedWidgetType: 'cards',
    config: { saved: true },
    content: { id: instanceId, accountId, widgetType: 'cards', fields: {}, updatedAt: new Date().toISOString() },
    publicPackage: { ...publicPackage, stylesCss: '.cards{display:block}' },
    displayName: 'Cards',
    isTemplate: false,
    baseLocale: 'en',
    hasDisplayName: true,
  } as const;
  env.failOnce(`accounts/${accountId}/pages/${pageId}/serve-state.json`);
  await assert.rejects(
    saveAccountInstanceTransition(saveInput),
    /injected_page_currency_write_failure/,
    'Instance Save must not report success when a required Page mark fails',
  );
  assert.deepEqual(
    await (await env.TOKYO_R2.get(`accounts/${accountId}/pages/${pageId}/serve-state.json`)).json(),
    { published: false, needsUpdate: false },
  );
  await saveAccountInstanceTransition(saveInput);
  assert.ok(purgeBodies.flat().includes(`https://dev.clk.live/${accountId}/${instanceId}/styles.css`));
  assert.ok(purgeBodies.flat().includes(`https://dev.clk.live/${accountId}/${instanceId}?locale=fr`));
  assert.deepEqual(
    await (await env.TOKYO_R2.get(`accounts/${accountId}/pages/${pageId}/serve-state.json`)).json(),
    { published: false, needsUpdate: true },
    'Instance Save must mark a referencing Page',
  );
  assert.deepEqual(
    await (await env.TOKYO_R2.get(`accounts/${accountId}/pages/${unrelatedPageId}/serve-state.json`)).json(),
    { published: false, needsUpdate: false },
    'Instance Save must not mark an unrelated Page',
  );

  await env.TOKYO_R2.put(
    `accounts/${accountId}/pages/${pageId}/serve-state.json`,
    JSON.stringify({ published: false, needsUpdate: false }),
    { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
  );

  purgeBodies.length = 0;
  env.failOnce(`accounts/${accountId}/pages/${pageId}/serve-state.json`);
  await assert.rejects(
    writeAccountInstanceTranslatedLocaleValues({ env, accountId, instanceId, locale: 'fr', values: {} }),
    (error: unknown) => error instanceof AccountInstanceTransitionError && error.status === 502,
    'translation write must report failure when required Page marking fails',
  );
  purgeBodies.length = 0;
  await writeAccountInstanceTranslatedLocaleValues({ env, accountId, instanceId, locale: 'fr', values: {} });
  assert.deepEqual(purgeBodies.flat().sort(), [
    `https://dev.clk.live/${accountId}/${instanceId}/?locale=fr`,
    `https://dev.clk.live/${accountId}/${instanceId}?locale=fr`,
  ]);
  assert.deepEqual(
    await (await env.TOKYO_R2.get(`accounts/${accountId}/pages/${pageId}/serve-state.json`)).json(),
    { published: false, needsUpdate: true },
    'Instance locale write must mark a referencing Page',
  );

  await env.TOKYO_R2.put(
    `accounts/${accountId}/pages/${pageId}/serve-state.json`,
    JSON.stringify({ published: false, needsUpdate: false }),
    { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
  );
  purgeBodies.length = 0;
  await deleteAccountInstanceTranslatedLocaleValues({ env, accountId, instanceId, locale: 'fr' });
  assert.deepEqual(purgeBodies.flat().sort(), [
    `https://dev.clk.live/${accountId}/${instanceId}/?locale=fr`,
    `https://dev.clk.live/${accountId}/${instanceId}?locale=fr`,
  ]);
  assert.deepEqual(
    await (await env.TOKYO_R2.get(`accounts/${accountId}/pages/${pageId}/serve-state.json`)).json(),
    { published: false, needsUpdate: false },
    'Settings-owned locale deletion changes future generation input and must not mark a Page',
  );

  await env.TOKYO_R2.put(
    `accounts/${accountId}/instances/${instanceId}/overlays/locales/fr.json`,
    JSON.stringify({ values: {} }),
    { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
  );
  events.length = 0;
  await unpublishAccountInstanceTransition({ env, accountId, instanceId });
  assert.ok(events.indexOf('state:unpublished') >= 0);
  assert.ok(events.indexOf('state:unpublished') < events.indexOf('purge'));

  events.length = 0;
  await deleteAccountInstanceTransition({ env, accountId, instanceId });
  assert.ok(events.indexOf('delete') >= 0);
  assert.ok(events.indexOf('delete') < events.indexOf('purge'));

  const manyLocales = Array.from({ length: 28 }, (_, index) => `x-${String(index).padStart(2, '0')}`);
  assert.equal(buildClkLiveEntryCachePurgeFiles({
    publicServingBase: 'https://dev.clk.live',
    accountId,
    instanceId,
    locales: manyLocales,
  }).length, 61);
  purgeBodies.length = 0;
  await purgePublicServingFiles({
    env,
    files: Array.from({ length: 61 }, (_, index) => `https://dev.clk.live/test/${index}`),
  });
  assert.deepEqual(purgeBodies.map((files) => files.length), [30, 30, 1]);

  console.log('Widget public cache lifecycle verification passed.');
} finally {
  globalThis.fetch = originalFetch;
}
