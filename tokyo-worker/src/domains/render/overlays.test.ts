import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_OVERLAY_EXPERIMENT, DEFAULT_OVERLAY_PERSONALIZATION } from '@clickeen/ck-contracts/overlay-identity';
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
  allocateOverlayId,
  listLocaleOverlayInventory,
  listTranslatedLocales,
  readOverlayObject,
  readSelectedOverlayPointer,
  readSelectedOverlayProjection,
  readTranslatedLocaleValues,
  validateOverlayObjectForSavedInstance,
  writeOverlayObject,
  writeSelectedOverlayPointer,
  writeTranslatedLocaleValues,
} from './overlays.ts';
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
  return { env, objects };
}

const COORDINATE = {
  accountId: 'A1B2C3D4',
  widgetCode: 'FAQ',
  instanceId: 'I1B2C3D4E5',
  languageCode: 'IT00',
  experiment: DEFAULT_OVERLAY_EXPERIMENT,
  personalization: DEFAULT_OVERLAY_PERSONALIZATION,
};

async function seedSavedFaqInstance(env: Env): Promise<Record<string, string>> {
  const config = resolveWidgetDefaults('faq');
  const widgetDefinition = getWidgetDefinition('faq');
  assert(config, 'FAQ defaults missing from widget catalog');
  assert(widgetDefinition, 'FAQ widget definition missing');
  await writeSavedRenderConfig({
    env,
    accountId: COORDINATE.accountId,
    instanceId: COORDINATE.instanceId,
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

test('overlay storage writes exact object body under overlays only', async () => {
  const { env, objects } = createTestEnv();
  const fullValues = await seedSavedFaqInstance(env);
  const overlayId = await allocateOverlayId({ env, coordinate: COORDINATE, maxVersions: 5 });

  await writeOverlayObject({ env, overlayId, values: fullValues });
  await writeSelectedOverlayPointer({ env, overlayId });

  assert.deepEqual(await readOverlayObject({ env, overlayId }), {
    v: 1,
    values: fullValues,
  });
  assert.deepEqual(await readSelectedOverlayPointer({ env, coordinate: COORDINATE }), {
    v: 1,
    overlayId,
  });
  assert.equal([...objects.keys()].some((key) => key.includes('/selected-overlays/')), false);
  assert.deepEqual(await readSelectedOverlayProjection({
    env,
    accountId: COORDINATE.accountId,
    widgetCode: COORDINATE.widgetCode,
    instanceId: COORDINATE.instanceId,
  }), {
    languages: { IT00: overlayId },
  });
});

test('locale overlay inventory lists actual overlay files only', async () => {
  const { env, objects } = createTestEnv();
  const fullValues = await seedSavedFaqInstance(env);
  const firstIt = await allocateOverlayId({ env, coordinate: COORDINATE, maxVersions: 5 });
  await writeOverlayObject({ env, overlayId: firstIt, values: fullValues });
  await writeSelectedOverlayPointer({ env, overlayId: firstIt });

  const secondIt = await allocateOverlayId({ env, coordinate: COORDINATE, maxVersions: 5 });
  await writeOverlayObject({ env, overlayId: secondIt, values: fullValues });
  await writeSelectedOverlayPointer({ env, overlayId: secondIt });

  const partialLatestIt = await allocateOverlayId({ env, coordinate: COORDINATE, maxVersions: 5 });
  await writeOverlayObject({ env, overlayId: partialLatestIt, values: { 'header.title': 'Solo titolo' } });
  await writeSelectedOverlayPointer({ env, overlayId: partialLatestIt });

  const csOverlay = await allocateOverlayId({
    env,
    coordinate: {
      ...COORDINATE,
      languageCode: 'CS00',
    },
    maxVersions: 5,
  });
  await writeOverlayObject({ env, overlayId: csOverlay, values: fullValues });
  await writeSelectedOverlayPointer({ env, overlayId: csOverlay });

  objects.set(`accounts/${COORDINATE.accountId}/instances/${COORDINATE.instanceId}/overlays/not-an-overlay.json`, {
    body: { v: 1, values: { title: 'Ignore me' } },
  });

  assert.deepEqual(await listLocaleOverlayInventory({
    env,
    accountId: COORDINATE.accountId,
    instanceId: COORDINATE.instanceId,
  }), [
    { locale: 'cs', overlayId: csOverlay },
    { locale: 'it', overlayId: secondIt },
  ]);
});

test('translated locale value read/write is direct by locale', async () => {
  const { env } = createTestEnv();
  const fullValues = await seedSavedFaqInstance(env);

  assert.deepEqual(await writeTranslatedLocaleValues({
    env,
    accountId: COORDINATE.accountId,
    instanceId: COORDINATE.instanceId,
    locale: 'it',
    values: fullValues,
  }), {
    locale: 'it',
    values: fullValues,
  });

  assert.deepEqual(await listTranslatedLocales({
    env,
    accountId: COORDINATE.accountId,
    instanceId: COORDINATE.instanceId,
  }), [{ locale: 'it' }]);

  assert.deepEqual(await readTranslatedLocaleValues({
    env,
    accountId: COORDINATE.accountId,
    instanceId: COORDINATE.instanceId,
    locale: 'it',
  }), {
    locale: 'it',
    values: fullValues,
  });

  await assert.rejects(
    () => writeTranslatedLocaleValues({
      env,
      accountId: COORDINATE.accountId,
      instanceId: COORDINATE.instanceId,
      locale: 'it',
      values: { 'header.title': 'Solo titolo' },
    }),
    /tokyo\.translation\.value_missing:/,
  );
});

test('saved instance overlay validation rejects partial FAQ values', async () => {
  const { env } = createTestEnv();
  const fullValues = await seedSavedFaqInstance(env);
  const overlayId = await allocateOverlayId({ env, coordinate: COORDINATE, maxVersions: 5 });

  assert.deepEqual(await validateOverlayObjectForSavedInstance({
    env,
    overlayId,
    values: fullValues,
  }), { ok: true });

  assert.deepEqual(await validateOverlayObjectForSavedInstance({
    env,
    overlayId,
    values: { 'header.title': 'Questions frequentes' },
  }), {
    ok: false,
    reasonKey: 'tokyo.overlay.missing_path',
    detail: 'overlay values missing_path: header.subtitleHtml',
    path: 'header.subtitleHtml',
  });
});

test('version allocation refuses when the retained slot is referenced', async () => {
  const { env } = createTestEnv();
  const fullValues = await seedSavedFaqInstance(env);
  const overlayId = await allocateOverlayId({ env, coordinate: COORDINATE, maxVersions: 1 });
  await writeOverlayObject({ env, overlayId, values: fullValues });
  await writeSelectedOverlayPointer({ env, overlayId });

  await assert.rejects(
    () => allocateOverlayId({ env, coordinate: COORDINATE, maxVersions: 1 }),
    /tokyo\.overlay\.version_slots_exhausted/,
  );
  await assert.rejects(
    () => writeOverlayObject({ env, overlayId, values: fullValues }),
    /tokyo\.overlay\.referenced_overwrite_denied/,
  );
});
