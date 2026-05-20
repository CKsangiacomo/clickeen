import assert from 'node:assert/strict';
import test from 'node:test';
import {
  publishAccountInstanceTransition,
  writeSavedRenderConfig,
  writeTranslatedLocaleValues,
} from '../../tokyo-worker/src/domains/render/index.ts';
import { tryHandleClkLiveStaticRoutes } from '../../tokyo-worker/src/routes/clk-live-routes.ts';
import type { Env } from '../../tokyo-worker/src/types.ts';

const ACCOUNT_ID = 'A1B2C3D4';
const INSTANCE_ID = 'Z9Y8X7W6V5';

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

function createTestEnv(seed: Record<string, string>) {
  const objects = new Map<string, StoredObject>(
    Object.entries(seed).map(([key, text]) => [key, { text, contentType: contentTypeForKey(key) }]),
  );
  const env = {
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
          async json() {
            return JSON.parse(stored.text) as unknown;
          },
          async text() {
            return stored.text;
          },
        };
      },
      async put(key: string, value: string | Uint8Array | ReadableStream | null, options?: { httpMetadata?: { contentType?: string } }) {
        const text = typeof value === 'string'
          ? value
          : value instanceof Uint8Array
            ? new TextDecoder().decode(value)
            : await new Response(value).text();
        objects.set(key, { text, contentType: options?.httpMetadata?.contentType ?? contentTypeForKey(key) });
      },
      async list({ prefix }: { prefix?: string }) {
        const normalizedPrefix = prefix ?? '';
        return {
          objects: [...objects.keys()]
            .filter((key) => key.startsWith(normalizedPrefix))
            .map((key) => ({ key })),
          truncated: false,
        };
      },
      async delete(key: string) {
        objects.delete(key);
      },
    } as unknown as R2Bucket,
  } as Env;
  return { env, objects };
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
    'product/widgets/faq/widget.css': '.ck-faq{}',
    'product/widgets/faq/widget.client.js': 'window.__FAQ_STATE__ = window.CK_WIDGET.state;',
  };
}

function faqConfig() {
  return {
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

test('PRD 103G publishes base and translated FAQ files from Tokyo source and current translated values', async () => {
  const { env } = createTestEnv(productSources());
  await writeSavedRenderConfig({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    displayName: 'FAQ',
    meta: { baseLocale: 'en', targetLocales: ['it'] },
    config: faqConfig(),
  });
  await writeTranslatedLocaleValues({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    values: {
      'header.title': 'Domande',
      'header.subtitleHtml': 'Risposte rapide',
      'cta.label': 'Contattaci',
      'sections.0.title': 'Nozioni di base',
      'sections.0.faqs.0.question': 'Quanto costa?',
      'sections.0.faqs.0.answer': 'I piani partono gratis, con modifica manuale.',
    },
  });

  const result = await publishAccountInstanceTransition({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(result.status, 'published');

  const baseHtml = await publicText(env, `/${ACCOUNT_ID}/${INSTANCE_ID}`);
  const translatedHtml = await publicText(env, `/${ACCOUNT_ID}/${INSTANCE_ID}/it.html`);
  const baseScript = await publicText(env, `/${ACCOUNT_ID}/${INSTANCE_ID}/script.js`);
  const translatedScript = await publicText(env, `/${ACCOUNT_ID}/${INSTANCE_ID}/script.it.js`);

  assert.match(baseHtml, /lang="en"/);
  assert.match(translatedHtml, /lang="it"/);
  assert.match(baseScript, /Plans start free\./);
  assert.match(translatedScript, /I piani partono gratis, con modifica manuale\./);
  assert.doesNotMatch(baseHtml + translatedHtml + baseScript + translatedScript, /\/api\/account\/|\/__internal\/|product\/widgets\//);
});
