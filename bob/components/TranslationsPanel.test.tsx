import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGenerateTranslationsButtonState,
  buildOverlayValuesAfterTranslationEdit,
  isTranslationGenerationAccepted,
  resolveGenerateTranslationsMessage,
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

test('manual translation edit produces a full updated overlay values object', () => {
  const currentValues = {
    'header.title': 'Domande frequenti',
    'sections.0.faqs.0.question': 'Che stanze offrite?',
    'sections.0.faqs.0.answer': 'Offriamo suite.',
  };

  const nextValues = buildOverlayValuesAfterTranslationEdit({
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
      isDirty: false,
      isSaving: false,
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
      isDirty: true,
      isSaving: false,
      isGenerating: false,
    }),
    {
      disabled: true,
      label: 'Generate translations',
      message: 'Save changes before generating translations.',
    },
  );
});

test('generate translations accepts background generation response', () => {
  const payload = {
    ok: true,
    translation: {
      accepted: true,
    },
  };

  assert.equal(isTranslationGenerationAccepted(payload), true);
  assert.equal(
    resolveGenerateTranslationsMessage(payload),
    'Generating translations. This can take a little while.',
  );
});
