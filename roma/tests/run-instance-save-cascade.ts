import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runAccountInstanceSourceSaveLocaleCascade } from '../lib/account-instance-save-cascade';

const request = new Request('https://roma.dev.clickeen.com/api/account/instances/ABCD123456') as never;
const authz = {
  userId: 'user_1',
  accountId: 'acct_1',
  accountPublicId: 'CLICKEEN',
  role: 'owner',
  profile: 'tier1',
  entitlements: null,
} as never;

function baseArgs(overrides: { activeLocales?: string[] } = {}) {
  return {
    request,
    accountId: 'CLICKEEN',
    instanceId: 'ABCD123456',
    baseLocale: 'en',
    activeLocales: overrides.activeLocales ?? ['en', 'fr', 'de'],
    configuredActiveLocaleCap: 3,
    authz,
    accountCapsule: 'capsule',
    requestId: 'req_124f',
  };
}

async function testEmptyActiveLocales(): Promise<void> {
  let generated = false;
  const result = await runAccountInstanceSourceSaveLocaleCascade({
    ...baseArgs({ activeLocales: ['en'] }),
    deps: {
      async generateTranslations() {
        generated = true;
        throw new Error('should_not_generate');
      },
      async materializeLocalePackages() {
        throw new Error('should_not_materialize');
      },
    } as never,
  });

  assert.equal(result.ok, true);
  assert.equal(generated, false);
  assert.equal(result.value.invoked, false);
  assert.deepEqual(result.value.activeLocales, []);
  assert.equal(result.value.cost.coordinates, 0);
}

async function testSuccessfulCascade(): Promise<void> {
  const calls: string[] = [];
  const result = await runAccountInstanceSourceSaveLocaleCascade({
    ...baseArgs(),
    deps: {
      async generateTranslations(args: any) {
        calls.push(`generate:${args.activeLocales.join(',')}`);
        return {
          ok: true,
          status: 200,
          value: {
            ok: true,
            translation: {
              ok: true,
              accepted: true,
              baseLocale: args.baseLocale,
              activeLocales: args.activeLocales,
              skippedLocales: [],
            },
          },
        };
      },
      async materializeLocalePackages(args: any) {
        calls.push(`materialize:${args.activeLocales.join(',')}`);
        return {
          ok: true,
          value: {
            ok: true,
            completed: args.activeLocales.map((locale: string) => ({
              accountId: args.accountId,
              instanceId: args.instanceId,
              locale,
              publicPackageFingerprint: `sha256:${locale}`,
            })),
            skipped: [],
          },
        };
      },
    } as never,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ['generate:fr', 'materialize:fr', 'generate:de', 'materialize:de']);
  assert.equal(result.value.ok, true);
  assert.equal(result.value.invoked, true);
  assert.equal(result.value.cost.instances, 1);
  assert.equal(result.value.cost.activeNonBaseLocales, 2);
  assert.equal(result.value.cost.hostCommandTimeoutMs, 120000);
  assert.deepEqual(result.value.translation.completed, ['fr', 'de']);
  assert.deepEqual(result.value.localePackages.completed.map((entry) => entry.locale), ['fr', 'de']);
}

async function testTranslationFailureNamesCoordinates(): Promise<void> {
  const calls: string[] = [];
  const result = await runAccountInstanceSourceSaveLocaleCascade({
    ...baseArgs(),
    deps: {
      async generateTranslations(args: any) {
        calls.push(`generate:${args.activeLocales.join(',')}`);
        if (args.activeLocales[0] === 'fr') {
          return {
            ok: true,
            status: 200,
            value: {
              ok: true,
              translation: {
                ok: true,
                accepted: true,
                baseLocale: args.baseLocale,
                activeLocales: args.activeLocales,
                skippedLocales: [],
              },
            },
          };
        }
        return {
          ok: false,
          status: 502,
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.translation.failed',
            detail: 'translation_agent_http_502',
          },
        };
      },
      async materializeLocalePackages(args: any) {
        calls.push(`materialize:${args.activeLocales.join(',')}`);
        return {
          ok: true,
          value: {
            ok: true,
            completed: args.activeLocales.map((locale: string) => ({
              accountId: args.accountId,
              instanceId: args.instanceId,
              locale,
              publicPackageFingerprint: `sha256:${locale}`,
            })),
            skipped: [],
          },
        };
      },
    } as never,
  });

  assert.deepEqual(calls, ['generate:fr', 'materialize:fr', 'generate:de']);
  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
  assert.equal(result.value.ok, false);
  assert.equal(result.value.localePackages.completed[0]?.locale, 'fr');
  assert.equal(result.value.localePackages.failed?.locale, 'de');
  assert.equal(result.value.localePackages.failed?.phase, 'translation-generation');
  assert.deepEqual(result.value.localePackages.skipped.map((entry) => entry.locale), []);
}

