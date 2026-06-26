import assert from 'node:assert/strict';
import {
  buildClkLiveEntryCachePurgeFiles,
} from '../src/domains/account-instances/operations';
import {
  deleteInstanceLocalePackage,
  writeInstanceLocalePackage,
} from '../src/domains/account-instances/package-files';

type StoredObject = {
  body: string;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
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
            httpMetadata: object.httpMetadata,
            customMetadata: object.customMetadata,
            async text() {
              return object.body;
            },
          };
        },
        async delete(keyOrKeys: string | string[]) {
          for (const key of Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys]) objects.delete(key);
        },
      },
    },
  };
}

async function testLocalePackageWriteMetadataAndDelete(): Promise<void> {
  const { env, objects } = createEnv();
  const result = await writeInstanceLocalePackage({
    env: env as never,
    accountId: 'CLICKEEN',
    instanceId: 'inst_locale_storage',
    baseLocale: 'en',
    locale: 'fr',
    sourceUpdatedAt: '2026-06-25T00:00:00.000Z',
    materializerContractVersion: 'ck-runtime-materializer:124B',
    publicPackage: {
      indexHtml: '<!doctype html><html lang="fr"></html>',
      stylesCss: '.root{}',
      runtimeJs: 'var selectedLocale = "fr";',
    },
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;

  const root = 'accounts/CLICKEEN/instances/inst_locale_storage/locales/fr';
  assert.deepEqual([...objects.keys()].sort(), [
    `${root}/index.html`,
    `${root}/runtime.js`,
    `${root}/styles.css`,
  ].sort());

  const index = objects.get(`${root}/index.html`);
  const styles = objects.get(`${root}/styles.css`);
  const runtime = objects.get(`${root}/runtime.js`);
  assert.equal(index?.httpMetadata?.contentType, 'text/html; charset=utf-8');
  assert.equal(styles?.httpMetadata?.contentType, 'text/css; charset=utf-8');
  assert.equal(runtime?.httpMetadata?.contentType, 'text/javascript; charset=utf-8');
  for (const object of [index, styles, runtime]) {
    assert.equal(object?.customMetadata?.publicPackageFingerprint, result.fingerprint);
    assert.equal(object?.customMetadata?.localePackageAccountPublicId, 'CLICKEEN');
    assert.equal(object?.customMetadata?.localePackageInstanceId, 'inst_locale_storage');
    assert.equal(object?.customMetadata?.localePackageBaseLocale, 'en');
    assert.equal(object?.customMetadata?.localePackageLocale, 'fr');
    assert.equal(object?.customMetadata?.localePackageSourceUpdatedAt, '2026-06-25T00:00:00.000Z');
    assert.equal(object?.customMetadata?.materializerContractVersion, 'ck-runtime-materializer:124B');
  }

  await deleteInstanceLocalePackage({
    env: env as never,
    accountId: 'CLICKEEN',
    instanceId: 'inst_locale_storage',
    locale: 'fr',
  });
  assert.equal(objects.size, 0);
}

async function testBaseLocalePackageWriteRejected(): Promise<void> {
  const { env, objects } = createEnv();
  const result = await writeInstanceLocalePackage({
    env: env as never,
    accountId: 'CLICKEEN',
    instanceId: 'inst_locale_storage',
    baseLocale: 'en',
    locale: 'en',
    sourceUpdatedAt: '2026-06-25T00:00:00.000Z',
    materializerContractVersion: 'ck-runtime-materializer:124B',
    publicPackage: {
      indexHtml: '<!doctype html><html lang="en"></html>',
      stylesCss: '.root{}',
      runtimeJs: 'var selectedLocale = "en";',
    },
  });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) return;
  assert.equal(result.reasonKey, 'artifact.package.locale_base_requested');
  assert.equal(objects.size, 0);
}

function testLocalePurgeFilesIncludeEntryAndSupportFiles(): void {
  const files = buildClkLiveEntryCachePurgeFiles({
    publicServingBase: 'https://dev.clk.live/',
    accountId: 'CLICKEEN',
    instanceId: 'inst_locale_storage',
    locales: ['fr', 'pt-BR'],
  });
  assert.deepEqual(files, [
    'https://dev.clk.live/CLICKEEN/inst_locale_storage',
    'https://dev.clk.live/CLICKEEN/inst_locale_storage/',
    'https://dev.clk.live/CLICKEEN/inst_locale_storage/index.html',
    'https://dev.clk.live/CLICKEEN/inst_locale_storage/styles.css',
    'https://dev.clk.live/CLICKEEN/inst_locale_storage/runtime.js',
    'https://dev.clk.live/CLICKEEN/inst_locale_storage/locales/fr',
    'https://dev.clk.live/CLICKEEN/inst_locale_storage/locales/fr/',
    'https://dev.clk.live/CLICKEEN/inst_locale_storage/locales/fr/index.html',
    'https://dev.clk.live/CLICKEEN/inst_locale_storage/locales/fr/styles.css',
    'https://dev.clk.live/CLICKEEN/inst_locale_storage/locales/fr/runtime.js',
    'https://dev.clk.live/CLICKEEN/inst_locale_storage/locales/pt-BR',
    'https://dev.clk.live/CLICKEEN/inst_locale_storage/locales/pt-BR/',
    'https://dev.clk.live/CLICKEEN/inst_locale_storage/locales/pt-BR/index.html',
    'https://dev.clk.live/CLICKEEN/inst_locale_storage/locales/pt-BR/styles.css',
    'https://dev.clk.live/CLICKEEN/inst_locale_storage/locales/pt-BR/runtime.js',
  ]);
}

const tests: Array<{ name: string; run: () => Promise<void> }> = [
  { name: 'locale package write metadata and delete', run: testLocalePackageWriteMetadataAndDelete },
  { name: 'base locale package write rejected', run: testBaseLocalePackageWriteRejected },
  { name: 'locale purge files include entry and support files', run: async () => testLocalePurgeFilesIncludeEntryAndSupportFiles() },
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
