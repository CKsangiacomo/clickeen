import assert from 'node:assert/strict';
import test from 'node:test';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import {
  buildOverlayTextValueMap,
  extractTextPrimitiveValuesForEditableFields,
} from '@clickeen/ck-contracts/overlay-primitives';
import type { InstanceTranslationJob } from '@clickeen/ck-contracts/instance-translation-jobs';
import type { Env } from '../../types.ts';
import {
  getWidgetDefinition,
  resolveWidgetDefaults,
} from '../widget-catalog.ts';
import {
  completeLocaleTranslation,
  generateInstanceTranslations,
} from './translation-operations.ts';
import {
  listTranslatedLocales,
  readTranslatedLocaleValues,
  writeTranslatedLocaleValues,
} from './overlays.ts';
import {
  readAccountInstanceContentDocument,
  writeSavedRenderConfig,
} from './saved-config.ts';

type StoredObject = {
  body: unknown;
};

const ACCOUNT_PUBLIC_ID = 'A1B2C3D4';
const INSTANCE_ID = 'I1B2C3D4E5';

function createTestEnv(): { env: Env; objects: Map<string, StoredObject>; queued: InstanceTranslationJob[] } {
  const objects = new Map<string, StoredObject>();
  const queued: InstanceTranslationJob[] = [];
  const env = {
    TOKYO_DEV_JWT: 'test',
    INSTANCE_TRANSLATION_JOBS: {
      async send(job: InstanceTranslationJob) {
        queued.push(job);
      },
    },
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
  return { env, objects, queued };
}

function authz(): RomaAccountAuthzCapsulePayload {
  return {
    v: 1,
    typ: 'roma.account',
    iss: 'berlin',
    aud: 'roma',
    sub: 'usr_test',
    userId: 'usr_test',
    accountId: 'acct_test',
    accountPublicId: ACCOUNT_PUBLIC_ID,
    accountStatus: 'active',
    accountIsPlatform: false,
    accountName: 'Test Account',
    accountSlug: 'test-account',
    accountWebsiteUrl: null,
    profile: 'free',
    role: 'owner',
    authzVersion: 'test',
    iat: 0,
    exp: 9_999_999_999,
  };
}

async function seedSavedFaqInstance(env: Env): Promise<Record<string, string>> {
  const config = resolveWidgetDefaults('faq');
  const widgetDefinition = getWidgetDefinition('faq');
  assert(config, 'FAQ defaults missing from widget catalog');
  assert(widgetDefinition, 'FAQ widget definition missing');
  await writeSavedRenderConfig({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
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

function setFirstFaqAnswer(config: Record<string, unknown>, answer: string): void {
  const sections = config.sections as Array<{ faqs?: Array<Record<string, unknown>> }> | undefined;
  const firstFaq = sections?.[0]?.faqs?.[0];
  assert(firstFaq, 'FAQ defaults must include a first FAQ answer');
  firstFaq.answer = answer;
}

test('Tokyo generate queues locale translation jobs from one product operation', async () => {
  const { env, queued } = createTestEnv();
  const values = await seedSavedFaqInstance(env);

  const generated = await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it', 'cs'],
    requestId: 'req_generate',
  });

  assert.equal(generated.ok, true);
  assert.equal(generated.ok ? generated.accepted : false, true);
  assert.deepEqual(queued.map((job) => job.targetLocale).sort(), ['cs', 'it']);
  assert.equal(queued[0]?.kind, 'instance.translation.locale_values');
  assert.equal(queued[0]?.changedFields.length, Object.keys(values).length);
});

test('Tokyo completion writes locale values only while the saved text basis is current', async () => {
  const { env, queued } = createTestEnv();
  const values = await seedSavedFaqInstance(env);

  const generated = await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it'],
    requestId: 'req_generate_complete',
  });
  assert.equal(generated.ok, true);
  assert.equal(queued.length, 1);

  assert.deepEqual(await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    job: queued[0],
    values,
  }), {
    ok: true,
    applied: true,
    locale: 'it',
  });

  assert.deepEqual(await readTranslatedLocaleValues({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
  }), {
    locale: 'it',
    values,
  });
  assert.deepEqual(await listTranslatedLocales({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  }), [
    { locale: 'it' },
  ]);

  const nextConfig = resolveWidgetDefaults('faq');
  assert(nextConfig);
  setFirstFaqAnswer(nextConfig, 'Plans start at zero dollars.');
  await writeSavedRenderConfig({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    config: nextConfig,
    displayName: 'FAQ example',
    meta: null,
  });

  assert.deepEqual(await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    job: queued[0],
    values,
  }), {
    ok: true,
    applied: false,
    locale: 'it',
    reasonKey: 'instance.translation.stale_source_text',
    detail: 'Current saved text for the translated fields no longer matches the translation job basis.',
  });
});

