import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildCurrentLanguageValues,
  buildFaqSavedTextGraph,
  faqFieldIdentityKey,
  selectFaqFieldsNeedingTranslation,
  type FaqLanguageValue,
  type FaqSavedTextField,
} from './faq-language-values.ts';
import { readWidgetEditableFieldsContract } from './overlay-primitives.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const contract = readWidgetEditableFieldsContract(
  JSON.parse(fs.readFileSync(path.join(repoRoot, 'tokyo/product/widgets/faq/editable-fields.json'), 'utf8')),
);

function config() {
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

function graph(currentConfig: Record<string, unknown> = config()): FaqSavedTextField[] {
  return buildFaqSavedTextGraph({
    contract,
    config: currentConfig,
    instanceId: 'INSTFAQ001',
  });
}

function translationsFor(fields: FaqSavedTextField[], prefix = 'it'): Array<{ identity: FaqSavedTextField['identity']; value: string }> {
  return fields.map((field) => ({
    identity: field.identity,
    value: `${prefix}:${field.baseText}`,
  }));
}

function previousValues(fields: FaqSavedTextField[]): FaqLanguageValue[] {
  return fields.map((field) => ({
    identity: field.identity,
    locale: 'it',
    value: `old:${field.baseText}`,
    updatedAt: '2026-05-16T00:00:00.000Z',
    jobId: 'job-old',
  }));
}

test('FAQ text graph uses stable IDs instead of array indexes for identity', () => {
  const before = graph();
  const reorderedConfig = config();
  reorderedConfig.sections[0].faqs.reverse();
  const after = graph(reorderedConfig);

  const beforeKeys = before.map((field) => faqFieldIdentityKey(field.identity)).sort();
  const afterKeys = after.map((field) => faqFieldIdentityKey(field.identity)).sort();
  assert.deepEqual(afterKeys, beforeKeys);
});

test('FAQ text graph uses the shared editable text primitive contract', () => {
  const fields = graph({
    header: { title: 'FAQs', subtitleHtml: { html: 'bad shape' } },
    cta: { label: 42 },
    sections: [
      {
        id: 'general',
        title: ['bad shape'],
        faqs: [{ id: 'pricing', question: 'What does it cost?', answer: { html: 'bad shape' } }],
      },
    ],
  });
  const values = Object.fromEntries(fields.map((field) => [field.identity.path, field.baseText]));

  assert.equal(values['header.title'], 'FAQs');
  assert.equal(values['header.subtitleHtml'], '');
  assert.equal(values['cta.label'], '');
  assert.equal(values['sections.0.title'], '');
  assert.equal(values['sections.0.faqs.0.question'], 'What does it cost?');
  assert.equal(values['sections.0.faqs.0.answer'], '');
});

test('buildCurrentLanguageValues carries unchanged translations across reorder', () => {
  const before = graph();
  const reorderedConfig = config();
  reorderedConfig.sections[0].faqs.reverse();
  const after = graph(reorderedConfig);
  const merged = buildCurrentLanguageValues({
    previousSavedTextGraph: before,
    currentSavedTextGraph: after,
    previousLanguageValues: previousValues(before),
    translatedValues: [],
    locale: 'it',
    updatedAt: '2026-05-17T00:00:00.000Z',
    jobId: 'job-new',
  });

  assert.equal(merged.ok, true);
  assert.deepEqual(
    merged.ok ? merged.values.map((value) => value.value).sort() : [],
    previousValues(before).map((value) => value.value).sort(),
  );
});

test('buildCurrentLanguageValues translates only inserted FAQ fields', () => {
  const before = graph();
  const next = config();
  next.sections[0].faqs.push({ id: 'security', question: 'Is it secure?', answer: 'Yes.', defaultOpen: false });
  const after = graph(next);
  const changed = after.filter((field) => !before.some((old) => faqFieldIdentityKey(old.identity) === faqFieldIdentityKey(field.identity)));
  const merged = buildCurrentLanguageValues({
    previousSavedTextGraph: before,
    currentSavedTextGraph: after,
    previousLanguageValues: previousValues(before),
    translatedValues: translationsFor(changed, 'new'),
    locale: 'it',
    updatedAt: '2026-05-17T00:00:00.000Z',
    jobId: 'job-new',
  });

  assert.equal(merged.ok, true);
  assert.equal(merged.ok ? merged.values.filter((value) => value.value.startsWith('new:')).length : 0, 2);
});

test('selectFaqFieldsNeedingTranslation selects whole changed fields only', () => {
  const before = graph();
  const next = config();
  next.sections[0].faqs[0].answer = 'Plans start at zero dollars.';
  const after = graph(next);
  const changed = selectFaqFieldsNeedingTranslation({
    previousSavedTextGraph: before,
    currentSavedTextGraph: after,
    previousLanguageValues: previousValues(before),
  });

  assert.deepEqual(
    changed.map((field) => field.identity.path),
    ['sections.0.faqs.0.answer'],
  );
  assert.equal(changed[0]?.baseText, 'Plans start at zero dollars.');
});

test('buildCurrentLanguageValues translates unchanged fields when no previous language value exists', () => {
  const before = graph();
  const previous = previousValues(before).filter((value) => value.identity.role !== 'faq-answer');
  const missing = before.filter((field) => field.identity.role === 'faq-answer');
  const merged = buildCurrentLanguageValues({
    previousSavedTextGraph: before,
    currentSavedTextGraph: before,
    previousLanguageValues: previous,
    translatedValues: translationsFor(missing, 'fill'),
    locale: 'it',
    updatedAt: '2026-05-17T00:00:00.000Z',
    jobId: 'job-new',
  });

  assert.equal(merged.ok, true);
  assert.equal(merged.ok ? merged.values.filter((value) => value.value.startsWith('fill:')).length : 0, 2);
});

test('buildCurrentLanguageValues removes deleted FAQ fields only', () => {
  const before = graph();
  const next = config();
  next.sections[0].faqs = next.sections[0].faqs.slice(0, 1);
  const after = graph(next);
  const merged = buildCurrentLanguageValues({
    previousSavedTextGraph: before,
    currentSavedTextGraph: after,
    previousLanguageValues: previousValues(before),
    translatedValues: [],
    locale: 'it',
    updatedAt: '2026-05-17T00:00:00.000Z',
    jobId: 'job-new',
  });

  assert.equal(merged.ok, true);
  assert.equal(merged.ok ? merged.values.some((value) => value.identity.faqId === 'setup') : true, false);
  assert.equal(merged.ok ? merged.values.some((value) => value.identity.faqId === 'pricing') : false, true);
});

test('buildCurrentLanguageValues uses translated value for changed base text', () => {
  const before = graph();
  const oldValues = previousValues(before);

  const next = config();
  next.sections[0].faqs[0].question = 'What does Clickeen cost?';
  const after = graph(next);
  const changed = after.filter((field) => field.identity.role === 'faq-question' && field.identity.faqId === 'pricing');
  const merged = buildCurrentLanguageValues({
    previousSavedTextGraph: before,
    currentSavedTextGraph: after,
    previousLanguageValues: oldValues,
    translatedValues: translationsFor(changed, 'changed'),
    locale: 'it',
    updatedAt: '2026-05-17T00:00:00.000Z',
    jobId: 'job-new',
  });

  assert.equal(merged.ok, true);
  const preserved = merged.ok
    ? merged.values.find((value) => value.identity.role === 'faq-question' && value.identity.faqId === 'pricing')
    : null;
  assert.equal(preserved?.value, 'changed:What does Clickeen cost?');
  assert.equal(preserved?.jobId, 'job-new');
});

test('buildCurrentLanguageValues fails closed on partial missing changed translation', () => {
  const before = graph();
  const next = config();
  next.sections[0].faqs[0].answer = 'Plans start at zero dollars.';
  const after = graph(next);
  const merged = buildCurrentLanguageValues({
    previousSavedTextGraph: before,
    currentSavedTextGraph: after,
    previousLanguageValues: previousValues(before),
    translatedValues: [],
    locale: 'it',
    updatedAt: '2026-05-17T00:00:00.000Z',
    jobId: 'job-new',
  });

  assert.equal(merged.ok, false);
  assert.equal(merged.ok ? '' : merged.reason, 'missing_changed_translation');
  assert.deepEqual(merged.values, previousValues(before));
});

test('FAQ duplicate or missing IDs fail before translation', () => {
  const duplicate = config();
  duplicate.sections[0].faqs[1].id = 'pricing';
  assert.throws(() => graph(duplicate), /faq_language\.faq_id_invalid/);

  const missing = config();
  missing.sections[0].id = '';
  assert.throws(() => graph(missing), /faq_language\.section_id_invalid/);
});
