import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildOverlayTextValueMap,
  extractTextPrimitiveValues,
  resolveOverlay,
  validateOverlayValuesForTextPrimitives,
} from './overlay-primitives.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readJson(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

test('FAQ primitive graph extracts concrete text paths for every question and answer', () => {
  const spec = readJson('tokyo/product/widgets/faq/spec.json') as { defaults: Record<string, unknown> };
  const items = extractTextPrimitiveValues({ spec, config: spec.defaults });
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

test('overlay value validation rejects missing and extra concrete paths', () => {
  const spec = readJson('tokyo/product/widgets/faq/spec.json') as { defaults: Record<string, unknown> };
  const items = extractTextPrimitiveValues({ spec, config: spec.defaults });
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
