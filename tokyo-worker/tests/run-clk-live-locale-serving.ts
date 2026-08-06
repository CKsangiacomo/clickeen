import assert from 'node:assert/strict';
import { writeInstancePublicPackage } from '../src/domains/account-instances/package-files';
import { completeLocalizedInstanceHtml } from '../src/domains/account-translations/localized-html';
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
    <link rel="stylesheet" href="/__CK_PUBLIC_ACCOUNT_ID__/__CK_PUBLIC_INSTANCE_ID__/styles.css" />
    <script type="application/ld+json">{"url":"https://clk.live/__CK_PUBLIC_ACCOUNT_ID__/__CK_PUBLIC_INSTANCE_ID__"}</script>
  </head>
  <body>
    <h1 data-ck-field-path="header.title" data-ck-field-target="richtext">English <strong>headline</strong></h1>
    <p data-ck-field-path="header.subtitleHtml" data-ck-field-target="richtext">English subtitle</p>
    <span data-ck-field-path="headerCta.label" data-ck-field-target="text">Read more</span>
    <a class="ck-clickeen-attribution__link" href="https://clickeen.com/">Made with Clickeen — FAQ</a>
    <script src="/__CK_PUBLIC_ACCOUNT_ID__/__CK_PUBLIC_INSTANCE_ID__/runtime.js" defer></script>
  </body>
</html>`,
  stylesCss: '.base{}',
  runtimeJs: 'window.__rootRuntime = true;',
};

const frenchValues = {
  'header.title': 'Titre <strong>français</strong>',
  'header.subtitleHtml': 'Sous-titre français',
  'headerCta.label': 'Lire plus',
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
  args: { publishStatus?: 'published' | 'unpublished' },
): Promise<void> {
  await putJson(env, `accounts/${accountId}/instances/${instanceId}/instance.config.json`, {
    id: instanceId,
    accountId,
    widgetCode: 'FAQ',
    widgetType: 'faq',
    isTemplate: false,
    displayName: 'FAQ',
    config: {},
    baseLocale: 'en',
    createdAt: updatedAt,
    updatedAt,
  });
  await putJson(env, `accounts/${accountId}/instances/${instanceId}/instance.content.json`, {
    id: instanceId,
    accountId,
    widgetType: 'faq',
    fields: {
      'header.title': {
        identityKey: 'faq|header.title|header.title',
        fieldPattern: 'header.title',
        value: 'English <strong>headline</strong>',
        status: 'ok',
      },
      'header.subtitleHtml': {
        identityKey: 'faq|header.subtitleHtml|header.subtitleHtml',
        fieldPattern: 'header.subtitleHtml',
        value: 'English subtitle',
        status: 'ok',
      },
      'headerCta.label': {
        identityKey: 'faq|headerCta.label|headerCta.label',
        fieldPattern: 'headerCta.label',
        value: 'Read more',
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
  await putPublishedSource(env, { publishStatus });
}

async function putOverlay(env: any, locale: string, value: unknown): Promise<void> {
  await putJson(
    env,
    `accounts/${accountId}/instances/${instanceId}/overlays/locales/${locale}.json`,
    value,
  );
}

async function request(
  pathname: string,
  env: any,
  method = 'GET',
  headers?: HeadersInit,
): Promise<Response | null> {
  const url = new URL(`https://dev.clk.live${pathname}`);
  return tryHandleClkLiveStaticRoutes({
    req: new Request(url, { method, headers }),
    env,
    pathname: url.pathname,
    url,
    respond: (response) => response,
  });
}

