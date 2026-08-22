import assert from 'node:assert/strict';
import { AccountPublicationCoordinator } from '../src/domains/account-instances/publication-coordinator';
import { scheduleAccountInstanceResidualCleanup } from '../src/domains/account-instances/delete';
import { createAccountInstanceFromSubmittedSource } from '../src/domains/account-instances/operations';
import { tryHandleClkLiveStaticRoutes } from '../src/routes/clk-live-routes';
import {
  listAccountInstanceIds,
  nextAccountInstanceTimestamp,
  readAccountInstanceSourcePointer,
  writeAccountInstanceSource,
} from '../src/domains/account-instances/source';
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
  private nextDeleteFailure: { key: string; error: Error } | null = null;
  private nextPutFailure: { key: string; error: Error } | null = null;
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

  failNextPut(key: string, error: Error): void {
    this.nextPutFailure = { key, error };
  }

  failNextDelete(key: string, error: Error): void {
    this.nextDeleteFailure = { key, error };
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
    if (this.nextPutFailure?.key === key) {
      const failure = this.nextPutFailure.error;
      this.nextPutFailure = null;
      throw failure;
    }
    const body =
      typeof value === 'string'
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
    const selected = Array.isArray(keys) ? keys : [keys];
    if (this.nextDeleteFailure && selected.includes(this.nextDeleteFailure.key)) {
      const failure = this.nextDeleteFailure.error;
      this.nextDeleteFailure = null;
      throw failure;
    }
    for (const key of selected) this.objects.delete(key);
  }
}

const accountId = 'CLICKEEN';
const firstInstanceId = 'AAAAAAAAAA';
const secondInstanceId = 'BBBBBBBBBB';
const retryInstanceId = 'CCCCCCCCCC';

function publicPackage(label: string) {
  return {
    indexHtml: `<main>${label}</main>`,
    stylesCss: `.${label} { display: block; }`,
    runtimeJs: `globalThis.${label} = true;`,
  };
}

function publishRequest(instanceId: string, sourceUpdatedAt: string, label: string): Request {
  return new Request('https://account-publication.internal/publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      accountId,
      instanceId,
      sourceUpdatedAt,
      publishedLimit: 1,
      publicPackage: publicPackage(label),
    }),
  });
}

function saveRequest(instanceId: string, label: string): Request {
  return new Request('https://account-publication.internal/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      accountId,
      instanceId,
      config: { core: { title: label } },
      content: {
        id: instanceId,
        accountId,
        fields: {},
        updatedAt: '2026-08-18T00:00:00.000Z',
      },
    }),
  });
}

