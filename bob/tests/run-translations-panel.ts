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
      activeLocales: ['fr', 'de'],
      skippedLocales: [],
    },
    localePackages: {
      ok: true,
      completed: [{ locale: 'fr' }, { locale: 'de' }],
      skipped: [],
    },
  },
});
assert.equal(success.tone, 'success');
assert.equal(success.title, 'Translations generated');
assert.deepEqual(success.lines, ['Generated 2 localized packages.', 'Preview translations have been refreshed.']);

const notAccepted = buildTranslationGenerationFeedback({
  ok: true,
  status: 200,
  json: {
    ok: true,
    translation: {
      ok: true,
      accepted: false,
      baseLocale: 'en',
      activeLocales: [],
      skippedLocales: [],
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

const packageFailurePayload = {
  ok: false,
  translation: {
    ok: true,
    accepted: true,
    baseLocale: 'en',
    activeLocales: ['fr', 'de'],
    skippedLocales: [],
  },
  error: {
    reasonKey: 'coreui.errors.instance.embedNotReady',
  },
  localePackages: {
    ok: false,
    completed: [{ locale: 'fr' }],
    skipped: [{ locale: 'de' }],
    failed: {
      locale: 'fr',
      phase: 'package-write',
      reasonKey: 'coreui.errors.instance.embedNotReady',
    },
  },
};
const packageFailure = buildTranslationGenerationFeedback({
  ok: false,
  status: 502,
  json: packageFailurePayload,
});
assert.equal(packageFailure.tone, 'warning');
assert.equal(packageFailure.title, 'Translations need attention');
assert.match(packageFailure.lines.join(' '), /French/);
assert.doesNotMatch(packageFailure.lines.join(' '), /coreui\.errors/);

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

assert.equal(shouldRefreshTranslationsAfterGeneration(packageFailurePayload), true);
assert.equal(shouldRefreshTranslationsAfterGeneration(packageFailure.lines), false);
assert.equal(shouldRefreshTranslationsAfterGeneration({
  translation: {
    accepted: true,
  },
}), true);

console.log('translations panel tests passed');
