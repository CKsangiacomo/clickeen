import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildTranslatedTextValueMap,
  extractSavedTextFieldsForEditableFields,
  extractTextPrimitiveValuesForEditableFields,
  readWidgetEditableFieldsContract,
  resolveTranslatedValues,
  validateTranslatedValuesForTextPrimitives,
  widgetEditableFieldsToTextPrimitives,
} from './translated-value-primitives.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readJson(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readFaqEditableFields() {
  return readWidgetEditableFieldsContract(readJson('tokyo/product/widgets/faq/editable-fields.json'));
}

function readEditableFields(widgetType: string) {
  return readWidgetEditableFieldsContract(readJson(`tokyo/product/widgets/${widgetType}/editable-fields.json`));
}

function readSpec(widgetType: string): { defaults: Record<string, unknown> } {
  return readJson(`tokyo/product/widgets/${widgetType}/spec.json`) as { defaults: Record<string, unknown> };
}

function readFaqSpec(): { defaults: Record<string, unknown> } {
  return readJson('tokyo/product/widgets/faq/spec.json') as { defaults: Record<string, unknown> };
}

function faqConfigWithContent(): Record<string, unknown> {
  const config = structuredClone(readFaqSpec().defaults);
  config.header = {
    ...(config.header as Record<string, unknown>),
    title: 'FAQs',
    subtitleHtml: 'Straight answers for launch teams.',
  };
  config.cta = {
    ...(config.cta as Record<string, unknown>),
    label: 'Start now',
  };
  config.sections = [
    {
      id: 'general',
      title: 'General',
      faqs: [
        {
          id: 'what-is',
          question: 'What is Clickeen?',
          answer: 'Clickeen helps teams publish widgets.',
        },
        {
          id: 'who-for',
          question: 'Who is it for?',
          answer: 'Teams that need fast product surfaces.',
        },
        {
          id: 'how-publish',
          question: 'How do I publish?',
          answer: 'Save the widget, then publish from Roma.',
        },
        {
          id: 'translations',
          question: 'Can I translate it?',
          answer: 'Yes, translations run after save.',
        },
      ],
    },
  ];
  return config;
}

test('FAQ editable-fields JSON is the translation field authority', () => {
  const spec = readJson('tokyo/product/widgets/faq/spec.json') as Record<string, unknown>;
  const contract = readFaqEditableFields();
  assert.equal(spec.overlays, undefined);
  assert.deepEqual(
    contract.fields.map((field) => field.path),
    [
      'header.title',
      'header.subtitleHtml',
      'cta.label',
      'sections[].title',
      'sections[].faqs[].question',
      'sections[].faqs[].answer',
    ],
  );
});

test('FAQ translation primitive graph derives from editable-fields JSON', () => {
  const primitives = widgetEditableFieldsToTextPrimitives(readFaqEditableFields());
  assert.deepEqual(primitives, [
    { path: 'header.title', label: 'Header title', type: 'richtext', role: 'header-title' },
    { path: 'header.subtitleHtml', label: 'Header subtitle', type: 'richtext', role: 'header-subtitle' },
    { path: 'cta.label', label: 'CTA label', type: 'string', role: 'cta-label' },
    { path: 'sections[].title', label: 'Section title', type: 'string', role: 'section-title' },
    { path: 'sections[].faqs[].question', label: 'FAQ question', type: 'string', role: 'faq-question' },
    { path: 'sections[].faqs[].answer', label: 'FAQ answer', type: 'richtext', role: 'faq-answer' },
  ]);
});

