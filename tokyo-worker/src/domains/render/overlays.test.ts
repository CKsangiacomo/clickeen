import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_OVERLAY_EXPERIMENT, DEFAULT_OVERLAY_PERSONALIZATION } from '@clickeen/ck-contracts/overlay-identity';
import type { Env } from '../../types.ts';
import {
  allocateOverlayId,
  readOverlayObject,
  readSelectedOverlayPointer,
  readSelectedOverlayProjection,
  writeOverlayObject,
  writeSelectedOverlayPointer,
} from './overlays.ts';

type StoredObject = {
  body: unknown;
};

function createTestEnv(): Env {
  const objects = new Map<string, StoredObject>();
  return {
    TOKYO_DEV_JWT: 'test',
    TOKYO_R2: {
      async put(key: string, value: unknown) {
        const body =
          value instanceof Uint8Array
            ? JSON.parse(new TextDecoder().decode(value))
            : value;
        objects.set(key, { body });
        return null;
      },
      async get(key: string) {
        const stored = objects.get(key);
        if (!stored) return null;
        return {
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
}

const COORDINATE = {
  accountId: 'A1B2C3D4',
  widgetCode: 'FAQ',
  instanceId: 'I1B2C3D4E5',
  languageCode: 'IT00',
  experiment: DEFAULT_OVERLAY_EXPERIMENT,
  personalization: DEFAULT_OVERLAY_PERSONALIZATION,
};

test('overlay storage writes exact object body and selected pointer', async () => {
  const env = createTestEnv();
  const overlayId = await allocateOverlayId({ env, coordinate: COORDINATE, maxVersions: 5 });

  await writeOverlayObject({ env, overlayId, values: { title: 'Domande frequenti' } });
  await writeSelectedOverlayPointer({ env, overlayId });

  assert.deepEqual(await readOverlayObject({ env, overlayId }), {
    v: 1,
    values: { title: 'Domande frequenti' },
  });
  assert.deepEqual(await readSelectedOverlayPointer({ env, coordinate: COORDINATE }), {
    v: 1,
    overlayId,
  });
  assert.deepEqual(await readSelectedOverlayProjection({
    env,
    accountId: COORDINATE.accountId,
    widgetCode: COORDINATE.widgetCode,
    instanceId: COORDINATE.instanceId,
  }), {
    languages: { IT00: overlayId },
  });
});

test('version allocation refuses when the retained slot is referenced', async () => {
  const env = createTestEnv();
  const overlayId = await allocateOverlayId({ env, coordinate: COORDINATE, maxVersions: 1 });
  await writeOverlayObject({ env, overlayId, values: { title: 'Versione uno' } });
  await writeSelectedOverlayPointer({ env, overlayId });

  await assert.rejects(
    () => allocateOverlayId({ env, coordinate: COORDINATE, maxVersions: 1 }),
    /tokyo\.overlay\.version_slots_exhausted/,
  );
  await assert.rejects(
    () => writeOverlayObject({ env, overlayId, values: { title: 'Overwrite' } }),
    /tokyo\.overlay\.referenced_overwrite_denied/,
  );
});
