import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AccountPublicationCoordinator } from '../src/domains/account-instances/publication-coordinator';
import { unpublishAccountInstanceTransition } from '../src/domains/account-instances/operations';
import {
  readAccountInstanceSourcePointer,
  writeAccountInstanceSource,
} from '../src/domains/account-instances/source';
import { transitionErrorResponse } from '../src/routes/internal-product-route-utils';
import type { Env } from '../src/types';

type StoredObject = {
  body: string;
  etag: string;
};

type ListHold = {
  started: Promise<void>;
  release: () => void;
};

class MemoryR2 {
  readonly objects = new Map<string, StoredObject>();
  private sequence = 0;
  private nextListHold: {
    started: () => void;
    released: Promise<void>;
  } | null = null;

  holdNextList(): ListHold {
    let markStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.nextListHold = { started: markStarted, released };
    return { started, release };
  }

  private object(key: string, stored: StoredObject) {
    return {
      key,
      version: stored.etag,
      size: new TextEncoder().encode(stored.body).byteLength,
      etag: stored.etag,
      httpEtag: `"${stored.etag}"`,
      uploaded: new Date(),
      storageClass: 'Standard',
      checksums: {},
      body: new ReadableStream(),
      bodyUsed: false,
      arrayBuffer: async () => new TextEncoder().encode(stored.body).buffer,
      bytes: async () => new TextEncoder().encode(stored.body),
      text: async () => stored.body,
      json: async <T>() => JSON.parse(stored.body) as T,
      blob: async () => new Blob([stored.body]),
      writeHttpMetadata: () => undefined,
    };
  }

  async get(key: string) {
    await Promise.resolve();
    const stored = this.objects.get(key);
    return stored ? this.object(key, stored) : null;
  }

  async put(key: string, value: string | ArrayBuffer | ArrayBufferView) {
    await Promise.resolve();
    const body = typeof value === 'string'
      ? value
      : value instanceof ArrayBuffer
        ? new TextDecoder().decode(value)
        : new TextDecoder().decode(
            new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
          );
    const stored = { body, etag: `etag-${++this.sequence}` };
    this.objects.set(key, stored);
    return this.object(key, stored);
  }

  async list(options?: R2ListOptions) {
    const hold = this.nextListHold;
    this.nextListHold = null;
    if (hold) {
      hold.started();
      await hold.released;
    }
    const prefix = options?.prefix ?? '';
    const objects = Array.from(this.objects.entries())
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, stored]) => this.object(key, stored));
    return {
      objects,
      truncated: false,
      delimitedPrefixes: [],
    };
  }

  async delete(keys: string | string[]) {
    for (const key of Array.isArray(keys) ? keys : [keys]) this.objects.delete(key);
  }
}

const accountId = 'CLICKEEN';
const firstInstanceId = 'AAAAAAAAAA';
const secondInstanceId = 'BBBBBBBBBB';

function publicPackage(label: string) {
  return {
    indexHtml: `<main>${label}</main>`,
    stylesCss: `.${label} { display: block; }`,
    runtimeJs: `globalThis.${label} = true;`,
  };
}

function publishRequest(instanceId: string, label: string): Request {
  return new Request('https://account-publication.internal/publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      accountId,
      instanceId,
      publishedLimit: 1,
      publicPackage: publicPackage(label),
    }),
  });
}

function assertPublicPackageStored(
  r2: MemoryR2,
  instanceId: string,
  expected: boolean,
  message: string,
): void {
  for (const file of ['index.html', 'styles.css', 'runtime.js']) {
    assert.equal(
      r2.objects.has(`accounts/${accountId}/instances/${instanceId}/${file}`),
      expected,
      message,
    );
  }
}

async function seedInstance(env: Env, instanceId: string): Promise<void> {
  await writeAccountInstanceSource({
    env,
    accountId,
    instanceId,
    widgetCode: 'FAQ',
    widgetType: 'faq',
    config: { core: { title: instanceId } },
    content: {
      id: instanceId,
      accountId,
      widgetType: 'faq',
      fields: {},
      updatedAt: '2026-08-17T00:00:00.000Z',
    },
    displayName: null,
    baseLocale: 'en',
  });
}

