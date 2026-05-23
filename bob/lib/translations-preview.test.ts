import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTranslatedValues } from '@clickeen/ck-contracts';
import { readWidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import faqContent from '../../tokyo/product/widgets/faq/editable-fields.json';
import {
  buildEditableFieldsTranslationReview,
  buildTranslationPanelLocaleState,
  listPreviewableLocales,
  normalizeTranslatedLocales,
  normalizeTranslatedLocaleValues,
  normalizeTranslationSetup,
  retainTranslatedLocaleValues,
} from './translations-preview';

const faqContract = readWidgetEditableFieldsContract(faqContent);

test('normalizes Roma-owned translation setup separately from translated values', () => {
  const data = normalizeTranslationSetup({
    v: 1,
    baseLocale: 'en',
    planTranslationsMax: 28,
    activeLocales: ['en', 'it', 'cs', 'it'],
  });

  assert.ok(data);
  assert.equal(data.baseLocale, 'en');
  assert.equal(data.planTranslationsMax, 28);
  assert.deepEqual(data.activeLocales, ['it', 'cs']);
});

test('normalizes Tokyo-owned translated locale list from current values', () => {
  const data = normalizeTranslatedLocales({
    v: 1,
    baseLocale: 'en',
    translations: [
      { locale: 'it' },
      { locale: 'cs' },
    ],
  });

  assert.ok(data);
  assert.deepEqual(listPreviewableLocales(data), ['en', 'it', 'cs']);
});

test('retains loaded translation values across polling refreshes', () => {
  assert.deepEqual(
    retainTranslatedLocaleValues(
      {
        it: { 'header.title': 'Domande' },
        cs: { 'header.title': 'Otazky' },
      },
      {
        v: 1,
        baseLocale: 'en',
        translations: [{ locale: 'it' }],
      },
    ),
    {
      it: { 'header.title': 'Domande' },
    },
  );
});

test('translation panel locale state refreshes dropdown only while translations are incomplete', () => {
  const incomplete = buildTranslationPanelLocaleState({
    baseLocale: 'en',
    activeLocales: ['it', 'cs'],
    requestedLocale: '',
    translatedLocales: {
      v: 1,
      baseLocale: 'en',
      translations: [{ locale: 'it' }],
    },
  });

  assert.equal(incomplete.expectedTranslationsCount, 2);
  assert.equal(incomplete.readyTranslationsCount, 1);
  assert.equal(incomplete.allExpectedTranslationsReady, false);
  assert.equal(incomplete.shouldRefreshOnDropdownOpen, true);
  assert.deepEqual(incomplete.localeValues, ['en', 'it']);

  const complete = buildTranslationPanelLocaleState({
    baseLocale: 'en',
    activeLocales: ['it', 'cs'],
    requestedLocale: 'cs',
    translatedLocales: {
      v: 1,
      baseLocale: 'en',
      translations: [
        { locale: 'it' },
        { locale: 'cs' },
      ],
    },
  });

  assert.equal(complete.readyTranslationsCount, 2);
  assert.equal(complete.allExpectedTranslationsReady, true);
  assert.equal(complete.shouldRefreshOnDropdownOpen, false);
  assert.deepEqual(complete.localeValues, ['en', 'it', 'cs']);
  assert.equal(complete.localeValue, 'cs');
  assert.deepEqual(complete.selectedTranslationEntry, { locale: 'cs' });
});

test('rejects old mixed translations panel payloads', () => {
  const data = normalizeTranslatedLocales({
    baseLocale: 'en',
    requestedLocales: ['en', 'it'],
    ['ready' + 'Locales']: ['en', 'it'],
    ['text' + 'Packs']: {
      it: { title: 'Domande frequenti' },
    },
  });

  assert.equal(data, null);
});

test('normalizes one exact translated locale value object for preview', () => {
  const translation = normalizeTranslatedLocaleValues({
    v: 1,
    locale: 'it',
    values: {
      title: 'Domande frequenti',
      'sections.0.faqs.0.question': 'Che stanze offrite?',
    },
  });

  assert.ok(translation);
  assert.equal(translation.values['sections.0.faqs.0.question'], 'Che stanze offrite?');
});

test('resolves FAQ language values across title CTA section questions and answers', () => {
  const base = {
    header: { title: 'Bed and Breakfast FAQs' },
    cta: { label: 'Book Now' },
    sections: [
      {
        title: 'Rooms',
        faqs: [
          {
            question: 'What rooms do you offer?',
            answer: 'We offer suites and standard rooms.',
          },
        ],
      },
    ],
  };

  const resolved = resolveTranslatedValues(base, {
    'header.title': 'Domande frequenti',
    'cta.label': 'Prenota ora',
    'sections.0.title': 'Camere',
    'sections.0.faqs.0.question': 'Che stanze offrite?',
    'sections.0.faqs.0.answer': 'Offriamo suite e camere standard.',
  });

  assert.equal(resolved.header.title, 'Domande frequenti');
  assert.equal(resolved.cta.label, 'Prenota ora');
  assert.equal(resolved.sections[0]?.title, 'Camere');
  assert.equal(resolved.sections[0]?.faqs[0]?.question, 'Che stanze offrite?');
  assert.equal(resolved.sections[0]?.faqs[0]?.answer, 'Offriamo suite e camere standard.');
});

test('builds translation review from stored current language values', () => {
  const review = buildEditableFieldsTranslationReview({
    contract: faqContract,
    config: {
      header: { title: 'FAQs', subtitleHtml: 'Quick answers' },
      cta: { label: 'Book now' },
      sections: [
        {
          title: 'Rooms',
          faqs: [
            {
              question: 'What rooms do you offer?',
              answer: 'We offer suites.',
            },
          ],
        },
      ],
    },
    values: {
      'header.title': 'Domande frequenti',
      'header.subtitleHtml': 'Risposte rapide',
      'cta.label': 'Prenota ora',
      'sections.0.title': 'Camere',
      'sections.0.faqs.0.question': 'Che stanze offrite?',
      'sections.0.faqs.0.answer': 'Offriamo suite.',
    },
  });

  assert.deepEqual(review.missingPaths, []);
  assert.equal(review.sections[0]?.title, 'Header');
  assert.equal(review.sections[2]?.title, 'Camere');
  assert.equal(review.sections[2]?.items[1]?.label, 'FAQ question');
  assert.equal(review.sections[2]?.items[1]?.value, 'Che stanze offrite?');
  assert.equal(review.sections[2]?.items[2]?.label, 'FAQ answer');
  assert.equal(review.sections[2]?.items[2]?.value, 'Offriamo suite.');
});

test('reports missing current language values in translation review', () => {
  const review = buildEditableFieldsTranslationReview({
    contract: faqContract,
    config: {
      header: { title: 'FAQs', subtitleHtml: 'Quick answers' },
      cta: { label: 'Book now' },
      sections: [
        {
          title: 'Rooms',
          faqs: [{ question: 'What rooms?', answer: 'Suites.' }],
        },
      ],
    },
    values: {
      'header.title': 'Domande frequenti',
      'header.subtitleHtml': 'Risposte rapide',
      'cta.label': 'Prenota ora',
      'sections.0.title': 'Camere',
      'sections.0.faqs.0.question': 'Che stanze?',
    },
  });

  assert.deepEqual(review.missingPaths, ['sections.0.faqs.0.answer']);
});
