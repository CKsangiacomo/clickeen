import assert from 'node:assert/strict';
import { writeInstancePublicPackage } from '../src/domains/account-instances/package-files';
import { dispatchTokyoRoute } from '../src/route-dispatch';
import { tryHandleClkLiveStaticRoutes } from '../src/routes/clk-live-routes';

type StoredObject = {
  body: string;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
};

const accountId = 'CLICKEEN';
const instanceId = 'ABCD123456';
const updatedAt = '2026-06-25T00:00:00.000Z';
const basePackage = {
  indexHtml: `<!doctype html>
<html lang="en">
  <head>
    <script>window.CK_LOCALE_CONTEXT = null;</script>
    <link rel="stylesheet" href="/CLICKEEN/ABCD123456/styles.css" />
  </head>
  <body><h1>English</h1><script src="/CLICKEEN/ABCD123456/runtime.js" defer></script></body>
</html>`,
  stylesCss: '.base{}',
  runtimeJs: 'window.__rootRuntime = true;',
};

function createEnv() {
  const objects = new Map<string, StoredObject>();
  return {
    objects,
    env: {
      TOKYO_R2: {
        async put(
          key: string,
          body: string,
          options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
        ) {
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
            async text() {
              return object.body;
            },
            async json() {
              return JSON.parse(object.body);
            },
          };
        },
        async list(options?: { prefix?: string; cursor?: string }) {
          const prefix = options?.prefix ?? '';
          return {
            objects: [...objects.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
            truncated: false,
          };
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

async function putPublishedSource(
  env: any,
  args: { publishStatus?: 'published' | 'unpublished'; publicPackageFingerprint: string },
): Promise<void> {
  await putJson(env, `accounts/${accountId}/instances/${instanceId}/instance.config.json`, {
    id: instanceId,
    accountId,
    widgetCode: 'FAQ',
    widgetType: 'faq',
    displayName: 'FAQ',
    config: {},
    baseLocale: 'en',
    publicPackageFingerprint: args.publicPackageFingerprint,
    createdAt: updatedAt,
    updatedAt,
  });
  await putJson(env, `accounts/${accountId}/instances/${instanceId}/instance.content.json`, {
    id: instanceId,
    accountId,
    widgetType: 'faq',
    fields: {
      headline: {
        identityKey: 'faq|headline|headline',
        fieldPattern: 'headline',
        value: 'English',
        status: 'ok',
      },
    },
    updatedAt,
  });
  await putJson(env, `accounts/${accountId}/instances/${instanceId}/serve-state.json`, {
    accountId,
    instanceId,
    status: args.publishStatus ?? 'published',
    updatedAt,
    ...(args.publishStatus === 'unpublished' ? {} : { publishedAt: updatedAt }),
  });
}

async function putRootAndSource(env: any, publishStatus: 'published' | 'unpublished' = 'published') {
  const root = await writeInstancePublicPackage({ env, accountId, instanceId, publicPackage: basePackage });
  assert.equal(root.ok, true, JSON.stringify(root));
  if (!root.ok) throw new Error(root.detail);
  await putPublishedSource(env, { publishStatus, publicPackageFingerprint: root.fingerprint });
}

async function putOverlay(env: any, locale: string, value: unknown): Promise<void> {
  await putJson(
    env,
    `accounts/${accountId}/instances/${instanceId}/overlays/locales/${locale}.json`,
    value,
  );
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

async function testRootAndTranslatedIndexUseOnePackage(): Promise<void> {
  const { env, objects } = createEnv();
  await putRootAndSource(env);
  await putOverlay(env, 'fr', { values: { headline: 'Bonjour' } });

  const base = await request(`/${accountId}/${instanceId}`, env);
  assert.equal(base?.status, 200);
  const baseHtml = await base!.text();
  assert.match(baseHtml, /"locale":"en"/);
  assert.match(baseHtml, /"languages":\["en","fr"\]/);
  assert.equal(base?.headers.get('cache-control'), 'no-store');

  const translated = await request(`/${accountId}/${instanceId}?locale=fr`, env);
  assert.equal(translated?.status, 200);
  const translatedHtml = await translated!.text();
  assert.match(translatedHtml, /<html lang="fr">/);
  assert.match(translatedHtml, /"locale":"fr"/);
  assert.match(translatedHtml, /"headline":"Bonjour"/);
  assert.match(translatedHtml, /href="\/CLICKEEN\/ABCD123456\/styles\.css"/);
  assert.match(translatedHtml, /src="\/CLICKEEN\/ABCD123456\/runtime\.js"/);
  assert.doesNotMatch(translatedHtml, /\/locales\//);

  const runtime = await request(`/${accountId}/${instanceId}/runtime.js`, env);
  assert.equal(await runtime?.text(), basePackage.runtimeJs);
  assert.equal(
    [...objects.keys()].some((key) => key.includes(`/instances/${instanceId}/locales/`)),
    false,
  );
}

async function testMissingAndCorruptOverlayFailClosed(): Promise<void> {
  const { env } = createEnv();
  await putRootAndSource(env);

  const missing = await request(`/${accountId}/${instanceId}?locale=fr`, env);
  assert.equal(missing?.status, 404);
  assert.equal(await missing?.text(), 'Locale not available');

  await putOverlay(env, 'fr', { values: {} });
  const corrupt = await request(`/${accountId}/${instanceId}?locale=fr`, env);
  assert.equal(corrupt?.status, 500);
  assert.equal(await corrupt?.text(), 'Locale data invalid');

  const baseOverlay = createEnv();
  await putRootAndSource(baseOverlay.env);
  await putOverlay(baseOverlay.env, 'en', { values: { headline: 'Masquerading base' } });
  const invalidBaseCoordinate = await request(`/${accountId}/${instanceId}`, baseOverlay.env);
  assert.equal(invalidBaseCoordinate?.status, 500);
  assert.equal(await invalidBaseCoordinate?.text(), 'Locale data invalid');
}

async function testUnpublishedMalformedAndRetiredPathsDoNotServe(): Promise<void> {
  const { env } = createEnv();
  await putRootAndSource(env, 'unpublished');
  await putOverlay(env, 'fr', { values: { headline: 'Bonjour' } });
  assert.equal((await request(`/${accountId}/${instanceId}?locale=fr`, env))?.status, 404);
  assert.equal((await request(`/${accountId}/${instanceId}?locale=FR`, env))?.status, 404);
  assert.equal(await request(`/${accountId}/${instanceId}/locales/fr`, env), null);
  assert.equal(await request(`/${accountId}/${instanceId}/locales/fr/runtime.js`, env), null);
}

async function testHeadAndOtherPublicRoutes(): Promise<void> {
  const { env } = createEnv();
  await putRootAndSource(env);
  await putOverlay(env, 'fr', { values: { headline: 'Bonjour' } });
  const head = await request(`/${accountId}/${instanceId}?locale=fr`, env, 'HEAD');
  assert.equal(head?.status, 200);
  assert.equal(await head?.text(), '');
  assert.equal(head?.headers.get('content-type'), 'text/html; charset=utf-8');

  await env.TOKYO_R2.put('dieter/icons/svg/globe.svg', '<svg></svg>', {
    httpMetadata: { contentType: 'image/svg+xml' },
  });
  const url = new URL('https://dev.clk.live/dieter/icons/svg/globe.svg');
  const icon = await dispatchTokyoRoute({
    req: new Request(url),
    env,
    pathname: url.pathname,
    url,
    respond: (response) => response,
  });
  assert.equal(icon.status, 200);
}

const tests = [
  ['root and translated index use one package', testRootAndTranslatedIndexUseOnePackage],
  ['missing and corrupt overlay fail closed', testMissingAndCorruptOverlayFailClosed],
  ['unpublished, malformed, and retired paths do not serve', testUnpublishedMalformedAndRetiredPathsDoNotServe],
  ['HEAD and adjacent public routes', testHeadAndOtherPublicRoutes],
] as const;

for (const [name, run] of tests) {
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
