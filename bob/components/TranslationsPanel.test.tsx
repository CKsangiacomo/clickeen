import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGenerateTranslationsButtonState,
  buildTranslationGenerationPanelState,
  buildTranslationValuesAfterEdit,
  isActiveTranslationGeneration,
  isTranslationGenerationAccepted,
  normalizeTranslationGenerationSummary,
  resolveGenerateTranslationsMessage,
  resolveTranslationPanelProductState,
  resolveTranslationGenerationStatusMessage,
  TranslationReviewRows,
} from './TranslationsPanel';

function collectText(node: unknown): string[] {
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(collectText);
  const props = (node as { props?: { children?: unknown } }).props;
  return collectText(props?.children);
}

test('TranslationsPanel review rows render generic content review sections and values', () => {
  const element = TranslationReviewRows({
    review: {
      missingPaths: [],
      sections: [
        {
          title: 'Header',
          items: [
            {
              label: 'Header title',
              path: 'header.title',
              value: 'Domande frequenti',
              missingPaths: [],
            },
          ],
        },
        {
          title: 'Camere',
          items: [
            {
              label: 'FAQ question',
              path: 'sections.0.faqs.0.question',
              value: 'Che stanze offrite?',
              missingPaths: [],
            },
            {
              label: 'FAQ answer',
              path: 'sections.0.faqs.0.answer',
              value: 'Offriamo suite.',
              missingPaths: [],
            },
          ],
        },
      ],
    },
  });
  const text = collectText(element).join('\n');

  assert.match(text, /Header title/);
  assert.match(text, /Domande frequenti/);
  assert.match(text, /FAQ question/);
  assert.match(text, /Che stanze offrite\?/);
  assert.match(text, /FAQ answer/);
  assert.match(text, /Offriamo suite\./);
});

test('manual translation edit produces a full updated translation values object', () => {
  const currentValues = {
    'header.title': 'Domande frequenti',
    'sections.0.faqs.0.question': 'Che stanze offrite?',
    'sections.0.faqs.0.answer': 'Offriamo suite.',
  };

  const nextValues = buildTranslationValuesAfterEdit({
    values: currentValues,
    path: 'sections.0.faqs.0.answer',
    value: 'Offriamo suite e camere familiari.',
  });

  assert.deepEqual(nextValues, {
    'header.title': 'Domande frequenti',
    'sections.0.faqs.0.question': 'Che stanze offrite?',
    'sections.0.faqs.0.answer': 'Offriamo suite e camere familiari.',
  });
  assert.notEqual(nextValues, currentValues);
});

test('generate translations button is enabled for a saved instance with active target languages', () => {
  assert.deepEqual(
    buildGenerateTranslationsButtonState({
      instanceId: 'I1B2C3D4E5',
      expectedTranslationsCount: 28,
      hasTranslatableFields: true,
      isDirty: false,
      isSaving: false,
      isStarting: false,
      isGenerating: false,
    }),
    {
      disabled: false,
      label: 'Generate translations',
      message: null,
    },
  );
});

test('generate translations button does not translate unsaved Bob edits', () => {
  assert.deepEqual(
    buildGenerateTranslationsButtonState({
      instanceId: 'I1B2C3D4E5',
      expectedTranslationsCount: 28,
      hasTranslatableFields: true,
      isDirty: true,
      isSaving: false,
      isStarting: false,
      isGenerating: false,
    }),
    {
      disabled: true,
      label: 'Generate translations',
      message: 'Save changes before generating translations.',
    },
  );
});

test('generate translations button is disabled for widgets without translatable fields', () => {
  assert.deepEqual(
    buildGenerateTranslationsButtonState({
      instanceId: 'I1B2C3D4E5',
      expectedTranslationsCount: 28,
      hasTranslatableFields: false,
      isDirty: false,
      isSaving: false,
      isStarting: false,
      isGenerating: false,
    }),
    {
      disabled: true,
      label: 'Generate translations',
      message: 'This widget has no translation fields.',
    },
  );
});

test('generate translations accepts background generation response', () => {
  const generation = {
    instanceId: 'I1B2C3D4E5',
    baseLocale: 'en',
    targetLocales: ['it', 'cs'],
    status: 'queued',
    requestedAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:00.000Z',
    totalLocales: 2,
    completedLocales: [],
    failedLocales: [],
    supersededLocales: [],
    pendingLocales: ['it', 'cs'],
    currentReadyLocales: [],
    jobId: 'job-1',
  };
  const payload = {
    ok: true,
    translation: {
      accepted: true,
      generation,
    },
  };

  assert.equal(isTranslationGenerationAccepted(payload), true);
  assert.equal(
    resolveGenerateTranslationsMessage(payload),
    'Generating translations.',
  );
});

test('generate translations does not accept a local spinner without Tokyo job state', () => {
  const payload = {
    ok: true,
    translation: {
      accepted: true,
    },
  };

  assert.equal(isTranslationGenerationAccepted(payload), false);
});

