import assert from 'node:assert/strict';
import {
  PUBLIC_INDEX_FILE,
  PUBLIC_RUNTIME_FILE,
  PUBLIC_STYLES_FILE,
} from '../src/domains/account-instances/package-file-names';
import {
  writeInstanceLocalePackage,
  writeInstancePublicPackage,
} from '../src/domains/account-instances/package-files';
import { tryHandleClkLiveStaticRoutes } from '../src/routes/clk-live-routes';

type StoredObject = {
  body: string;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
};

const accountId = 'CLICKEEN';
const instanceId = 'ABCD123456';
const sourceUpdatedAt = '2026-06-25T00:00:00.000Z';
const expectedMaterializerContractVersion = 'ck-runtime-materializer:124B';
const basePackage = {
  indexHtml: '<!doctype html><html lang="en"><body>base</body></html>',
  stylesCss: '.base{}',
  runtimeJs: 'window.__locale = "en";',
};
const localePackage = {
  indexHtml: '<!doctype html><html lang="fr"><body>fr</body></html>',
  stylesCss: '.fr{}',
  runtimeJs: 'window.__locale = "fr";',
};

function createEnv() {
  const objects = new Map<string, StoredObject>();
  return {
    objects,
    env: {
      TOKYO_R2: {
        async put(key: string, body: string, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }) {
          objects.set(key, {
            body,
            httpMetadata: options?.httpMetadata,
            customMetadata: options?.customMetadata,
          });
          return {};
        },
        async get(key: string) {
          const object = objects.get(key);
          if (!object) return null;
          return {
            body: new Response(object.body).body,
            httpMetadata: object.httpMetadata,
            customMetadata: object.customMetadata,
            httpEtag: `"${key}"`,
            async text() {
              return object.body;
            },
            async json() {
              return JSON.parse(object.body);
            },
          };
        },
        async delete(keyOrKeys: string | string[]) {
          for (const key of Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys]) objects.delete(key);
        },
        async list() {
          return { objects: [], truncated: false };
        },
      },
    },
  };
}

