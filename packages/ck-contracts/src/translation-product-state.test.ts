import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isActiveTranslationGeneration,
  normalizeTranslationGenerationSummary,
} from './translation-product-state';

test('normalizes translation generation wire summary into resolved product state', () => {
  const summary = normalizeTranslationGenerationSummary({
    v: 2,
    instanceId: 'inst_1',
    baseLocale: 'en',
    targetLocales: ['it'],
    status: 'queued',
    requestedAt: '2026-06-02T00:00:00.000Z',
    updatedAt: null,
    totalLocales: 1,
    locales: [{ locale: 'it', state: 'generating', reviewable: false }],
  });

  assert.deepEqual(summary, {
    v: 2,
    instanceId: 'inst_1',
    baseLocale: 'en',
    targetLocales: ['it'],
    status: 'queued',
    active: true,
    requestedAt: '2026-06-02T00:00:00.000Z',
    updatedAt: null,
    totalLocales: 1,
    isCurrentBaseContent: true,
    locales: [{ locale: 'it', state: 'generating', reviewable: false }],
  });
  assert.equal(isActiveTranslationGeneration(summary), true);
});

test('rejects internal-only superseded status on product summary wire contract', () => {
  assert.equal(
    normalizeTranslationGenerationSummary({
      instanceId: 'inst_1',
      baseLocale: 'en',
      targetLocales: ['it'],
      status: 'superseded',
      requestedAt: null,
      updatedAt: null,
      totalLocales: 1,
      locales: [{ locale: 'it', state: 'missing', reviewable: false }],
    }),
    null,
  );
});