async function readPayload(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

async function assertPostCommitPurgeFailureTruth(): Promise<void> {
  const r2 = new MemoryR2();
  const env = {
    TOKYO_R2: r2 as unknown as R2Bucket,
    ACCOUNT_PUBLICATION_COORDINATOR: {} as DurableObjectNamespace,
    CLOUDFLARE_ZONE_ID: 'zone',
    CLOUDFLARE_CACHE_PURGE_TOKEN: 'token',
  } satisfies Env;
  await seedInstance(env, firstInstanceId);

  const coordinator = new AccountPublicationCoordinator(
    {
      storage: {
        async get() {
          return undefined;
        },
      },
    } as unknown as DurableObjectState,
    env,
  );
  const originalFetch = globalThis.fetch;
  let purgeSucceeds = false;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ success: purgeSucceeds }),
    {
      status: purgeSucceeds ? 200 : 500,
      headers: { 'content-type': 'application/json' },
    },
  );

  try {
    const failedPublish = await coordinator.fetch(
      publishRequest(firstInstanceId, 'publish-committed-before-purge-failure'),
    );
    assert.equal(failedPublish.status, 502);
    assert.deepEqual(await readPayload(failedPublish), {
      ok: false,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'tokyo.errors.publicCache.purgeFailed',
        detail: 'cloudflare_purge_status_500',
      },
      committed: {
        instanceId: firstInstanceId,
        status: 'published',
        changed: true,
      },
    });
    const publishedPointer = await readAccountInstanceSourcePointer({
      env,
      accountId,
      instanceId: firstInstanceId,
    });
    assert.ok(publishedPointer.ok);
    assert.equal(publishedPointer.value.publishStatus, 'published');
    assertPublicPackageStored(
      r2,
      firstInstanceId,
      true,
      'a purge failure must not erase the committed package',
    );

    purgeSucceeds = true;
    const republish = await coordinator.fetch(
      publishRequest(firstInstanceId, 'republish-retries-purge'),
    );
    assert.equal(republish.status, 200);
    assert.deepEqual(await readPayload(republish), {
      ok: true,
      instanceId: firstInstanceId,
      status: 'published',
      changed: false,
    });

    purgeSucceeds = false;
    let unpublishFailure: unknown;
    try {
      await unpublishAccountInstanceTransition({
        env,
        accountId,
        instanceId: firstInstanceId,
      });
    } catch (error) {
      unpublishFailure = error;
    }
    assert.ok(unpublishFailure);
    const failedUnpublish = transitionErrorResponse(unpublishFailure);
    assert.equal(failedUnpublish.status, 502);
    assert.deepEqual(await readPayload(failedUnpublish), {
      ok: false,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'tokyo.errors.publicCache.purgeFailed',
        detail: 'cloudflare_purge_status_500',
      },
      committed: {
        instanceId: firstInstanceId,
        status: 'unpublished',
        changed: true,
      },
    });
    const unpublishedPointer = await readAccountInstanceSourcePointer({
      env,
      accountId,
      instanceId: firstInstanceId,
    });
    assert.ok(unpublishedPointer.ok);
    assert.equal(unpublishedPointer.value.publishStatus, 'unpublished');

    purgeSucceeds = true;
    assert.deepEqual(
      await unpublishAccountInstanceTransition({
        env,
        accountId,
        instanceId: firstInstanceId,
      }),
      {
        instanceId: firstInstanceId,
        status: 'unpublished',
        changed: false,
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function run(): Promise<void> {
  await assertPostCommitPurgeFailureTruth();

  const r2 = new MemoryR2();
  const env = {
    TOKYO_R2: r2 as unknown as R2Bucket,
    ACCOUNT_PUBLICATION_COORDINATOR: {} as DurableObjectNamespace,
    CLOUDFLARE_ZONE_ID: 'zone',
    CLOUDFLARE_CACHE_PURGE_TOKEN: 'token',
  } satisfies Env;
  await Promise.all([
    seedInstance(env, firstInstanceId),
    seedInstance(env, secondInstanceId),
  ]);

  let lifecycleFenceReads = 0;
  const coordinator = new AccountPublicationCoordinator(
    {
      storage: {
        async get() {
          lifecycleFenceReads += 1;
          return undefined;
        },
      },
    } as unknown as DurableObjectState,
    env,
  );
  const listHold = r2.holdNextList();
  let markFirstPurgeStarted!: () => void;
  let releaseFirstPurge!: () => void;
  const firstPurgeStarted = new Promise<void>((resolve) => {
    markFirstPurgeStarted = resolve;
  });
  const firstPurgeReleased = new Promise<void>((resolve) => {
    releaseFirstPurge = resolve;
  });

  const originalFetch = globalThis.fetch;
  let purgeCalls = 0;
  globalThis.fetch = async () => {
    purgeCalls += 1;
    if (purgeCalls === 1) {
      markFirstPurgeStarted();
      await firstPurgeReleased;
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const winnerResponsePromise = coordinator.fetch(
      publishRequest(firstInstanceId, 'first'),
    );
    await listHold.started;
    assert.equal(lifecycleFenceReads, 1, 'the lifecycle fence must run before R2 listing');

    const overlappingResponse = await coordinator.fetch(
      publishRequest(secondInstanceId, 'second-overlap'),
    );
    assert.equal(overlappingResponse.status, 409);
    const overlappingPayload = await readPayload(overlappingResponse);
    assert.deepEqual(overlappingPayload.error, {
      kind: 'DENY',
      reasonKey: 'coreui.errors.instance.publishInProgress',
      detail: 'coreui.errors.instance.publishInProgress',
    });
    assertPublicPackageStored(
      r2,
      secondInstanceId,
      false,
      'the overlapping contender must store no public package file',
    );
    const overlappingPointer = await readAccountInstanceSourcePointer({
      env,
      accountId,
      instanceId: secondInstanceId,
    });
    assert.ok(overlappingPointer.ok);
    assert.equal(overlappingPointer.value.publishStatus, 'unpublished');
    assert.equal(purgeCalls, 0, 'the overlapping contender must not purge public cache');

    listHold.release();
    await firstPurgeStarted;

    const deniedResponse = await coordinator.fetch(
      publishRequest(secondInstanceId, 'second-later'),
    );
    assert.equal(deniedResponse.status, 402);
    const deniedPayload = await readPayload(deniedResponse);
    assert.deepEqual(deniedPayload.error, {
      kind: 'DENY',
      reasonKey: 'coreui.upsell.reason.limitReached',
      detail: 'coreui.upsell.reason.limitReached',
      current: 1,
      limit: 1,
    });
    assertPublicPackageStored(
      r2,
      secondInstanceId,
      false,
      'the later capacity loser must store no public package file',
    );
    const deniedPointer = await readAccountInstanceSourcePointer({
      env,
      accountId,
      instanceId: secondInstanceId,
    });
    assert.ok(deniedPointer.ok);
    assert.equal(deniedPointer.value.publishStatus, 'unpublished');
    assert.equal(purgeCalls, 1, 'the capacity loser must not purge public cache');

    releaseFirstPurge();
    const winnerResponse = await winnerResponsePromise;
    assert.equal(winnerResponse.status, 200);
    assert.deepEqual(await readPayload(winnerResponse), {
      ok: true,
      instanceId: firstInstanceId,
      status: 'published',
      changed: true,
    });
    assertPublicPackageStored(r2, firstInstanceId, true, 'the winner must store its full package');

    const republishResponse = await coordinator.fetch(
      publishRequest(firstInstanceId, 'first-republished'),
    );
    assert.equal(republishResponse.status, 200);
    assert.deepEqual(await readPayload(republishResponse), {
      ok: true,
      instanceId: firstInstanceId,
      status: 'published',
      changed: false,
    });
    assert.equal(purgeCalls, 2);
  } finally {
    releaseFirstPurge();
    globalThis.fetch = originalFetch;
  }

  const [wrangler, indexSource, routeSource, coordinatorSource] = await Promise.all([
    readFile(new URL('../wrangler.toml', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/routes/internal-instance-routes.ts', import.meta.url), 'utf8'),
    readFile(
      new URL('../src/domains/account-instances/publication-coordinator.ts', import.meta.url),
      'utf8',
    ),
  ]);
  assert.match(wrangler, /name = "ACCOUNT_PUBLICATION_COORDINATOR"/);
  assert.match(wrangler, /class_name = "AccountPublicationCoordinator"/);
  assert.match(wrangler, /new_sqlite_classes = \["AccountPublicationCoordinator"\]/);
  assert.match(indexSource, /export \{ AccountPublicationCoordinator \}/);
  assert.match(routeSource, /coordinateAccountInstancePublish\(\{/);
  assert.doesNotMatch(routeSource, /publication\.lock|putJsonIfUnchanged/);
  assert.ok(
    coordinatorSource.indexOf('this.state.storage.get(') <
      coordinatorSource.indexOf('publishAccountInstanceTransition({'),
    'the Durable Object lifecycle fence must precede all R2 publication work',
  );

  console.log(
    'PASS Tokyo publication coordination is first-wins, preserves loser state, and permits Republish',
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
