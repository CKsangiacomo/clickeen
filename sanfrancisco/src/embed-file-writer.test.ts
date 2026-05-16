import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOverlayId } from '@clickeen/ck-contracts/overlay-identity';
import { runEmbedFileWriter, type EmbedFileWriterStorage } from './embed-file-writer.ts';
import type { WidgetGenerationJob } from './widget-generation-jobs.ts';

const ACCOUNT_ID = 'A1B2C3D4';
const INSTANCE_ID = 'Z9Y8X7W6V5';
const INSTANCE_KEY = `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/instance.json`;

function createStorage(seed: Record<string, string>) {
  const objects = new Map(Object.entries(seed));
  const writes: string[] = [];
  const storage: EmbedFileWriterStorage = {
    async readText(key) {
      return objects.get(key) ?? null;
    },
    async writeText(key, value) {
      writes.push(key);
      objects.set(key, value);
    },
    async exists(key) {
      return objects.has(key);
    },
    async listKeys(prefix) {
      return [...objects.keys()].filter((key) => key.startsWith(prefix));
    },
  };
  return { storage, objects, writes };
}

function baseInstance(overrides: Record<string, unknown> = {}) {
  return {
    v: 1,
    id: INSTANCE_ID,
    accountId: ACCOUNT_ID,
    accountPublicId: ACCOUNT_ID,
    widgetCode: 'FAQ',
    widgetType: 'faq',
    displayName: 'FAQ',
    config: {
      header: { title: 'Questions' },
      sections: [{ title: 'Basics', faqs: [{ question: 'What?', answer: 'This.' }] }],
    },
    baseLocale: 'en',
    targetLocales: [],
    embedBuildShape: {
      rendering: 'html',
      seoMode: 'off',
      locales: ['en'],
      clientSide: 'minimal-js',
    },
    sourceVersion: 1,
    generation: {
      translations: { status: 'queued', sourceVersion: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
      embed: { status: 'queued', sourceVersion: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
    },
    publishStatus: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function productSources() {
  return {
    'product/widgets/faq/widget.html': `<!doctype html>
<html><head>
<link rel="stylesheet" href="/dieter/tokens/tokens.css" />
<link rel="stylesheet" href="../shared/header.css" />
<link rel="stylesheet" href="./widget.css" />
</head><body>
<div data-ck-widget="faq" data-role="root">
  <section data-role="faq"></section>
  <script src="../shared/header.js" defer></script>
  <script src="./widget.client.js" defer></script>
</div>
</body></html>`,
    'product/widgets/faq/spec.json': '{"v":1}',
    'product/widgets/faq/agent.md': '# FAQ',
    'product/widgets/shared/header.css': '.ck-header{}',
    'product/widgets/faq/widget.css': '.ck-faq{}',
    'product/widgets/shared/header.js': 'window.CKHeader = {};',
    'product/widgets/faq/widget.client.js': 'window.__FAQ_STATE__ = window.CK_WIDGET.state;',
  };
}

function embedJob(sourceVersion = 1): WidgetGenerationJob {
  return {
    v: 1,
    jobId: 'job-1',
    jobType: 'widget.embed',
    accountPublicId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    sourceVersion,
    attempt: 0,
    queuedAt: '2026-01-01T00:00:00.000Z',
    traceId: 'trace-1',
    agentId: 'widget.instance.embed',
  };
}

test('embed file writer writes support files before index directly under the instance folder', async () => {
  const { storage, objects, writes } = createStorage({
    ...productSources(),
    [INSTANCE_KEY]: JSON.stringify(baseInstance()),
  });

  const result = await runEmbedFileWriter({ storage, job: embedJob() });

  assert.deepEqual(result, {
    ok: true,
    stale: false,
    files: ['styles.v1.css', 'styles.css', 'script.v1.js', 'script.js', 'index.html'],
  });
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/styles.css`), true);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/script.js`), true);
  assert.equal([...objects.keys()].some((key) => key.includes('/embed/') || key.includes('/public/') || key.endsWith('/config.json')), false);
  assert.equal(writes.at(-2), `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`);

  const index = objects.get(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`) ?? '';
  assert.match(index, /<link rel="stylesheet" href=".\/styles\.v1\.css"/);
  assert.match(index, /<script src=".\/script\.v1\.js" defer><\/script>/);
  assert.doesNotMatch(index, /product\/widgets|instance\.json|\/__internal\//);

  const saved = JSON.parse(objects.get(INSTANCE_KEY) ?? '{}') as { generation?: { embed?: { status?: string; files?: string[] } } };
  assert.equal(saved.generation?.embed?.status, 'ready');
  assert.deepEqual(saved.generation?.embed?.files, ['styles.v1.css', 'styles.css', 'script.v1.js', 'script.js', 'index.html']);
});

test('embed file writer refuses stale jobs without writing public files', async () => {
  const { storage, objects } = createStorage({
    ...productSources(),
    [INSTANCE_KEY]: JSON.stringify(baseInstance({ sourceVersion: 2 })),
  });

  const result = await runEmbedFileWriter({ storage, job: embedJob(1) });

  assert.deepEqual(result, { ok: true, stale: true, currentSourceVersion: 2 });
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), false);
});

test('embed file writer blocks target locale builds until required overlay exists', async () => {
  const existingIndex = '<!doctype html><html>old</html>';
  const { storage, objects } = createStorage({
    ...productSources(),
    [INSTANCE_KEY]: JSON.stringify(baseInstance({
      targetLocales: ['it'],
      embedBuildShape: {
        rendering: 'html',
        seoMode: 'off',
        locales: ['en', 'it'],
        clientSide: 'minimal-js',
      },
    })),
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`]: existingIndex,
  });

  const result = await runEmbedFileWriter({ storage, job: embedJob() });

  assert.deepEqual(result, { ok: false, stale: false, reason: 'embed.overlay_blocked:it' });
  assert.equal(objects.get(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), existingIndex);
  const saved = JSON.parse(objects.get(INSTANCE_KEY) ?? '{}') as { generation?: { embed?: { status?: string; blockingReason?: string } } };
  assert.equal(saved.generation?.embed?.status, 'failed');
  assert.equal(saved.generation?.embed?.blockingReason, 'embed.overlay_blocked:it');
});

test('embed file writer applies locale overlays into locale browser files', async () => {
  const overlayId = buildOverlayId({
    accountPublicId: ACCOUNT_ID,
    widgetCode: 'FAQ',
    instanceId: INSTANCE_ID,
    languageCode: 'IT00',
    experiment: 'A01',
    personalization: '000',
    version: '00',
  });
  const { storage, objects } = createStorage({
    ...productSources(),
    [INSTANCE_KEY]: JSON.stringify(baseInstance({
      targetLocales: ['it'],
      embedBuildShape: {
        rendering: 'html',
        seoMode: 'off',
        locales: ['en', 'it'],
        clientSide: 'minimal-js',
      },
    })),
    [`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/overlays/${overlayId}.json`]: JSON.stringify({
      v: 1,
      overlayId,
      values: {
        'header.title': 'Domande',
      },
    }),
  });

  const result = await runEmbedFileWriter({ storage, job: embedJob() });

  assert.equal(result.ok, true);
  const localeHtml = objects.get(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/it.html`) ?? '';
  const localeScript = objects.get(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/script.v1.it.js`) ?? '';
  assert.match(localeHtml, /lang="it"/);
  assert.match(localeHtml, /script\.v1\.it\.js/);
  assert.match(localeScript, /Domande/);
  assert.doesNotMatch(localeScript, /\/api\/account\/|\/__internal\/|product\/widgets\//);
});
