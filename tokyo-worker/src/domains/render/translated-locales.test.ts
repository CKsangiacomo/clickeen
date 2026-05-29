import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTranslatedTextValueMap,
  extractTextPrimitiveValuesForEditableFields,
} from '@clickeen/ck-contracts/translated-value-primitives';
import type { Env } from '../../types.ts';
import {
  getWidgetDefinition,
  resolveWidgetDefaults,
} from '../widget-catalog.ts';
import {
  listTranslatedLocales,
  readTranslatedLocaleValues,
  writeTranslatedLocaleValues,
} from './translated-locales.ts';
import {
  accountInstanceConfigKey,
  accountInstanceContentKey,
  accountInstanceLocaleOverlayKey,
} from './keys.ts';
import { writeSavedRenderConfig } from './saved-config.ts';
import { attachTestInstanceRegistry } from './test-instance-registry.ts';

type StoredObject = {
  body: unknown;
  httpEtag: string;
};

function createTestEnv(): { env: Env; objects: Map<string, StoredObject> } {
  const objects = new Map<string, StoredObject>();
  let objectVersion = 0;
  const env = {
    TOKYO_DEV_JWT: 'test',
    TOKYO_R2: {
      async put(key: string, value: unknown, options?: { onlyIf?: { etagMatches?: string } }) {
        const current = objects.get(key);
        const expectedEtag = options?.onlyIf?.etagMatches;
        const currentEtag = current?.httpEtag.replace(/^"|"$/g, '');
        if (expectedEtag?.startsWith('"')) throw new Error(`Conditional ETag should not be wrapped in quotes (${expectedEtag}).`);
        if (expectedEtag && currentEtag !== expectedEtag) return null;
        const body =
          value instanceof Uint8Array
            ? JSON.parse(new TextDecoder().decode(value))
            : value;
        const httpEtag = `"test-${++objectVersion}"`;
        objects.set(key, { body, httpEtag });
        return { key, httpEtag, etag: httpEtag };
      },
      async get(key: string) {
        const stored = objects.get(key);
        if (!stored) return null;
        return {
          httpEtag: stored.httpEtag,
          async json() {
            return stored.body;
          },
        };
      },
      async list(options?: { prefix?: string; cursor?: string }) {
        const prefix = options?.prefix ?? '';
        return {
          objects: Array.from(objects.keys())
            .filter((key) => key.startsWith(prefix))
            .sort()
            .map((key) => ({ key })),
          truncated: false,
          cursor: undefined,
        };
      },
      async delete(keys: string | string[]) {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          objects.delete(key);
        }
      },
    } as unknown as R2Bucket,
  } as Env;
  attachTestInstanceRegistry(env);
  return { env, objects };
}

const ACCOUNT_ID = 'A1B2C3D4';
const INSTANCE_ID = 'I1B2C3D4E5';

async function seedSavedFaqInstance(env: Env): Promise<Record<string, string>> {
  const config = resolveWidgetDefaults('faq');
  const widgetDefinition = getWidgetDefinition('faq');
  assert(config, 'FAQ defaults missing from widget catalog');
  assert(widgetDefinition, 'FAQ widget definition missing');
  await writeSavedRenderConfig({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    config,
    displayName: 'FAQ example',
    meta: null,
  });
  return buildTranslatedTextValueMap(
    extractTextPrimitiveValuesForEditableFields({
      contract: widgetDefinition.editableFields,
      config,
    }),
  );
}

