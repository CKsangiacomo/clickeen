import assert from 'node:assert/strict';
import {
  buildActivityRows,
  resolveGenerateTranslationsError,
  resolveGenerateTranslationsMessage,
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
    localePackages: {
      ok: true,
      completed: [
        { accountId: 'CLICKEEN', instanceId: 'INST', locale: 'fr', publicPackageFingerprint: 'sha256:fr' },
        { accountId: 'CLICKEEN', instanceId: 'INST', locale: 'de', publicPackageFingerprint: 'sha256:de' },
      ],
      skipped: [],
    },
  }),
  'Generated 2 active locales.',
);

assert.equal(
  resolveGenerateTranslationsError({
    error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.translation.failed' },
    translation: {
      ok: true,
      accepted: true,
      baseLocale: 'en',
      activeLocales: ['fr'],
      skippedLocales: ['de'],
    },
    localePackages: {
      ok: false,
      completed: [{ accountId: 'CLICKEEN', instanceId: 'INST', locale: 'fr', publicPackageFingerprint: 'sha256:fr' }],
      skipped: [{ accountId: 'CLICKEEN', instanceId: 'INST', locale: 'de', phase: 'not-attempted-after-failure' }],
      failed: {
        accountId: 'CLICKEEN',
        instanceId: 'INST',
        locale: 'de',
        phase: 'package-write',
        reasonKey: 'tokyo.errors.package.write',
      },
    },
  }),
  'Translations failed on de during package-write.',
);

assert.deepEqual(
  buildActivityRows([
    { stage: 'command-started', message: 'Generating 2 active locales.', total: 2, completed: 0 },
    { stage: 'locale-completed', locale: 'fr', message: 'fr complete.', total: 2, completed: 1 },
    { stage: 'locale-failed', locale: 'de', phase: 'package-write', message: 'de failed.', total: 2, completed: 1 },
  ]).map((row) => ({ state: row.state, message: row.message })),
  [
    { state: 'current', message: 'Generating 2 active locales.' },
    { state: 'done', message: 'fr complete.' },
    { state: 'failed', message: 'de failed.' },
  ],
);

console.log('translations panel command activity tests passed');
