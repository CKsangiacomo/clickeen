import assert from 'node:assert/strict';
import {
  AccountInstanceTransitionError,
  buildClkLiveEntryCachePurgeFiles,
  createAccountInstanceFromSubmittedSource,
  deleteAccountInstanceTransition,
  saveAccountInstanceTransition,
} from '../src/domains/account-instances/operations';
import { readAccountInstanceSource } from '../src/domains/account-instances/source';
import { writeInstanceServeState } from '../src/domains/account-instances/serve-state';
import type { AccountInstanceContentDocument } from '../src/domains/account-instances/types';
import type { Env } from '../src/types';

type StoredObject = {
  body: string;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
};

type PurgeCall = {
  url: string;
  body: string;
};

const accountId = 'CLICKEEN';
const instanceId = 'ABCD123456';
const publicServingBase = 'https://dev.clk.live';
const instancePrefix = `accounts/${accountId}/instances/${instanceId}/`;
const initialPackage = {
  indexHtml: '<!doctype html><html><body>initial</body></html>',
  stylesCss: '.initial{}',
  runtimeJs: 'window.__initial = true;',
};
const updatedPackage = {
  indexHtml: '<!doctype html><html><body>updated</body></html>',
  stylesCss: '.updated{}',
  runtimeJs: 'window.__updated = true;',
};

function bodyAsText(body: unknown): string {
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  if (body instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(body));
  throw new Error(`unsupported test R2 body: ${Object.prototype.toString.call(body)}`);
}

function createEnv(): { env: Env; objects: Map<string, StoredObject> } {
  const objects = new Map<string, StoredObject>();
  const bucket = {
    async put(
      key: string,
      body: unknown,
      options?: {
        httpMetadata?: { contentType?: string };
        customMetadata?: Record<string, string>;
      },
    ) {
      objects.set(key, {
        body: bodyAsText(body),
        httpMetadata: options?.httpMetadata,
        customMetadata: options?.customMetadata,
      });
      return {};
    },
    async get(key: string) {
      const object = objects.get(key);
      if (!object) return null;
      return {
        body: new Response(object.body).body,
        httpEtag: `etag-${key}`,
        httpMetadata: object.httpMetadata,
        customMetadata: object.customMetadata,
        async text() {
          return object.body;
        },
        async json() {
          return JSON.parse(object.body);
        },
      };
    },
    async list(options?: { prefix?: string }) {
      const prefix = options?.prefix ?? '';
      return {
        objects: [...objects.keys()]
          .filter((key) => key.startsWith(prefix))
          .map((key) => ({ key })),
        truncated: false,
      };
    },
    async delete(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
    },
  };
  return {
    objects,
    env: {
      TOKYO_R2: bucket as unknown as R2Bucket,
      CLOUDFLARE_ZONE_ID: 'test-zone',
      CLOUDFLARE_CACHE_PURGE_TOKEN: 'test-token',
      PUBLIC_SERVING_BASE_URL: publicServingBase,
    },
  };
}

function content(value: string): AccountInstanceContentDocument {
  return {
    id: instanceId,
    accountId,
    widgetType: 'faq',
    fields: {
      headline: {
        identityKey: 'faq|headline|headline',
        fieldPattern: 'headline',
        value,
        status: 'ok',
      },
    },
    updatedAt: '2026-08-07T00:00:00.000Z',
  };
}

async function createInstance(env: Env, published: boolean): Promise<void> {
  const created = await createAccountInstanceFromSubmittedSource({
    env,
    accountId,
    instanceId,
    widgetType: 'faq',
    displayName: 'FAQ',
    config: { revision: 1 },
    content: content('Initial'),
    baseLocale: 'en',
    publicPackage: initialPackage,
  });
  if (published) {
    await writeInstanceServeState({
      env,
      accountId,
      instanceId,
      widgetCode: created.pointer.widgetCode,
      status: 'published',
    });
  }
}

