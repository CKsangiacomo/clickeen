import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../../types.ts';
import {
  verifyInstancePublicPackageReady,
  writeInstancePublicPackage,
} from './package-files.ts';

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
  return undefined;
}

function createTestEnv(seed: Record<string, string> = {}) {
  const objects = new Map<string, StoredObject>(
    Object.entries(seed).map(([key, text]) => [key, { text, contentType: contentTypeForKey(key) }]),
  );
  const env = {
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
        return { key };
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

function packagePayload(instanceId = INSTANCE_ID) {
  return {
    v: 1 as const,
    indexHtml: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FAQ</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div data-ck-widget="faq" data-role="root" data-ck-instance-id="${instanceId}">
      <section data-role="faq"><h2>FAQ</h2></section>
    </div>
    <script src="./runtime.js" defer></script>
  </body>
</html>`,
    stylesCss: `/* ck-style-module:faq-widget-css */
.ck-faq { color: black; }
/* ck-style-module:end */`,
    runtimeJs: `/* ck-runtime-payload:start */
(function () {
  window.CK_WIDGETS = Object.assign({}, window.CK_WIDGETS || {});
  window.CK_WIDGETS["${instanceId}"] = { instanceId: "${instanceId}", state: {} };
})();
/* ck-runtime-payload:end */
/* ck-runtime-module:faq-widget-client-js */
window.CKWidgetRuntime = window.CKWidgetRuntime || {};
/* ck-runtime-module:end */`,
  };
}

function textPayload(objects: Map<string, StoredObject>, key: string): string {
  return objects.get(key)?.text ?? '';
}

test('public package writer stores submitted widget package without rendering widget internals', async () => {
  const { env, objects } = createTestEnv();

  const result = await writeInstancePublicPackage({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    publicPackage: packagePayload(),
  });

  assert.equal(result.ok, true);
  const root = `accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}`;
  const indexHtml = textPayload(objects, `${root}/index.html`);
  const stylesCss = textPayload(objects, `${root}/styles.css`);
  const runtimeJs = textPayload(objects, `${root}/runtime.js`);
  assert.match(indexHtml, /data-ck-instance-id="Z9Y8X7W6V5"/);
  assert.doesNotMatch(`${indexHtml}\n${stylesCss}\n${runtimeJs}`, /product\/widgets|widget\.client\.js|widget\.css/);
  assert.equal(objects.get(`${root}/index.html`)?.contentType, 'text/html; charset=utf-8');
  assert.equal(objects.get(`${root}/styles.css`)?.contentType, 'text/css; charset=utf-8');
  assert.equal(objects.get(`${root}/runtime.js`)?.contentType, 'text/javascript; charset=utf-8');

  const ready = await verifyInstancePublicPackageReady({ env, accountId: ACCOUNT_ID, instanceId: INSTANCE_ID });
  assert.equal(ready.ok, true);
});

test('public package writer rejects packages that do not point at the saved instance', async () => {
  const { env, objects } = createTestEnv();

  const result = await writeInstancePublicPackage({
    env,
    accountId: ACCOUNT_ID,
    instanceId: INSTANCE_ID,
    publicPackage: packagePayload('Q1W2E3R4T5'),
  });

  assert.equal(result.ok, false);
  assert.equal(objects.has(`accounts/${ACCOUNT_ID}/instances/${INSTANCE_ID}/index.html`), false);
});
