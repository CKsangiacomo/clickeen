import assert from 'node:assert/strict';
import {
  resolveTranslatedValues,
  type WidgetEditableFieldsContract,
} from '@clickeen/ck-contracts';
import {
  buildActivityRows,
  buildTranslationGenerationFeedback,
  shouldRefreshTranslationsAfterGeneration,
} from '../components/TranslationsPanel';
import {
  buildEditableFieldsTranslationOverlayInspection,
  mapTranslationOverlayValuesToCurrentPaths,
} from '../lib/translations-preview';

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

const repeatedContentContract: WidgetEditableFieldsContract = {
  widgetType: 'contract-widget',
  fields: [
    {
      path: 'items[].title',
      type: 'string',
      label: 'Item title',
      role: 'item-title',
      arrayItemIdentity: ['items[].id'],
      limits: [],
    },
  ],
};
const firstCoordinate = 'contract-widget|item-title|items[].title|items[].id=first';
const secondCoordinate = 'contract-widget|item-title|items[].title|items[].id=second';
const thirdCoordinate = 'contract-widget|item-title|items[].title|items[].id=third';
const translatedValues = {
  [firstCoordinate]: 'Premier',
  [secondCoordinate]: 'Deuxième',
};
const reorderedConfig = {
  items: [
    { id: 'second', title: 'Second' },
    { id: 'first', title: 'First' },
    { id: 'third', title: 'Third' },
  ],
};
const reorderedValuesByPath = mapTranslationOverlayValuesToCurrentPaths({
  contract: repeatedContentContract,
  config: reorderedConfig,
  values: translatedValues,
});
assert.deepEqual(reorderedValuesByPath, {
  'items.0.title': 'Deuxième',
  'items.1.title': 'Premier',
});
assert.deepEqual(
  resolveTranslatedValues(reorderedConfig, reorderedValuesByPath),
  {
    items: [
      { id: 'second', title: 'Deuxième' },
      { id: 'first', title: 'Premier' },
      { id: 'third', title: 'Third' },
    ],
  },
);
const addedInspection = buildEditableFieldsTranslationOverlayInspection({
  contract: repeatedContentContract,
  config: reorderedConfig,
  values: translatedValues,
});
assert.deepEqual(addedInspection.missingPaths, [thirdCoordinate]);

const afterDeleteValuesByPath = mapTranslationOverlayValuesToCurrentPaths({
  contract: repeatedContentContract,
  config: { items: [{ id: 'second', title: 'Second' }] },
  values: translatedValues,
});
assert.deepEqual(afterDeleteValuesByPath, { 'items.0.title': 'Deuxième' });

console.log('translations panel tests passed');