test('translation generation status messages come from Tokyo job state', () => {
  const generation = normalizeTranslationGenerationSummary({
    instanceId: 'I1B2C3D4E5',
    baseLocale: 'en',
    targetLocales: ['it', 'cs'],
    status: 'running',
    requestedAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:03.000Z',
    totalLocales: 2,
    completedLocales: ['it'],
    failedLocales: [],
    supersededLocales: [],
    pendingLocales: ['cs'],
    currentReadyLocales: ['it'],
    jobId: 'job-1',
  });

  assert(generation);
  assert.equal(isActiveTranslationGeneration(generation), true);
  assert.equal(resolveTranslationGenerationStatusMessage(generation), 'Generating translations.');
});

test('panel entry adopts an already active Tokyo generation state', () => {
  const panelState = buildTranslationGenerationPanelState({
    ok: true,
    generation: {
      instanceId: 'I1B2C3D4E5',
      baseLocale: 'en',
      targetLocales: ['it', 'cs'],
      status: 'running',
      requestedAt: '2026-05-20T00:00:00.000Z',
      updatedAt: '2026-05-20T00:00:03.000Z',
      totalLocales: 2,
      completedLocales: ['it'],
      failedLocales: [],
      supersededLocales: [],
      pendingLocales: ['cs'],
      currentReadyLocales: ['it'],
      jobId: 'job-1',
    },
  });

  assert.deepEqual(panelState, {
    isGenerating: true,
    message: 'Generating translations.',
    shouldRefreshTranslations: true,
  });
});

test('translation generation message shows base content out of sync', () => {
  const generation = normalizeTranslationGenerationSummary({
    instanceId: 'I1B2C3D4E5',
    baseLocale: 'en',
    targetLocales: ['it'],
    status: 'idle',
    requestedAt: null,
    updatedAt: null,
    totalLocales: 1,
    completedLocales: [],
    failedLocales: [],
    supersededLocales: [],
    pendingLocales: [],
    currentReadyLocales: [],
    outOfSyncLocales: ['it'],
    isCurrentBaseContent: true,
  });

  assert(generation);
  assert.equal(
    resolveTranslationGenerationStatusMessage(generation),
    'The base content has changed. Regenerate translations.',
  );
});

test('translation panel product state disables generate while current work is active', () => {
  const generation = normalizeTranslationGenerationSummary({
    v: 2,
    instanceId: 'I1B2C3D4E5',
    baseLocale: 'en',
    targetLocales: ['it'],
    status: 'running',
    active: true,
    requestedAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:03.000Z',
    totalLocales: 1,
    isCurrentBaseContent: true,
    baseContentMarker: 'base-1',
    generationRequestMarker: 'request-1',
    locales: [{ locale: 'it', state: 'generating', reviewable: false }],
  });
  assert(generation);

  assert.deepEqual(resolveTranslationPanelProductState({
    instanceId: 'I1B2C3D4E5',
    expectedTranslationsCount: 1,
    hasTranslatableFields: true,
    isDirty: false,
    isSaving: false,
    generationLoaded: true,
    generation,
  }), {
    primaryState: 'generating',
    primaryMessage: 'Generating translations.',
    canGenerate: false,
    reviewableLocales: [],
  });
});

test('translation panel product state reports base changes without queue progress copy', () => {
  const generation = normalizeTranslationGenerationSummary({
    v: 2,
    instanceId: 'I1B2C3D4E5',
    baseLocale: 'en',
    targetLocales: ['it'],
    status: 'completed',
    active: false,
    requestedAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:03.000Z',
    totalLocales: 1,
    isCurrentBaseContent: true,
    baseContentMarker: 'base-2',
    generationRequestMarker: 'request-2',
    locales: [{ locale: 'it', state: 'outOfSync', reviewable: false }],
  });
  assert(generation);

  const panelState = resolveTranslationPanelProductState({
    instanceId: 'I1B2C3D4E5',
    expectedTranslationsCount: 1,
    hasTranslatableFields: true,
    isDirty: false,
    isSaving: false,
    generationLoaded: true,
    generation,
  });

  assert.equal(panelState.primaryState, 'baseChanged');
  assert.equal(panelState.primaryMessage, 'The base content has changed. Regenerate translations.');
  assert.doesNotMatch(panelState.primaryMessage ?? '', /\d+ of \d+ translations ready/);
  assert.equal(panelState.canGenerate, true);
  assert.deepEqual(panelState.reviewableLocales, []);
});

test('translation panel product state exposes only Tokyo-reviewable locales', () => {
  const generation = normalizeTranslationGenerationSummary({
    v: 2,
    instanceId: 'I1B2C3D4E5',
    baseLocale: 'en',
    targetLocales: ['it', 'cs'],
    status: 'completed',
    active: false,
    requestedAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:03.000Z',
    totalLocales: 2,
    isCurrentBaseContent: true,
    baseContentMarker: 'base-1',
    generationRequestMarker: 'request-1',
    locales: [
      { locale: 'cs', state: 'missing', reviewable: false },
      { locale: 'it', state: 'inSync', reviewable: true },
    ],
  });
  assert(generation);

  assert.deepEqual(resolveTranslationPanelProductState({
    instanceId: 'I1B2C3D4E5',
    expectedTranslationsCount: 2,
    hasTranslatableFields: true,
    isDirty: false,
    isSaving: false,
    generationLoaded: true,
    generation,
  }), {
    primaryState: 'available',
    primaryMessage: null,
    canGenerate: true,
    reviewableLocales: ['it'],
  });
});
