import assert from 'node:assert/strict';
import test from 'node:test';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import {
  buildTranslatedTextValueMap,
  extractTextPrimitiveValuesForEditableFields,
} from '@clickeen/ck-contracts/translated-value-primitives';
import type { InstanceTranslationJob } from '@clickeen/ck-contracts/instance-translation-jobs';
import type { Env } from '../../types.ts';
import {
  getWidgetDefinition,
  resolveWidgetDefaults,
} from '../widget-definitions.ts';
import {
  completeLocaleTranslation,
  failLocaleTranslation,
  generateInstanceTranslations,
  readInstanceTranslationGeneration,
} from './operations.ts';
import {
  listTranslatedLocales,
  readTranslatedLocaleValues,
  writeTranslatedLocaleValues,
} from './values.ts';
import {
  readInstanceRegistryRow,
  updateInstanceRegistryTranslationStatus,
} from '../account-instances/registry.ts';
import {
  readAccountInstanceContentDocument,
  writeAccountInstanceSource,
} from '../account-instances/source.ts';
import { accountInstanceLocaleOverlayKey } from '../account-instances/keys.ts';
import { attachTestInstanceRegistry } from '../../test-utils/instance-registry.ts';

type StoredObject = {
  body: unknown;
  httpEtag: string;
};

const ACCOUNT_PUBLIC_ID = 'A1B2C3D4';
const INSTANCE_ID = 'I1B2C3D4E5';

function createTestEnv(): { env: Env; objects: Map<string, StoredObject>; queued: InstanceTranslationJob[] } {
  const objects = new Map<string, StoredObject>();
  const queued: InstanceTranslationJob[] = [];
  let objectVersion = 0;
  const env = {
    TOKYO_DEV_JWT: 'test',
    INSTANCE_TRANSLATION_JOBS: {
      async send(job: InstanceTranslationJob) {
        queued.push(job);
      },
    },
    TOKYO_R2: {
      async put(key: string, value: unknown, options?: { onlyIf?: { etagMatches?: string } }) {
        await Promise.resolve();
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
  assert(config, 'FAQ defaults missing from widget definitions');
  assert(widgetDefinition, 'FAQ widget definition missing');
  setFirstFaqAnswer(config, 'Plans start with a free option.');
  await writeAccountInstanceSource({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
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

async function seedSavedWidgetInstance(args: {
  env: Env;
  widgetType: string;
  instanceId?: string;
  displayName?: string;
}): Promise<Record<string, string>> {
  const config = resolveWidgetDefaults(args.widgetType);
  const widgetDefinition = getWidgetDefinition(args.widgetType);
  assert(config, `${args.widgetType} defaults missing from widget definitions`);
  assert(widgetDefinition, `${args.widgetType} widget definition missing`);
  await writeAccountInstanceSource({
    env: args.env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: args.instanceId ?? INSTANCE_ID,
    widgetType: args.widgetType,
    config,
    displayName: args.displayName ?? `${args.widgetType} example`,
    meta: null,
  });
  return buildTranslatedTextValueMap(
    extractTextPrimitiveValuesForEditableFields({
      contract: widgetDefinition.editableFields,
      config,
    }),
  );
}

function setFirstFaqAnswer(config: Record<string, unknown>, answer: string): void {
  const sections = Array.isArray(config.sections) ? config.sections as Array<Record<string, unknown>> : [];
  if (!Array.isArray(config.sections)) config.sections = sections;

  let firstSection = sections[0];
  if (!firstSection || typeof firstSection !== 'object' || Array.isArray(firstSection)) {
    firstSection = { id: 'general', title: '', faqs: [] };
    sections[0] = firstSection;
  }
  if (typeof firstSection.id !== 'string') firstSection.id = 'general';
  if (typeof firstSection.title !== 'string') firstSection.title = '';
  if (!Array.isArray(firstSection.faqs)) firstSection.faqs = [];

  const faqs = firstSection.faqs as Array<Record<string, unknown>>;
  let firstFaq = faqs[0];
  if (!firstFaq || typeof firstFaq !== 'object' || Array.isArray(firstFaq)) {
    firstFaq = {
      id: 'pricing',
      question: 'What does it cost?',
      answer: '',
      defaultOpen: false,
    };
    faqs[0] = firstFaq;
  }
  if (typeof firstFaq.id !== 'string') firstFaq.id = 'pricing';
  if (typeof firstFaq.question !== 'string') firstFaq.question = 'What does it cost?';
  if (typeof firstFaq.defaultOpen !== 'boolean') firstFaq.defaultOpen = false;
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
  assert.equal(new Set(queued.map((job) => job.jobId)).size, 1);
  assert.equal(generated.ok ? Object.prototype.hasOwnProperty.call(generated, 'queuedLocales') : false, false);
  assert.equal(queued[0]?.kind, 'instance.translation.locale_values');
  assert.equal(queued[0]?.changedFields.length, Object.keys(values).length);
  assert.equal((await readInstanceRegistryRow({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  }))?.translationStatus, 'queued');
});

test('Tokyo generate queues non-FAQ widget translation jobs through the same generic path', async () => {
  const { env, queued } = createTestEnv();
  const values = await seedSavedWidgetInstance({ env, widgetType: 'countdown' });

  const generated = await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it'],
    requestId: 'req_countdown_generate',
  });

  assert.equal(generated.ok, true);
  assert.equal(generated.ok ? generated.accepted : false, true);
  assert.equal(queued.length, 1);
  assert.equal(queued[0]?.widgetType, 'countdown');
  assert.equal(queued[0]?.changedFields.length, Object.keys(values).length);
  assert(queued[0]?.changedFields.some((field) => field.path === 'timer.labels.days'));
  assert(queued[0]?.changedFields.every((field) => field.identityKey && field.fieldPattern));

  const job = queued[0];
  assert(job);
  const translated = Object.fromEntries(job.changedFields.map((field) => [field.path, `it:${field.baseText}`]));
  assert.deepEqual(await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    job,
    values: translated,
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
    values: translated,
  });
});

test('Tokyo generate completes Logo Showcase nested repeated fields through the same generic path', async () => {
  const { env, queued } = createTestEnv();
  await seedSavedWidgetInstance({ env, widgetType: 'logoshowcase' });

  const generated = await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it'],
    requestId: 'req_logoshowcase_generate',
  });

  assert.equal(generated.ok, true);
  assert.equal(generated.ok ? generated.accepted : false, true);
  assert.equal(queued.length, 1);
  const job = queued[0];
  assert(job);
  assert.equal(job.widgetType, 'logoshowcase');
  assert(job.changedFields.some((field) => field.path === 'strips.0.logos.0.name'));
  assert(job.changedFields.every((field) => field.identityKey && field.fieldPattern));

  const translated = Object.fromEntries(job.changedFields.map((field) => [field.path, `it:${field.baseText}`]));
  assert.deepEqual(await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    job,
    values: translated,
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
    values: translated,
  });
});

