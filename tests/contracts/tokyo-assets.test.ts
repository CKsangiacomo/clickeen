import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../tokyo-worker/src/index';
import {
  createR2BucketStub,
  createUsageKvStub,
} from './helpers';

vi.mock('@clickeen/l10n/locales.json', () => ({
  default: ['en', 'fr', 'de'],
}));

const ACCOUNT_ID = '11111111-1111-1111-1111-111111111111';
const DEV_TOKEN = 'tokyo-dev-token';

function devHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set('authorization', `Bearer ${DEV_TOKEN}`);
  headers.set('x-ck-internal-service', 'devstudio.local');
  return headers;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('Tokyo asset lifecycle contract', () => {
  it('keeps upload, public read, integrity, and delete coherent', async () => {
    const { bucket } = createR2BucketStub();
    const usageKv = createUsageKvStub();
    const env = {
      TOKYO_R2: bucket,
      TOKYO_DEV_JWT: DEV_TOKEN,
      TOKYO_PUBLIC_BASE_URL: 'https://tokyo.test',
      USAGE_KV: usageKv,
    } as any;

    const uploadResponse = await worker.fetch(
      new Request('https://tokyo.test/__internal/assets/upload', {
        method: 'POST',
        headers: devHeaders({
          'x-account-id': ACCOUNT_ID,
          'x-filename': 'logo.png',
          'x-source': 'devstudio',
          'content-type': 'image/png',
        }),
        body: new Uint8Array([137, 80, 78, 71]),
      }),
      env,
    );

    expect(uploadResponse.status).toBe(200);
    const uploaded = (await uploadResponse.json()) as {
      assetId: string;
      assetRef: string;
      url: string;
    };
    expect(uploaded.assetId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(uploaded.assetRef).toContain(`assets/versions/${ACCOUNT_ID}/${uploaded.assetId}/`);

    const publicAssetPath = new URL(uploaded.url).pathname;
    const publicRead = await worker.fetch(
      new Request(`https://tokyo.test${publicAssetPath}`, { method: 'GET' }),
      env,
    );
    expect(publicRead.status).toBe(200);
    expect(publicRead.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(new Uint8Array(await publicRead.arrayBuffer())).toEqual(
      new Uint8Array([137, 80, 78, 71]),
    );

    const integrityResponse = await worker.fetch(
      new Request(
        `https://tokyo.test/assets/integrity/${ACCOUNT_ID}/${uploaded.assetId}`,
        {
          method: 'GET',
          headers: devHeaders(),
        },
      ),
      env,
    );
    expect(integrityResponse.status).toBe(200);
    expect(await integrityResponse.json()).toMatchObject({
      accountId: ACCOUNT_ID,
      assetId: uploaded.assetId,
      integrity: {
        ok: true,
      },
    });

    const deleteResponse = await worker.fetch(
      new Request(
        `https://tokyo.test/__internal/assets/${ACCOUNT_ID}/${uploaded.assetId}`,
        {
          method: 'DELETE',
          headers: devHeaders(),
        },
      ),
      env,
    );
    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({
      accountId: ACCOUNT_ID,
      assetId: uploaded.assetId,
      deleted: true,
      usageCount: 0,
    });

    const missingRead = await worker.fetch(
      new Request(`https://tokyo.test${publicAssetPath}`, { method: 'GET' }),
      env,
    );
    expect(missingRead.status).toBe(404);
  });
});