test('Tokyo completion overwrites generated fields after temporary locale edits', async () => {
  const { env, queued } = createTestEnv();
  const values = await seedSavedFaqInstance(env);

  await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it'],
  });
  assert.equal(queued.length, 1);

  await writeTranslatedLocaleValues({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    values: {
      ...values,
      'header.title': 'Manual title',
    },
  });

  assert.deepEqual(await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    job: queued[0],
    values,
  }), {
    ok: true,
    applied: true,
    locale: 'it',
  });
  assert.equal((await readTranslatedLocaleValues({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
  }))?.values['header.title'], values['header.title']);
});

test('Tokyo generate queues only changed fields for an existing translated locale', async () => {
  const { env, queued } = createTestEnv();
  const values = await seedSavedFaqInstance(env);

  await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it'],
  });
  assert.equal(queued.length, 1);
  await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    job: queued[0],
    values,
  });

  const nextConfig = resolveWidgetDefaults('faq');
  assert(nextConfig);
  setFirstFaqAnswer(nextConfig, 'Plans start at zero dollars.');
  await writeSavedRenderConfig({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    config: nextConfig,
    displayName: 'FAQ example',
    meta: null,
  });

  const generated = await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it'],
  });
  assert.equal(generated.ok, true);
  assert.equal(queued.length, 2);
  assert.deepEqual(queued[1]?.changedFields.map((field) => field.identity.path), ['sections.0.faqs.0.answer']);

  await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    job: queued[1],
    values: {
      ...values,
      'sections.0.faqs.0.answer': 'I piani partono da zero euro.',
    },
  });

  assert.deepEqual((await readTranslatedLocaleValues({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
  }))?.values, {
    ...values,
    'sections.0.faqs.0.answer': 'I piani partono da zero euro.',
  });

  const skipped = await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it'],
  });
  assert.equal(skipped.ok, true);
  assert.equal(skipped.ok ? skipped.accepted : true, false);
  assert.equal(queued.length, 2);
});

test('content status clears changed fields only after every generated target locale completes', async () => {
  const { env, queued } = createTestEnv();
  const values = await seedSavedFaqInstance(env);

  await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it', 'cs'],
  });
  assert.equal(queued.length, 2);
  for (const job of queued.slice(0, 2)) {
    await completeLocaleTranslation({
      env,
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      locale: job.targetLocale,
      job,
      values,
    });
  }

  const nextConfig = resolveWidgetDefaults('faq');
  assert(nextConfig);
  setFirstFaqAnswer(nextConfig, 'Plans start at zero dollars.');
  await writeSavedRenderConfig({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    config: nextConfig,
    displayName: 'FAQ example',
    meta: null,
  });

  await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it', 'cs'],
  });
  assert.equal(queued.length, 4);
  assert.deepEqual(queued.slice(2).map((job) => job.targetLocale).sort(), ['cs', 'it']);

  const italianJob = queued.find((job) => job.targetLocale === 'it' && job.changedFields.length === 1);
  assert(italianJob);
  await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    job: italianJob,
    values: {
      ...values,
      'sections.0.faqs.0.answer': 'I piani partono da zero euro.',
    },
  });

  let content = await readAccountInstanceContentDocument({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
  });
  assert.equal(content.ok, true);
  assert.equal(content.ok ? content.value.fields['sections.0.faqs.0.answer']?.status : null, 'changed');
  assert.equal(content.ok ? content.value.fields['sections.0.faqs.0.answer']?.localeStatus?.it : null, 'ok');

  await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it', 'cs'],
  });
  assert.equal(queued.length, 5);
  assert.equal(queued[4]?.targetLocale, 'cs');
  assert.deepEqual(queued[4]?.changedFields.map((field) => field.identity.path), ['sections.0.faqs.0.answer']);

  await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'cs',
    job: queued[4],
    values: {
      ...values,
      'sections.0.faqs.0.answer': 'Plany zacinaji na nule.',
    },
  });

  content = await readAccountInstanceContentDocument({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
  });
  assert.equal(content.ok, true);
  assert.equal(content.ok ? content.value.fields['sections.0.faqs.0.answer']?.status : null, 'ok');
});
