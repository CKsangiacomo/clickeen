import type { RuntimeMaterializerCompiledWidget, RuntimeMaterializerInput } from '../../src/types';

export const baseState = {
  headline: 'Clickeen helps teams launch fast.',
  nested: {
    eyebrow: 'AI-native widgets',
  },
  behavior: {
    seoGeo: {
      enabled: false,
    },
    socialShare: {
      enabled: true,
      attachTo: 'stage',
    },
  },
  headerCta: {
    openMode: 'same-tab',
  },
  localeSwitcher: {
    enabled: false,
    attachTo: 'stage',
  },
  typography: {
    globalFamily: 'Inter',
    roles: {},
    roleScales: {},
  },
  items: [
    { id: 'first', title: 'First answer' },
    { id: 'second', title: 'Second answer' },
  ],
};

export const baseCompiledWidget = {
  widgetname: 'contract-widget',
  discovery: {
    widgetType: 'contract-widget',
    kind: 'contract-widget',
    baseline: {
      title: 'Contract Widget',
      description: 'Contract Widget public package.',
    },
    parts: [],
    relationships: [],
  },
  editableFields: {
    widgetType: 'contract-widget',
    fields: [
      {
        path: 'headline',
        type: 'string',
        label: 'Headline',
        role: 'headline',
        arrayItemIdentity: [],
        limits: [],
      },
      {
        path: 'nested.eyebrow',
        type: 'string',
        label: 'Eyebrow',
        role: 'eyebrow',
        arrayItemIdentity: [],
        limits: [],
      },
      {
        path: 'items[].title',
        type: 'string',
        label: 'Item title',
        role: 'item-title',
        arrayItemIdentity: ['items[].id'],
        limits: [],
      },
    ],
  },
  widgetSoftware: {
    widgetHtml: `<body>
<link rel="stylesheet" href="/dieter/tokens/tokens.css" />
<link rel="stylesheet" href="./core/core.css" />
<section class="ck-headerLayout" data-ck-widget="contract-widget">
  <p data-bind="nested.eyebrow"></p>
  <h1 data-bind="headline"></h1>
  <ul data-bind="items"></ul>
</section>
<script src="./core/core.js" defer></script>
</body>`,
    coreHtml: '',
    typographyBehavior: {
      roles: {},
    },
    styles: [
      {
        path: '/dieter/tokens/tokens.css',
        source: `:root { --ck-color-text: #111; }
`,
      },
      {
        path: './core/core.css',
        source: `.contract-widget { color: var(--ck-color-text); }
`,
      },
    ],
    scripts: [
      {
        path: './core/core.js',
        source: `window.__contractWidgetLoaded = true;
`,
      },
    ],
  },
} satisfies RuntimeMaterializerCompiledWidget;

export const baseMaterializerInput = {
  compiled: baseCompiledWidget,
  artifactCoordinate: {
    kind: 'account-instance-widget',
    accountPublicId: 'CLICKEEN',
    instanceId: 'inst_contract',
    baseLocale: 'en',
  },
  state: baseState,
  discoveryPolicyEnabled: false,
  typographyData: {
    curatedFonts: {
      Inter: {
        source: 'google',
        spec: 'Inter:wght@100..900',
        familyClass: 'sans',
        weights: ['400'],
        styles: ['normal'],
      },
    },
  },
} satisfies RuntimeMaterializerInput;
