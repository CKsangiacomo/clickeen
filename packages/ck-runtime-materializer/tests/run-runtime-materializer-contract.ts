import assert from 'node:assert/strict';
import {
  renderWidgetStyles,
  WIDGET_TYPOGRAPHY_SCRIPTS,
  type TypographyScript,
  type WidgetTypographyBehavior,
} from '@clickeen/widget-foundation';
import { materializeRuntimePackage } from '../src';
import { baseMaterializerInput } from './fixtures/base-input';
import type { RuntimeMaterializerInput } from '../src';

function cloneInput(input: RuntimeMaterializerInput): RuntimeMaterializerInput {
  return structuredClone(input);
}

function assertSuccess<T extends { ok: boolean }>(result: T): asserts result is T & { ok: true } {
  assert.equal(result.ok, true, JSON.stringify(result));
}

async function materializeBase() {
  const result = await materializeRuntimePackage(cloneInput(baseMaterializerInput));
  assertSuccess(result);
  return result;
}

async function testPackageWithOneShellContract(): Promise<void> {
  const result = await materializeBase();
  assert.match(result.files.indexHtml, /href="\/CLICKEEN\/inst_contract\/styles\.css"/);
  assert.match(result.files.indexHtml, /src="\/CLICKEEN\/inst_contract\/runtime\.js"/);
  assert.doesNotMatch(result.files.indexHtml, /\/locales\//);
  assert.doesNotMatch(
    result.files.runtimeJs,
    /CK_WIDGETS|baseState|applyExactOverlay|localeOverlay|requestedLocale/,
  );
  assert.match(result.files.runtimeJs, /__contractWidgetLoaded/);
}

function contentMarker(identityKey: string): string {
  return `data-ck-content-path="${identityKey}"`;
}

async function testStableContentCoordinates(): Promise<void> {
  const input = cloneInput(baseMaterializerInput);
  input.state.headline = `A & < > " ' / \` = B`;
  input.compiled.widgetSoftware.widgetHtml = `<body>
<section data-ck-widget="contract-widget">
  <h1 data-ck-content-path="{{$ck.headline.path}}">{{headline}}</h1>
  <span data-ck-content-path="{{nested.$ck.eyebrow.path}}" data-ck-content-mode="text" data-ck-content-attribute="title" title="{{nested.eyebrow}}"></span>
  {{> core}}
</section>
</body>`;
  input.compiled.widgetSoftware.coreHtml = `<ul>
{{#items}}
  <li data-ck-content-path="{{$ck.title.path}}">{{title}}</li>
{{/items}}
</ul>`;

  const firstKey = 'contract-widget|item-title|items[].title|items[].id=first';
  const secondKey = 'contract-widget|item-title|items[].title|items[].id=second';
  const thirdKey = 'contract-widget|item-title|items[].title|items[].id=third';
  const initial = await materializeRuntimePackage(input);
  assertSuccess(initial);
  assert.doesNotMatch(initial.files.indexHtml, /data-ck-content-path="[^"]*&#x3D;/);
  assert.ok(initial.files.indexHtml.includes(contentMarker('contract-widget|headline|headline')));
  assert.ok(
    initial.files.indexHtml.includes('A &amp; &lt; &gt; &quot; &#39; &#x2F; &#x60; = B'),
    'ordinary values retain HTML escaping while equals remains literal',
  );
  assert.ok(
    initial.files.indexHtml.includes(contentMarker('contract-widget|eyebrow|nested.eyebrow')),
  );
  assert.match(
    initial.files.indexHtml,
    /data-ck-content-attribute="title" title="AI-native widgets"/,
  );
  assert.ok(initial.files.indexHtml.includes(contentMarker(firstKey)));
  assert.ok(initial.files.indexHtml.includes(contentMarker(secondKey)));

  const reordered = cloneInput(input);
  const reorderedItems = reordered.state.items as Array<{ id: string; title: string }>;
  reordered.state.items = [reorderedItems[1]!, reorderedItems[0]!];
  const reorderedResult = await materializeRuntimePackage(reordered);
  assertSuccess(reorderedResult);
  assert.ok(
    reorderedResult.files.indexHtml.indexOf(contentMarker(secondKey)) <
      reorderedResult.files.indexHtml.indexOf(contentMarker(firstKey)),
  );

  const added = cloneInput(reordered);
  (added.state.items as Array<{ id: string; title: string }>).push({
    id: 'third',
    title: 'Third answer',
  });
  const addedResult = await materializeRuntimePackage(added);
  assertSuccess(addedResult);
  assert.ok(addedResult.files.indexHtml.includes(contentMarker(thirdKey)));

  const deleted = cloneInput(added);
  deleted.state.items = (deleted.state.items as Array<{ id: string; title: string }>).filter(
    (item) => item.id !== 'first',
  );
  const deletedResult = await materializeRuntimePackage(deleted);
  assertSuccess(deletedResult);
  assert.equal(deletedResult.files.indexHtml.includes(contentMarker(firstKey)), false);
}

async function testRepeatedItemStyleCoordinates(): Promise<void> {
  const input = cloneInput(baseMaterializerInput);
  const items = input.state.items as Array<Record<string, unknown>>;
  items[0]!.style = { background: { type: 'color', color: '#112233' } };
  items[1]!.style = { background: { type: 'color', color: '#445566' } };
  input.compiled.widgetSoftware.styles = [
    {
      path: './core/core.css',
      source: `{{#items}}
.item-{{id}} {
  background: {{#ck.css.background}}{{$ck.path}}.style.background{{/ck.css.background}};
}
{{/items}}`,
    },
  ];

  const initial = await materializeRuntimePackage(input);
  assertSuccess(initial);
  assert.match(initial.files.stylesCss, /\.item-first\s*\{\s*background: #112233;/);
  assert.match(initial.files.stylesCss, /\.item-second\s*\{\s*background: #445566;/);

  input.state.items = [items[1]!, items[0]!];
  const reordered = await materializeRuntimePackage(input);
  assertSuccess(reordered);
  assert.match(reordered.files.stylesCss, /\.item-first\s*\{\s*background: #112233;/);
  assert.match(reordered.files.stylesCss, /\.item-second\s*\{\s*background: #445566;/);
}

function allScriptLineHeights(value: string): Record<TypographyScript, string> {
  return Object.fromEntries(WIDGET_TYPOGRAPHY_SCRIPTS.map((script) => [script, value])) as Record<
    TypographyScript,
    string
  >;
}

function cjkLineHeights(args: {
  other: string;
  japanese: string;
  korean: string;
  zhHans: string;
  zhHant: string;
}): Record<TypographyScript, string> {
  return {
    ...allScriptLineHeights(args.other),
    japanese: args.japanese,
    korean: args.korean,
    zhHans: args.zhHans,
    zhHant: args.zhHant,
  };
}

const TYPOGRAPHY_BEHAVIOR_CASES = {
  title: {
    fluidSize: 'min-plus-growth',
    normalLineHeight: cjkLineHeights({
      other: 'var(--lh-tight)',
      japanese: '1.28',
      korean: '1.26',
      zhHans: '1.24',
      zhHant: '1.24',
    }),
  },
  body: {
    fluidSize: 'proportional',
    normalLineHeight: cjkLineHeights({
      other: 'var(--lh-body)',
      japanese: '1.58',
      korean: '1.54',
      zhHans: '1.52',
      zhHant: '1.52',
    }),
  },
  button: {
    fluidSize: 'proportional',
    normalLineHeight: cjkLineHeights({
      other: 'var(--lh-tight)',
      japanese: '1.24',
      korean: '1.22',
      zhHans: '1.2',
      zhHant: '1.2',
    }),
  },
  localeSwitcher: {
    fluidSize: 'proportional',
    normalLineHeight: allScriptLineHeights('var(--lh-tight)'),
  },
  bigBang: {
    fluidSize: 'min-plus-growth',
    normalLineHeight: allScriptLineHeights('normal'),
  },
  cardTitle: {
    fluidSize: 'min-plus-growth',
    normalLineHeight: allScriptLineHeights('normal'),
  },
  cardCopy: {
    fluidSize: 'proportional',
    normalLineHeight: allScriptLineHeights('normal'),
  },
  timer: {
    fluidSize: 'min-plus-growth',
    normalLineHeight: allScriptLineHeights('1'),
  },
  label: {
    fluidSize: 'proportional',
    normalLineHeight: allScriptLineHeights('var(--lh-tight)'),
  },
  section: {
    fluidSize: 'proportional',
    normalLineHeight: cjkLineHeights({
      other: 'var(--lh-tight)',
      japanese: '1.3',
      korean: '1.3',
      zhHans: '1.28',
      zhHant: '1.28',
    }),
  },
  question: {
    fluidSize: 'proportional',
    normalLineHeight: cjkLineHeights({
      other: 'var(--lh-tight)',
      japanese: '1.38',
      korean: '1.36',
      zhHans: '1.34',
      zhHant: '1.34',
    }),
  },
  answer: {
    fluidSize: 'proportional',
    normalLineHeight: cjkLineHeights({
      other: 'var(--lh-body)',
      japanese: '1.62',
      korean: '1.58',
      zhHans: '1.56',
      zhHant: '1.56',
    }),
  },
} satisfies WidgetTypographyBehavior['roles'];

const TYPOGRAPHY_SCRIPT_LOCALES: Record<TypographyScript, string> = {
  latin: 'en',
  japanese: 'ja',
  korean: 'ko',
  zhHans: 'zh-CN',
  zhHant: 'zh-TW',
  arabic: 'ar',
  hebrew: 'he',
  thai: 'th',
  devanagari: 'hi',
  bengali: 'bn',
  cyrillic: 'ru',
};

async function testExactTypographyBehavior(): Promise<void> {
  const input = cloneInput(baseMaterializerInput);
  const roleEntries = Object.entries(TYPOGRAPHY_BEHAVIOR_CASES);
  input.state.typography = {
    globalFamily: 'Inter',
    roles: Object.fromEntries(
      roleEntries.map(([roleKey]) => [
        roleKey,
        {
          color: { type: 'color', color: '#111111' },
          family: 'Inter',
          fontStyle: 'normal',
          lineHeightCustom: 1,
          lineHeightPreset: 'normal',
          sizeCustom: 40,
          sizePreset: 'custom',
          trackingCustom: 0,
          trackingPreset: 'normal',
          weight: '400',
        },
      ]),
    ),
    roleScales: Object.fromEntries(roleEntries.map(([roleKey]) => [roleKey, { xs: '20px' }])),
  };
  input.compiled.widgetSoftware.typographyBehavior = {
    roles: TYPOGRAPHY_BEHAVIOR_CASES,
  };
  input.compiled.widgetSoftware.styles = [
    {
      path: './core/core.css',
      source: roleEntries
        .map(([roleKey]) => {
          const variableKey = roleKey.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
          return `.test-${roleKey} {\n{{#ck.css.typographyRole}}${roleKey} ${variableKey}{{/ck.css.typographyRole}}\n}`;
        })
        .join('\n'),
    },
  ];

  for (const script of WIDGET_TYPOGRAPHY_SCRIPTS) {
    input.artifactCoordinate.baseLocale = TYPOGRAPHY_SCRIPT_LOCALES[script];
    const result = await materializeRuntimePackage(input);
    assertSuccess(result);
    const previewCss = renderWidgetStyles({
      software: input.compiled.widgetSoftware,
      state: input.state,
      context: {
        locale: input.artifactCoordinate.baseLocale,
        typographyData: input.typographyData,
      },
    });
    assert.equal(result.files.stylesCss, previewCss, `${script} preview and Publish CSS match`);
    roleEntries.forEach(([roleKey, behavior]) => {
      const block = result.files.stylesCss.match(
        new RegExp(`\\.test-${roleKey} \\{([\\s\\S]*?)\\}`),
      )?.[1];
      assert.ok(block, `${script}:${roleKey} renders typography variables`);
      const expectedSize =
        behavior.fluidSize === 'min-plus-growth'
          ? 'clamp(20px, calc(20px + 2.0833cqi), 40px)'
          : 'clamp(20px, 4.1667cqi, 40px)';
      assert.ok(
        block.includes(
          `--typo-${roleKey.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}-size: ${expectedSize};`,
        ),
        `${script}:${roleKey} preserves its fluid-size formula`,
      );
      assert.ok(
        block.includes(
          `--typo-${roleKey.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}-line-height: ${behavior.normalLineHeight[script]};`,
        ),
        `${script}:${roleKey} preserves normal line height`,
      );
    });
  }
}

const testCases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: 'package with one Shell contract', run: testPackageWithOneShellContract },
  { name: 'stable content coordinates', run: testStableContentCoordinates },
  { name: 'repeated item style coordinates', run: testRepeatedItemStyleCoordinates },
  { name: 'exact generic typography behavior', run: testExactTypographyBehavior },
];

for (const testCase of testCases) {
  try {
    await testCase.run();
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    console.error(`FAIL ${testCase.name}`);
    throw error;
  }
}