test('Tokyo generate returns active matching work on a duplicate Generate click', async () => {
  const { env, queued } = createTestEnv();
  const values = await seedSavedFaqInstance(env);

  const first = await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it', 'cs'],
    requestId: 'req_generate_once',
  });
  assert.equal(first.ok, true);
  assert.equal(queued.length, 2);
  const originalItalianJob = queued.find((job) => job.targetLocale === 'it');
  assert(originalItalianJob);

  const second = await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it', 'cs'],
    requestId: 'req_generate_duplicate',
  });

  assert.equal(second.ok, true);
  assert.equal(second.ok ? second.accepted : false, true);
  assert.equal(queued.length, 2);
  assert.equal(second.ok ? Object.prototype.hasOwnProperty.call(second, 'queuedLocales') : false, false);
  assert.equal(
    second.ok ? second.generation?.generationRequestMarker : null,
    first.ok ? first.generation?.generationRequestMarker : null,
  );
  assert.equal((await readInstanceRegistryRow({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  }))?.translationStatus, 'queued');
  assert.deepEqual(await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    job: originalItalianJob,
    values,
  }), {
    ok: true,
    applied: true,
    locale: 'it',
  });
});

test('Tokyo generate starts current-base work when older base translation is active', async () => {
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
  const originalJob = queued[0];
  assert(originalJob);

  const nextConfig = resolveWidgetDefaults('faq');
  assert(nextConfig);
  setFirstFaqAnswer(nextConfig, 'Plans start at zero dollars.');
  await writeAccountInstanceSource({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    config: nextConfig,
    displayName: 'FAQ example',
    meta: null,
  });

  const restarted = await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it'],
  });
  assert.equal(restarted.ok, true);
  assert.equal(queued.length, 2);
  assert.equal(restarted.ok ? restarted.generation?.active : null, true);
  assert.equal(restarted.ok ? restarted.generation?.isCurrentBaseContent : null, true);
  const generation = await readInstanceTranslationGeneration({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  });
  assert.equal(generation.ok, true);
  assert.equal(generation.ok ? generation.generation.isCurrentBaseContent : null, true);
  assert.equal(generation.ok ? generation.generation.active : null, true);
  assert.deepEqual(generation.ok ? generation.generation.locales : [], [
    { locale: 'it', state: 'generating', reviewable: false },
  ]);

  assert.deepEqual(await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    job: originalJob,
    values,
  }), {
    ok: true,
    applied: false,
    locale: 'it',
    reasonKey: 'instance.translation.stale_generation',
    detail: 'This translation job does not match the active translation operation for the instance.',
  });
});

