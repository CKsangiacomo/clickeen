import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildOverlayTextValueMap,
  extractTextPrimitiveValuesForEditableFields,
  readWidgetEditableFieldsContract,
  resolveOverlay,
  validateOverlayValuesForTextPrimitives,
  widgetEditableFieldsToTextPrimitives,
} from './overlay-primitives.ts';

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

function readFaqSpec(): { defaults: Record<string, unknown> } {
  return readJson('tokyo/product/widgets/faq/spec.json') as { defaults: Record<string, unknown> };
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
  const runtime = readText('tokyo/product/widgets/faq/widget.client.js');

  for (const path of ['header.title', 'header.subtitleHtml', 'cta.label']) {
    assert(paths.has(path));
    assert(headerModule.includes(`path='${path}'`), `${path} missing from Bob shared header controls`);
    assert(runtime.includes(path), `${path} missing from FAQ runtime`);
  }

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
  assert(runtime.includes('section.id'), 'section identity missing from FAQ runtime');
  assert(runtime.includes('faq.id'), 'FAQ identity missing from FAQ runtime');
  assert(runtime.includes('faq.defaultOpen'), 'defaultOpen missing from FAQ runtime');
});

test('FAQ primitive graph extracts concrete text paths for every question and answer', () => {
  const spec = readFaqSpec();
  const contract = readFaqEditableFields();
  const items = extractTextPrimitiveValuesForEditableFields({ contract, config: spec.defaults });
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
  const values = buildOverlayTextValueMap(items);

  assert.equal(values['header.title'], 'FAQs');
  assert.equal(values['header.subtitleHtml'], '');
  assert.equal(values['cta.label'], '');
  assert.equal(values['sections.0.title'], '');
  assert.equal(values['sections.0.faqs.0.question'], 'What does it cost?');
  assert.equal(values['sections.0.faqs.0.answer'], '');
});

test('overlay value validation rejects missing and extra concrete paths', () => {
  const spec = readFaqSpec();
  const contract = readFaqEditableFields();
  const items = extractTextPrimitiveValuesForEditableFields({ contract, config: spec.defaults });
  const values = buildOverlayTextValueMap(items);

  assert.deepEqual(validateOverlayValuesForTextPrimitives(items, values), { ok: true });

  const missing = { ...values };
  delete missing['sections.0.faqs.0.answer'];
  assert.deepEqual(validateOverlayValuesForTextPrimitives(items, missing), {
    ok: false,
    reason: 'missing_path',
    path: 'sections.0.faqs.0.answer',
  });

  assert.deepEqual(
    validateOverlayValuesForTextPrimitives(items, {
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

test('resolveOverlay applies one value map to nested FAQ text without mutating base', () => {
  const spec = readJson('tokyo/product/widgets/faq/spec.json') as { defaults: Record<string, unknown> };
  const base = spec.defaults;
  const next = resolveOverlay(base, {
    'header.title': 'Domande frequenti',
    'sections.0.faqs.0.question': 'Che cos e Clickeen?',
    'sections.0.faqs.0.answer': 'Clickeen ti aiuta a pubblicare widget.',
  });

  assert.equal((base.header as any).title, 'FAQs');
  assert.equal((next.header as any).title, 'Domande frequenti');
  assert.equal((next.sections as any)[0].faqs[0].question, 'Che cos e Clickeen?');
  assert.equal((next.sections as any)[0].faqs[0].answer, 'Clickeen ti aiuta a pubblicare widget.');
});