test('translated locale value read/write is direct by locale', async () => {
  const { env, objects } = createTestEnv();
  const fullValues = await seedSavedFaqInstance(env);

  assert.deepEqual(await writeTranslatedLocaleValues({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    values: fullValues,
  }), {
    locale: 'it',
    values: fullValues,
  });

  assert.deepEqual(await listTranslatedLocales({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
  }), [{ locale: 'it' }]);

  assert.deepEqual(await readTranslatedLocaleValues({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
  }), {
    locale: 'it',
    values: fullValues,
  });

  const overlayKey = accountInstanceLocaleOverlayKey(ACCOUNT_ID, 'faq', INSTANCE_ID, 'it');
  const overlay = objects.get(overlayKey)?.body;
  assert(overlay && typeof overlay === 'object' && !Array.isArray(overlay));
  assert.deepEqual(overlay, {
    v: 1,
    locale: 'it',
    baseContentMarker: (overlay as { baseContentMarker: string }).baseContentMarker,
    widgetContractHash: (overlay as { widgetContractHash: string }).widgetContractHash,
    status: 'inSync',
    values: fullValues,
    updatedAt: (overlay as { updatedAt: string }).updatedAt,
  });
  assert.equal(typeof (overlay as { baseContentMarker: unknown }).baseContentMarker, 'string');
  assert.equal(typeof (overlay as { widgetContractHash: unknown }).widgetContractHash, 'string');
  assert.match(String((overlay as { baseContentMarker: unknown }).baseContentMarker), /^sha256:v1:[0-9a-f]{64}$/);
  assert.match(String((overlay as { widgetContractHash: unknown }).widgetContractHash), /^sha256:v1:[0-9a-f]{64}$/);
  assert.equal(typeof (overlay as { updatedAt: unknown }).updatedAt, 'string');

  const content = objects.get(accountInstanceContentKey(ACCOUNT_ID, 'faq', INSTANCE_ID))?.body as { fields?: Record<string, unknown> } | undefined;
  assert(content?.fields);
  for (const field of Object.values(content.fields)) {
    assert.equal(Object.prototype.hasOwnProperty.call(field as Record<string, unknown>, 'translatedValues'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(field as Record<string, unknown>, 'localeStatus'), false);
  }

  await assert.rejects(
    () => writeTranslatedLocaleValues({
      env,
      accountId: ACCOUNT_ID,
      instanceId: INSTANCE_ID,
      locale: 'it',
      values: { 'header.title': 'Solo titolo' },
    }),
    /tokyo\.translation\.value_missing:/,
  );
});

test('legacy embedded translated values migrate to locale overlays and clean content source', async () => {
  const { env, objects } = createTestEnv();
  const fullValues = await seedSavedFaqInstance(env);
  const config = objects.get(accountInstanceConfigKey(ACCOUNT_ID, 'faq', INSTANCE_ID))?.body as { targetLocales?: string[] } | undefined;
  assert(config);
  config.targetLocales = ['it'];
  const contentKey = accountInstanceContentKey(ACCOUNT_ID, 'faq', INSTANCE_ID);
  const legacyContent = objects.get(contentKey)?.body as {
    fields?: Record<string, {
      localeStatus?: Record<string, string>;
      translatedValues?: Record<string, string>;
    }>;
  } | undefined;
  assert(legacyContent?.fields);
  for (const [path, field] of Object.entries(legacyContent.fields)) {
    field.localeStatus = { it: 'ok' };
    field.translatedValues = { it: fullValues[path]! };
  }

  assert.deepEqual(await listTranslatedLocales({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
  }), [{ locale: 'it' }]);

  assert.deepEqual(await readTranslatedLocaleValues({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
  }), {
    locale: 'it',
    values: fullValues,
  });

  const overlay = objects.get(accountInstanceLocaleOverlayKey(ACCOUNT_ID, 'faq', INSTANCE_ID, 'it'))?.body;
  assert(overlay && typeof overlay === 'object' && !Array.isArray(overlay));
  assert.equal((overlay as { status?: unknown }).status, 'inSync');
  assert.deepEqual((overlay as { values?: unknown }).values, fullValues);

  const cleaned = objects.get(contentKey)?.body as { fields?: Record<string, unknown> } | undefined;
  assert(cleaned?.fields);
  for (const field of Object.values(cleaned.fields)) {
    assert.equal(Object.prototype.hasOwnProperty.call(field as Record<string, unknown>, 'translatedValues'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(field as Record<string, unknown>, 'localeStatus'), false);
  }
});
