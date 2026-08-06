import assert from 'node:assert/strict';
import {
  generateInstance,
  type GenerateInstanceInput,
} from '../src';
import { renderStencil } from '../src/stencil-renderer';
import { createWidgetShellFactoryDefaults, SYSTEM_GOOGLE_FONT_RECORDS } from '@clickeen/widget-shell';

function expectThrow(fn: () => unknown, pattern: RegExp): void {
  assert.throws(fn, pattern);
}

function interTypography() {
  return {
    curatedFonts: {
      Inter: {
        source: 'google' as const, spec: SYSTEM_GOOGLE_FONT_RECORDS.Inter.spec, familyClass: 'sans' as const,
        weights: [...SYSTEM_GOOGLE_FONT_RECORDS.Inter.weights], styles: [...SYSTEM_GOOGLE_FONT_RECORDS.Inter.styles],
      },
    },
  };
}

function testNestedRepeaterCoordinates(): void {
  const rendered = renderStencil(
    '{{#each faq.sections}}S{{@index}}={{@path}}:{{title}};{{#each faqs}}Q{{@index}}={{@path}}:{{question}}/{{../title}};{{/each}}{{/each}}',
    {
      faq: {
        sections: [
          {
            title: 'General',
            faqs: [
              { question: 'First?' },
              { question: 'Second?' },
            ],
          },
        ],
      },
    },
    { strict: true },
  );
  assert.equal(
    rendered,
    'S0=faq.sections.0:General;Q0=faq.sections.0.faqs.0:First?/General;Q1=faq.sections.0.faqs.1:Second?/General;',
  );
}

function testEscapingAndApprovedRawPaths(): void {
  const rendered = renderStencil(
    '{{#each cards.items}}<h2>{{title}}</h2><div>{{copy}}</div>{{/each}}',
    { cards: { items: [{ title: '<Title>', copy: '<strong>Copy</strong>' }] } },
    { strict: true, rawPathPatterns: new Set(['cards.items[].copy']) },
  );
  assert.equal(rendered, '<h2>&lt;Title&gt;</h2><div><strong>Copy</strong></div>');
}

function testStrictFailures(): void {
  expectThrow(
    () => renderStencil('{{missing}}', {}, { strict: true }),
    /ck\.web_code\.stencil\.value_missing:missing/,
  );
  expectThrow(
    () => renderStencil('{{#each faq.sections}}{{@path}}{{/each}}', { faq: {} }, { strict: true }),
    /ck\.web_code\.stencil\.repeater_invalid:faq\.sections/,
  );
  assert.equal(renderStencil('{{#each optional}}{{value}}{{/each}}', {}), '');
}

function instanceInput(): GenerateInstanceInput {
  return {
    definition: {
      widgetType: 'cards',
      displayName: 'Cards',
      description: 'Cards test definition',
      editableFields: {
        widgetType: 'cards',
        fields: [
          {
            path: 'cards.items[].title',
            label: 'Title',
            type: 'string',
            role: 'card-title',
            arrayItemIdentity: ['cards.items[].id'],
            limits: [],
          },
          {
            path: 'cards.items[].copy',
            label: 'Copy',
            type: 'richtext',
            role: 'card-copy',
            arrayItemIdentity: ['cards.items[].id'],
            limits: [],
          },
        ],
      },
      files: {
        'index.html': '<!doctype html><html><head><title>Cards Widget</title><link rel="stylesheet" href="../shared/shell.css" /></head><body><div class="stage" data-role="stage"><div class="pod" data-role="pod"><div data-role="root" data-ck-widget="cards"><section class="ck-headerLayout"><header class="ck-header"><a data-role="header-cta" href="{{headerCta.href}}" data-open-mode="{{headerCta.openMode}}"><span class="ck-header__ctaIcon" aria-hidden="true"></span>CTA</a></header><div class="ck-headerLayout__body">{{#each cards.items}}<article data-ck-field-path="{{@path}}.title" data-ck-field-target="text"><h2>{{title}}</h2><div data-ck-field-path="{{@path}}.copy" data-ck-field-target="richtext">{{copy}}</div><img src="{{media.image.src}}" alt="{{media.imageAlt}}" data-ck-field-path="{{@path}}.media.imageAlt" data-ck-field-target="attribute:alt" /></article>{{/each}}</div></section><script src="./runtime.js"></script></div></div></div></body></html>',
        'styles.css': '.card { display: block; }',
        'runtime.js': 'window.CKCardsBehavior?.();',
      },
      styleModules: [{ id: 'product/widgets/shared/shell.css', source: '.shell { display:block; }' }],
      runtimeModules: [{ id: 'product/widgets/shared/runtime.js', source: 'window.CKWidgetRuntime = {};' }],
    },
    source: {
      ...createWidgetShellFactoryDefaults(),
      widgetType: 'cards',
      cards: {
        items: [
          {
            id: 'A',
            title: 'One & two',
            copy: '<strong>Copy</strong>',
            media: {
              type: 'image',
              image: { assetRef: 'asset://hero' },
              imageAlt: 'Hero "image"',
            },
          },
        ],
      },
    },
    baseLocale: 'en-US',
    overlays: null,
    settings: {
      seoGeoAeoEnabled: false,
      includeClickeenAttribution: true,
    },
    context: {
      assetsByRef: {
        'asset://hero': {
          assetRef: 'asset://hero',
          url: 'https://assets.example/hero.png',
          assetType: 'image',
          contentType: 'image/png',
        },
      },
      typography: interTypography(),
    },
  };
}