function coordinateRequest(action: 'rename' | 'unpublish' | 'delete', instanceId: string): Request {
  return new Request(`https://account-publication.internal/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      accountId,
      instanceId,
      ...(action === 'rename' ? { displayName: 'must-not-be-renamed' } : {}),
    }),
  });
}

function assertPublicPackageStored(
  r2: MemoryR2,
  instanceId: string,
  expected: boolean,
  message: string,
): void {
  const root = `accounts/${accountId}/instances/${instanceId}`;
  const stored = r2.objects.get(`${root}/serve-state.json`);
  assert.ok(stored, 'the instance must retain its canonical serve artifact');
  const record = JSON.parse(stored.body) as { publicPackage?: unknown };
  assert.equal(record.publicPackage !== undefined, expected, message);
  assert.equal(
    r2.objects.has(`${root}/index.html`),
    false,
    'index.html must not be a second commit',
  );
  assert.equal(
    r2.objects.has(`${root}/styles.css`),
    false,
    'styles.css must not be a second commit',
  );
  assert.equal(
    r2.objects.has(`${root}/runtime.js`),
    false,
    'runtime.js must not be a second commit',
  );
}

function assertCurrentSourceIdentityShape(r2: MemoryR2, instanceId: string): void {
  const stored = r2.objects.get(
    `accounts/${accountId}/instances/${instanceId}/instance.source.json`,
  );
  assert.ok(stored);
  const source = JSON.parse(stored.body) as Record<string, unknown>;
  assert.equal(source.widgetType, 'faq');
  assert.equal(Object.prototype.hasOwnProperty.call(source, 'widgetCode'), false);
  const content = source.content as Record<string, unknown>;
  assert.equal(Object.prototype.hasOwnProperty.call(content, 'widgetType'), false);
}

async function seedInstance(env: Env, instanceId: string): Promise<void> {
  await writeAccountInstanceSource({
    env,
    accountId,
    instanceId,
    widgetType: 'faq',
    config: { core: { title: instanceId } },
    content: {
      id: instanceId,
      accountId,
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

async function servePublicFile(env: Env, instanceId: string, file: string): Promise<Response> {
  const url = new URL(`https://dev.clk.live/${accountId}/${instanceId}/${file}`);
  const response = await tryHandleClkLiveStaticRoutes({
    req: new Request(url),
    env,
    cache: undefined,
    waitUntil() {},
    pathname: url.pathname,
    url,
    respond: (value) => value,
  });
  assert.ok(response);
  return response;
}

async function run(): Promise<void> {
  assert.equal(
    nextAccountInstanceTimestamp('2999-01-01T00:00:00.000Z'),
    '2999-01-01T00:00:00.001Z',
    'the source writer must advance even when the prior coordinate is ahead of wall-clock time',
  );
  const r2 = new MemoryR2();
  const env = {
    TOKYO_R2: r2 as unknown as R2Bucket,
    ACCOUNT_PUBLICATION_COORDINATOR: {} as DurableObjectNamespace,
  } satisfies Env;

  const retrySourceKey = `accounts/${accountId}/instances/${retryInstanceId}/instance.source.json`;
  r2.failNextPut(retrySourceKey, new Error('r2 source write failed'));
  await assert.rejects(
    createAccountInstanceFromSubmittedSource({
      env,
      accountId,
      instanceId: retryInstanceId,
      widgetType: 'faq',
      displayName: null,
      config: { core: { title: 'retry' } },
      content: {
        id: retryInstanceId,
        accountId,
        fields: {},
        updatedAt: '2026-08-18T00:00:00.000Z',
      },
      baseLocale: 'en',
    }),
    /r2 source write failed/,
  );
  assert.equal(r2.objects.has(retrySourceKey), false);
  assert.deepEqual(
    await listAccountInstanceIds({ env, accountId }),
    [],
    'an initial unpublished-state orphan must not become visible as an instance',
  );
  await createAccountInstanceFromSubmittedSource({
    env,
    accountId,
    instanceId: retryInstanceId,
    widgetType: 'faq',
    displayName: null,
    config: { core: { title: 'retry' } },
    content: {
      id: retryInstanceId,
      accountId,
      fields: {},
      updatedAt: '2026-08-18T00:00:00.000Z',
    },
    baseLocale: 'en',
  });
  assertCurrentSourceIdentityShape(r2, retryInstanceId);
  await Promise.all([seedInstance(env, firstInstanceId), seedInstance(env, secondInstanceId)]);
  const firstSeeded = await readAccountInstanceSourcePointer({
    env,
    accountId,
    instanceId: firstInstanceId,
  });
  const secondSeeded = await readAccountInstanceSourcePointer({
    env,
    accountId,
    instanceId: secondInstanceId,
  });
  assert.ok(firstSeeded.ok);
  assert.ok(secondSeeded.ok);
  const firstRevision = firstSeeded.value.updatedAt;
  const secondRevision = secondSeeded.value.updatedAt;

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

  const winnerResponsePromise = coordinator.fetch(
    publishRequest(firstInstanceId, firstRevision, 'first'),
  );
  await listHold.started;
  assert.equal(lifecycleFenceReads, 1, 'the lifecycle fence must run before R2 listing');

  const overlappingResponse = await coordinator.fetch(
    publishRequest(secondInstanceId, secondRevision, 'second-overlap'),
  );
  assert.equal(overlappingResponse.status, 409);
  const overlappingPayload = await readPayload(overlappingResponse);
  assert.deepEqual(overlappingPayload.error, {
    kind: 'DENY',
    reasonKey: 'coreui.errors.instance.commandInProgress',
    detail: 'coreui.errors.instance.commandInProgress',
  });
  const overlappingSave = await coordinator.fetch(
    saveRequest(secondInstanceId, 'second-save-overlap'),
  );
  assert.equal(overlappingSave.status, 409);
  assert.deepEqual(await readPayload(overlappingSave), {
    error: {
      kind: 'DENY',
      reasonKey: 'coreui.errors.instance.commandInProgress',
      detail: 'coreui.errors.instance.commandInProgress',
    },
  });
  for (const action of ['rename', 'unpublish', 'delete'] as const) {
    const overlappingCommand = await coordinator.fetch(coordinateRequest(action, secondInstanceId));
    assert.equal(overlappingCommand.status, 409);
    assert.deepEqual(await readPayload(overlappingCommand), {
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.instance.commandInProgress',
        detail: 'coreui.errors.instance.commandInProgress',
      },
    });
  }
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

  listHold.release();
  const winnerResponse = await winnerResponsePromise;
  assert.equal(winnerResponse.status, 200);
  assert.deepEqual(await readPayload(winnerResponse), {
    ok: true,
    instanceId: firstInstanceId,
    status: 'published',
    changed: true,
  });
  const firstPublishedPointer = await readAccountInstanceSourcePointer({
    env,
    accountId,
    instanceId: firstInstanceId,
  });
  assert.ok(firstPublishedPointer.ok);
  assert.ok(firstPublishedPointer.value.publishedAt);

  const deniedResponse = await coordinator.fetch(
    publishRequest(secondInstanceId, secondRevision, 'second-later'),
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
  assertPublicPackageStored(r2, firstInstanceId, true, 'the winner must store its full package');

  const republishResponse = await coordinator.fetch(
    publishRequest(firstInstanceId, firstRevision, 'first-republished'),
  );
  assert.equal(republishResponse.status, 200);
  assert.deepEqual(await readPayload(republishResponse), {
    ok: true,
    instanceId: firstInstanceId,
    status: 'published',
    changed: false,
  });
  const republishedPointer = await readAccountInstanceSourcePointer({
    env,
    accountId,
    instanceId: firstInstanceId,
  });
  assert.ok(republishedPointer.ok);
  assert.ok(
    republishedPointer.value.publishedAt! > firstPublishedPointer.value.publishedAt!,
    'every successful Republish must advance the publication receipt',
  );

  const saveResponse = await coordinator.fetch(saveRequest(firstInstanceId, 'saved-after-publish'));
  assert.equal(saveResponse.status, 200);
  const savedPointer = await readAccountInstanceSourcePointer({
    env,
    accountId,
    instanceId: firstInstanceId,
  });
  assert.ok(savedPointer.ok);
  assert.notEqual(savedPointer.value.updatedAt, firstRevision);

  const secondSaveResponse = await coordinator.fetch(saveRequest(firstInstanceId, 'saved-again'));
  assert.equal(secondSaveResponse.status, 200);
  const savedAgainPointer = await readAccountInstanceSourcePointer({
    env,
    accountId,
    instanceId: firstInstanceId,
  });
  assert.ok(savedAgainPointer.ok);
  assert.ok(
    savedAgainPointer.value.updatedAt > savedPointer.value.updatedAt,
    'every accepted source mutation must advance the exact revision coordinate',
  );
  assertCurrentSourceIdentityShape(r2, firstInstanceId);

  const staleSourcePublish = await coordinator.fetch(
    publishRequest(firstInstanceId, firstRevision, 'stale-source-package'),
  );
  assert.equal(staleSourcePublish.status, 409);
  assert.deepEqual(await readPayload(staleSourcePublish), {
    error: {
      kind: 'DENY',
      reasonKey: 'coreui.errors.instance.sourceChanged',
      detail: 'coreui.errors.instance.sourceChanged',
    },
  });

  const currentSourcePublish = await coordinator.fetch(
    publishRequest(firstInstanceId, savedAgainPointer.value.updatedAt, 'current-source-package'),
  );
  assert.equal(currentSourcePublish.status, 200);
  const publishedPointer = await readAccountInstanceSourcePointer({
    env,
    accountId,
    instanceId: firstInstanceId,
  });
  assert.ok(publishedPointer.ok);
  assert.ok(
    publishedPointer.value.publishedAt! > publishedPointer.value.updatedAt,
    'the publication receipt must advance beyond the source revision it commits',
  );
  const servedStyles = await servePublicFile(env, firstInstanceId, 'styles.css');
  assert.equal(await servedStyles.text(), publicPackage('current-source-package').stylesCss);
  assert.equal(
    servedStyles.headers.get('cache-tag'),
    `clk-instance-${accountId}-${firstInstanceId}`,
  );
  const servedRuntime = await servePublicFile(env, firstInstanceId, 'runtime.js');
  assert.equal(await servedRuntime.text(), publicPackage('current-source-package').runtimeJs);

  const serveStateKey = `accounts/${accountId}/instances/${firstInstanceId}/serve-state.json`;
  const committedServeArtifact = r2.objects.get(serveStateKey)?.body;
  assert.ok(committedServeArtifact);
  r2.failNextPut(serveStateKey, new Error('r2 publication write failed'));
  const failedRepublish = await coordinator.fetch(
    publishRequest(firstInstanceId, savedAgainPointer.value.updatedAt, 'must-not-become-public'),
  );
  assert.equal(failedRepublish.status, 502);
  assert.deepEqual(await readPayload(failedRepublish), {
    error: {
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'artifact.package_write_failed',
      detail: 'r2 publication write failed',
    },
  });
  assert.equal(
    r2.objects.get(serveStateKey)?.body,
    committedServeArtifact,
    'a failed Republish must leave the entire prior publication artifact unchanged',
  );

  const sourceKey = `accounts/${accountId}/instances/${firstInstanceId}/instance.source.json`;
  const committedSource = r2.objects.get(sourceKey)?.body;
  assert.ok(committedSource);
  r2.failNextPut(sourceKey, new Error('r2 source update failed'));
  const failedSave = await coordinator.fetch(saveRequest(firstInstanceId, 'must-not-be-saved'));
  assert.equal(failedSave.status, 502);
  assert.equal(
    r2.objects.get(sourceKey)?.body,
    committedSource,
    'a failed later Save must leave the complete prior source unchanged',
  );
  const renameResponse = await coordinator.fetch(coordinateRequest('rename', firstInstanceId));
  assert.equal(renameResponse.status, 200);
  const renamedPointer = await readAccountInstanceSourcePointer({
    env,
    accountId,
    instanceId: firstInstanceId,
  });
  assert.ok(renamedPointer.ok);
  assert.ok(
    renamedPointer.value.updatedAt > renamedPointer.value.publishedAt!,
    'Rename after Publish must advance source truth and expose saved changes as not live',
  );
  assertCurrentSourceIdentityShape(r2, firstInstanceId);

  const retryServeStateKey = `accounts/${accountId}/instances/${retryInstanceId}/serve-state.json`;
  r2.failNextDelete(retrySourceKey, new Error('r2 source-anchor delete failed'));
  const failedDelete = await coordinator.fetch(coordinateRequest('delete', retryInstanceId));
  assert.equal(failedDelete.status, 502);
  assert.deepEqual(await readPayload(failedDelete), {
    error: {
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'coreui.errors.db.writeFailed',
      detail: 'r2 source-anchor delete failed',
    },
  });
  assert.equal(r2.objects.has(retrySourceKey), true);
  assert.equal(r2.objects.has(retryServeStateKey), true);
  const visibleAfterFailedDelete = await readAccountInstanceSourcePointer({
    env,
    accountId,
    instanceId: retryInstanceId,
  });
  assert.ok(
    visibleAfterFailedDelete.ok,
    'a failed source-anchor delete must leave the whole saved instance visible',
  );

  const completedDelete = await coordinator.fetch(coordinateRequest('delete', retryInstanceId));
  assert.equal(completedDelete.status, 200);
  assert.deepEqual(await readPayload(completedDelete), { ok: true, existed: true });
  assert.equal(r2.objects.has(retrySourceKey), false);
  assert.equal(r2.objects.has(retryServeStateKey), true);
  assert.deepEqual(
    await readAccountInstanceSourcePointer({ env, accountId, instanceId: retryInstanceId }),
    { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' },
  );
  assert.equal(
    (await listAccountInstanceIds({ env, accountId })).includes(retryInstanceId),
    false,
    'the exact source anchor must be the inventory visibility coordinate',
  );
  assert.equal(
    (await servePublicFile(env, retryInstanceId, 'index.html')).status,
    404,
    'public serving must stop as soon as the source anchor is deleted',
  );

  r2.failNextDelete(retryServeStateKey, new Error('r2 residual cleanup failed'));
  const scheduledCleanup: Promise<unknown>[] = [];
  scheduleAccountInstanceResidualCleanup({
    env,
    accountId,
    instanceId: retryInstanceId,
    waitUntil(promise) {
      scheduledCleanup.push(promise);
    },
  });
  assert.equal(scheduledCleanup.length, 1);
  await assert.doesNotReject(scheduledCleanup[0]);
  assert.equal(
    r2.objects.has(retryServeStateKey),
    true,
    'residual cleanup failure may leave unreachable bytes but cannot reverse product deletion',
  );
  assert.deepEqual(
    await readAccountInstanceSourcePointer({ env, accountId, instanceId: retryInstanceId }),
    { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' },
  );

  const secondServeStateKey = `accounts/${accountId}/instances/${secondInstanceId}/serve-state.json`;
  const secondServeState = r2.objects.get(secondServeStateKey);
  assert.ok(secondServeState);
  r2.objects.set(secondServeStateKey, {
    ...secondServeState,
    body: JSON.stringify({ status: 'impossible' }),
  });
  await assert.rejects(
    readAccountInstanceSourcePointer({ env, accountId, instanceId: secondInstanceId }),
    /coreui\.errors\.instance\.serveStateInvalid/,
    'an impossible stored serve-state must fail visibly instead of becoming unpublished',
  );
  r2.objects.set(secondServeStateKey, secondServeState);

  console.log(
    'PASS Tokyo instance coordination preserves publication capacity and exact source revision truth',
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
