import assert from 'node:assert/strict';
import { scheduleAccountInstanceCacheEviction } from '../src/domains/account-instances/operations';

const accountId = 'CLICKEEN';
const instanceId = 'AAAAAAAAAA';
const expectedPurge = { tags: [`clk-instance-${accountId}-${instanceId}`] };

function scheduleWith(args: {
  cache: CacheContext | undefined;
  waitUntil: ExecutionContext['waitUntil'];
}): void {
  scheduleAccountInstanceCacheEviction({
    ...args,
    accountId,
    instanceId,
  });
}

async function assertRejectedAndUnsuccessfulEvictionsAreInert(): Promise<void> {
  for (const createPurgeResult of [
    () =>
      Promise.resolve<CachePurgeResult>({
        success: false,
        errors: [{ code: 1001, message: 'purge rejected' }],
      }),
    () => Promise.reject<CachePurgeResult>(new Error('purge unavailable')),
  ]) {
    const purgeBodies: CachePurgeOptions[] = [];
    const scheduled: Promise<unknown>[] = [];
    scheduleWith({
      cache: {
        purge(options) {
          purgeBodies.push(options);
          return createPurgeResult();
        },
      },
      waitUntil(promise) {
        scheduled.push(promise);
      },
    });

    assert.deepEqual(purgeBodies, [expectedPurge]);
    assert.equal(scheduled.length, 1);
    await assert.doesNotReject(scheduled[0]);
  }
}

async function assertPendingEvictionDoesNotBlockScheduling(): Promise<void> {
  let resolvePurge!: (result: CachePurgeResult) => void;
  const pendingPurge = new Promise<CachePurgeResult>((resolve) => {
    resolvePurge = resolve;
  });
  const scheduled: Promise<unknown>[] = [];

  const result = scheduleWith({
    cache: {
      purge() {
        return pendingPurge;
      },
    },
    waitUntil(promise) {
      scheduled.push(promise);
    },
  });

  assert.equal(result, undefined);
  assert.equal(scheduled.length, 1);
  resolvePurge({ success: true, errors: [] });
  await scheduled[0];
}

function assertMissingAndSynchronousFailuresAreInert(): void {
  let waitUntilCalls = 0;
  assert.doesNotThrow(() => {
    scheduleWith({
      cache: undefined,
      waitUntil() {
        waitUntilCalls += 1;
      },
    });
  });
  assert.equal(waitUntilCalls, 0);

  assert.doesNotThrow(() => {
    scheduleWith({
      cache: {
        purge() {
          throw new Error('synchronous purge failure');
        },
      },
      waitUntil() {
        waitUntilCalls += 1;
      },
    });
  });
  assert.equal(waitUntilCalls, 0);

  assert.doesNotThrow(() => {
    scheduleWith({
      cache: {
        async purge() {
          return { success: true, errors: [] };
        },
      },
      waitUntil() {
        throw new Error('waitUntil unavailable');
      },
    });
  });
}

async function run(): Promise<void> {
  await assertRejectedAndUnsuccessfulEvictionsAreInert();
  await assertPendingEvictionDoesNotBlockScheduling();
  assertMissingAndSynchronousFailuresAreInert();
  console.log('PASS account-instance cache eviction is background-only and product-inert');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
