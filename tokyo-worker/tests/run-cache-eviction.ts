import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
    () => Promise.resolve<CachePurgeResult>({
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

async function assertRouteAndDeployBoundaries(): Promise<void> {
  const [
    routeHelpers,
    indexSource,
    operations,
    instanceRoutes,
    translationRoutes,
    translationValues,
    publicRoutes,
    workflow,
  ] = await Promise.all([
    readFile(new URL('../src/route-helpers.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/domains/account-instances/operations.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/routes/internal-instance-routes.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/routes/internal-translation-routes.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/domains/account-translations/values.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/routes/clk-live-routes.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../.github/workflows/cloud-dev-workers.yml', import.meta.url), 'utf8'),
  ]);

  assert.match(routeHelpers, /waitUntil: ExecutionContext\['waitUntil'\]/);
  assert.match(indexSource, /waitUntil: ctx\.waitUntil\.bind\(ctx\)/);

  assert.doesNotMatch(operations, /purgeConfigMissing|purgeFailed|committed/);
  assert.doesNotMatch(instanceRoutes, /await scheduleAccountInstanceCacheEviction|committed/);
  assert.match(instanceRoutes, /publishedAt: created\.pointer\.publishedAt/);
  assert.equal(
    instanceRoutes.match(/scheduleAccountInstanceCacheEviction\(\{/g)?.length,
    3,
    'publish, unpublish, and delete must each schedule eviction only after their mutations complete',
  );
  assert.match(
    instanceRoutes,
    /const coordinated = await coordinateAccountInstancePublish\(\{[\s\S]*if \(!coordinated\.ok\) return respond\(coordinated\);[\s\S]*scheduleAccountInstanceCacheEviction\(\{/,
  );
  assert.match(
    instanceRoutes,
    /const coordinated = await coordinateAccountInstanceUnpublish\(\{[\s\S]*if \(!coordinated\.ok\) return respond\(coordinated\);[\s\S]*scheduleAccountInstanceCacheEviction\(\{/,
  );
  assert.match(
    instanceRoutes,
    /const coordinated = await coordinateAccountInstanceDelete\(\{[\s\S]*if \(!coordinated\.ok\) return respond\(coordinated\);[\s\S]*scheduleAccountInstanceCacheEviction\(\{/,
  );

  assert.equal(
    translationRoutes.match(/scheduleAccountInstanceCacheEviction\(\{/g)?.length,
    2,
    'overlay PUT and DELETE must schedule eviction at the route boundary',
  );
  assert.match(
    translationRoutes,
    /const translation = await writeAccountInstanceTranslatedLocaleValues\(\{[\s\S]*scheduleAccountInstanceCacheEviction\(\{/,
  );
  assert.match(
    translationRoutes,
    /const translation = await deleteAccountInstanceTranslatedLocaleValues\(\{[\s\S]*scheduleAccountInstanceCacheEviction\(\{/,
  );
  assert.doesNotMatch(
    translationValues,
    /CacheContext|waitUntil|purge|scheduleAccountInstanceCacheEviction|readInstanceServeState/,
  );

  assert.match(publicRoutes, /public, max-age=60, s-maxage=300, must-revalidate/);
  assert.doesNotMatch(publicRoutes, /stale-while-revalidate=86400/);
  assert.doesNotMatch(workflow, /CLOUDFLARE_CACHE_PURGE_TOKEN|public cache purge token/);
}

async function run(): Promise<void> {
  await assertRejectedAndUnsuccessfulEvictionsAreInert();
  await assertPendingEvictionDoesNotBlockScheduling();
  assertMissingAndSynchronousFailuresAreInert();
  await assertRouteAndDeployBoundaries();
  console.log('PASS account-instance cache eviction is background-only and product-inert');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