function testGenerateInstance(): void {
  const input = instanceInput();
  const header = input.source.header as { title: string; subtitleHtml: string };
  header.title = '<strong>Customer Cards</strong>';
  header.subtitleHtml = '<p>Useful &amp; direct.</p>';
  const stage = input.source.stage as Record<string, any>;
  stage.floating = { enabled: true, anchor: 'top-right', offset: 24 };
  stage.insideShadow.all = { ...stage.insideShadow.all, enabled: true, alpha: 20, blur: 12 };
  const pod = input.source.pod as Record<string, any>;
  pod.insideShadow.all = { ...pod.insideShadow.all, enabled: true, alpha: 20, blur: 12 };
  const behavior = input.source.behavior as Record<string, any>;
  behavior.socialShare.enabled = true;
  (input.source.localeSwitcher as Record<string, unknown>).enabled = true;
  (input.source.localeSwitcher as Record<string, unknown>).position = 'top-center';
  input.overlays = { 'it-IT': { values: { 'cards.items.0.title': 'Carta' } } };
  input.context.typography.curatedFonts['Account Sans'] = {
    source: 'account-asset', url: 'https://assets.example/account.woff2', contentType: 'font/woff2',
    familyClass: 'sans', weights: ['400', '700'], styles: ['normal'],
  };
  input.context.typography.curatedFonts.Lora = {
    source: 'google', spec: SYSTEM_GOOGLE_FONT_RECORDS.Lora.spec, familyClass: 'serif',
    weights: [...SYSTEM_GOOGLE_FONT_RECORDS.Lora.weights], styles: [...SYSTEM_GOOGLE_FONT_RECORDS.Lora.styles],
  };
  (((input.source.typography as Record<string, any>).roles as Record<string, any>).title as Record<string, unknown>).family = 'Account Sans';
  const item = ((input.source.cards as { items: Array<{ copy: string }> }).items[0]);
  item.copy = '<strong onclick="bad()">Copy</strong><img src=x onerror=bad()><a href="javascript:bad()">unsafe</a>';
  const generated = generateInstance(input);
  assert.match(generated.indexHtml, /data-ck-field-path="cards\.items\.0\.title"/);
  assert.match(generated.indexHtml, /One &amp; two/);
  assert.match(generated.indexHtml, /<strong>Copy<\/strong><a>unsafe<\/a>/);
  assert.ok(!generated.indexHtml.includes('onclick'));
  assert.ok(!generated.indexHtml.includes('<img src=x'));
  assert.ok(!generated.indexHtml.includes('javascript:'));
  assert.match(generated.indexHtml, /https:\/\/assets\.example\/hero\.png/);
  assert.match(generated.indexHtml, /alt="Hero &quot;image&quot;"/);
  assert.match(
    generated.indexHtml,
    /href="\/__CK_PUBLIC_ACCOUNT_ID__\/__CK_PUBLIC_INSTANCE_ID__\/styles\.css"/,
  );
  assert.match(generated.indexHtml, /data-has-header="true"/);
  assert.match(generated.indexHtml, /data-core-size-mode="auto"/);
  assert.match(generated.indexHtml, /--stage-bg: #efefef/);
  assert.match(generated.indexHtml, /data-stage-floating="true"/);
  assert.match(generated.indexHtml, /class="ck-inside-shadow-layer"/);
  assert.match(generated.indexHtml, /data-action="wechat"/);
  assert.match(generated.indexHtml, /data-action="instagram"/);
  assert.match(generated.indexHtml, /class="ck-locale-switcher__select"/);
  assert.match(generated.indexHtml, /class="ck-locale-switcher" data-host="stage" data-position="top-center"/);
  assert.match(generated.indexHtml, /<option value="en-US" selected>/);
  assert.match(generated.indexHtml, /<option value="it-IT">/);
  assert.match(generated.indexHtml, /--typo-title-family/);
  assert.match(generated.indexHtml, /class="ck-clickeen-attribution"/);
  assert.equal((generated.indexHtml.match(/<meta name="generator" content="Clickeen" \/>/g) ?? []).length, 1);
  assert.ok(!generated.indexHtml.includes('<meta name="description"'));
  assert.equal((generated.indexHtml.match(/class="ck-clickeen-attribution"/g) ?? []).length, 1);
  assert.match(
    generated.indexHtml,
    /href="https:\/\/clickeen\.com\/" target="_blank" rel="nofollow noreferrer">Made with Clickeen — Cards<\/a>/,
  );
  assert.match(generated.indexHtml, /"@type":"Organization"/);
  assert.match(generated.indexHtml, /"@type":"WebApplication"/);
  assert.match(generated.indexHtml, /"@type":"WebPage"/);
  assert.match(generated.indexHtml, /https:\/\/clk\.live\/__CK_PUBLIC_ACCOUNT_ID__\/__CK_PUBLIC_INSTANCE_ID__/);
  assert.match(generated.indexHtml, /"name":"Clickeen"/);
  assert.match(generated.indexHtml, /"description":"Create and publish customizable website widgets in multiple languages\."/);
  assert.equal((generated.indexHtml.match(/rel="stylesheet"/g) ?? []).length, 1);
  assert.equal((generated.indexHtml.match(
    /src="\/__CK_PUBLIC_ACCOUNT_ID__\/__CK_PUBLIC_INSTANCE_ID__\/runtime\.js"/g,
  ) ?? []).length, 1);
  assert.match(generated.stylesCss, /ck-style-module:shared-shell\.css/);
  assert.match(generated.stylesCss, /ck-style-module:cards-styles\.css/);
  assert.match(generated.stylesCss, /ck-style-module:generated-clickeen-attribution\.css/);
  assert.match(generated.stylesCss, /@font-face\{font-family:"Account Sans"/);
  assert.match(generated.runtimeJs, /ck-runtime-module:shared-runtime\.js/);
  assert.match(generated.runtimeJs, /ck-runtime-module:cards-runtime\.js/);
  assert.ok(!generated.runtimeJs.includes('CK_WIDGETS'));
  assert.ok(!generated.runtimeJs.includes('ck:state-update'));
  assert.ok(generated.indexHtml.includes(
    'href="/__CK_PUBLIC_ACCOUNT_ID__/__CK_PUBLIC_INSTANCE_ID__/styles.css"',
  ));
  assert.ok(generated.indexHtml.includes(
    'src="/__CK_PUBLIC_ACCOUNT_ID__/__CK_PUBLIC_INSTANCE_ID__/runtime.js"',
  ));
  assert.ok(!generated.indexHtml.includes('href="./styles.css"'));
  assert.ok(!generated.indexHtml.includes('src="./runtime.js"'));

  const loraInput = instanceInput();
  loraInput.context = input.context;
  (((loraInput.source.typography as Record<string, any>).roles as Record<string, any>).title as Record<string, unknown>).family = 'Lora';
  const loraInstance = generateInstance(loraInput);
  assert.match(loraInstance.stylesCss, /family=Lora/);

  const plainInput = instanceInput();
  plainInput.settings = { seoGeoAeoEnabled: false, includeClickeenAttribution: false };
  const plain = generateInstance(plainInput);
  assert.match(plain.indexHtml, /<meta name="generator" content="Clickeen" \/>/);
  assert.ok(!plain.indexHtml.includes('ck-clickeen-attribution'));
  assert.ok(!plain.indexHtml.includes('application/ld+json'));
  assert.ok(!plain.indexHtml.includes('<meta name="description"'));
  assert.ok(!plain.stylesCss.includes('generated-clickeen-attribution.css'));

  const seoInput = instanceInput();
  const seoHeader = seoInput.source.header as { title: string; subtitleHtml: string };
  seoHeader.title = '<strong>Customer Cards</strong>';
  seoHeader.subtitleHtml = '<p>Useful &amp; direct.</p>';
  seoInput.settings = { seoGeoAeoEnabled: true, includeClickeenAttribution: false };
  const seo = generateInstance(seoInput);
  assert.match(seo.indexHtml, /<title>Customer Cards<\/title>/);
  assert.match(seo.indexHtml, /<meta name="description" content="Useful &amp; direct\." \/>/);
  assert.match(seo.indexHtml, /data-ck-schema="instance-webpage"/);
  assert.match(seo.indexHtml, /"name":"Customer Cards"/);
  assert.match(seo.indexHtml, /"description":"Useful & direct\."/);
  assert.ok(!seo.indexHtml.includes('ck-clickeen-attribution'));
  assert.ok(!seo.indexHtml.includes('"@type":"Organization"'));
  assert.ok(!seo.indexHtml.includes('rel="canonical"'));

  const combinedInput = instanceInput();
  const combinedHeader = combinedInput.source.header as { title: string; subtitleHtml: string };
  combinedHeader.title = 'Combined Cards';
  combinedHeader.subtitleHtml = 'Combined description';
  combinedInput.settings = { seoGeoAeoEnabled: true, includeClickeenAttribution: true };
  const combined = generateInstance(combinedInput);
  assert.match(combined.indexHtml, /<title>Combined Cards<\/title>/);
  assert.match(combined.indexHtml, /<meta name="description" content="Combined description" \/>/);
  assert.equal((combined.indexHtml.match(/"@type":"WebPage"/g) ?? []).length, 1);
  assert.equal((combined.indexHtml.match(/class="ck-clickeen-attribution"/g) ?? []).length, 1);
  assert.ok(!combined.indexHtml.includes('data-ck-schema="instance-webpage"'));

  const invalid = instanceInput();
  invalid.definition.files['index.html'] = invalid.definition.files['index.html'].replace(
    'data-ck-field-target="text"',
    'data-ck-field-target="attribute:src"',
  );
  expectThrow(() => generateInstance(invalid), /ck\.web_code\.field_marker_invalid/);

  const invalidAlignment = instanceInput();
  (invalidAlignment.source.stage as Record<string, unknown>).alignment = 'diagonal';
  expectThrow(() => generateInstance(invalidAlignment), /ck\.web_code\.shell_invalid:stage\.alignment/);
  const invalidGradient = instanceInput();
  (invalidGradient.source.stage as Record<string, unknown>).background = { type: 'gradient', gradient: { kind: 'spiral', angle: 0, stops: [{ color: '#000', position: 0 }, { color: '#fff', position: 100 }] } };
  expectThrow(() => generateInstance(invalidGradient), /ck\.web_code\.shell_invalid:stage\.background\.gradient\.kind/);
  const invalidShadow = instanceInput();
  ((invalidShadow.source.stage as Record<string, any>).shadow as Record<string, unknown>).inset = 'yes';
  expectThrow(() => generateInstance(invalidShadow), /ck\.web_code\.shell_invalid:stage\.shadow\.inset/);
  const invalidTracking = instanceInput();
  (((invalidTracking.source.typography as Record<string, any>).roles as Record<string, any>).title as Record<string, unknown>).trackingPreset = 'compressed';
  expectThrow(() => generateInstance(invalidTracking), /ck\.web_code\.shell_invalid:typography\.roles\.title\.trackingPreset/);
  const invalidCore = instanceInput();
  (invalidCore.source.coreSize as Record<string, unknown>).mode = 'elastic';
  expectThrow(() => generateInstance(invalidCore), /ck\.web_code\.shell_invalid:coreSize\.mode/);
  const missingFont = instanceInput();
  missingFont.context.typography.curatedFonts = {};
  expectThrow(() => generateInstance(missingFont), /ck\.web_code\.typography_font_missing:Inter/);
  const missingBaseLocale = instanceInput();
  missingBaseLocale.baseLocale = '';
  expectThrow(() => generateInstance(missingBaseLocale), /ck\.web_code\.instance_base_locale_invalid/);
  const missingChannel = instanceInput();
  delete ((missingChannel.source.behavior as Record<string, any>).socialShare.channels as Record<string, unknown>).wechat;
  expectThrow(() => generateInstance(missingChannel), /ck\.web_code\.shell_invalid:behavior\.socialShare\.channels\.wechat/);

  const videoInput = instanceInput();
  (videoInput.source.pod as Record<string, unknown>).background = { type: 'video', video: { src: 'https://assets.example/background.mp4', fit: 'cover', position: 'center', loop: true, muted: true, autoplay: true } };
  const video = generateInstance(videoInput);
  assert.match(video.indexHtml, /class="ck-fill-layer" data-fill-kind="video"/);
  assert.match(video.stylesCss, /\.ck-fill-layer\{position:absolute;inset:0/);
}

function testFaqInstanceSchema(): void {
  const input = instanceInput();
  input.definition.widgetType = 'faq';
  input.definition.displayName = 'FAQ';
  input.definition.description = 'Answer common questions in a visible FAQ widget.';
  input.definition.editableFields = { widgetType: 'faq', fields: [] };
  input.definition.files['index.html'] = '<!doctype html><html><head><title>FAQ</title></head><body><div class="stage" data-role="stage"><div class="pod" data-role="pod"><div data-role="root" data-ck-widget="faq"><section class="ck-headerLayout"><header class="ck-header"><a data-role="header-cta" href="{{headerCta.href}}" data-open-mode="{{headerCta.openMode}}"><span class="ck-header__ctaIcon" aria-hidden="true"></span>CTA</a></header><div class="ck-headerLayout__body">{{#each faq.sections}}{{#each faqs}}<h3>{{question}}</h3><div>{{answer}}</div>{{/each}}{{/each}}</div></section></div></div></div></body></html>';
  input.source.widgetType = 'faq';
  input.source.faq = {
    sections: [
      {
        faqs: [
          { question: 'What is Clickeen?', answer: '<strong>A visual widget platform.</strong>', privateNotes: 'never publish' },
          { question: '', answer: 'Not visibly usable.' },
        ],
      },
    ],
  };
  input.settings = { seoGeoAeoEnabled: true, includeClickeenAttribution: false };
  const generated = generateInstance(input);
  assert.equal((generated.indexHtml.match(/data-ck-schema="faq-page"/g) ?? []).length, 1);
  assert.equal((generated.indexHtml.match(/"@type":"Question"/g) ?? []).length, 1);
  assert.match(generated.indexHtml, /"name":"What is Clickeen\?"/);
  assert.match(generated.indexHtml, /"text":"A visual widget platform\."/);
  assert.ok(!generated.indexHtml.includes('privateNotes'));
  assert.ok(!generated.indexHtml.includes('never publish'));

  input.settings.seoGeoAeoEnabled = false;
  const disabled = generateInstance(input);
  assert.ok(!disabled.indexHtml.includes('data-ck-schema="faq-page"'));
}

testNestedRepeaterCoordinates();
testEscapingAndApprovedRawPaths();
testStrictFailures();
testGenerateInstance();
testFaqInstanceSchema();
console.log('PASS Web Code Generator contracts');