async function testMaterializationFailurePreservesPackageCoordinates(): Promise<void> {
  const result = await runAccountInstanceSourceSaveLocaleCascade({
    ...baseArgs(),
    deps: {
      async generateTranslations(args: any) {
        return {
          ok: true,
          status: 200,
          value: {
            ok: true,
            translation: {
              ok: true,
              accepted: true,
              baseLocale: args.baseLocale,
              activeLocales: args.activeLocales,
              skippedLocales: [],
            },
          },
        };
      },
      async materializeLocalePackages() {
        return {
          ok: false,
          status: 409,
          error: {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.instance.embedNotReady',
            detail: 'locale_package_fingerprint_mismatch',
          },
          value: {
            ok: false,
            completed: [{
              accountId: 'CLICKEEN',
              instanceId: 'ABCD123456',
              locale: 'fr',
              publicPackageFingerprint: 'sha256:fr',
            }],
            skipped: [{
              accountId: 'CLICKEEN',
              instanceId: 'ABCD123456',
              locale: 'it',
              phase: 'not-attempted-after-failure',
            }],
            failed: {
              accountId: 'CLICKEEN',
              instanceId: 'ABCD123456',
              locale: 'de',
              phase: 'package-write',
              reasonKey: 'coreui.errors.instance.embedNotReady',
              detail: 'locale_package_fingerprint_mismatch',
            },
          },
        };
      },
    } as never,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(result.value.localePackages.completed[0]?.locale, 'fr');
  assert.equal(result.value.localePackages.failed?.locale, 'de');
  assert.equal(result.value.localePackages.failed?.phase, 'package-write');
}

async function testCacheRefreshFailurePreservesPackageCoordinates(): Promise<void> {
  const result = await runAccountInstanceSourceSaveLocaleCascade({
    ...baseArgs(),
    deps: {
      async generateTranslations(args: any) {
        return {
          ok: true,
          status: 200,
          value: {
            ok: true,
            translation: {
              ok: true,
              accepted: true,
              baseLocale: args.baseLocale,
              activeLocales: args.activeLocales,
              skippedLocales: [],
            },
          },
        };
      },
      async materializeLocalePackages() {
        return {
          ok: false,
          status: 502,
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'tokyo.errors.publicCache.purgeFailed',
            detail: 'cloudflare_purge_status_502',
          },
          value: {
            ok: false,
            completed: [],
            skipped: [],
            failed: {
              accountId: 'CLICKEEN',
              instanceId: 'ABCD123456',
              locale: 'fr',
              phase: 'cache-refresh',
              reasonKey: 'tokyo.errors.publicCache.purgeFailed',
              detail: 'cloudflare_purge_status_502',
            },
          },
        };
      },
    } as never,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
  assert.equal(result.value.localePackages.failed?.locale, 'fr');
  assert.equal(result.value.localePackages.failed?.phase, 'cache-refresh');
  assert.equal(result.value.localePackages.failed?.reasonKey, 'tokyo.errors.publicCache.purgeFailed');
}

async function testNoBroadCascadeMachinery(): Promise<void> {
  const helperSource = await readFile(new URL('../lib/account-instance-save-cascade.ts', import.meta.url), 'utf8');
  const routeSource = await readFile(new URL('../app/api/account/instances/[instanceId]/route.ts', import.meta.url), 'utf8');
  for (const forbidden of [
    'dependency graph',
    'event bus',
    'scheduler',
    'watcher',
    'readiness marker',
    'status file',
    'setTimeout(',
    'queue',
    'backfill',
  ]) {
    assert.equal(helperSource.toLowerCase().includes(forbidden), false, forbidden);
    assert.equal(routeSource.toLowerCase().includes(forbidden), false, forbidden);
  }
}

async function testActiveLocaleSettingsCostSurfaceIsNamed(): Promise<void> {
  const routeSource = await readFile(new URL('../app/api/account/locales/route.ts', import.meta.url), 'utf8');
  assert.match(routeSource, /changedLocaleCount = addedLocales\.length \+ removedLocales\.length/);
  assert.match(routeSource, /coordinates: instances\.value\.accountInstances\.length \* changedLocaleCount/);
  assert.match(routeSource, /configuredActiveLocaleCap: args\.configuredActiveLocaleCap/);
  assert.match(routeSource, /hostCommandTimeoutMs: 120000/);
  assert.match(routeSource, /for \(const locale of addedLocales\)/);
  assert.doesNotMatch(routeSource, /activeLocales: addedLocales/);
  assert.match(routeSource, /phase: 'translation-generation'/);
}

async function testBobSourceSavedCascadeFailureHandoff(): Promise<void> {
  const savingSource = await readFile(new URL('../../bob/lib/session/useSessionSaving.ts', import.meta.url), 'utf8');
  assert.match(savingSource, /json\?\.sourceSaved === true && json\?\.localeCascade/);
  assert.match(savingSource, /savedInstanceDataSignature: submittedInstanceDataSignature/);
  assert.match(savingSource, /source: 'translation'/);
  assert.match(savingSource, /coreui\.errors\.translations\.acceptanceFailed/);
}

const tests: Array<{ name: string; run: () => Promise<void> }> = [
  { name: 'empty active locales skip save cascade work', run: testEmptyActiveLocales },
  { name: 'source save cascades through current translation and package helpers', run: testSuccessfulCascade },
  { name: 'translation failure names exact incomplete coordinates', run: testTranslationFailureNamesCoordinates },
  { name: 'materialization failure preserves package coordinates', run: testMaterializationFailurePreservesPackageCoordinates },
  { name: 'cache refresh failure preserves package coordinates', run: testCacheRefreshFailurePreservesPackageCoordinates },
  { name: 'save cascade does not add broad machinery', run: testNoBroadCascadeMachinery },
  { name: 'active locale settings names bounded cost surface', run: testActiveLocaleSettingsCostSurfaceIsNamed },
  { name: 'Bob handles source-saved locale cascade failure as translation follow-up', run: testBobSourceSavedCascadeFailureHandoff },
];

async function main(): Promise<void> {
  for (const test of tests) {
    try {
      await test.run();
      console.log(`PASS ${test.name}`);
    } catch (error) {
      console.error(`FAIL ${test.name}`);
      throw error;
    }
  }
}

void main();