function installPurgeResponse(args: { status: number; success: boolean }): {
  calls: PurgeCall[];
  restore: () => void;
} {
  const calls: PurgeCall[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: input instanceof Request ? input.url : String(input),
      body: String(init?.body ?? ''),
    });
    return new Response(JSON.stringify({ success: args.success }), {
      status: args.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function assertExactPurge(call: PurgeCall): void {
  assert.equal(call.url, 'https://api.cloudflare.com/client/v4/zones/test-zone/purge_cache');
  assert.deepEqual(JSON.parse(call.body), {
    files: buildClkLiveEntryCachePurgeFiles({ publicServingBase, accountId, instanceId }),
  });
}

async function save(env: Env): ReturnType<typeof saveAccountInstanceTransition> {
  return saveAccountInstanceTransition({
    env,
    accountId,
    instanceId,
    submittedWidgetType: 'faq',
    config: { revision: 2 },
    content: content('Updated'),
    publicPackage: updatedPackage,
    baseLocale: 'en',
    hasDisplayName: false,
  });
}

function assertPurgeFailure(error: unknown): boolean {
  assert.ok(error instanceof AccountInstanceTransitionError);
  assert.equal(error.status, 502);
  assert.equal(error.reasonKey, 'tokyo.errors.publicCache.purgeFailed');
  return true;
}

async function testSavePurgesOnlyPublishedInstance(): Promise<void> {
  const published = createEnv();
  await createInstance(published.env, true);
  const publishedPurge = installPurgeResponse({ status: 200, success: true });
  try {
    const result = await save(published.env);
    assert.equal(result.live, true);
    assert.equal(publishedPurge.calls.length, 1);
    assertExactPurge(publishedPurge.calls[0]);
  } finally {
    publishedPurge.restore();
  }

  const unpublished = createEnv();
  await createInstance(unpublished.env, false);
  const unpublishedPurge = installPurgeResponse({ status: 200, success: true });
  try {
    const result = await save(unpublished.env);
    assert.equal(result.live, false);
    assert.equal(unpublishedPurge.calls.length, 0);
  } finally {
    unpublishedPurge.restore();
  }
}

async function testSavePurgeFailureIsNotReportedAsSuccess(): Promise<void> {
  const { env } = createEnv();
  await createInstance(env, true);
  const purge = installPurgeResponse({ status: 500, success: false });
  try {
    await assert.rejects(save(env), assertPurgeFailure);
    const saved = await readAccountInstanceSource({ env, accountId, instanceId });
    assert.equal(saved.ok, true);
    if (saved.ok) assert.equal(saved.value.config.revision, 2);
  } finally {
    purge.restore();
  }
}

async function testDeletePurgesPublishedInstance(): Promise<void> {
  const published = createEnv();
  await createInstance(published.env, true);
  const publishedPurge = installPurgeResponse({ status: 200, success: true });
  try {
    const deleted = await deleteAccountInstanceTransition({
      env: published.env,
      accountId,
      instanceId,
    });
    assert.equal(deleted.existed, true);
    assert.equal(publishedPurge.calls.length, 1);
    assertExactPurge(publishedPurge.calls[0]);
    assert.equal(
      [...published.objects.keys()].some((key) => key.startsWith(instancePrefix)),
      false,
    );
  } finally {
    publishedPurge.restore();
  }

  const unpublished = createEnv();
  await createInstance(unpublished.env, false);
  const unpublishedPurge = installPurgeResponse({ status: 200, success: true });
  try {
    const deleted = await deleteAccountInstanceTransition({
      env: unpublished.env,
      accountId,
      instanceId,
    });
    assert.equal(deleted.existed, true);
    assert.equal(unpublishedPurge.calls.length, 0);
  } finally {
    unpublishedPurge.restore();
  }
}

async function testDeletePurgeFailurePreservesInstanceForRetry(): Promise<void> {
  const { env, objects } = createEnv();
  await createInstance(env, true);
  const failedPurge = installPurgeResponse({ status: 500, success: false });
  try {
    await assert.rejects(
      deleteAccountInstanceTransition({ env, accountId, instanceId }),
      assertPurgeFailure,
    );
    assert.equal(failedPurge.calls.length, 1);
    assertExactPurge(failedPurge.calls[0]);
    assert.equal(
      [...objects.keys()].some((key) => key.startsWith(instancePrefix)),
      true,
    );
  } finally {
    failedPurge.restore();
  }

  const retryPurge = installPurgeResponse({ status: 200, success: true });
  try {
    const deleted = await deleteAccountInstanceTransition({ env, accountId, instanceId });
    assert.equal(deleted.existed, true);
    assert.equal(retryPurge.calls.length, 1);
    assertExactPurge(retryPurge.calls[0]);
    assert.equal(
      [...objects.keys()].some((key) => key.startsWith(instancePrefix)),
      false,
    );
  } finally {
    retryPurge.restore();
  }
}

const tests = [
  ['Save purges only a published instance', testSavePurgesOnlyPublishedInstance],
  ['Save purge failure is not reported as success', testSavePurgeFailureIsNotReportedAsSuccess],
  ['Delete purges a published instance', testDeletePurgesPublishedInstance],
  ['Delete purge failure preserves the instance for retry', testDeletePurgeFailurePreservesInstanceForRetry],
] as const;

for (const [name, run] of tests) {
  await run();
  console.log(`PASS ${name}`);
}