test('FAQ manual editor and runtime paths are covered by editable-fields JSON', () => {
  const contract = readFaqEditableFields();
  const paths = new Set(contract.fields.map((field) => field.path));
  const faqSpecText = readText('tokyo/product/widgets/faq/spec.json');
  const headerModule = readText('bob/lib/compiler/modules/header.ts');
  const template = readText('tokyo/product/widgets/faq/widget.html');
  const runtime = readText('tokyo/product/widgets/faq/widget.client.js');
  const headerRuntime = readText('tokyo/product/widgets/shared/header.js');

  for (const [path, role, runtimePath] of [
    ['header.title', 'header-title', 'state.header.title'],
    ['header.subtitleHtml', 'header-subtitle', 'state.header.subtitleHtml'],
    ['cta.label', 'header-cta', 'state.cta.label'],
  ]) {
    assert(paths.has(path));
    assert(headerModule.includes(`path='${path}'`), `${path} missing from Bob shared header controls`);
    assert(template.includes(`data-role="${role}"`), `${path} missing from FAQ template`);
    assert(headerRuntime.includes(runtimePath), `${path} missing from shared header runtime`);
  }
  assert(runtime.includes('CKHeader.applyHeader'), 'FAQ runtime missing shared header delegation');

  assert(paths.has('sections[].title'));
  assert(
    faqSpecText.includes('"label-path": "title"') ||
      faqSpecText.includes('"labelPath": "sections.__SECTION__.title"'),
    'sections[].title missing from FAQ editor controls',
  );

  for (const path of ['sections[].faqs[].question', 'sections[].faqs[].answer']) {
    assert(paths.has(path));
    const bobPath = path
      .replace('sections[]', 'sections.__SECTION__')
      .replace('faqs[]', 'faqs.__INDEX__');
    assert(faqSpecText.includes(`"data-bob-path": "${bobPath}"`), `${path} missing from FAQ editor controls`);
  }

  assert(!paths.has('sections[].id'));
  assert(!paths.has('sections[].faqs[].id'));
  assert(!paths.has('sections[].faqs[].defaultOpen'));
  assert(runtime.includes('data-role="faq-section"'), 'section identity boundary missing from FAQ runtime');
  assert(runtime.includes('data-role="faq-item"'), 'FAQ identity boundary missing from FAQ runtime');
  assert(runtime.includes('item.id'), 'FAQ item identity missing from FAQ runtime');
  assert(runtime.includes('faq.defaultOpen'), 'defaultOpen missing from FAQ runtime');
});

test('FAQ primitive graph extracts concrete text paths from saved content', () => {
  const contract = readFaqEditableFields();
  const items = extractTextPrimitiveValuesForEditableFields({ contract, config: faqConfigWithContent() });
  const paths = items.map((item) => item.path);

  assert.equal(paths.length, 12);
  assert(paths.includes('header.title'));
  assert(paths.includes('header.subtitleHtml'));
  assert(paths.includes('cta.label'));
  assert(paths.includes('sections.0.title'));
  assert(paths.includes('sections.0.faqs.0.question'));
  assert(paths.includes('sections.0.faqs.0.answer'));
  assert(paths.includes('sections.0.faqs.3.question'));
  assert(paths.includes('sections.0.faqs.3.answer'));
  assert(!paths.some((itemPath) => itemPath.includes('[]') || itemPath.includes('*')));
});

test('generic saved text extraction covers FAQ, Countdown, and Logo Showcase contracts', () => {
  const cases = [
    { widgetType: 'faq', config: faqConfigWithContent(), expected: ['header.title', 'cta.label', 'sections.0.faqs.0.question'] },
    { widgetType: 'countdown', expected: ['header.title', 'timer.labels.days', 'actions.after.text'] },
    { widgetType: 'logoshowcase', expected: ['header.title', 'cta.label', 'strips.0.logos.0.name'] },
  ];

  for (const entry of cases) {
    const contract = readEditableFields(entry.widgetType);
    const spec = readSpec(entry.widgetType);
    const fields = extractSavedTextFieldsForEditableFields({ contract, config: entry.config ?? spec.defaults });
    const paths = new Set(fields.map((field) => field.path));
    for (const expectedPath of entry.expected) {
      assert(paths.has(expectedPath), `${entry.widgetType} missing ${expectedPath}`);
    }
    assert(fields.every((field) => field.identityKey && field.fieldPattern && field.role));
  }
});

