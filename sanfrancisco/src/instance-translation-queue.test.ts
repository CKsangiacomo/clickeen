import assert from 'node:assert/strict';
import test from 'node:test';
import { readWidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import type { InstanceTranslationJob } from '@clickeen/ck-contracts/instance-translation-jobs';
import {
  buildFaqSavedTextGraph,
  selectFaqFieldsNeedingTranslation,
  type FaqLanguageValue,
} from '@clickeen/ck-contracts/faq-language-values';
import { resolveAiAgent } from '@clickeen/ck-contracts/ai';
import { resolveAiRuntimeBudget, resolveAiRuntimePolicy } from '@clickeen/ck-policy';
import editableFieldsJson from '../../tokyo/product/widgets/faq/editable-fields.json';
import { handleInstanceTranslationQueueMessage } from './instance-translation-queue';
import type { Env } from './types';

const ACCOUNT_PUBLIC_ID = 'A1B2C3D4';
const INSTANCE_ID = 'I1B2C3D4E5';
const contract = readWidgetEditableFieldsContract(editableFieldsJson);

function previousConfig() {
  return {
    header: { title: 'FAQs', subtitleHtml: 'Quick answers' },
    cta: { label: 'Book now' },
    sections: [
      {
        id: 'rooms',
        title: 'Rooms',
        faqs: [
          {
            id: 'room-types',
            question: 'What rooms do you offer?',
            answer: 'We offer suites.',
          },
        ],
      },
    ],
  };
}

function previousLanguageValues(fields: ReturnType<typeof buildFaqSavedTextGraph>): FaqLanguageValue[] {
  return fields.map((field) => ({
    identity: field.identity,
    locale: 'it',
    value: `it-old:${field.baseText}`,
    updatedAt: '2026-05-17T00:00:00.000Z',
    jobId: 'job-old',
  }));
}

function translationJob(): InstanceTranslationJob {
  const before = previousConfig();
  const after = previousConfig();
  after.sections[0].faqs[0].answer = 'https://example.com/new-room-list';
  const previousSavedTextGraph = buildFaqSavedTextGraph({
    contract,
    config: before,
    instanceId: INSTANCE_ID,
  });
  const currentSavedTextGraph = buildFaqSavedTextGraph({
    contract,
    config: after,
    instanceId: INSTANCE_ID,
  });
  const values = previousLanguageValues(previousSavedTextGraph);
  const changedFields = selectFaqFieldsNeedingTranslation({
    previousSavedTextGraph,
    currentSavedTextGraph,
    previousLanguageValues: values,
  });
  const agent = resolveAiAgent('widget.instance.translator');
  assert(agent);
  const ai = resolveAiRuntimePolicy({ entry: agent.entry, policyProfile: 'free' });
  const budget = resolveAiRuntimeBudget(ai);
  return {
    v: 1,
    kind: 'instance.translation.locale_values',
    jobId: 'job-queue-it',
    accountId: 'acct_test',
    accountPublicId: ACCOUNT_PUBLIC_ID,
    userId: 'usr_test',
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    widgetContractVersion: 1,
    baseLocale: 'en',
    targetLocale: 'it',
    targetLocales: ['it'],
    requestedAt: '2026-05-18T00:00:00.000Z',
    requestId: 'req_queue_worker',
    ai,
    budgets: { maxTokens: budget.maxTokens, timeoutMs: budget.timeoutMs },
    previousSavedTextGraph,
    currentSavedTextGraph,
    previousLanguageValues: values,
    changedFields,
    deletedFieldKeys: [],
  };
}

test('San Francisco queue job completes one translated locale with changed values only', async () => {
  const writes: Array<Record<string, any>> = [];
  let acked = false;
  const env = {
    AI_GRANT_HMAC_SECRET: 'test-secret',
    TOKYO_PRODUCT_CONTROL: {
      async fetch(input: RequestInfo | URL, init?: RequestInit) {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        if (url.pathname === `/__internal/instances/${INSTANCE_ID}/translations/it/complete`) {
          writes.push(body);
          return new Response(JSON.stringify({ ok: true, completion: { ok: true, applied: true, locale: 'it' } }), {
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: { detail: url.pathname } }), { status: 500 });
      },
    },
  } as Env;
  const handled = await handleInstanceTranslationQueueMessage(env, {
    body: translationJob(),
    attempts: 1,
    ack() {
      acked = true;
    },
    retry() {
      throw new Error('unexpected retry');
    },
  } as unknown as Message<unknown>);

  assert.equal(handled, true);
  assert.equal(acked, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.job.jobId, 'job-queue-it');
  assert.equal(writes[0]?.values['sections.0.faqs.0.answer'], 'https://example.com/new-room-list');
  assert.equal(Object.prototype.hasOwnProperty.call(writes[0]?.values ?? {}, 'header.title'), false);
});

test('San Francisco reports non-retryable provider failures to Tokyo before ack', async () => {
  const failures: Array<Record<string, any>> = [];
  let acked = false;
  let retried = false;
  const job = translationJob();
  job.changedFields = job.changedFields.map((field) => ({
    ...field,
    baseText: 'Please translate this answer now.',
  }));
  const env = {
    AI_GRANT_HMAC_SECRET: 'test-secret',
    TOKYO_PRODUCT_CONTROL: {
      async fetch(input: RequestInfo | URL, init?: RequestInit) {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        if (url.pathname === `/__internal/instances/${INSTANCE_ID}/translations/it/fail`) {
          failures.push(body);
          return new Response(JSON.stringify({
            ok: true,
            failure: {
              ok: true,
              recorded: true,
              locale: 'it',
              reasonKey: body.reasonKey,
              detail: body.detail,
            },
          }), {
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: { detail: url.pathname } }), { status: 500 });
      },
    },
  } as Env;

  const handled = await handleInstanceTranslationQueueMessage(env, {
    body: job,
    attempts: 1,
    ack() {
      acked = true;
    },
    retry() {
      retried = true;
    },
  } as unknown as Message<unknown>);

  assert.equal(handled, true);
  assert.equal(acked, true);
  assert.equal(retried, false);
  assert.equal(failures.length, 1);
  assert.equal(failures[0]?.job.jobId, 'job-queue-it');
  assert.equal(failures[0]?.reasonKey, 'instance.translation.provider_unavailable');
  assert.match(String(failures[0]?.detail), /Missing .*API_KEY/);
});

test('San Francisco reports retry-exhausted terminal failures to Tokyo', async () => {
  const failures: Array<Record<string, any>> = [];
  let acked = false;
  let retried = false;
  const env = {
    AI_GRANT_HMAC_SECRET: 'test-secret',
    TOKYO_PRODUCT_CONTROL: {
      async fetch(input: RequestInfo | URL, init?: RequestInit) {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        if (url.pathname === `/__internal/instances/${INSTANCE_ID}/translations/it/complete`) {
          return new Response(JSON.stringify({ error: { detail: 'temporary tokyo failure' } }), { status: 500 });
        }
        if (url.pathname === `/__internal/instances/${INSTANCE_ID}/translations/it/fail`) {
          failures.push(body);
          return new Response(JSON.stringify({
            ok: true,
            failure: {
              ok: true,
              recorded: true,
              locale: 'it',
              reasonKey: body.reasonKey,
              detail: body.detail,
            },
          }), {
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: { detail: url.pathname } }), { status: 500 });
      },
    },
  } as Env;

  const handled = await handleInstanceTranslationQueueMessage(env, {
    body: translationJob(),
    attempts: 8,
    ack() {
      acked = true;
    },
    retry() {
      retried = true;
    },
  } as unknown as Message<unknown>);

  assert.equal(handled, true);
  assert.equal(acked, true);
  assert.equal(retried, false);
  assert.equal(failures.length, 1);
  assert.equal(failures[0]?.reasonKey, 'instance.translation.retry_exhausted');
  assert.match(String(failures[0]?.detail), /temporary tokyo failure/);
});
