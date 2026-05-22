import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOverlayTextValueMap,
  extractTextPrimitiveValuesForEditableFields,
} from '@clickeen/ck-contracts/overlay-primitives';
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
import { writeSavedRenderConfig } from './saved-config.ts';
import { attachTestInstanceRegistry } from './test-instance-registry.ts';

type StoredObject = {
  body: unknown;
  httpEtag: string;
};

function createTestEnv(): Env {
  const objects = new Map<string, StoredObject>();
  let objectVersion = 0;
  const env = {
    TOKYO_DEV_JWT: 'test',
    TOKYO_R2: {
      async put(key: string, value: unknown, options?: { onlyIf?: { etagMatches?: string } }) {
        const current = objects.get(key);
        const expectedEtag = options?.onlyIf?.etagMatches;
        if (expectedEtag && current?.httpEtag !== expectedEtag) return null;
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
  return env;
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
  return buildOverlayTextValueMap(
    extractTextPrimitiveValuesForEditableFields({
      contract: widgetDefinition.editableFields,
      config,
    }),
  );
}

test('translated locale value read/write is direct by locale', async () => {
  const env = createTestEnv();
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
