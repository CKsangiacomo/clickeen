import assert from 'node:assert/strict';
import {
  buildActivityRows,
  buildTranslationGenerationFeedback,
  shouldRefreshTranslationsAfterGeneration,
} from '../components/TranslationsPanel';

assert.deepEqual(
  buildActivityRows([
    { message: 'Writing translations' },
    { message: 'French written' },
    { message: 'German written' },
  ]).map((row) => row.message),
  [
    'Writing translations',
    'French written',
    'German written',
  ],
);

const success = buildTranslationGenerationFeedback({
  ok: true,
  status: 200,
  json: {
    ok: true,
    translation: {
      ok: true,
      accepted: true,
      baseLocale: 'en',
      requestedLocales: ['fr', 'de'],
      translatedLocales: ['fr', 'de'],
      failedLocales: [],
    },
  },
});
assert.equal(success.tone, 'success');
assert.equal(success.title, 'Translations generated');
assert.deepEqual(success.lines, ['Generated translations for French, German.', 'Preview translations have been refreshed.']);

const notAccepted = buildTranslationGenerationFeedback({
  ok: true,
  status: 200,
  json: {
    ok: true,
    translation: {
      ok: true,
      accepted: false,
      baseLocale: 'en',
      requestedLocales: [],
      translatedLocales: [],
      failedLocales: [],
    },
  },
});
assert.equal(notAccepted.tone, 'warning');
assert.equal(notAccepted.title, 'No translations generated');
assert.equal(shouldRefreshTranslationsAfterGeneration({
  translation: {
    accepted: false,
  },
}), false);

const commandFailure = buildTranslationGenerationFeedback({
  ok: false,
  status: 403,
  json: {
    error: {
      reasonKey: 'coreui.errors.auth.forbidden',
    },
  },
});
assert.equal(commandFailure.tone, 'error');
assert.equal(commandFailure.title, 'Translation generation failed');
assert.deepEqual(commandFailure.lines, ['You do not have permission to generate translations for this account.']);

assert.equal(shouldRefreshTranslationsAfterGeneration({
  translation: {
    accepted: true,
    translatedLocales: [],
  },
}), false);

const partial = buildTranslationGenerationFeedback({
  ok: true,
  status: 200,
  json: {
    ok: false,
    translation: {
      ok: false,
      accepted: true,
      baseLocale: 'en',
      requestedLocales: ['fr', 'de', 'it'],
      translatedLocales: ['fr', 'it'],
      failedLocales: [
        {
          locale: 'de',
          reasonKey: 'coreui.errors.translation.providerFailed',
          detail: 'Provider failure',
        },
      ],
    },
  },
});
assert.equal(partial.tone, 'warning');
assert.equal(partial.title, 'Translations partially generated');
assert.match(partial.lines.join(' '), /German/);
assert.doesNotMatch(partial.lines.join(' '), /providerFailed|Provider failure/);
assert.equal(shouldRefreshTranslationsAfterGeneration({
  translation: {
    ok: false,
    accepted: true,
    requestedLocales: ['fr', 'de', 'it'],
    translatedLocales: ['fr', 'it'],
    failedLocales: [{ locale: 'de', reasonKey: 'coreui.errors.translation.providerFailed' }],
  },
}), true);

const allFailedPayload = {
  ok: false,
  translation: {
    ok: false,
    accepted: true,
    baseLocale: 'en',
    requestedLocales: ['fr', 'de'],
    translatedLocales: [],
    failedLocales: [
      { locale: 'fr', reasonKey: 'coreui.errors.translation.providerFailed' },
      { locale: 'de', reasonKey: 'coreui.errors.translation.providerFailed' },
    ],
  },
};
const allFailed = buildTranslationGenerationFeedback({
  ok: true,
  status: 200,
  json: allFailedPayload,
});
assert.equal(allFailed.tone, 'error');
assert.equal(allFailed.title, 'Translation generation failed');
assert.match(allFailed.lines.join(' '), /French, German/);
assert.equal(shouldRefreshTranslationsAfterGeneration(allFailedPayload), false);

const malformedPartial = buildTranslationGenerationFeedback({
  ok: true,
  status: 200,
  json: {
    ok: true,
    translation: {
      ok: true,
      accepted: true,
      baseLocale: 'en',
      requestedLocales: ['fr', 'de'],
      translatedLocales: ['fr'],
      failedLocales: [],
    },
  },
});
assert.equal(malformedPartial.tone, 'error');
assert.match(malformedPartial.lines.join(' '), /result was incomplete/);
assert.equal(shouldRefreshTranslationsAfterGeneration({
  translation: {
    ok: true,
    accepted: true,
    requestedLocales: ['fr', 'de'],
    translatedLocales: ['fr'],
    failedLocales: [],
  },
}), false);

const missingAccepted = buildTranslationGenerationFeedback({
  ok: true,
  status: 200,
  json: {
    translation: {
      ok: true,
      requestedLocales: [],
      translatedLocales: [],
      failedLocales: [],
    },
  },
});
assert.equal(missingAccepted.tone, 'error');
assert.match(missingAccepted.lines.join(' '), /result was incomplete/);

console.log('translations panel tests passed');