test('Logo Showcase generic identity survives nested repeated reorder', () => {
  const contract = readEditableFields('logoshowcase');
  const spec = readSpec('logoshowcase');
  const before = structuredClone(spec.defaults);
  const after = structuredClone(spec.defaults);
  const strip = (after.strips as Array<{ logos: unknown[] }>)[0];
  strip.logos = [strip.logos[1], strip.logos[0], ...strip.logos.slice(2)];

  const beforeFields = extractSavedTextFieldsForEditableFields({ contract, config: before });
  const afterFields = extractSavedTextFieldsForEditableFields({ contract, config: after });
  const beforeAudiName = beforeFields.find((field) => field.path === 'strips.0.logos.0.name');
  const afterAudiName = afterFields.find((field) => field.path === 'strips.0.logos.1.name');

  assert(beforeAudiName);
  assert(afterAudiName);
  assert.equal(beforeAudiName.baseText, 'Audi');
  assert.equal(afterAudiName.baseText, 'Audi');
  assert.equal(beforeAudiName.identityKey, afterAudiName.identityKey);
});

test('generic identity fails closed on duplicate nested IDs', () => {
  const contract = readEditableFields('logoshowcase');
  const spec = readSpec('logoshowcase');
  const config = structuredClone(spec.defaults);
  const logos = (config.strips as Array<{ logos: Array<{ id: string }> }>)[0].logos;
  logos[1].id = logos[0].id;

  assert.throws(
    () => extractSavedTextFieldsForEditableFields({ contract, config }),
    /saved_text_field_identity_duplicate/,
  );
});

test('FAQ primitive graph materializes editable text fields as strings', () => {
  const contract = readFaqEditableFields();
  const items = extractTextPrimitiveValuesForEditableFields({
    contract,
    config: {
      header: { title: 'FAQs', subtitleHtml: { html: 'bad shape' } },
      cta: { label: 42 },
      sections: [
        {
          id: 'general',
          title: ['bad shape'],
          faqs: [{ id: 'pricing', question: 'What does it cost?', answer: { html: 'bad shape' } }],
        },
      ],
    },
  });
  const values = buildTranslatedTextValueMap(items);

  assert.equal(values['header.title'], 'FAQs');
  assert.equal(values['header.subtitleHtml'], '');
  assert.equal(values['cta.label'], '');
  assert.equal(values['sections.0.title'], '');
  assert.equal(values['sections.0.faqs.0.question'], 'What does it cost?');
  assert.equal(values['sections.0.faqs.0.answer'], '');
});

test('translated value validation rejects missing and extra concrete paths', () => {
  const contract = readFaqEditableFields();
  const items = extractTextPrimitiveValuesForEditableFields({ contract, config: faqConfigWithContent() });
  const values = buildTranslatedTextValueMap(items);

  assert.deepEqual(validateTranslatedValuesForTextPrimitives(items, values), { ok: true });

  const missing = { ...values };
  delete missing['sections.0.faqs.0.answer'];
  assert.deepEqual(validateTranslatedValuesForTextPrimitives(items, missing), {
    ok: false,
    reason: 'missing_path',
    path: 'sections.0.faqs.0.answer',
  });

  assert.deepEqual(
    validateTranslatedValuesForTextPrimitives(items, {
      ...values,
      'sections.0.faqs.0.internalNote': 'Not declared',
    }),
    {
      ok: false,
      reason: 'extra_path',
      path: 'sections.0.faqs.0.internalNote',
    },
  );
});

test('resolveTranslatedValues applies one value map to nested FAQ text without mutating base', () => {
  const base = faqConfigWithContent();
  const next = resolveTranslatedValues(base, {
    'header.title': 'Domande frequenti',
    'sections.0.faqs.0.question': 'Che cos e Clickeen?',
    'sections.0.faqs.0.answer': 'Clickeen ti aiuta a pubblicare widget.',
  });

  assert.equal((base.header as any).title, 'FAQs');
  assert.equal((next.header as any).title, 'Domande frequenti');
  assert.equal((next.sections as any)[0].faqs[0].question, 'Che cos e Clickeen?');
  assert.equal((next.sections as any)[0].faqs[0].answer, 'Clickeen ti aiuta a pubblicare widget.');
});
