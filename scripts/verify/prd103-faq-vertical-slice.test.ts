import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildCurrentLanguageValues,
  buildFaqSavedTextGraph,
  selectFaqFieldsNeedingTranslation,
  type FaqLanguageValue,
  type FaqSavedTextField,
} from '../../packages/ck-contracts/src/faq-language-values.ts';
import {
  extractTextPrimitiveValues,
  readWidgetContentContract,
  resolveOverlay,
  validateOverlayValuesForTextPrimitives,
  widgetContentToOverlayContract,
} from '../../packages/ck-contracts/src/overlay-primitives.ts';
import { buildContentTranslationReview } from '../../bob/lib/translations-preview.ts';
import { normalizeInstanceTranslationAgentRequest } from '../../sanfrancisco/src/l10n-account-routes.ts';

const repoRoot = process.cwd();
const spec = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tokyo/product/widgets/faq/spec.json'), 'utf8'));
const contract = readWidgetContentContract(
  JSON.parse(fs.readFileSync(path.join(repoRoot, 'tokyo/product/widgets/faq/content.json'), 'utf8')),
);
const specWithGeneratedOverlays = {
  ...spec,
  overlays: widgetContentToOverlayContract(contract),
};

function previousFaqConfig() {
  return {
    header: { title: 'FAQs', subtitleHtml: 'Quick answers' },
    cta: { label: 'Contact us' },
    sections: [
      {
        id: 'general',
        title: 'General',
        faqs: [
          { id: 'pricing', question: 'What does it cost?', answer: 'Plans start free.', defaultOpen: false },
          { id: 'setup', question: 'How long is setup?', answer: 'A few minutes.', defaultOpen: false },
        ],
      },
    ],
  };
}

function savedGraph(config: Record<string, unknown>): FaqSavedTextField[] {
  return buildFaqSavedTextGraph({
    contract,
    config,
    instanceId: 'INSTFAQ001',
  });
}

function previousSpanishValues(fields: FaqSavedTextField[]): FaqLanguageValue[] {
  return fields.map((field) => ({
    identity: field.identity,
    locale: 'es',
    value: `es-old:${field.baseText}`,
    updatedAt: '2026-05-17T00:00:00.000Z',
    jobId: 'job-old',
  }));
}

test('PRD 103V: one FAQ edit produces complete current language values visible in Bob review and preview', () => {
  const beforeConfig = previousFaqConfig();
  const afterConfig = previousFaqConfig();
  afterConfig.sections[0].faqs[0].answer = 'Plans start at zero dollars.';

  const previousSavedTextGraph = savedGraph(beforeConfig);
  const currentSavedTextGraph = savedGraph(afterConfig);
  const previousLanguageValues = previousSpanishValues(previousSavedTextGraph);
  const changedFields = selectFaqFieldsNeedingTranslation({
    previousSavedTextGraph,
    currentSavedTextGraph,
    previousLanguageValues,
  });

  assert.deepEqual(
    changedFields.map((field) => field.identity.path),
    ['sections.0.faqs.0.answer'],
  );

  const agentRequest = normalizeInstanceTranslationAgentRequest({
    v: 1,
    operation: 'translate_saved_instance',
    accountId: 'acc_test',
    instanceId: 'INSTFAQ001',
    widgetType: 'faq',
    baseLocale: 'en',
    targetLocale: 'es',
    jobId: 'job-103v',
    currentSavedTextGraph: changedFields.map((field) => ({
      path: field.identity.path,
      type: field.type,
      label: field.label,
      role: field.identity.role,
      value: field.baseText,
    })),
  });
  assert(agentRequest);
  assert.equal(agentRequest.operation, 'translate_saved_instance');
  assert.deepEqual(
    agentRequest.currentSavedTextGraph.map((field) => field.path),
    ['sections.0.faqs.0.answer'],
  );

  const translatedValues = changedFields.map((field) => ({
    identity: field.identity,
    value: 'Los planes empiezan en cero dolares.',
  }));
  const merged = buildCurrentLanguageValues({
    previousSavedTextGraph,
    currentSavedTextGraph,
    previousLanguageValues,
    translatedValues,
    locale: 'es',
    updatedAt: '2026-05-18T00:00:00.000Z',
    jobId: 'job-103v',
  });
  assert.equal(merged.ok, true);
  assert.equal(merged.ok ? merged.values.length : 0, currentSavedTextGraph.length);

  const currentLanguageValues = Object.fromEntries(
    (merged.ok ? merged.values : []).map((value) => [value.identity.path, value.value]),
  );
  assert.equal(currentLanguageValues['sections.0.faqs.0.answer'], 'Los planes empiezan en cero dolares.');
  assert.equal(currentLanguageValues['header.title'], 'es-old:FAQs');

  const textItems = extractTextPrimitiveValues({
    spec: specWithGeneratedOverlays,
    config: afterConfig,
  });
  assert.deepEqual(validateOverlayValuesForTextPrimitives(textItems, currentLanguageValues), { ok: true });

  const review = buildContentTranslationReview({
    contract,
    config: afterConfig,
    values: currentLanguageValues,
  });
  const answerItem = review.sections
    .flatMap((section) => section.items)
    .find((item) => item.path === 'sections.0.faqs.0.answer');
  assert.equal(answerItem?.value, 'Los planes empiezan en cero dolares.');
  assert.deepEqual(review.missingPaths, []);

  const previewConfig = resolveOverlay(afterConfig, currentLanguageValues);
  assert.equal(previewConfig.sections[0].faqs[0].answer, 'Los planes empiezan en cero dolares.');
});

test('PRD 103V failure fixture: missing changed translation does not create partial current language values', () => {
  const beforeConfig = previousFaqConfig();
  const afterConfig = previousFaqConfig();
  afterConfig.sections[0].faqs[0].answer = 'Plans start at zero dollars.';

  const previousSavedTextGraph = savedGraph(beforeConfig);
  const currentSavedTextGraph = savedGraph(afterConfig);
  const previousLanguageValues = previousSpanishValues(previousSavedTextGraph);
  const merged = buildCurrentLanguageValues({
    previousSavedTextGraph,
    currentSavedTextGraph,
    previousLanguageValues,
    translatedValues: [],
    locale: 'es',
    updatedAt: '2026-05-18T00:00:00.000Z',
    jobId: 'job-103v-failed',
  });

  assert.equal(merged.ok, false);
  assert.equal(merged.ok ? '' : merged.reason, 'missing_changed_translation');
  assert.deepEqual(merged.values, previousLanguageValues);
});
