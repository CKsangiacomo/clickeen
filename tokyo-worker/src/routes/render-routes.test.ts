import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../types.ts';
import { tryHandlePublicRenderRoutes } from './render-routes.ts';

const ACCOUNT_ID = 'A1B2C3D4';
const INSTANCE_ID = 'Z9Y8X7W6V5';
const WIDGET_CODE = 'FAQ';
const WIDGET_TYPE = 'faq';
const CONFIG_FP = 'a'.repeat(64);

function createJsonObject(payload: unknown) {
  return {
    async json() {
      return payload;
    },
  };
}

function createTestEnv(objects: Record<string, unknown>): Env {
  return {
    TOKYO_DEV_JWT: 'test',
    TOKYO_R2: {
      async get(key: string) {
        return Object.prototype.hasOwnProperty.call(objects, key)
          ? createJsonObject(objects[key])
          : null;
      },
    } as unknown as R2Bucket,
  } as Env;
}

async function callPublicRoute(env: Env, pathname: string): Promise<Response | null> {
  return tryHandlePublicRenderRoutes({
    req: new Request(`https://tokyo.test${pathname}`),
    env,
    pathname,
    url: new URL(`https://tokyo.test${pathname}`),
    respond: (response) => response,
  });
}

test('public render routes serve account-scoped published projections', async () => {
  const env = createTestEnv({
    [`accounts/${ACCOUNT_ID}/instances/index.json`]: {
      v: 1,
      accountId: ACCOUNT_ID,
      entries: [
        {
          accountId: ACCOUNT_ID,
          id: INSTANCE_ID,
          widgetCode: WIDGET_CODE,
          widgetType: WIDGET_TYPE,
          displayName: 'FAQ',
          publishStatus: 'published',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/publish.json`]: {
      v: 1,
      id: INSTANCE_ID,
      accountId: ACCOUNT_ID,
      widgetCode: WIDGET_CODE,
      widgetType: WIDGET_TYPE,
      status: 'published',
      configFp: CONFIG_FP,
      localePolicy: {
        baseLocale: 'en',
        ip: { enabled: false, countryToLocale: {} },
        switcher: { enabled: false },
      },
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/published/config.json`]: {
      question: 'Where is this served from?',
      answer: 'The account instance published projection.',
    },
  });

  const pointerResponse = await callPublicRoute(
    env,
    `/renders/accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/live/r.json`,
  );
  assert.equal(pointerResponse?.status, 200);
  const pointer = await pointerResponse!.json() as Record<string, unknown>;
  assert.equal(pointer.id, INSTANCE_ID);
  assert.equal(pointer.widgetType, WIDGET_TYPE);
  assert.equal(pointer.configFp, CONFIG_FP);

  const configResponse = await callPublicRoute(
    env,
    `/renders/accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/config.json`,
  );
  assert.equal(configResponse?.status, 200);
  assert.deepEqual(await configResponse!.json(), {
    question: 'Where is this served from?',
    answer: 'The account instance published projection.',
  });
});

test('legacy instance-only public render routes no longer resolve objects', async () => {
  const response = await callPublicRoute(
    createTestEnv({}),
    `/renders/widgets/${INSTANCE_ID}/live/r.json`,
  );
  assert.equal(response?.status, 404);
});
