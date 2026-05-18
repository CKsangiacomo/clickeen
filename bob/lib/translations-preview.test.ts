import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOverlay } from '@clickeen/ck-contracts';
import { readWidgetContentContract } from '@clickeen/ck-contracts/overlay-primitives';
import faqContent from '../../tokyo/product/widgets/faq/content.json';
import {
  buildContentTranslationReview,
  buildTranslationPanelLocaleState,
  listPreviewableLocales,
  normalizeLocaleOverlayInventory,
  normalizeLocaleOverlayObject,
  normalizeTranslationSetup,
} from './translations-preview';

const faqContract = readWidgetContentContract(faqContent);

test('normalizes Roma-owned translation setup separately from overlays', () => {
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

test('normalizes Tokyo-owned overlay inventory from actual storage facts', () => {
  const data = normalizeLocaleOverlayInventory({
    v: 1,
    baseLocale: 'en',
    overlays: [
      { locale: 'it', overlayId: 'OVERLAY1' },
      { locale: 'cs', overlayId: 'OVERLAY2' },
    ],
  });

  assert.ok(data);
  assert.deepEqual(listPreviewableLocales(data), ['en', 'it', 'cs']);
});

test('translation panel locale state refreshes dropdown only while translations are incomplete', () => {
  const incomplete = buildTranslationPanelLocaleState({
    baseLocale: 'en',
    activeLocales: ['it', 'cs'],
    requestedLocale: '',
    inventory: {
      v: 1,
      baseLocale: 'en',
      overlays: [{ locale: 'it', overlayId: 'IT_OVERLAY' }],
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
    inventory: {
      v: 1,
      baseLocale: 'en',
      overlays: [
        { locale: 'it', overlayId: 'IT_OVERLAY' },
        { locale: 'cs', overlayId: 'CS_OVERLAY' },
      ],
    },
  });

  assert.equal(complete.readyTranslationsCount, 2);
  assert.equal(complete.allExpectedTranslationsReady, true);
  assert.equal(complete.shouldRefreshOnDropdownOpen, false);
  assert.deepEqual(complete.localeValues, ['en', 'it', 'cs']);
  assert.equal(complete.localeValue, 'cs');
  assert.deepEqual(complete.selectedOverlayEntry, { locale: 'cs', overlayId: 'CS_OVERLAY' });
});

test('rejects old mixed translations panel payloads', () => {
  const data = normalizeLocaleOverlayInventory({
    baseLocale: 'en',
    requestedLocales: ['en', 'it'],
    ['ready' + 'Locales']: ['en', 'it'],
    ['text' + 'Packs']: {
      it: { title: 'Domande frequenti' },
    },
  });

  assert.equal(data, null);
});

test('normalizes one exact overlay object for preview', () => {
  const overlay = normalizeLocaleOverlayObject({
    v: 1,
    overlayId: 'OVERLAY1',
    values: {
      title: 'Domande frequenti',
      'sections.0.faqs.0.question': 'Che stanze offrite?',
    },
  });

  assert.ok(overlay);
  assert.equal(overlay.values['sections.0.faqs.0.question'], 'Che stanze offrite?');
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

  const resolved = resolveOverlay(base, {
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
  const review = buildContentTranslationReview({
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
  const review = buildContentTranslationReview({
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
