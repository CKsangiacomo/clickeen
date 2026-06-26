import assert from 'node:assert/strict';
import {
  buildActivityRows,
  resolveGenerateTranslationsError,
  resolveGenerateTranslationsMessage,
  resolveTranslationPanelProductState,
} from '../components/TranslationsPanel';

assert.equal(
  resolveGenerateTranslationsMessage({
    ok: true,
    translation: {
      ok: true,
      accepted: true,
      baseLocale: 'en',
      activeLocales: ['fr', 'de'],
      skippedLocales: [],
    },
  }),
  'Generated 2 active locales.',
);

assert.equal(
  resolveGenerateTranslationsError({
    error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.translation.failed' },
  }),
  'Translations could not be generated.',
);

assert.deepEqual(
  buildActivityRows([
    { stage: 'command-started', message: 'Generating 2 active locales.', total: 2, completed: 0 },
    { stage: 'overlay-written', locale: 'fr', message: 'fr overlay written.', total: 2, completed: 1 },
    { stage: 'overlay-written', locale: 'de', message: 'de overlay written.', total: 2, completed: 2 },
  ]).map((row) => ({ state: row.state, message: row.message })),
  [
    { state: 'current', message: 'Writing translations' },
    { state: 'done', message: 'French written' },
    { state: 'done', message: 'German written' },
  ],
);

assert.equal(
  resolveTranslationPanelProductState({
    instanceId: 'INST',
    hasActiveLocales: true,
    activeLocales: ['fr'],
    translatedLocales: [],
    hasTranslatableFields: true,
    isDirty: false,
    isSaving: false,
    isGenerating: true,
  }).primaryMessage,
  null,
);

console.log('translations panel command activity tests passed');
