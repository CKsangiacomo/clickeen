import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CatalogAssetCopyError,
  copyClickeenCatalogAssets,
} from '../src/domains/assets';
import { handleCopyClickeenCatalogAssets } from '../src/domains/assets-handlers';

type Stored = {
  bytes: Uint8Array;
  uploaded: Date;
  httpMetadata: { contentType: string };
  customMetadata: Record<string, string>;
};

function createStore() {
  const objects = new Map<string, Stored>();
  let failedPutKey: string | null = null;
  let destinationPutCount = 0;
  const env = {
    TOKYO_R2: {
      async head(key: string) {
        const object = objects.get(key);
        return object ? { size: object.bytes.byteLength, uploaded: object.uploaded, httpMetadata: object.httpMetadata, customMetadata: object.customMetadata } : null;
      },
      async get(key: string) {
        const object = objects.get(key);
        return object ? {
          size: object.bytes.byteLength,
          uploaded: object.uploaded,
          httpMetadata: object.httpMetadata,
          customMetadata: object.customMetadata,
          async arrayBuffer() { return object.bytes.slice().buffer; },
        } : null;
      },
      async list(options?: { prefix?: string }) {
        const prefix = options?.prefix ?? '';
        return {
          objects: [...objects.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, object]) => ({
            key,
            size: object.bytes.byteLength,
            uploaded: object.uploaded,
            httpMetadata: object.httpMetadata,
            customMetadata: object.customMetadata,
          })),
          truncated: false,
        };
      },
      async put(key: string, body: ArrayBuffer, options: { httpMetadata: { contentType: string }; customMetadata: Record<string, string> }) {
        if (failedPutKey === key) throw new Error(`write_failed:${key}`);
        destinationPutCount += 1;
        objects.set(key, {
          bytes: new Uint8Array(body),
          uploaded: new Date('2026-08-06T12:00:00.000Z'),
          httpMetadata: options.httpMetadata,
          customMetadata: options.customMetadata,
        });
        return {};
      },
    },
  } as any;
  function seed(accountId: string, filename: string, text: string, source = 'devstudio') {
    objects.set(`accounts/${accountId}/assets/${filename}`, {
      bytes: new TextEncoder().encode(text),
      uploaded: new Date('2026-08-06T10:00:00.000Z'),
      httpMetadata: { contentType: 'image/png' },
      customMetadata: {
        filename,
        originalFilename: filename,
        source,
        createdAt: '2026-08-06T10:00:00.000Z',
        sizeBytes: String(text.length),
      },
    });
  }
  return {
    env,
    objects,
    seed,
    failPut(key: string) { failedPutKey = key; },
    destinationPutCount() { return destinationPutCount; },
  };
}

const collision = createStore();
collision.seed('CLICKEEN', 'hero.png', 'new');
collision.seed('CUSTOMER', 'hero.png', 'keep');
collision.seed('CUSTOMER', 'hero-2.png', 'keep-two');
const mappings = await copyClickeenCatalogAssets({
  env: collision.env,
  destinationAccountId: 'CUSTOMER',
  sourceAssetRefs: ['hero.png'],
  uploadSizeLimit: 100,
  storageLimit: 1_000,
});
assert.deepEqual(mappings, [{
  sourceAssetRef: 'hero.png',
  destinationAssetRef: 'hero-3.png',
}]);
assert.equal(new TextDecoder().decode(collision.objects.get('accounts/CUSTOMER/assets/hero.png')?.bytes), 'keep');
assert.equal(new TextDecoder().decode(collision.objects.get('accounts/CUSTOMER/assets/hero-3.png')?.bytes), 'new');
assert.equal(collision.objects.get('accounts/CUSTOMER/assets/hero-3.png')?.customMetadata.source, 'promotion');

for (const limits of [
  { uploadSizeLimit: 2, storageLimit: 1_000, detail: 'uploads.size.max' },
  { uploadSizeLimit: 100, storageLimit: 2, detail: 'storage.bytes.max' },
]) {
  const limited = createStore();
  limited.seed('CLICKEEN', 'hero.png', 'new');
  await assert.rejects(
    copyClickeenCatalogAssets({
      env: limited.env,
      destinationAccountId: 'CUSTOMER',
      sourceAssetRefs: ['hero.png'],
      uploadSizeLimit: limits.uploadSizeLimit,
      storageLimit: limits.storageLimit,
    }),
    (error: unknown) => error instanceof CatalogAssetCopyError && error.message === limits.detail,
  );
  assert.equal(limited.destinationPutCount(), 0, 'Every limit must be checked before the first destination write');
}

const partial = createStore();
partial.seed('CLICKEEN', 'one.png', 'one');
partial.seed('CLICKEEN', 'two.png', 'two');
partial.failPut('accounts/CUSTOMER/assets/two.png');
await assert.rejects(
  copyClickeenCatalogAssets({
    env: partial.env,
    destinationAccountId: 'CUSTOMER',
    sourceAssetRefs: ['one.png', 'two.png'],
    uploadSizeLimit: null,
    storageLimit: null,
  }),
  (error: unknown) => error instanceof CatalogAssetCopyError && error.reasonKey === 'tokyo.errors.assets.copyFailed' &&
    error.completedMappings.length === 1 &&
    error.completedMappings[0]?.destinationAssetRef === 'one.png',
);
assert.equal(partial.objects.has('accounts/CUSTOMER/assets/one.png'), true);
assert.equal(partial.objects.has('accounts/CUSTOMER/assets/two.png'), false);

const unauthorized = await handleCopyClickeenCatalogAssets(new Request('https://tokyo.internal/__internal/assets/catalog-copy', {
  method: 'POST',
  headers: {
    'x-account-id': 'CUSTOMER',
    'x-upload-size-max': 'unlimited',
    'x-storage-bytes-max': 'unlimited',
    'content-type': 'application/json',
  },
  body: JSON.stringify({ assetRefs: ['hero.png'] }),
}), createStore().env);
assert.equal(unauthorized.status, 403, 'The copy route requires Roma service and account-capsule authentication');

const handlerSource = await readFile(new URL('../src/domains/assets-handlers.ts', import.meta.url), 'utf8');
const domainSource = await readFile(new URL('../src/domains/assets.ts', import.meta.url), 'utf8');
assert.match(handlerSource, /rawAssetRefs\.some\(\(value\) => !isAssetRef\(value\)\)/);
assert.match(handlerSource, /destinationAccountId[\s\S]*resolveAccountAssetAuthorization/);
assert.doesNotMatch(handlerSource, /sourceAccountId|ownerAccountId/);
assert.match(domainSource, /onlyIf: \{ etagDoesNotMatch: '\*' \}/, 'A concurrent destination collision must not overwrite');

console.log('Catalog asset copy contract verification passed.');
