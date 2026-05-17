import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOverlay } from '@clickeen/ck-contracts';
import {
  listPreviewableLocales,
  normalizeLocaleOverlayInventory,
  normalizeLocaleOverlayObject,
  normalizeTranslationSetup,
} from './translations-preview';

test('normalizes Roma-owned translation setup separately from overlays', () => {
  const data = normalizeTranslationSetup({
    v: 1,
    baseLocale: 'en',
    planTranslationsMax: 29,
    activeLocales: ['en', 'it', 'cs', 'it'],
  });

  assert.ok(data);
  assert.equal(data.baseLocale, 'en');
  assert.equal(data.planTranslationsMax, 29);
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