async function putJson(env: any, key: string, value: unknown): Promise<void> {
  await env.TOKYO_R2.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

async function putPublishedSource(env: any, args: { publishStatus?: 'published' | 'unpublished'; publicPackageFingerprint: string }): Promise<void> {
  await putJson(env, `accounts/${accountId}/instances/${instanceId}/instance.config.json`, {
    id: instanceId,
    accountId,
    widgetCode: 'FAQ',
    widgetType: 'faq',
    displayName: 'FAQ',
    config: {},
    baseLocale: 'en',
    publicPackageFingerprint: args.publicPackageFingerprint,
    createdAt: sourceUpdatedAt,
    updatedAt: sourceUpdatedAt,
  });
  await putJson(env, `accounts/${accountId}/instances/${instanceId}/serve-state.json`, {
    accountId,
    instanceId,
    status: args.publishStatus ?? 'published',
    updatedAt: sourceUpdatedAt,
    ...(args.publishStatus === 'unpublished' ? {} : { publishedAt: sourceUpdatedAt }),
  });
}

async function putBaseAndLocale(env: any): Promise<void> {
  const base = await writeInstancePublicPackage({
    env,
    accountId,
    instanceId,
    publicPackage: basePackage,
  });
  assert.equal(base.ok, true, JSON.stringify(base));
  if (!base.ok) return;
  await putPublishedSource(env, { publicPackageFingerprint: base.fingerprint });
  const locale = await writeInstanceLocalePackage({
    env,
    accountId,
    instanceId,
    baseLocale: 'en',
    locale: 'fr',
    sourceUpdatedAt,
    materializerContractVersion: expectedMaterializerContractVersion,
    publicPackage: localePackage,
  });
  assert.equal(locale.ok, true, JSON.stringify(locale));
}

async function request(pathname: string, env: any, method = 'GET'): Promise<Response | null> {
  const url = new URL(`https://dev.clk.live${pathname}`);
  return tryHandleClkLiveStaticRoutes({
    req: new Request(url, { method }),
    env,
    pathname: url.pathname,
    url,
    respond: (response) => response,
  });
}

async function testBaseAndLocaleStoredBytes(): Promise<void> {
  const { env } = createEnv();
  await putBaseAndLocale(env);

  const base = await request(`/${accountId}/${instanceId}`, env);
  assert.equal(base?.status, 200);
  assert.equal(await base?.text(), basePackage.indexHtml);

  const locale = await request(`/${accountId}/${instanceId}/locales/fr`, env);
  assert.equal(locale?.status, 200);
  assert.equal(await locale?.text(), localePackage.indexHtml);
  assert.equal(locale?.headers.get('cache-control'), 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');

  const runtime = await request(`/${accountId}/${instanceId}/locales/fr/${PUBLIC_RUNTIME_FILE}`, env);
  assert.equal(runtime?.status, 200);
  assert.equal(await runtime?.text(), localePackage.runtimeJs);

  const head = await request(`/${accountId}/${instanceId}/locales/fr/${PUBLIC_STYLES_FILE}`, env, 'HEAD');
  assert.equal(head?.status, 200);
  assert.equal(await head?.text(), '');
  assert.equal(head?.headers.get('content-type'), 'text/css; charset=utf-8');
}

async function testLocaleUnavailableAndNoBaseFallback(): Promise<void> {
  const { env, objects } = createEnv();
  await putBaseAndLocale(env);
  objects.delete(`accounts/${accountId}/instances/${instanceId}/locales/fr/${PUBLIC_INDEX_FILE}`);

  const missing = await request(`/${accountId}/${instanceId}/locales/fr`, env);
  assert.equal(missing?.status, 404);
  assert.equal(await missing?.text(), 'Locale not available');
  assert.equal(missing?.headers.get('cache-control'), 'no-store');
}

async function testLocaleMetadataMismatchFailsClosed(): Promise<void> {
  const { env, objects } = createEnv();
  await putBaseAndLocale(env);
  const runtimeKey = `accounts/${accountId}/instances/${instanceId}/locales/fr/${PUBLIC_RUNTIME_FILE}`;
  const runtime = objects.get(runtimeKey);
  assert.ok(runtime);
  runtime.customMetadata = {
    ...(runtime.customMetadata ?? {}),
    localePackageSourceUpdatedAt: '2026-06-24T00:00:00.000Z',
  };

  const response = await request(`/${accountId}/${instanceId}/locales/fr/${PUBLIC_RUNTIME_FILE}`, env);
  assert.equal(response?.status, 404);
  assert.equal(await response?.text(), 'Locale not available');
}

async function testUnpublishedAndMalformedLocaleRoutes(): Promise<void> {
  const { env } = createEnv();
  const base = await writeInstancePublicPackage({
    env: env as never,
    accountId,
    instanceId,
    publicPackage: basePackage,
  });
  assert.equal(base.ok, true, JSON.stringify(base));
  if (!base.ok) return;
  await putPublishedSource(env, { publishStatus: 'unpublished', publicPackageFingerprint: base.fingerprint });

  const unpublished = await request(`/${accountId}/${instanceId}/locales/fr`, env);
  assert.equal(unpublished?.status, 404);
  assert.equal(await unpublished?.text(), 'Not found');

  assert.equal(await request(`/${accountId}/${instanceId}/locales/fr-CA`, env), null);
  assert.equal(await request(`/${accountId}/${instanceId}/locales/fr/extra.js`, env), null);

  const page = await request(`/${accountId}/pages/PAGE123456`, env);
  assert.equal(page?.status, 404);
  assert.equal(await page?.text(), 'Not found');
}

async function testNoForbiddenServingImports(): Promise<void> {
  const routeSource = await import('node:fs/promises').then((fs) =>
    fs.readFile(new URL('../src/routes/clk-live-routes.ts', import.meta.url), 'utf8'),
  );
  for (const forbidden of [
    'ck-runtime-materializer',
    'materialize',
    'locale-overlay',
    'readlocaleoverlay',
    'translation',
    'supabase',
    'roma/',
    'account-locales',
  ]) {
    assert.equal(routeSource.toLowerCase().includes(forbidden), false, forbidden);
  }
}

const tests: Array<{ name: string; run: () => Promise<void> }> = [
  { name: 'base and locale routes serve stored bytes', run: testBaseAndLocaleStoredBytes },
  { name: 'missing locale artifact is explicit unavailable with no base fallback', run: testLocaleUnavailableAndNoBaseFallback },
  { name: 'locale metadata mismatch fails closed', run: testLocaleMetadataMismatchFailsClosed },
  { name: 'unpublished and malformed locale routes do not serve locale bytes', run: testUnpublishedAndMalformedLocaleRoutes },
  { name: 'clk.live route keeps forbidden serving dependencies out', run: testNoForbiddenServingImports },
];

for (const test of tests) {
  try {
    await test.run();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    console.error(`FAIL ${test.name}`);
    throw error;
  }
}
