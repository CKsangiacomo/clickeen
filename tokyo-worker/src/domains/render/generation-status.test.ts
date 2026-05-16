import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../../types.ts';
import {
  updateInstanceGenerationStatus,
  writeSavedRenderConfig,
} from './index.ts';

const ACCOUNT_ID = 'A1B2C3D4';
const INSTANCE_ID = 'Z9Y8X7W6V5';

function createJsonObject(payload: unknown) {
  return {
    async json() {
      return payload;
    },
  };
}

function createTestEnv() {
  const objects = new Map<string, unknown>();
  const env = {
    TOKYO_DEV_JWT: 'test',
    TOKYO_R2: {
      async get(key: string) {
        return objects.has(key) ? createJsonObject(objects.get(key)) : null;
      },
      async put(key: string, value: string | Uint8Array) {
        const body = typeof value === 'string' ? value : new TextDecoder().decode(value);
        objects.set(key, JSON.parse(body));
      },
      async list({ prefix }: { prefix?: string }) {
        const normalizedPrefix = prefix ?? '';
        return {
          objects: [...objects.keys()]
            .filter((key) => key.startsWith(normalizedPrefix))
            .map((key) => ({ key })),
          truncated: false,
        };
      },
    } as unknown as R2Bucket,
  } as Env;
  return { env, objects };
}

test('generation status writes are conditional on sourceVersion', async () => {
  const { env, objects } = createTestEnv();
  await writeSavedRenderConfig({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    config: { question: 'Q1' },
  });
  await writeSavedRenderConfig({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    config: { question: 'Q2' },
  });

  const stale = await updateInstanceGenerationStatus({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    sourceVersion: 1,
    lane: 'embed',
    status: 'ready',
  });
  assert.equal(stale.stale, true);

  const current = objects.get(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.json`) as any;
  assert.equal(current.sourceVersion, 2);
  assert.equal(current.generation.embed.status, 'queued');
});

test('generation status follows allowed transitions for the current sourceVersion', async () => {
  const { env, objects } = createTestEnv();
  await writeSavedRenderConfig({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    config: { question: 'Q1' },
  });

  const building = await updateInstanceGenerationStatus({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    sourceVersion: 1,
    lane: 'translations',
    status: 'building',
  });
  assert.equal(building.stale, false);

  const ready = await updateInstanceGenerationStatus({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    sourceVersion: 1,
    lane: 'translations',
    status: 'ready',
  });
  assert.equal(ready.stale, false);

  const current = objects.get(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.json`) as any;
  assert.equal(current.generation.translations.status, 'ready');

  const rebuilding = await updateInstanceGenerationStatus({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    sourceVersion: 1,
    lane: 'translations',
    status: 'building',
  });
  assert.equal(rebuilding.stale, false);
});
