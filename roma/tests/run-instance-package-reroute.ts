import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultAccountFontLibrary } from '@clickeen/widget-foundation';
import {
  buildAccountDefaultStateFixture,
  PACKAGE_PARITY_WIDGETS,
  widgetFixtureCoordinate,
} from './instance-package-fixtures';
import {
  buildSavedWidgetPublicPackageResult,
  prepareAccountInstancePublicPackage,
  readWidgetForInstancePackage,
  validateInstanceTypographyStructure,
} from '../lib/account-instance-public-package';
import { runRemovedLocaleCleanup } from '../lib/account-locale-cleanup';

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const CLOUDFLARE_REQUEST_CONTEXT_SYMBOL = Symbol.for('__cloudflare-request-context__');

async function readSource(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

async function testEveryWidgetBuildsPackageWithOneShell(): Promise<void> {
  for (const widgetType of PACKAGE_PARITY_WIDGETS) {
    const compiled = readWidgetForInstancePackage(widgetType);
    assert.equal(compiled.ok, true, JSON.stringify(compiled));
    if (!compiled.ok) continue;
    const coordinate = widgetFixtureCoordinate(widgetType);
    const result = await buildSavedWidgetPublicPackageResult({
      compiled: compiled.value,
      accountId: coordinate.accountId,
      instanceId: coordinate.instanceId,
      baseLocale: coordinate.baseLocale,
      displayName: coordinate.displayName,
      state: await buildAccountDefaultStateFixture(widgetType),
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) continue;
    assert.match(result.value.package.indexHtml, /window\.CK_LOCALE_CONTEXT = null;/);
    assert.equal(
      result.value.package.indexHtml.includes(`/${coordinate.accountId}/${coordinate.instanceId}/styles.css`),
      true,
    );
    assert.equal(
      result.value.package.indexHtml.includes(`/${coordinate.accountId}/${coordinate.instanceId}/runtime.js`),
      true,
    );
    assert.doesNotMatch(result.value.package.indexHtml, /\/locales\//);
    assert.doesNotMatch(result.value.package.runtimeJs, /\/locales\/|requestedLocale|localeOverlay/);
    assert.deepEqual(result.value.evidence.artifactCoordinate, {
      kind: 'account-instance-widget',
      accountPublicId: coordinate.accountId,
      instanceId: coordinate.instanceId,
      baseLocale: coordinate.baseLocale,
    });
    assert.equal(result.value.evidence.materializerContractVersion, 'ck-runtime-materializer:shell-anchor');
  }
}

async function testMaterializationRequiresCompleteTypography(): Promise<void> {
  for (const widgetType of PACKAGE_PARITY_WIDGETS) {
    const compiled = readWidgetForInstancePackage(widgetType);
    assert.equal(compiled.ok, true, JSON.stringify(compiled));
    if (!compiled.ok) continue;
    const state = await buildAccountDefaultStateFixture(widgetType);
    assert.deepEqual(
      validateInstanceTypographyStructure({ compiled: compiled.value, state }),
      [],
      widgetType,
    );
  }

  const compiled = readWidgetForInstancePackage('calltoaction');
  assert.equal(compiled.ok, true, JSON.stringify(compiled));
  if (!compiled.ok) return;

  const missingRole = await buildAccountDefaultStateFixture('calltoaction');
  const missingRoleTypography = missingRole.typography as Record<string, unknown>;
  delete (missingRoleTypography.roles as Record<string, unknown>).eyebrow;
  assert.deepEqual(
    validateInstanceTypographyStructure({ compiled: compiled.value, state: missingRole }),
    ['typography.roles.eyebrow'],
  );

  const missingPreset = await buildAccountDefaultStateFixture('calltoaction');
  const missingPresetTypography = missingPreset.typography as Record<string, unknown>;
  const missingPresetRoles = missingPresetTypography.roles as Record<string, unknown>;
  delete (missingPresetRoles.title as Record<string, unknown>).trackingPreset;
  assert.deepEqual(
    validateInstanceTypographyStructure({ compiled: compiled.value, state: missingPreset }),
    ['typography.roles.title.trackingPreset'],
  );

  const missingScale = await buildAccountDefaultStateFixture('calltoaction');
  const missingScaleTypography = missingScale.typography as Record<string, unknown>;
  delete (missingScaleTypography.roleScales as Record<string, unknown>).title;
  assert.deepEqual(
    validateInstanceTypographyStructure({ compiled: compiled.value, state: missingScale }),
    ['typography.roleScales.title'],
  );
}

async function testTokyoFontUsesTokyoOriginInSavedRuntime(): Promise<void> {
  const accountId = 'CLICKEEN';
  const instanceId = 'inst_faq_tokyo_font';
  const state = await buildAccountDefaultStateFixture('faq');
  const typography = state.typography as Record<string, unknown>;
  const roles = typography.roles as Record<string, unknown>;
  Object.assign(roles.title as Record<string, unknown>, {
    family: 'Orio',
    weight: '400',
    fontStyle: 'normal',
  });

  const widgetDefaults = {
    accountId,
    fontLibrary: createDefaultAccountFontLibrary(),
    common: {},
    widgets: {},
    seededAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const globalRecord = globalThis as Record<PropertyKey, unknown>;
  const previousContext = globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
  const previousTokyoUrl = process.env.NEXT_PUBLIC_TOKYO_URL;
  globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      TOKYO_PRODUCT_CONTROL: {
        async fetch() {
          return Response.json({ accountId, widgetDefaults });
        },
      },
    },
  };
  process.env.NEXT_PUBLIC_TOKYO_URL = 'https://tokyo.dev.clickeen.com';

  try {
    const prepared = await prepareAccountInstancePublicPackage({
      accountId,
      accountCapsule: 'capsule',
      requestId: 'font-origin-test',
      config: state,
    });
    assert.equal(prepared.ok, true, JSON.stringify(prepared));
    if (!prepared.ok) return;

    const compiled = readWidgetForInstancePackage('faq');
    assert.equal(compiled.ok, true, JSON.stringify(compiled));
    if (!compiled.ok) return;
    const result = await buildSavedWidgetPublicPackageResult({
      compiled: compiled.value,
      accountId,
      instanceId,
      baseLocale: 'en',
      displayName: 'FAQ Tokyo font',
      state: prepared.value.state,
      typographyData: prepared.value.typographyData,
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) return;
    assert.match(
      result.value.package.runtimeJs,
      /"url":"https:\/\/tokyo\.dev\.clickeen\.com\/fonts\/special\/Orio\.woff"/,
    );
    assert.doesNotMatch(
      result.value.package.runtimeJs,
      /https:\/\/dev\.clk\.live\/fonts\//,
    );
  } finally {
    if (previousContext === undefined) delete globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = previousContext;
    if (previousTokyoUrl === undefined) delete process.env.NEXT_PUBLIC_TOKYO_URL;
    else process.env.NEXT_PUBLIC_TOKYO_URL = previousTokyoUrl;
  }
}

async function testTranslationAndSettingsAreOverlayOnly(): Promise<void> {
  const generation = await readSource(
    'roma/app/api/account/instances/[instanceId]/translations/generate/route.ts',
  );
  assert.match(generation, /generateAccountInstanceTranslations/);
  assert.doesNotMatch(generation, /materializeRuntimePackage|localePackages|LocalePackage/);

  const settings = await readSource('roma/app/api/account/locales/route.ts');
  assert.match(settings, /deleteAccountInstanceTranslationValues/);
  assert.doesNotMatch(settings, /deletePackage|LocalePackage|locale-package|cache-refresh/);
}

async function testRemovedLocaleCleanupAttemptsEveryOverlay(): Promise<void> {
  const calls: string[] = [];
  const result = await runRemovedLocaleCleanup({
    accountId: 'CLICKEEN',
    instanceIds: ['inst_one', 'inst_two'],
    removedLocales: ['fr', 'de'],
    deleteTranslation: async (instanceId, locale) => {
      calls.push(`${instanceId}:${locale}`);
      if (instanceId === 'inst_two' && locale === 'fr') {
        return {
          ok: false as const,
          error: {
            kind: 'UPSTREAM_UNAVAILABLE' as const,
            reasonKey: 'translation_delete_failed',
          },
        };
      }
      return { ok: true as const };
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.instancesChecked, 2);
  assert.equal(result.deleted.length, 3);
  assert.deepEqual(result.failed, [
    {
      instanceId: 'inst_two',
      locale: 'fr',
      phase: 'translation-delete',
      reasonKey: 'translation_delete_failed',
      detail: 'delete:inst_two:fr:translation_delete_failed',
    },
  ]);
  assert.deepEqual(calls, ['inst_one:fr', 'inst_one:de', 'inst_two:fr', 'inst_two:de']);
}

async function testNoActiveLocalePackageAuthority(): Promise<void> {
  const targets = [
    'roma/lib/account-instance-public-package.ts',
    'roma/lib/account-instance-direct.ts',
    'tokyo-worker/src/domains/account-instances/keys.ts',
    'tokyo-worker/src/domains/account-instances/package-files.ts',
    'tokyo-worker/src/routes/internal-instance-routes.ts',
    'tokyo-worker/src/routes/clk-live-routes.ts',
  ];
  const forbidden = [
    'LocalePackage',
    'localePackages',
    'locale-package',
    'locale_package_',
    'accountInstanceLocalePackage',
    'localePackageAccountPublicId',
    'localePackageSourceUpdatedAt',
  ];
  for (const target of targets) {
    const source = await readSource(target);
    for (const token of forbidden) {
      assert.equal(source.includes(token), false, `${token} survived in ${target}`);
    }
  }
}

const tests = [
  ['every widget builds a package with one Shell', testEveryWidgetBuildsPackageWithOneShell],
  ['materialization requires complete typography', testMaterializationRequiresCompleteTypography],
  ['Tokyo fonts use the Tokyo origin in saved runtime', testTokyoFontUsesTokyoOriginInSavedRuntime],
  ['translation and settings are overlay-only', testTranslationAndSettingsAreOverlayOnly],
  ['removed locale cleanup attempts every overlay', testRemovedLocaleCleanupAttemptsEveryOverlay],
  ['no active locale package authority', testNoActiveLocalePackageAuthority],
] as const;

async function main(): Promise<void> {
  for (const [name, run] of tests) {
    try {
      await run();
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      throw error;
    }
  }
}

void main();
