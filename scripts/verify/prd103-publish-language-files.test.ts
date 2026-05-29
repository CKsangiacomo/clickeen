import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTranslatedTextValueMap,
  extractTextPrimitiveValuesForEditableFields,
  type WidgetEditableFieldsContract,
} from '@clickeen/ck-contracts/translated-value-primitives';
import {
  getWidgetDefinition,
  resolveWidgetDefaults,
} from '../../tokyo-worker/src/domains/widget-catalog.ts';
import {
  publishAccountInstanceTransition,
  writeSavedRenderConfig,
  writeTranslatedLocaleValues,
} from '../../tokyo-worker/src/domains/render/index.ts';
import { tryHandleClkLiveStaticRoutes } from '../../tokyo-worker/src/routes/clk-live-routes.ts';
import type { Env } from '../../tokyo-worker/src/types.ts';
import { attachTestInstanceRegistry } from '../../tokyo-worker/src/domains/render/test-instance-registry.ts';

const ACCOUNT_ID = 'A1B2C3D4';
type StoredObject = {
  text: string;
  contentType?: string;
  httpEtag: string;
};

function contentTypeForKey(key: string): string | undefined {
  if (key.endsWith('.html')) return 'text/html; charset=utf-8';
  if (key.endsWith('.css')) return 'text/css; charset=utf-8';
  if (key.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (key.endsWith('.json')) return 'application/json; charset=utf-8';
  return undefined;
}

function createTestEnv(seed: Record<string, string>) {
  let objectVersion = 0;
  const objects = new Map<string, StoredObject>(
    Object.entries(seed).map(([key, text]) => [key, { text, contentType: contentTypeForKey(key), httpEtag: `"seed-${++objectVersion}"` }]),
  );
  const env = {
    TOKYO_DEV_JWT: 'test',
    TOKYO_R2: {
      async get(key: string) {
        const stored = objects.get(key);
        if (!stored) return null;
        return {
          httpEtag: stored.httpEtag,
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
      async put(
        key: string,
        value: string | Uint8Array | ReadableStream | null,
        options?: { httpMetadata?: { contentType?: string }; onlyIf?: { etagMatches?: string } },
      ) {
        const current = objects.get(key);
        const expectedEtag = options?.onlyIf?.etagMatches;
        if (expectedEtag && current?.httpEtag !== expectedEtag) return null;
        const text = typeof value === 'string'
          ? value
          : value instanceof Uint8Array
            ? new TextDecoder().decode(value)
            : await new Response(value).text();
        const httpEtag = `"test-${++objectVersion}"`;
        objects.set(key, { text, contentType: options?.httpMetadata?.contentType ?? contentTypeForKey(key), httpEtag });
        return { key, httpEtag, etag: httpEtag };
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
  attachTestInstanceRegistry(env);
  return { env, objects };
}

function widgetProductSources(widgetType: string) {
  return {
    [`product/widgets/${widgetType}/widget.html`]: `<!doctype html>
<html><head>
<link rel="stylesheet" href="./widget.css" />
</head><body>
<div data-ck-widget="${widgetType}" data-role="root">
  <section data-role="${widgetType}"></section>
  <script src="./widget.client.js" defer></script>
</div>
</body></html>`,
    [`product/widgets/${widgetType}/widget.css`]: `.ck-${widgetType}{}`,
    [`product/widgets/${widgetType}/widget.client.js`]: `window.__${widgetType.toUpperCase()}_STATE__ = window.CK_WIDGET.state;`,
  };
}

function translatedValuesForWidget(args: {
  widgetType: string;
  contract: WidgetEditableFieldsContract;
  config: Record<string, unknown>;
}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(buildTranslatedTextValueMap(
      extractTextPrimitiveValuesForEditableFields({
        contract: args.contract,
        config: args.config,
      }),
    )).map(([path, value]) => [path, `it:${value}`]),
  );
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

const widgetCases = [
  {
    widgetType: 'faq',
    instanceId: 'Z9Y8X7W6V5',
    expectedTranslatedScriptText: 'it:Plans start free.',
    mutate(config: Record<string, unknown>) {
      const header = config.header as Record<string, unknown>;
      const cta = config.cta as Record<string, unknown>;
      const sections = config.sections as Array<Record<string, unknown>>;
      const section = sections[0] as Record<string, unknown>;
      const faqs = section.faqs as Array<Record<string, unknown>>;
      header.title = 'Questions';
      header.subtitleHtml = 'Fast answers';
      cta.label = 'Contact us';
      section.title = 'Basics';
      faqs[0] = {
        ...(faqs[0] ?? {}),
        question: 'What does it cost?',
        answer: 'Plans start free.',
      };
    },
  },
  {
    widgetType: 'countdown',
    instanceId: 'Q1W2E3R4T5',
    expectedTranslatedScriptText: 'it:Days',
  },
  {
    widgetType: 'logoshowcase',
    instanceId: 'L1O2G3O4S5',
    expectedTranslatedScriptText: 'it:Audi',
  },
] as const;

for (const widgetCase of widgetCases) {
  test(`PRD 105 publishes canonical ${widgetCase.widgetType} runtime from Tokyo source and current locale overlay`, async () => {
    const widgetDefinition = getWidgetDefinition(widgetCase.widgetType);
    const config = resolveWidgetDefaults(widgetCase.widgetType);
    assert(widgetDefinition);
    assert(config);
    widgetCase.mutate?.(config);
    const { env } = createTestEnv(widgetProductSources(widgetCase.widgetType));
    const translatedValues = translatedValuesForWidget({
      widgetType: widgetCase.widgetType,
      contract: widgetDefinition.editableFields,
      config,
    });
    await writeSavedRenderConfig({
      env,
      accountId: ACCOUNT_ID,
      instanceId: widgetCase.instanceId,
      widgetType: widgetCase.widgetType,
      displayName: widgetDefinition.label,
      meta: { baseLocale: 'en', targetLocales: ['it'] },
      config,
    });
    await writeTranslatedLocaleValues({
      env,
      accountId: ACCOUNT_ID,
      instanceId: widgetCase.instanceId,
      locale: 'it',
      values: translatedValues,
    });

    const result = await publishAccountInstanceTransition({ env, accountId: ACCOUNT_ID, instanceId: widgetCase.instanceId });
    assert.equal(result.status, 'published');

    const baseHtml = await publicText(env, `/${ACCOUNT_ID}/${widgetCase.instanceId}`);
    const runtime = await publicText(env, `/${ACCOUNT_ID}/${widgetCase.instanceId}/runtime.js`);

    assert.match(baseHtml, /lang="en"/);
    assert.match(baseHtml, /runtime\.js/);
    assert.match(runtime, /CK_WIDGET/);
    assert.match(runtime, /CK_LOCALE_POLICY/);
    assert.match(runtime, new RegExp(widgetCase.expectedTranslatedScriptText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(baseHtml + runtime, /\/api\/account\/|\/__internal\/|product\/widgets\//);
  });
}
