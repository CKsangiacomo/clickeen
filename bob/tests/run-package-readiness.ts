import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadCompleteSavedTranslationState } from '../components/useTranslationPreviewState';

async function run(): Promise<void> {
  const readLocales: string[] = [];
  const complete = await loadCompleteSavedTranslationState({
    instanceId: 'INSTANCE123',
    baseLocale: 'en-US',
    listTranslations: async () => ({
      ok: true,
      status: 200,
      json: {
        baseLocale: 'en-US',
        translations: [{ locale: 'it-IT' }, { locale: 'fr-FR' }],
      },
    }),
    readTranslation: async ({ locale }) => {
      readLocales.push(locale);
      return {
        ok: true,
        status: 200,
        json: { locale, values: { 'header.title': `${locale} title` } },
      };
    },
  });

  assert.deepEqual(readLocales.sort(), ['fr-FR', 'it-IT']);
  assert.deepEqual(complete, {
    translatedLocales: {
      baseLocale: 'en-US',
      translations: [{ locale: 'it-IT' }, { locale: 'fr-FR' }],
    },
    valuesByLocale: {
      'it-IT': { 'header.title': 'it-IT title' },
      'fr-FR': { 'header.title': 'fr-FR title' },
    },
  });

  await assert.rejects(
    loadCompleteSavedTranslationState({
      instanceId: 'INSTANCE123',
      baseLocale: 'en-US',
      listTranslations: async () => ({
        ok: true,
        status: 200,
        json: {
          baseLocale: 'en-US',
          translations: [{ locale: 'it-IT' }, { locale: 'fr-FR' }],
        },
      }),
      readTranslation: async ({ locale }) =>
        locale === 'fr-FR'
          ? { ok: false, status: 500, json: null }
          : {
              ok: true,
              status: 200,
              json: { locale, values: { 'header.title': `${locale} title` } },
            },
    }),
    /Saved translations could not be read/,
  );

  const [builder, workspace, editing, session] = await Promise.all([
    readFile(new URL('../components/BuilderApp.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/Workspace.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../lib/session/useSessionEditing.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/session/WidgetDocumentSession.tsx', import.meta.url), 'utf8'),
  ]);

  const overlayEnablement =
    builder.match(/const savedOverlaysEnabled = Boolean\(([\s\S]*?)\n  \);/)?.[1] ?? '';
  assert.match(overlayEnablement, /session\.compiled/);
  assert.match(overlayEnablement, /instanceId/);
  assert.match(overlayEnablement, /baseLocale/);
  assert.doesNotMatch(overlayEnablement, /previewMode/);
  assert.match(
    builder,
    /const requestTranslationsRefresh = \(\) => \{\s+session\.setGeneratedPublicPackage\(null\);\s+setTranslationsRefreshVersion/,
  );
  assert.match(workspace, /!savedTranslationsReady/);
  assert.match(workspace, /Object\.entries\(translationValuesByLanguage\)/);
  assert.match(workspace, /setGeneratedPublicPackage\(generatedBasePackage\)/);
  assert.match(editing, /instanceData: applied\.data,\s+publicPackage: null,/);
  assert.match(session, /if \(result === null\)[\s\S]*?publicPackage: null,/);
  assert.match(session, /if \(!result\.ok\)[\s\S]*?publicPackage: null,/);

  console.log('package readiness tests passed');
}

void run();