test('Tokyo exposes current translation generation progress', async () => {
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

  let generation = await readInstanceTranslationGeneration({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  });
  assert.equal(generation.ok, true);
  assert.equal(generation.ok ? generation.generation.status : null, 'queued');
  assert.equal(generation.ok ? generation.generation.v : null, 2);
  assert.equal(generation.ok ? generation.generation.active : null, true);
  assert.equal(typeof (generation.ok ? generation.generation.baseContentMarker : null), 'string');
  assert.equal(typeof (generation.ok ? generation.generation.generationRequestMarker : null), 'string');
  assert.deepEqual(generation.ok ? generation.generation.locales : [], [
    { locale: 'cs', state: 'generating', reviewable: false },
    { locale: 'it', state: 'generating', reviewable: false },
  ]);

  const italianJob = queued.find((job) => job.targetLocale === 'it');
  assert(italianJob);
  await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    job: italianJob,
    values,
  });

  generation = await readInstanceTranslationGeneration({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  });
  assert.equal(generation.ok, true);
  assert.equal(generation.ok ? generation.generation.status : null, 'running');
  assert.deepEqual(generation.ok ? generation.generation.locales : [], [
    { locale: 'cs', state: 'generating', reviewable: false },
    { locale: 'it', state: 'inSync', reviewable: true },
  ]);
  assert.equal((await readInstanceRegistryRow({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  }))?.translationStatus, 'running');

  const czechJob = queued.find((job) => job.targetLocale === 'cs');
  assert(czechJob);
  await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'cs',
    job: czechJob,
    values,
  });

  generation = await readInstanceTranslationGeneration({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  });
  assert.equal(generation.ok, true);
  assert.equal(generation.ok ? generation.generation.status : null, 'completed');
  assert.equal(generation.ok ? generation.generation.active : null, false);
  assert.deepEqual(generation.ok ? generation.generation.locales : [], [
    { locale: 'cs', state: 'inSync', reviewable: true },
    { locale: 'it', state: 'inSync', reviewable: true },
  ]);
  assert.equal((await readInstanceRegistryRow({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  }))?.translationStatus, 'idle');

  await updateInstanceRegistryTranslationStatus({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    translationStatus: 'queued',
  });
  generation = await readInstanceTranslationGeneration({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  });
  assert.equal(generation.ok, true);
  assert.equal(generation.ok ? generation.generation.status : null, 'completed');
});

test('Tokyo markers separate base content sync from requested locale scope', async () => {
  const { env, queued } = createTestEnv();
  const values = await seedSavedFaqInstance(env);

  const first = await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it'],
  });
  assert.equal(first.ok, true);
  assert.equal(queued.length, 1);
  const firstJob = queued[0];
  assert(firstJob);
  await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    job: firstJob,
    values,
  });

  const afterItalian = await readInstanceTranslationGeneration({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  });
  assert.equal(afterItalian.ok, true);
  const baseMarker = afterItalian.ok ? afterItalian.generation.baseContentMarker : null;
  const italianRequestMarker = afterItalian.ok ? afterItalian.generation.generationRequestMarker : null;
  assert.equal(typeof baseMarker, 'string');
  assert.equal(typeof italianRequestMarker, 'string');
  assert.deepEqual(afterItalian.ok ? afterItalian.generation.locales : [], [
    { locale: 'it', state: 'inSync', reviewable: true },
  ]);

  const expanded = await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it', 'cs'],
  });
  assert.equal(expanded.ok, true);
  assert.equal(queued.length, 2);
  assert.equal(queued[1]?.targetLocale, 'cs');
  assert.equal(expanded.ok ? expanded.generation?.baseContentMarker : null, baseMarker);
  assert.notEqual(expanded.ok ? expanded.generation?.generationRequestMarker : null, italianRequestMarker);
  assert.deepEqual(expanded.ok ? expanded.generation?.locales : [], [
    { locale: 'cs', state: 'generating', reviewable: false },
    { locale: 'it', state: 'inSync', reviewable: true },
  ]);
});

