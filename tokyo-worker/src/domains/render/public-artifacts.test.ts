import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../../types.ts';
import {
  materializeInstancePublicArtifacts,
  writeSavedRenderConfig,
  writeTranslatedLocaleValues,
} from './index.ts';

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

function createTestEnv(seed: Record<string, string> = {}) {
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

test('Tokyo materializes base and translated public artifacts from instance source and translated locale values', async () => {
  const { env, objects } = createTestEnv(productSources());
  await writeSavedRenderConfig({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    widgetType: 'faq',
    displayName: 'FAQ',
    meta: { baseLocale: 'en', targetLocales: ['it'] },
    config: faqConfig(),
  });
  const values = {
    'header.title': 'Domande',
    'header.subtitleHtml': 'Risposte rapide',
    'cta.label': 'Contattaci',
    'sections.0.title': 'Nozioni di base',
    'sections.0.faqs.0.question': 'Quanto costa?',
    'sections.0.faqs.0.answer': 'I piani partono gratis.',
  };
  await writeTranslatedLocaleValues({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    locale: 'it',
    values,
  });

  const result = await materializeInstancePublicArtifacts({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.locales, ['en', 'it']);
  const root = `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}`;
  assert.match(objects.get(`${root}/index.html`)?.text ?? '', /lang="en"/);
  assert.match(objects.get(`${root}/it.html`)?.text ?? '', /lang="it"/);
  assert.match(objects.get(`${root}/script.js`)?.text ?? '', /Plans start free\./);
  assert.match(objects.get(`${root}/script.it.js`)?.text ?? '', /I piani partono gratis\./);
  assert.doesNotMatch(
    [
      objects.get(`${root}/index.html`)?.text,
      objects.get(`${root}/it.html`)?.text,
      objects.get(`${root}/script.js`)?.text,
      objects.get(`${root}/script.it.js`)?.text,
    ].join('\n'),
    /\/api\/account\/|\/__internal\/|product\/widgets\//,
  );
});
