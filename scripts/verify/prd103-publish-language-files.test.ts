import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOverlayId } from '../../packages/ck-contracts/src/overlay-identity.ts';
import { runEmbedFileWriter, type EmbedFileWriterStorage } from '../../sanfrancisco/src/embed-file-writer.ts';
import type { WidgetGenerationJob } from '../../sanfrancisco/src/widget-generation-jobs.ts';
import { tryHandleClkLiveStaticRoutes } from '../../tokyo-worker/src/routes/clk-live-routes.ts';
import type { Env } from '../../tokyo-worker/src/types.ts';

const ACCOUNT_ID = 'A1B2C3D4';
const INSTANCE_ID = 'Z9Y8X7W6V5';
const INSTANCE_ROOT = `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}`;
const INSTANCE_KEY = `${INSTANCE_ROOT}/instance.json`;

type StoredObject = {
  text: string;
  contentType?: string;
};

function contentTypeForKey(key: string): string | undefined {
  if (key.endsWith('.html')) return 'text/html; charset=utf-8';
  if (key.endsWith('.css')) return 'text/css; charset=utf-8';
  if (key.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (key.endsWith('.json')) return 'application/json; charset=utf-8';
  return undefined;
}

function createStorage(seed: Record<string, string>) {
  const objects = new Map<string, StoredObject>(
    Object.entries(seed).map(([key, text]) => [key, { text, contentType: contentTypeForKey(key) }]),
  );
  const storage: EmbedFileWriterStorage = {
    async readText(key) {
      return objects.get(key)?.text ?? null;
    },
    async writeText(key, value, options) {
      objects.set(key, { text: value, contentType: options?.contentType ?? contentTypeForKey(key) });
    },
    async exists(key) {
      return objects.has(key);
    },
    async listKeys(prefix) {
      return [...objects.keys()].filter((key) => key.startsWith(prefix));
    },
  };
  return { storage, objects };
}

function createPublicEnv(objects: Map<string, StoredObject>): Env {
  return {
    TOKYO_DEV_JWT: 'test',
    TOKYO_R2: {
      async get(key: string) {
        const stored = objects.get(key);
        if (!stored) return null;
        return {
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(stored.text));
              controller.close();
            },
          }),
          httpMetadata: stored.contentType ? { contentType: stored.contentType } : undefined,
        };
      },
    } as unknown as R2Bucket,
  } as Env;
}

function productSources() {
  return {
    'product/widgets/faq/widget.html': `<!doctype html>
<html><head>
<link rel="stylesheet" href="./widget.css" />
</head><body>
<div data-ck-widget="faq" data-role="root">
  <section data-role="faq"></section>
  <script src="./widget.client.js" defer></script>
</div>
</body></html>`,
    'product/widgets/faq/spec.json': '{"v":1}',
    'product/widgets/faq/agent.md': '# FAQ',
    'product/widgets/faq/widget.css': '.ck-faq{}',
    'product/widgets/faq/widget.client.js': 'window.__FAQ_STATE__ = window.CK_WIDGET.state;',
  };
}

function instanceDocument() {
  return {
    v: 1,
    id: INSTANCE_ID,
    accountId: ACCOUNT_ID,
    accountPublicId: ACCOUNT_ID,
    widgetCode: 'FAQ',
    widgetType: 'faq',
    displayName: 'FAQ',
    config: {
      header: { title: 'Questions', subtitleHtml: 'Fast answers' },
      cta: { label: 'Contact us' },
      sections: [
        {
          id: 'general',
          title: 'Basics',
          faqs: [
            {
              id: 'pricing',
              question: 'What does it cost?',
              answer: 'Plans start free.',
              defaultOpen: false,
            },
          ],
        },
      ],
    },
    baseLocale: 'en',
    targetLocales: ['it'],
    embedBuildShape: {
      rendering: 'html',
      seoMode: 'off',
      locales: ['en', 'it'],
      clientSide: 'minimal-js',
    },
    sourceVersion: 1,
    generation: {
      translations: { status: 'ready', sourceVersion: 1, updatedAt: '2026-05-18T00:00:00.000Z' },
      embed: { status: 'queued', sourceVersion: 1, updatedAt: '2026-05-18T00:00:00.000Z' },
    },
    publishStatus: 'published',
    createdAt: '2026-05-18T00:00:00.000Z',
    updatedAt: '2026-05-18T00:00:00.000Z',
  };
}

function embedJob(): WidgetGenerationJob {
  return {
    v: 1,
    jobId: 'job-prd103g',
    jobType: 'widget.embed',
    accountPublicId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    sourceVersion: 1,
    attempt: 0,
    queuedAt: '2026-05-18T00:00:00.000Z',
    traceId: 'trace-prd103g',
    agentId: 'widget.instance.embed',
  };
}

async function publicText(env: Env, pathname: string): Promise<string> {
  const url = new URL(`https://clk.live${pathname}`);
  const response = await tryHandleClkLiveStaticRoutes({
    req: new Request(url),
    env,
    pathname: url.pathname,
    url,
    respond: (value) => value,
  });
  assert.equal(response?.status, 200);
  return response ? response.text() : '';
}

test('PRD 103G publishes base and translated FAQ files from saved instance and current language values', async () => {
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
    [INSTANCE_KEY]: JSON.stringify(instanceDocument()),
    [`${INSTANCE_ROOT}/overlays/${overlayId}.json`]: JSON.stringify({
      v: 1,
      overlayId,
      values: {
        'header.title': 'Domande',
        'header.subtitleHtml': 'Risposte rapide',
        'cta.label': 'Contattaci',
        'sections.0.title': 'Nozioni di base',
        'sections.0.faqs.0.question': 'Quanto costa?',
        'sections.0.faqs.0.answer': 'I piani partono gratis, con modifica manuale.',
      },
    }),
  });

  const result = await runEmbedFileWriter({ storage, job: embedJob() });
  assert.equal(result.ok, true);

  const env = createPublicEnv(objects);
  const baseHtml = await publicText(env, `/${ACCOUNT_ID}/${INSTANCE_ID}`);
  const translatedHtml = await publicText(env, `/${ACCOUNT_ID}/${INSTANCE_ID}/it.html`);
  const baseScript = await publicText(env, `/${ACCOUNT_ID}/${INSTANCE_ID}/script.v1.js`);
  const translatedScript = await publicText(env, `/${ACCOUNT_ID}/${INSTANCE_ID}/script.v1.it.js`);

  assert.match(baseHtml, /lang="en"/);
  assert.match(translatedHtml, /lang="it"/);
  assert.match(baseScript, /Plans start free\./);
  assert.match(translatedScript, /I piani partono gratis, con modifica manuale\./);
  assert.doesNotMatch(baseHtml + translatedHtml + baseScript + translatedScript, /\/api\/account\/|\/__internal\/|product\/widgets\//);
});