test('Tokyo marks completed locales out of sync when saved base content changes', async () => {
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
  assert(queued[0]);
  await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    job: queued[0],
    values,
  });

  const synced = await readInstanceTranslationGeneration({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  });
  assert.equal(synced.ok, true);
  const oldBaseMarker = synced.ok ? synced.generation.baseContentMarker : null;
  assert.equal(typeof oldBaseMarker, 'string');

  const nextConfig = resolveWidgetDefaults('faq');
  assert(nextConfig);
  setFirstFaqAnswer(nextConfig, 'Plans start at zero dollars.');
  await writeAccountInstanceSource({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    config: nextConfig,
    displayName: 'FAQ example',
    meta: null,
  });

  const stale = await readInstanceTranslationGeneration({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  });
  assert.equal(stale.ok, true);
  assert.notEqual(stale.ok ? stale.generation.baseContentMarker : null, oldBaseMarker);
  assert.deepEqual(stale.ok ? stale.generation.locales : [], [
    { locale: 'it', state: 'outOfSync', reviewable: false },
  ]);
});

test('Tokyo records terminal locale failures on generation operation state', async () => {
  const { env, queued } = createTestEnv();
  await seedSavedFaqInstance(env);

  await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it'],
  });
  assert.equal(queued.length, 1);

  const failed = await failLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    job: queued[0],
    reasonKey: 'instance.translation.provider_failed',
    detail: 'provider failed',
  });
  assert.deepEqual(failed, {
    ok: true,
    recorded: true,
    locale: 'it',
    reasonKey: 'instance.translation.provider_failed',
    detail: 'provider failed',
  });

  const generation = await readInstanceTranslationGeneration({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  });
  assert.equal(generation.ok, true);
  assert.equal(generation.ok ? generation.generation.status : null, 'failed');
  assert.deepEqual(generation.ok ? generation.generation.locales : [], [
    {
      locale: 'it',
      state: 'failed',
      reviewable: false,
      reasonKey: 'instance.translation.provider_failed',
      detail: 'provider failed',
    },
  ]);
  assert.equal((await readInstanceRegistryRow({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  }))?.translationStatus, 'failed');
});

