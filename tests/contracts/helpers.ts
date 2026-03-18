type StoredR2Object = {
  body: Uint8Array;
  httpMetadata?: {
    contentType?: string;
  };
};

function encodeBody(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') return new TextEncoder().encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  return new TextEncoder().encode(JSON.stringify(value));
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

export function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function createR2BucketStub() {
  const store = new Map<string, StoredR2Object>();

  const bucket = {
    async get(key: string) {
      const entry = store.get(key) ?? null;
      if (!entry) return null;
      return {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(entry.body);
            controller.close();
          },
        }),
        httpMetadata: entry.httpMetadata,
        async json() {
          return JSON.parse(new TextDecoder().decode(entry.body));
        },
        async text() {
          return new TextDecoder().decode(entry.body);
        },
      };
    },
    async head(key: string) {
      const entry = store.get(key) ?? null;
      if (!entry) return null;
      return {
        httpMetadata: entry.httpMetadata,
      };
    },
    async put(
      key: string,
      value: unknown,
      options?: {
        httpMetadata?: {
          contentType?: string;
        };
      },
    ) {
      store.set(key, {
        body: encodeBody(value),
        httpMetadata: options?.httpMetadata,
      });
    },
    async delete(keys: string | string[]) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const key of list) {
        store.delete(key);
      }
    },
    async list(options?: { prefix?: string; cursor?: string; limit?: number }) {
      const prefix = options?.prefix ?? '';
      const limit = options?.limit ?? 1000;
      const start = options?.cursor ? Number(options.cursor) : 0;
      const keys = [...store.keys()].filter((key) => key.startsWith(prefix)).sort();
      const slice = keys.slice(start, start + limit);
      const nextCursor = start + limit;
      return {
        objects: slice.map((key) => ({ key })),
        truncated: nextCursor < keys.length,
        cursor: nextCursor < keys.length ? String(nextCursor) : undefined,
      };
    },
  };

  return { bucket, store };
}

export function createUsageKvStub() {
  const store = new Map<string, string>();
  return {
    async get(key: string, type?: 'json') {
      const value = store.get(key) ?? null;
      if (!value || type !== 'json') return value;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    },
    async put(
      key: string,
      value: string,
      _options?: {
        expirationTtl?: number;
      },
    ) {
      store.set(key, value);
    },
    store,
  };
}

export function createExecutionContextStub(): ExecutionContext {
  return {
    waitUntil() {},
    passThroughOnException() {},
  } as ExecutionContext;
}