async function testRootAndTranslatedIndexUseOnePackage(): Promise<void> {
  const { env, objects } = createEnv();
  await putRootAndSource(env);
  await putOverlay(env, 'fr', { values: frenchValues });

  const packageKeys = [...objects.keys()].filter((key) =>
    key.startsWith(`accounts/${accountId}/instances/${instanceId}/`) && !key.endsWith('.json'),
  );
  assert.deepEqual(packageKeys.sort(), [
    `accounts/${accountId}/instances/${instanceId}/index.html`,
    `accounts/${accountId}/instances/${instanceId}/runtime.js`,
    `accounts/${accountId}/instances/${instanceId}/styles.css`,
  ]);
  for (const key of packageKeys) assert.equal(objects.get(key)?.customMetadata, undefined);

  const base = await request(`/${accountId}/${instanceId}`, env);
  assert.equal(base?.status, 200);
  const baseHtml = await base!.text();
  assert.doesNotMatch(baseHtml, /CK_LOCALE_CONTEXT/);
  assert.doesNotMatch(baseHtml, /__CK_PUBLIC_/);
  assert.match(baseHtml, /https:\/\/clk\.live\/CLICKEEN\/ABCD123456/);
  assert.match(baseHtml, /https:\/\/clickeen\.com\//);
  assert.match(baseHtml, /href="\/CLICKEEN\/ABCD123456\/styles\.css"/);
  assert.match(baseHtml, /src="\/CLICKEEN\/ABCD123456\/runtime\.js"/);
  assert.match(baseHtml, /English <strong>headline<\/strong>/);
  assert.equal(base?.headers.get('cache-control'), 'public, max-age=0, s-maxage=300, must-revalidate');

  const translated = await request(`/${accountId}/${instanceId}?locale=fr`, env);
  assert.equal(translated?.status, 200);
  const translatedHtml = await translated!.text();
  assert.match(translatedHtml, /<html lang="fr">/);
  assert.match(translatedHtml, /Titre <strong>français<\/strong>/);
  assert.match(translatedHtml, /Sous-titre français/);
  assert.match(translatedHtml, /Lire plus/);
  assert.doesNotMatch(translatedHtml, /English (?:<strong>headline<\/strong>|subtitle)/);
  assert.doesNotMatch(translatedHtml, /CK_LOCALE_CONTEXT/);
  assert.doesNotMatch(translatedHtml, /__CK_PUBLIC_/);
  assert.match(translatedHtml, /https:\/\/clk\.live\/CLICKEEN\/ABCD123456/);
  assert.match(translatedHtml, /https:\/\/clickeen\.com\//);
  assert.match(translatedHtml, /href="\/CLICKEEN\/ABCD123456\/styles\.css"/);
  assert.match(translatedHtml, /src="\/CLICKEEN\/ABCD123456\/runtime\.js"/);
  assert.doesNotMatch(translatedHtml, /\/locales\//);
  assert.equal(translated?.headers.get('cache-control'), 'public, max-age=0, s-maxage=300, must-revalidate');

  const runtime = await request(`/${accountId}/${instanceId}/runtime.js`, env);
  assert.equal(await runtime?.text(), basePackage.runtimeJs);
  assert.equal(
    [...objects.keys()].some((key) => key.includes(`/instances/${instanceId}/locales/`)),
    false,
  );
}

async function testGlobalProductLinkDoesNotVaryByCountry(): Promise<void> {
  const { env } = createEnv();
  await putRootAndSource(env);
  const us = await request(`/${accountId}/${instanceId}`, env, 'GET', { 'cf-ipcountry': 'US' });
  const it = await request(`/${accountId}/${instanceId}`, env, 'GET', { 'cf-ipcountry': 'IT' });
  assert.equal(us?.status, 200);
  assert.equal(it?.status, 200);
  assert.equal(await us!.text(), await it!.text());
  assert.equal(us?.headers.get('cache-control'), 'public, max-age=0, s-maxage=300, must-revalidate');
}

async function testUnresolvedPublicPlaceholdersFailClosed(): Promise<void> {
  const base = createEnv();
  await putRootAndSource(base.env);
  const baseIndex = base.objects.get(`accounts/${accountId}/instances/${instanceId}/index.html`);
  assert.ok(baseIndex);
  baseIndex.body = baseIndex.body.replace('</body>', '<span>__CK_PUBLIC_PAGE_URL__</span></body>');
  const baseResponse = await request(`/${accountId}/${instanceId}`, base.env);
  assert.equal(baseResponse?.status, 500);
  assert.equal(await baseResponse?.text(), 'Public HTML invalid');
  assert.equal(baseResponse?.headers.get('cache-control'), 'no-store');

  const translated = createEnv();
  await putRootAndSource(translated.env);
  await putOverlay(translated.env, 'fr', { values: frenchValues });
  const translatedIndex = translated.objects.get(`accounts/${accountId}/instances/${instanceId}/index.html`);
  assert.ok(translatedIndex);
  translatedIndex.body = translatedIndex.body.replace('</body>', '<span>__CK_PUBLIC_UNKNOWN__</span></body>');
  const translatedResponse = await request(`/${accountId}/${instanceId}?locale=fr`, translated.env);
  assert.equal(translatedResponse?.status, 500);
  assert.equal(await translatedResponse?.text(), 'Public HTML invalid');
  assert.equal(translatedResponse?.headers.get('cache-control'), 'no-store');
}

async function testMissingAndCorruptPackageFilesFailClosed(): Promise<void> {
  const missing = createEnv();
  await putRootAndSource(missing.env);
  missing.objects.delete(`accounts/${accountId}/instances/${instanceId}/runtime.js`);
  assert.equal((await request(`/${accountId}/${instanceId}`, missing.env))?.status, 404);
  assert.equal((await request(`/${accountId}/${instanceId}/styles.css`, missing.env))?.status, 404);

  const corrupt = createEnv();
  await putRootAndSource(corrupt.env);
  const stylesKey = `accounts/${accountId}/instances/${instanceId}/styles.css`;
  const styles = corrupt.objects.get(stylesKey);
  assert.ok(styles);
  styles.httpMetadata = {};
  assert.equal((await request(`/${accountId}/${instanceId}`, corrupt.env))?.status, 404);
  assert.equal((await request(`/${accountId}/${instanceId}/runtime.js`, corrupt.env))?.status, 404);
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
  await putOverlay(baseOverlay.env, 'en', {
    values: {
      'header.title': 'Masquerading base',
      'header.subtitleHtml': 'Masquerading base',
      'headerCta.label': 'Masquerading base',
    },
  });
  const invalidBaseCoordinate = await request(`/${accountId}/${instanceId}`, baseOverlay.env);
  assert.equal(invalidBaseCoordinate?.status, 500);
  assert.equal(await invalidBaseCoordinate?.text(), 'Locale data invalid');
}

async function testUnsafeRichtextAndMissingMarkersFailClosed(): Promise<void> {
  const unsafe = createEnv();
  await putRootAndSource(unsafe.env);
  await putOverlay(unsafe.env, 'fr', {
    values: {
      ...frenchValues,
      'header.title': 'Titre <script>incorrect</script>',
    },
  });
  const unsafeResponse = await request(`/${accountId}/${instanceId}?locale=fr`, unsafe.env);
  assert.equal(unsafeResponse?.status, 500);
  assert.equal(await unsafeResponse?.text(), 'Locale data invalid');

  const missingMarkers = createEnv();
  await putRootAndSource(missingMarkers.env);
  await putOverlay(missingMarkers.env, 'fr', { values: frenchValues });
  const indexKey = `accounts/${accountId}/instances/${instanceId}/index.html`;
  const storedIndex = missingMarkers.objects.get(indexKey);
  assert.ok(storedIndex);
  storedIndex.body = '<!doctype html><html lang="en"><body>English only</body></html>';
  const markerResponse = await request(`/${accountId}/${instanceId}?locale=fr`, missingMarkers.env);
  assert.equal(markerResponse?.status, 500);
  assert.equal(await markerResponse?.text(), 'Locale data invalid');
}

function testLocalizedHtmlCompletesApprovedTargets(): void {
  const html = `<!doctype html><html lang="en"><body>
    <span data-ck-field-path="label" data-ck-field-target="text">English</span>
    <div data-ck-field-path="copy" data-ck-field-target="richtext">English <strong>copy</strong></div>
    <img src="photo.jpg" alt="English alt" data-ck-field-path="alt" data-ck-field-target="attribute:alt">
    <a href="/" title="English title" data-ck-field-path="title" data-ck-field-target="attribute:title">Link</a>
  </body></html>`;
  const localized = completeLocalizedInstanceHtml({
    html,
    locale: 'fr',
    values: {
      label: 'Café <ouvert>',
      copy: 'Copie <strong>française</strong>',
      alt: 'Photo "française" & détail',
      title: "Titre d'été",
    },
  });
  assert.match(localized, /<html lang="fr">/);
  assert.match(localized, />Café &lt;ouvert&gt;<\/span>/);
  assert.match(localized, />Copie <strong>française<\/strong><\/div>/);
  assert.match(localized, /alt="Photo &quot;française&quot; &amp; détail"/);
  assert.match(localized, /title="Titre d&#39;été"/);
}

async function testUnpublishedMalformedAndRetiredPathsDoNotServe(): Promise<void> {
  const { env } = createEnv();
  await putRootAndSource(env, 'unpublished');
  await putOverlay(env, 'fr', { values: frenchValues });
  assert.equal((await request(`/${accountId}/${instanceId}?locale=fr`, env))?.status, 404);
  assert.equal((await request(`/${accountId}/${instanceId}?locale=FR`, env))?.status, 404);
  assert.equal(await request(`/${accountId}/${instanceId}/locales/fr`, env), null);
  assert.equal(await request(`/${accountId}/${instanceId}/locales/fr/runtime.js`, env), null);
}

async function testHeadAndOtherPublicRoutes(): Promise<void> {
  const { env } = createEnv();
  await putRootAndSource(env);
  await putOverlay(env, 'fr', { values: frenchValues });
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

  await env.TOKYO_R2.put('product/clickeen.js', 'window.__clickeenLoader = true;', {
    httpMetadata: { contentType: 'application/javascript; charset=utf-8' },
  });
  const loaderUrl = new URL('https://dev.clk.live/clickeen.js');
  const loader = await dispatchTokyoRoute({
    req: new Request(loaderUrl),
    env,
    pathname: loaderUrl.pathname,
    url: loaderUrl,
    respond: (response) => response,
  });
  assert.equal(loader.status, 200);
  assert.equal(await loader.text(), 'window.__clickeenLoader = true;');
  assert.equal(loader.headers.get('content-type'), 'application/javascript; charset=utf-8');
  assert.equal(loader.headers.get('access-control-allow-origin'), '*');
  assert.equal(loader.headers.get('x-content-type-options'), 'nosniff');
}

const tests = [
  ['root and translated index use one package', testRootAndTranslatedIndexUseOnePackage],
  ['global product link does not vary by country', testGlobalProductLinkDoesNotVaryByCountry],
  ['unresolved public placeholders fail closed', testUnresolvedPublicPlaceholdersFailClosed],
  ['missing and corrupt package files fail closed', testMissingAndCorruptPackageFilesFailClosed],
  ['missing and corrupt overlay fail closed', testMissingAndCorruptOverlayFailClosed],
  ['unsafe richtext and missing markers fail closed', testUnsafeRichtextAndMissingMarkersFailClosed],
  ['localized HTML completes approved targets', testLocalizedHtmlCompletesApprovedTargets],
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
