import type { Env } from '../types.ts';
import { attachTestInstanceRegistry } from '../domains/render/test-instance-registry.ts';

export type StoredObject =
  | { kind: 'json'; payload: unknown }
  | { kind: 'bytes'; body: Uint8Array; httpMetadata?: { contentType?: string } };

function createJsonObject(payload: unknown) {
  return {
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    },
  };
}

function createBytesObject(stored: Extract<StoredObject, { kind: 'bytes' }>) {
  const text = new TextDecoder().decode(stored.body);
  return {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(stored.body);
        controller.close();
      },
    }),
    httpMetadata: stored.httpMetadata,
    async json() {
      return JSON.parse(text) as unknown;
    },
    async text() {
      return text;
    },
  };
}

export function createInternalRouteTestEnv() {
  const objects = new Map<string, StoredObject>();
  const env = {
    TOKYO_DEV_JWT: 'test',
    TOKYO_R2: {
      async get(key: string) {
        const stored = objects.get(key);
        if (!stored) return null;
        return stored.kind === 'json' ? createJsonObject(stored.payload) : createBytesObject(stored);
      },
      async put(key: string, value: string | Uint8Array | ReadableStream | null, options?: { httpMetadata?: { contentType?: string } }) {
        const text = typeof value === 'string'
          ? value
          : value instanceof Uint8Array
            ? new TextDecoder().decode(value)
            : await new Response(value).text();
        if (options?.httpMetadata?.contentType && !options.httpMetadata.contentType.includes('json')) {
          objects.set(key, { kind: 'bytes', body: new TextEncoder().encode(text), httpMetadata: options.httpMetadata });
          return;
        }
        objects.set(key, { kind: 'json', payload: JSON.parse(text) });
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

export function putText(objects: Map<string, StoredObject>, key: string, body: string, contentType: string): void {
  objects.set(key, {
    kind: 'bytes',
    body: new TextEncoder().encode(body),
    httpMetadata: { contentType },
  });
}

export function seedFaqProductSources(objects: Map<string, StoredObject>): void {
  putText(objects, 'product/widgets/faq/widget.html', `<!doctype html>
<html><head>
<link rel="stylesheet" href="./widget.css" />
</head><body>
<div data-ck-widget="faq" data-role="root">
  <section data-role="faq"></section>
  <script src="./widget.client.js" defer></script>
</div>
</body></html>`, 'text/html; charset=utf-8');
  putText(objects, 'product/widgets/faq/widget.css', '.ck-faq{}', 'text/css; charset=utf-8');
  putText(objects, 'product/widgets/faq/widget.client.js', 'window.__FAQ_STATE__ = window.CK_WIDGET.state;', 'text/javascript; charset=utf-8');
}
