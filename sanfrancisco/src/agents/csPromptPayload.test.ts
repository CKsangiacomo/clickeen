import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCsPromptPayload } from './csPromptPayload.ts';

test('FAQ copilot prompt uses provided controls for editor context', () => {
  const payload = buildCsPromptPayload({
    widgetType: 'faq',
    prompt: 'Rewrite every question and answer',
    currentConfig: {
      header: {
        title: 'Support FAQs',
        subtitleHtml: 'Fast answers',
      },
      cta: {
        label: 'Contact us',
      },
      sections: [
        {
          id: 'general',
          title: 'General',
          faqs: [
            {
              id: 'what-is-it',
              question: 'What is Clickeen?',
              answer: 'Clickeen helps publish widgets.',
              defaultOpen: false,
            },
          ],
        },
      ],
      appearance: {
        cardwrapper: {
          shadow: {
            blur: 24,
          },
        },
      },
    },
    widgetPackage: {
      v: 1,
      widgetType: 'faq',
      files: {
        'content.json': {
          mediaType: 'application/json',
          source: JSON.stringify({
            v: 1,
            widgetType: 'faq',
            fields: [
              {
                path: 'header.title',
                label: 'Header title',
                type: 'richtext',
                role: 'header-title',
              },
              {
                path: 'sections[].faqs[].question',
                label: 'FAQ question',
                type: 'string',
                role: 'faq-question',
              },
              {
                path: 'sections[].faqs[].answer',
                label: 'FAQ answer',
                type: 'richtext',
                role: 'faq-answer',
              },
            ],
          }),
        },
        'spec.json': {
          mediaType: 'application/json',
          source: JSON.stringify({
            v: 1,
            widgetname: 'faq',
            defaults: {
              header: {},
              sections: [],
              behavior: {},
            },
            normalization: {
              idRules: [{ arrayPath: 'sections', idKey: 'id' }],
              coerceRules: [{ path: 'sections[].faqs[].defaultOpen', type: 'boolean' }],
            },
          }),
        },
        'widget.html': {
          mediaType: 'text/html',
          source: '<section data-widget="faq"><button data-faq-toggle></button></section>',
        },
        'widget.css': {
          mediaType: 'text/css',
          source: '.ck-faq { display: grid; } .ck-faq__question { font-weight: 700; }',
        },
        'widget.client.js': {
          mediaType: 'text/javascript',
          source: 'export function mountFaq(root) { root.querySelectorAll("[data-faq-toggle]"); }',
        },
      },
    },
    controls: [
      {
        path: 'appearance.cardwrapper.shadow.blur',
        label: 'Shadow blur',
        kind: 'number',
      },
      {
        path: 'sections.__SECTION__.faqs.__INDEX__.question',
        label: 'Question',
        kind: 'textfield',
      },
      {
        path: 'sections.__SECTION__.faqs.__INDEX__.answer',
        label: 'Answer',
        kind: 'richtext',
      },
    ],
  });

  assert.match(payload, /WIDGET_PACKAGE_CONTEXT:/);
  assert.match(payload, /content\.json: .*sections\[\]\.faqs\[\]\.question/);
  assert.match(payload, /spec\.json: .*defaultRoots=header,sections,behavior/);
  assert.match(payload, /widget\.html: .*data-widget="faq"/);
  assert.match(payload, /widget\.css: .*ck-faq__question/);
  assert.match(payload, /widget\.client\.js: .*mountFaq/);
  assert.match(payload, /sections\.__SECTION__\.faqs\.__INDEX__\.question/);
  assert.match(payload, /sections\.0\.faqs\.0\.question: What is Clickeen\?/);
  assert.match(payload, /sections\.0\.faqs\.0\.answer: Clickeen helps publish widgets\./);
  assert.doesNotMatch(payload, /appearance\.cardwrapper\.shadow\.blur: 24/);
});
