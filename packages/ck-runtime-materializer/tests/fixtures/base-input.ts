import type {
  RuntimeMaterializerCompiledWidget,
  RuntimeMaterializerInput,
} from '../../src/types';

export const baseState = {
  headline: 'Clickeen helps teams launch fast.',
  nested: {
    eyebrow: 'AI-native widgets',
  },
  behavior: {
    socialShare: {
      enabled: true,
    },
  },
  items: [
    { id: 'first', title: 'First answer' },
    { id: 'second', title: 'Second answer' },
  ],
};

export const baseCompiledWidget = {
  widgetname: 'contract-widget',
  displayName: 'Contract Widget',
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
  controls: [{ path: 'headline' }, { path: 'nested.eyebrow' }, { path: 'items[].title' }],
  widgetPackage: {
    files: {
      'widget.html': {
        mediaType: 'text/html',
        source: `<body>
<link rel="stylesheet" href="/dieter/tokens/tokens.css" />
<link rel="stylesheet" href="./widget.css" />
<section data-ck-widget="contract-widget" data-role="root">
  <p data-bind="nested.eyebrow"></p>
  <h1 data-bind="headline"></h1>
  <ul data-bind="items"></ul>
</section>
<script src="./widget.client.js" defer></script>
</body>`,
      },
      'product/widgets/contract-widget/widget.css': {
        mediaType: 'text/css',
        source: `.contract-widget { color: var(--ck-color-text); }
`,
      },
      'product/widgets/contract-widget/widget.client.js': {
        mediaType: 'text/javascript',
        source: `window.__contractWidgetLoaded = true;
`,
      },
      'product/widgets/shared/socialShare.css': {
        mediaType: 'text/css',
        source: `.ck-social-share { display: flex; }
`,
      },
      'product/widgets/shared/socialShare.js': {
        mediaType: 'text/javascript',
        source: `window.__ckSocialShareLoaded = true;
`,
      },
    },
  },
} satisfies RuntimeMaterializerCompiledWidget;

export const baseMaterializerInput = {
  compiled: baseCompiledWidget,
  artifactCoordinate: {
    kind: 'account-instance-widget',
    accountPublicId: 'CLICKEEN',
    instanceId: 'inst_contract',
    baseLocale: 'en',
    requestedLocale: 'en',
  },
  displayName: 'Contract Widget',
  state: baseState,
  evidence: {
    schemaWidgetContractFingerprint: 'schema:fingerprint',
    sourceFingerprint: 'source:fingerprint',
    sourceReference: 'accounts/CLICKEEN/instances/inst_contract/source.json',
    overlayFingerprint: null,
  },
} satisfies RuntimeMaterializerInput;

