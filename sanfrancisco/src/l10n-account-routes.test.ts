import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeBabelTextProducerRequest,
  produceBabelTextValues,
} from './l10n-account-routes.ts';
import type { AIGrant, Env } from './types.ts';

const grant: AIGrant = {
  v: 1,
  iss: 'roma',
  sub: { kind: 'user', userId: 'usr_test', accountId: 'acc_test' },
  exp: Math.floor(Date.now() / 1000) + 60,
  caps: ['agent:widget.instance.translator'],
  budgets: { maxTokens: 1000 },
  mode: 'ops',
};

const env = {
  AI_GRANT_HMAC_SECRET: 'test-secret',
} as Env;

test('Babel text producer request accepts exact concrete paths only', () => {
  const request = normalizeBabelTextProducerRequest({
    v: 1,
    widgetType: 'faq',
    sourceLanguage: 'en',
    targetLanguage: 'it',
    items: [
      { path: 'header.title', type: 'string', value: 'FAQ' },
      { path: 'sections.0.faqs.0.question', type: 'string', value: 'https://example.com' },
      { path: 'sections.0.faqs.0.answer', type: 'richtext', value: '' },
    ],
  });

  assert.equal(request?.items.length, 3);
  assert.deepEqual(
    request?.items.map((item) => item.path),
    ['header.title', 'sections.0.faqs.0.question', 'sections.0.faqs.0.answer'],
  );
});

test('Babel text producer request rejects pattern and duplicate paths', () => {
  assert.equal(
    normalizeBabelTextProducerRequest({
      v: 1,
      widgetType: 'faq',
      sourceLanguage: 'en',
      targetLanguage: 'it',
      items: [{ path: 'sections[].faqs[].question', type: 'string', value: 'Question?' }],
    }),
    null,
  );

  assert.equal(
    normalizeBabelTextProducerRequest({
      v: 1,
      widgetType: 'faq',
      sourceLanguage: 'en',
      targetLanguage: 'it',
      items: [
        { path: 'header.title', type: 'string', value: 'FAQ' },
        { path: 'header.title', type: 'string', value: 'FAQ again' },
      ],
    }),
    null,
  );
});

test('Babel text producer returns exact value set for direct non-translatable values', async () => {
  const request = normalizeBabelTextProducerRequest({
    v: 1,
    widgetType: 'faq',
    sourceLanguage: 'en',
    targetLanguage: 'it',
    items: [
      { path: 'cta.label', type: 'string', value: '' },
      { path: 'sections.0.faqs.0.question', type: 'string', value: 'https://example.com' },
    ],
  });
  assert(request);

  const produced = await produceBabelTextValues({ env, grant, request });
  assert.deepEqual(produced, {
    v: 1,
    values: {
      'cta.label': '',
      'sections.0.faqs.0.question': 'https://example.com',
    },
  });
});