test('Tokyo fails stale active generation operations instead of polling forever', async () => {
  const { env, queued } = createTestEnv();
  await seedSavedFaqInstance(env);

  await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it'],
  });
  assert.equal(queued.length, 1);
  const job = queued[0];
  assert(job);

  const staleAt = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  await fetch(`${env.SUPABASE_URL}/rest/v1/translation_generation_operations?id=eq.${job.jobId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      requested_at: staleAt,
      updated_at: staleAt,
      expires_at: staleAt,
    }),
  });
  await fetch(`${env.SUPABASE_URL}/rest/v1/translation_generation_operation_locales?operation_id=eq.${job.jobId}`, {
    method: 'PATCH',
    body: JSON.stringify({ updated_at: staleAt }),
  });

  const generation = await readInstanceTranslationGeneration({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  });
  assert.equal(generation.ok, true);
  assert.equal(generation.ok ? generation.generation.status : null, 'failed');
  assert.deepEqual(generation.ok ? generation.generation.locales : [], [
    {
      locale: 'it',
      state: 'failed',
      reviewable: false,
      reasonKey: 'instance.translation.timed_out',
      detail: 'Translation job did not report completion or failure before the generation timeout.',
    },
  ]);
  assert.equal(generation.ok ? generation.generation.reasonKey : null, 'instance.translation.timed_out');
  assert.equal((await readInstanceRegistryRow({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  }))?.translationStatus, 'failed');
});

test('Tokyo records failed generation state when queue send fails', async () => {
  const { env } = createTestEnv();
  await seedSavedFaqInstance(env);
  env.INSTANCE_TRANSLATION_JOBS = {
    async send() {
      throw new Error('queue unavailable');
    },
  } as Env['INSTANCE_TRANSLATION_JOBS'];

  const generated = await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it'],
  });

  assert.equal(generated.ok, false);
  assert.equal(generated.ok ? null : generated.reasonKey, 'instance.translation.queue_send_failed');
  assert.equal((await readInstanceRegistryRow({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  }))?.translationStatus, 'failed');
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
  await writeAccountInstanceSource({
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
  await writeAccountInstanceSource({
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
  assert.deepEqual(queued[1]?.changedFields.map((field) => field.path), ['sections.0.faqs.0.answer']);

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

test('Tokyo generate treats an incomplete locale overlay as missing', async () => {
  const { env, objects, queued } = createTestEnv();
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

  const overlayKey = accountInstanceLocaleOverlayKey(ACCOUNT_PUBLIC_ID, 'faq', INSTANCE_ID, 'it');
  const stored = objects.get(overlayKey);
  assert(stored && stored.body && typeof stored.body === 'object' && !Array.isArray(stored.body));
  const overlay = stored.body as { values: Record<string, string> };
  delete overlay.values['sections.0.faqs.0.question'];

  await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it'],
  });

  assert.equal(queued.length, 2);
  assert.deepEqual(queued[1]?.changedFields.map((field) => field.path), ['sections.0.faqs.0.question']);
  assert.deepEqual(await listTranslatedLocales({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
  }), []);
  assert.equal(await readTranslatedLocaleValues({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
  }), null);
});

test('content status clears changed fields only after every generated target locale completes', async () => {
  const { env, objects, queued } = createTestEnv();
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
  await writeAccountInstanceSource({
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
  const czechOverlayKey = accountInstanceLocaleOverlayKey(ACCOUNT_PUBLIC_ID, 'faq', INSTANCE_ID, 'cs');
  const staleCzechOverlay = objects.get(czechOverlayKey)?.body as {
    baseContentMarker?: string;
    widgetContractHash?: string;
    status?: string;
    values?: Record<string, string>;
  } | undefined;
  assert(staleCzechOverlay?.values);
  staleCzechOverlay.baseContentMarker = `sha256:v1:${'0'.repeat(64)}`;
  staleCzechOverlay.status = 'inSync';
  staleCzechOverlay.values['sections.0.faqs.0.answer'] = 'Stale but complete.';

  let content = await readAccountInstanceContentDocument({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
  });
  assert.equal(content.ok, true);
  assert.equal(content.ok ? content.value.fields['sections.0.faqs.0.answer']?.status : null, 'changed');
  assert.equal((await readTranslatedLocaleValues({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
  }))?.values['sections.0.faqs.0.answer'], 'I piani partono da zero euro.');

  await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it', 'cs'],
  });
  assert.equal(queued.length, 4);

  const czechJob = [...queued].reverse().find((job) => job.targetLocale === 'cs' && job.changedFields.length === 1);
  assert(czechJob);
  await completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: 'cs',
    job: czechJob,
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

test('concurrent locale completions preserve every locale value on instance content', async () => {
  const { env, queued } = createTestEnv();
  const values = await seedSavedFaqInstance(env);

  await generateInstanceTranslations({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    authz: authz(),
    baseLocale: 'en',
    targetLocales: ['it', 'cs', 'fr', 'de'],
  });
  assert.equal(queued.length, 4);

  await Promise.all(queued.map((job) => completeLocaleTranslation({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    locale: job.targetLocale,
    job,
    values: Object.fromEntries(
      Object.entries(values).map(([path, value]) => [path, `${job.targetLocale}:${value}`]),
    ),
  })));

  const content = await readAccountInstanceContentDocument({
    env,
    accountId: ACCOUNT_PUBLIC_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
  });
  assert.equal(content.ok, true);
  const expectedLocales = ['cs', 'de', 'fr', 'it'];
  for (const field of Object.values(content.ok ? content.value.fields : {})) {
    assert.equal(field.status, 'ok');
  }
  assert.deepEqual(
    (await listTranslatedLocales({ env, accountId: ACCOUNT_PUBLIC_ID, instanceId: INSTANCE_ID }))
      .map((entry) => entry.locale),
    expectedLocales,
  );
  for (const locale of expectedLocales) {
    const translated = await readTranslatedLocaleValues({
      env,
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      locale,
    });
    assert.equal(translated?.values['header.title'], `${locale}:${values['header.title']}`);
  }
});
