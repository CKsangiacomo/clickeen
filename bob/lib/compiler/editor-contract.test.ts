import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parsePanels } from '../compiler.shared';
import { compileControlsFromPanels } from './controls';
import { buildEditorHtmlLines } from './editor-contract';
import { applyWidgetNormalizationRules, normalizeWidgetNormalizationSpec } from './modules/normalization';

type WidgetSpec = {
  widgetname: string;
  defaults: Record<string, unknown>;
  editor: unknown;
  normalization?: unknown;
};

const repoRoot = path.resolve(process.cwd(), '..');

function readWidgetSpec(widgetType: string): WidgetSpec {
  const specPath = path.join(repoRoot, 'tokyo/product/widgets', widgetType, 'spec.json');
  return JSON.parse(fs.readFileSync(specPath, 'utf8')) as WidgetSpec;
}

function renderEditorHtml(widgetType: string): string {
  const spec = readWidgetSpec(widgetType);
  return buildEditorHtmlLines(spec.editor, spec.defaults, spec.widgetname).join('\n');
}

test('shared Stage/Pod appearance controls expand for every current widget', () => {
  const cases = [
    { widgetType: 'cardgrid', hasPodBorder: false },
    { widgetType: 'countdown', hasPodBorder: true },
    { widgetType: 'cta', hasPodBorder: false },
    { widgetType: 'faq', hasPodBorder: true },
    { widgetType: 'hero', hasPodBorder: false },
    { widgetType: 'logoshowcase', hasPodBorder: false },
    { widgetType: 'split', hasPodBorder: false },
    { widgetType: 'steps', hasPodBorder: false },
  ];

  for (const widgetCase of cases) {
    const html = renderEditorHtml(widgetCase.widgetType);

    assert.match(html, /path='stage\.background'/, widgetCase.widgetType);
    assert.match(html, /path='stage\.insideShadow\.all'/, widgetCase.widgetType);
    assert.match(html, /path='pod\.background'/, widgetCase.widgetType);
    assert.match(html, /path='pod\.insideShadow\.all'/, widgetCase.widgetType);
    assert.match(html, /path='pod\.radius'/, widgetCase.widgetType);

    if (widgetCase.hasPodBorder) {
      assert.match(html, /path='appearance\.podBorder'/, widgetCase.widgetType);
    } else {
      assert.doesNotMatch(html, /path='appearance\.podBorder'/, widgetCase.widgetType);
    }
  }
});

test('faq widget compiles nested section label paths from defaults', async () => {
  const spec = readWidgetSpec('faq');
  const panels = parsePanels(buildEditorHtmlLines(spec.editor, spec.defaults, spec.widgetname)).panels;
  const controls = compileControlsFromPanels({ panels, defaults: spec.defaults });
  const sectionLabelControl = controls.find((control) => control.path === 'sections.__SECTION__.title');

  assert.equal(sectionLabelControl?.kind, 'string');
  assert.ok(controls.some((control) => control.path === 'sections.__SECTION__.faqs'));
});

test('steps normalization assigns stable repeated item ids before save', () => {
  const spec = readWidgetSpec('steps');
  const normalization = normalizeWidgetNormalizationSpec(spec.normalization);
  const config = {
    items: [
      { id: '', title: 'Choose a widget', body: '' },
      { title: 'Choose a widget', body: '' },
      { id: '', title: '', body: '' },
    ],
  };

  const normalized = applyWidgetNormalizationRules(config, normalization);

  assert.deepEqual(
    (normalized.items as Array<{ id: string }>).map((item) => item.id),
    ['choose-a-widget', 'choose-a-widget-2', 'step-3'],
  );
});

test('cardgrid normalization assigns stable repeated item ids before save', () => {
  const spec = readWidgetSpec('cardgrid');
  const normalization = normalizeWidgetNormalizationSpec(spec.normalization);
  const config = {
    items: [
      { id: '', title: 'Examples', body: '' },
      { title: 'Examples', body: '' },
      { id: '', title: '', body: '' },
    ],
  };

  const normalized = applyWidgetNormalizationRules(config, normalization);

  assert.deepEqual(
    (normalized.items as Array<{ id: string }>).map((item) => item.id),
    ['examples', 'examples-2', 'card-3'],
  );
});
