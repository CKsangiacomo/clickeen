import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOverlay } from '@clickeen/ck-contracts';
import {
  listPreviewableLanguages,
  normalizeTranslationsPreviewData,
} from './translations-preview';

test('normalizes selected overlay values for previewable languages', () => {
  const data = normalizeTranslationsPreviewData({
    v: 1,
    baseLanguage: 'en',
    languages: [
      { language: 'it', label: 'Italiano', overlayId: 'OVERLAY1' },
      { language: 'cs', label: 'Czech', overlayId: null },
    ],
    valuesByLanguage: {
      it: {
        title: 'Domande frequenti',
        'sections.0.faqs.0.question': 'Che stanze offrite?',
      },
    },
    progress: [],
  });

  assert.ok(data);
  assert.deepEqual(listPreviewableLanguages(data), ['en', 'it']);
  assert.equal(data.valuesByLanguage.it['sections.0.faqs.0.question'], 'Che stanze offrite?');
});

test('rejects overlay rows that point at missing values', () => {
  const data = normalizeTranslationsPreviewData({
    v: 1,
    baseLanguage: 'en',
    languages: [{ language: 'it', label: 'Italiano', overlayId: 'OVERLAY1' }],
    valuesByLanguage: {},
    progress: [],
  });

  assert.equal(data, null);
});

test('rejects legacy translation payloads', () => {
  const data = normalizeTranslationsPreviewData({
    baseLocale: 'en',
    requestedLocales: ['en', 'it'],
    ['ready' + 'Locales']: ['en', 'it'],
    ['text' + 'Packs']: {
      it: { title: 'Domande frequenti' },
    },
  });

  assert.equal(data, null);
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
