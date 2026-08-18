import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { callTokyo } from '../lib/tokyo-client';

const CLOUDFLARE_REQUEST_CONTEXT_SYMBOL = Symbol.for('__cloudflare-request-context__');

async function readSource(path: string): Promise<string> {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

async function testRomaSaveDoesNotRunLocalization(): Promise<void> {
  const routeSource = await readSource('roma/app/api/account/instances/[instanceId]/route.ts');

  assert.doesNotMatch(routeSource, /runAccountInstanceSourceSaveLocaleCascade/);
  assert.doesNotMatch(routeSource, /sourceSaved/);
  assert.doesNotMatch(routeSource, /localeCascade/);
  assert.doesNotMatch(routeSource, /resolvePolicyFromEntitlementsSnapshot/);
  assert.match(routeSource, /saveAccountInstanceInTokyo/);
  assert.match(routeSource, /NextResponse\.json\(\{\s*ok: true,\s*\}\)/);
}

async function testBobSaveHasNoPartialLocalizationBranch(): Promise<void> {
  const savingSource = await readSource('bob/lib/session/useSessionSaving.ts');

  assert.doesNotMatch(savingSource, /sourceSaved/);
  assert.doesNotMatch(savingSource, /localeCascade/);
  assert.doesNotMatch(savingSource, /source: 'translation'/);
  assert.match(savingSource, /command: 'update-instance'/);
  assert.match(savingSource, /savedInstanceDataSignature: submittedInstanceDataSignature/);
}

async function testExplicitTranslationRouteSurvives(): Promise<void> {
  const translationRouteSource = await readSource(
    'roma/app/api/account/instances/[instanceId]/translations/generate/route.ts',
  );
  const translationValuesRouteSource = await readSource(
    'roma/app/api/account/instances/[instanceId]/translations/[locale]/route.ts',
  );
  const tokyoTranslationValuesSource = await readSource(
    'tokyo-worker/src/domains/account-translations/values.ts',
  );
  const panelSource = await readSource('bob/components/TranslationsPanel.tsx');

  assert.match(translationRouteSource, /generateAccountInstanceTranslations/);
  assert.match(translationRouteSource, /activeLocalesToGenerate/);
  assert.match(translationRouteSource, /generateAccountInstanceTranslations\(\{[\s\S]*onActivity: activity/);
  assert.doesNotMatch(translationRouteSource, /materializeRuntimePackage|localePackages|LocalePackage/);
  assert.match(panelSource, /Generate translations/);
  assert.match(panelSource, /generateTranslations/);
  assert.doesNotMatch(panelSource, /localePackages|localized package|public package/i);
  assert.match(translationValuesRouteSource, /export async function PUT/);
  assert.match(translationValuesRouteSource, /writeAccountInstanceTranslationValues/);
  assert.match(tokyoTranslationValuesSource, /locale === stored\.baseLocale/);
  assert.match(tokyoTranslationValuesSource, /tokyo\.translation\.locale\.base_forbidden/);
}

async function testNoAccountInstanceMetaPersistenceContract(): Promise<void> {
  const bobSaveSource = await readSource('bob/lib/session/useSessionSaving.ts');
  const romaSaveRoute = await readSource('roma/app/api/account/instances/[instanceId]/route.ts');
  const romaDirectSource = await readSource('roma/lib/account-instance-direct.ts');
  const tokyoRoutes = await readSource('tokyo-worker/src/routes/internal-instance-routes.ts');
  const tokyoTypes = await readSource('tokyo-worker/src/domains/account-instances/types.ts');

  assert.doesNotMatch(bobSaveSource, /saveBody\.meta|meta:\s*null/);
  assert.doesNotMatch(romaSaveRoute, /body\.meta|\{ meta \}/);
  assert.doesNotMatch(romaDirectSource, /meta:/);
  assert.doesNotMatch(tokyoRoutes, /rawBody\.meta|body\.meta|pointer\.meta|normalizeSubmittedMeta/);
  assert.doesNotMatch(tokyoTypes, /meta\?: Record<string, unknown> \| null/);
}

async function testNoInventedAccountInstanceBodyKeyWhitelist(): Promise<void> {
  for (const path of [
    'roma/app/api/account/instances/[instanceId]/route.ts',
    'roma/app/api/account/instances/route.ts',
    'roma/lib/account-instance-direct.ts',
    'tokyo-worker/src/routes/internal-instance-routes.ts',
  ]) {
    const source = await readSource(path);
    assert.doesNotMatch(source, /bodyHasOnlyKeys/);
    assert.doesNotMatch(source, /ACCOUNT_INSTANCE_SAVE_BODY_KEYS/);
    assert.doesNotMatch(source, /INTERNAL_INSTANCE_(CREATE|SAVE)_BODY_KEYS/);
  }
}

async function testTokyoBindingFailureIsStructured(): Promise<void> {
  const globalRecord = globalThis as Record<PropertyKey, unknown>;
  const previous = globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
  globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      TOKYO_PRODUCT_CONTROL: {
        async fetch() {
          throw new Error('service binding unavailable');
        },
      },
    },
  };
  try {
    const result = await callTokyo({ accountId: 'CLICKEEN' }, {
      path: '/__internal/instances/ABCD123456/unpublish',
      method: 'POST',
      decode: (payload) => payload,
      errorKey: 'roma.errors.proxy.tokyo_unavailable',
      errorDetail: 'tokyo_instance_unpublish_http_error',
    });
    assert.deepEqual(result, {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'roma.errors.proxy.tokyo_unavailable',
        detail: 'tokyo_instance_unpublish_http_error',
      },
    });
  } finally {
    if (previous === undefined) delete globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = previous;
  }
}

async function testInvalidTokyoBodyDoesNotMasqueradeAsAvailabilityFailure(): Promise<void> {
  const body: Record<string, unknown> = {};
  body.self = body;
  await assert.rejects(
    callTokyo({ accountId: 'CLICKEEN' }, {
      path: '/__internal/instances',
      method: 'POST',
      body,
      decode: (payload) => payload,
      errorKey: 'roma.errors.proxy.tokyo_unavailable',
      errorDetail: 'tokyo_instance_create_http_error',
    }),
    /circular/i,
  );
}

const tests: Array<{ name: string; run: () => Promise<void> }> = [
  { name: 'Roma source save does not run localization', run: testRomaSaveDoesNotRunLocalization },
  { name: 'Bob save has no partial localization branch', run: testBobSaveHasNoPartialLocalizationBranch },
  { name: 'explicit translation route and panel survive', run: testExplicitTranslationRouteSurvives },
  { name: 'account instance persistence has no generic meta contract', run: testNoAccountInstanceMetaPersistenceContract },
  { name: 'account instance save has no invented body key whitelist', run: testNoInventedAccountInstanceBodyKeyWhitelist },
  { name: 'Tokyo binding failure becomes a structured route failure', run: testTokyoBindingFailureIsStructured },
  { name: 'invalid Tokyo body does not masquerade as availability failure', run: testInvalidTokyoBodyDoesNotMasqueradeAsAvailabilityFailure },
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
