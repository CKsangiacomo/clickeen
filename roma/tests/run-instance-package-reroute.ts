import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializeRuntimePackage } from '@clickeen/ck-runtime-materializer';
import { extractSavedTextFieldsForEditableFields } from '@clickeen/ck-contracts/translated-value-primitives';
import {
  createDefaultAccountFontLibrary,
  type AccountFontLibrary,
} from '@clickeen/widget-shell';
import {
  buildAccountDefaultStateFixture,
  buildCompiledWidgetFixture,
  PACKAGE_PARITY_WIDGETS,
  readExpectedPackageFixture,
  widgetFixtureCoordinate,
  type PackageParityWidget,
} from './instance-package-fixtures';
import {
  buildSavedWidgetPublicPackageResult,
  buildSavedWidgetPublicPackage,
  materializeAccountInstanceLocalePublicPackage,
  materializeAccountInstancePublicPackage,
} from '../lib/account-instance-public-package';
import { buildLocalePackageMaterializationFailure } from '../lib/account-instance-locale-package';
import { buildLocalePackageDeleteFailureCoordinate } from '../lib/account-locale-overlay-update';

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const CLOUDFLARE_REQUEST_CONTEXT_SYMBOL = Symbol.for('__cloudflare-request-context__');
const UPLOADED_FONT_FAMILY = 'Uploaded Font';
const UPLOADED_FONT_ASSET_REF = 'UploadedFont.woff2';
const UPLOADED_FONT_URL = `https://tokyo.dev.clickeen.com/assets/account/CLICKEEN/${UPLOADED_FONT_ASSET_REF}`;

type ResolvedAssetFixture = {
  assetRef: string;
  url: string;
  assetType: string;
  contentType: string;
};

type TokyoControlFixtureOptions = {
  fontLibrary?: AccountFontLibrary;
  resolveAssets?: (assetRefs: string[]) => Promise<Response> | Response;
};

async function withTokyoProductControlDefaults<T>(
  accountId: string,
  run: () => Promise<T>,
  options: TokyoControlFixtureOptions = {},
): Promise<T> {
  const globalRecord = globalThis as Record<PropertyKey, unknown>;
  const previous = globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
  const fontLibrary = options.fontLibrary ?? createDefaultAccountFontLibrary();
  const env: {
    TOKYO_PRODUCT_CONTROL: { fetch: () => Promise<Response> };
    TOKYO_ASSET_CONTROL?: { fetch: (_input: RequestInfo | URL, init?: RequestInit) => Promise<Response> };
  } = {
    TOKYO_PRODUCT_CONTROL: {
      fetch: async () =>
        new Response(
          JSON.stringify({
            accountId,
            widgetDefaults: {
              accountId,
              fontLibrary,
              shell: {},
              widgets: {},
              seededAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    },
  };
  if (options.resolveAssets) {
    env.TOKYO_ASSET_CONTROL = {
      fetch: async (_input, init) => {
        const rawBody = typeof init?.body === 'string' ? init.body : '';
        const payload = rawBody ? JSON.parse(rawBody) as { assetRefs?: unknown } : null;
        const assetRefs = Array.isArray(payload?.assetRefs)
          ? payload.assetRefs.filter((assetRef): assetRef is string => typeof assetRef === 'string')
          : [];
        return options.resolveAssets!(assetRefs);
      },
    };
  }
  globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env,
  };
  try {
    return await run();
  } finally {
    if (typeof previous === 'undefined') {
      delete globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    } else {
      globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = previous;
    }
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function buildUploadedFontLibrary(): AccountFontLibrary {
  const base = createDefaultAccountFontLibrary();
  return {
    ...base,
    fonts: {
      ...base.fonts,
      [UPLOADED_FONT_FAMILY]: {
        label: UPLOADED_FONT_FAMILY,
        source: 'account-asset',
        category: 'display',
        familyClass: 'sans',
        usage: 'heading-only',
        weights: ['400'],
        styles: ['normal'],
        assetRef: UPLOADED_FONT_ASSET_REF,
        contentType: 'font/woff2',
      },
    },
  };
}

function setTitleFont(config: Record<string, unknown>, family: string): Record<string, unknown> {
  const typography = config.typography;
  if (!typography || typeof typography !== 'object' || Array.isArray(typography)) {
    throw new Error('test typography fixture missing');
  }
  const roles = (typography as Record<string, unknown>).roles;
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) {
    throw new Error('test typography roles fixture missing');
  }
  const title = (roles as Record<string, unknown>).title;
  if (!title || typeof title !== 'object' || Array.isArray(title)) {
    throw new Error('test typography title role fixture missing');
  }
  (title as Record<string, unknown>).family = family;
  return config;
}

function resolvedUploadedFontAsset(overrides: Partial<ResolvedAssetFixture> = {}): ResolvedAssetFixture {
  return {
    assetRef: UPLOADED_FONT_ASSET_REF,
    url: UPLOADED_FONT_URL,
    assetType: 'font',
    contentType: 'font/woff2',
    ...overrides,
  };
}

async function assertRomaIsOnly124CCaller(): Promise<void> {
  const files = [
    'roma/lib/account-instance-public-package.ts',
    'packages/ck-runtime-materializer/src/materialize.ts',
    'packages/ck-runtime-materializer/src/index.ts',
  ];
  const joined = await Promise.all(files.map((file) => readFile(path.join(repoRoot, file), 'utf8')));
  assert.match(joined[0]!, /@clickeen\/ck-runtime-materializer/);
  assert.doesNotMatch(joined[1]!, /roma\/|@roma\/|tokyo-worker|next\/|react|process\.env/);
  assert.doesNotMatch(joined[2]!, /roma\/|@roma\/|tokyo-worker|next\/|react|process\.env/);
}

async function readRouteSource(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

function assertLocalePackageCallsDoNotStreamActivity(source: string): void {
  const calls = source.match(/materializeAccountInstanceLocalePackages\(\{[\s\S]*?\n\s*\}\)/g) ?? [];
  assert.ok(calls.length > 0, 'expected locale package materialization calls');
  for (const call of calls) {
    assert.doesNotMatch(call, /onActivity/);
  }
}

async function materializeForWidget(widgetType: PackageParityWidget) {
  const compiled = await buildCompiledWidgetFixture(widgetType);
  const state = await buildAccountDefaultStateFixture(widgetType);
  const coordinate = widgetFixtureCoordinate(widgetType);
  return buildSavedWidgetPublicPackage({
    compiled,
    accountId: coordinate.accountId,
    instanceId: coordinate.instanceId,
    baseLocale: coordinate.baseLocale,
    displayName: coordinate.displayName,
    state,
  });
}

async function testAllWidgetDualBuildParity(): Promise<void> {
  const expected = await readExpectedPackageFixture();
  for (const widgetType of PACKAGE_PARITY_WIDGETS) {
    const result = await materializeForWidget(widgetType);
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) continue;
    assert.deepEqual(result.value, {
      ...expected[widgetType],
      dependencies: { instanceIds: [] },
    });
    console.log(`PASS all-widget dual-build parity ${widgetType}`);
  }
}

async function testAdapterInputContract(): Promise<void> {
  const widgetType = 'faq';
  const compiled = await buildCompiledWidgetFixture(widgetType);
  const state = await buildAccountDefaultStateFixture(widgetType);
  const coordinate = widgetFixtureCoordinate(widgetType);
  const result = await buildSavedWidgetPublicPackage({
    compiled,
    accountId: coordinate.accountId,
    instanceId: coordinate.instanceId,
    baseLocale: coordinate.baseLocale,
    displayName: coordinate.displayName,
    state,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.match(result.value.runtimeJs, /var selectedLocale = payload\.baseLocale;/);
  assert.match(result.value.runtimeJs, /"languages":\["en"\]/);
  assert.doesNotMatch(result.value.runtimeJs, /"fr"/);
  assert.match(result.value.runtimeJs, /"instanceId":"inst_faq"/);
}

async function testCreateSaveDuplicateRoutePackageSubmission(): Promise<void> {
  const routes = [
    'roma/app/api/account/instances/route.ts',
    'roma/app/api/account/instances/[instanceId]/route.ts',
    'roma/app/api/account/instances/[instanceId]/duplicate/route.ts',
  ];
  for (const routePath of routes) {
    const source = await readRouteSource(routePath);
    assert.match(source, /materializeAccountInstancePublicPackage\(\{/);
    assert.match(source, /publicPackage\.value/);
    assert.match(source, /publicPackage\.ok/);
    assert.match(source, /createAccountInstanceInTokyo|saveAccountInstanceInTokyo/);
  }
  const duplicateRoute = await readRouteSource('roma/app/api/account/instances/[instanceId]/duplicate/route.ts');
  assert.match(duplicateRoute, /const instanceId = createCompactInstanceId\(\);/);
  assert.match(duplicateRoute, /instanceId,\n\s+baseLocale,/);
}

async function testInstanceMetaRemovedContract(): Promise<void> {
  const bobSaveSource = await readRouteSource('bob/lib/session/useSessionSaving.ts');
  assert.doesNotMatch(bobSaveSource, /meta:\s*meta\?\.meta\s*\?\?\s*null/);
  assert.doesNotMatch(bobSaveSource, /meta:\s*null/);
  assert.doesNotMatch(bobSaveSource, /saveBody\.meta/);

  const bobSessionTypes = await readRouteSource('bob/lib/session/sessionTypes.ts');
  assert.doesNotMatch(bobSessionTypes, /meta\?: Record<string, unknown> \| null/);

  const romaSaveRoute = await readRouteSource('roma/app/api/account/instances/[instanceId]/route.ts');
  assert.doesNotMatch(romaSaveRoute, /body\.meta/);
  assert.doesNotMatch(romaSaveRoute, /\{ meta \}/);

  const duplicateRoute = await readRouteSource('roma/app/api/account/instances/[instanceId]/duplicate/route.ts');
  assert.doesNotMatch(duplicateRoute, /meta:\s*null/);

  const tokyoRoutes = await readRouteSource('tokyo-worker/src/routes/internal-instance-routes.ts');
  assert.doesNotMatch(tokyoRoutes, /rawBody\.meta|body\.meta|pointer\.meta|normalizeSubmittedMeta/);

  const tokyoTypes = await readRouteSource('tokyo-worker/src/domains/account-instances/types.ts');
  assert.doesNotMatch(tokyoTypes, /meta\?: Record<string, unknown> \| null/);
}

async function testErrorMapping(): Promise<void> {
  const compiled = await buildCompiledWidgetFixture('faq');
  const state = await buildAccountDefaultStateFixture('faq');
  const coordinate = widgetFixtureCoordinate('faq');
  delete compiled.widgetPackage?.files['product/widgets/faq/widget.css'];
  const result = await buildSavedWidgetPublicPackage({
    compiled,
    accountId: coordinate.accountId,
    instanceId: coordinate.instanceId,
    baseLocale: coordinate.baseLocale,
    displayName: coordinate.displayName,
    state,
  });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) return;
  assert.equal(result.status, 422);
  assert.equal(result.error.kind, 'VALIDATION');
  assert.equal(result.error.reasonKey, 'coreui.errors.widget.packageMissing:product/widgets/faq/widget.css');
}

async function testByteExactStateSerialization(): Promise<void> {
  const result = await materializeForWidget('countdown');
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  const expected = (await readExpectedPackageFixture()).countdown;
  assert.equal(result.value.runtimeJs, expected.runtimeJs);
}

async function testAdapterEvidencePlumbing(): Promise<void> {
  const compiled = await buildCompiledWidgetFixture('faq');
  const state = await buildAccountDefaultStateFixture('faq');
  const coordinate = widgetFixtureCoordinate('faq');
  const result = await buildSavedWidgetPublicPackageResult({
    compiled,
    accountId: coordinate.accountId,
    instanceId: coordinate.instanceId,
    baseLocale: coordinate.baseLocale,
    displayName: coordinate.displayName,
    state,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.deepEqual(result.value.evidence.localeCoordinate, {
    kind: 'account-instance-widget',
    accountPublicId: 'CLICKEEN',
    instanceId: 'inst_faq',
    baseLocale: 'en',
    requestedLocale: 'en',
  });
  assert.match(result.value.evidence.sourceReference, /^accounts\/CLICKEEN\/instances\/inst_faq\/base$/);
  assert.match(result.value.evidence.sourceFingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.match(result.value.evidence.schemaWidgetContractFingerprint, /^widget-editable-fields:[a-f0-9]{8}$/);
  assert.equal(result.value.evidence.overlayFingerprint, null);
  assert.equal(result.value.evidence.materializerContractVersion, 'ck-runtime-materializer:124B');
  assert.match(result.value.evidence.generatedPackageFingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(result.value.evidence.supportFileFingerprints, []);
}

async function testRouteFacingMaterializerWrapper(): Promise<void> {
  const compiled = await buildCompiledWidgetFixture('calltoaction');
  const config = await buildAccountDefaultStateFixture('calltoaction');
  const coordinate = widgetFixtureCoordinate('calltoaction');
  const result = await withTokyoProductControlDefaults(coordinate.accountId, () =>
    materializeAccountInstancePublicPackage({
      compiled,
      accountId: coordinate.accountId,
      accountCapsule: 'test-capsule',
      requestId: 'test-request',
      instanceId: coordinate.instanceId,
      baseLocale: coordinate.baseLocale,
      displayName: coordinate.displayName,
      config,
    }),
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.equal(typeof result.value.indexHtml, 'string');
  assert.equal(typeof result.value.stylesCss, 'string');
  assert.equal(typeof result.value.runtimeJs, 'string');
}

async function materializeCallToActionWithUploadedFont(args: {
  resolveAssets: (assetRefs: string[]) => Promise<Response> | Response;
}) {
  const compiled = await buildCompiledWidgetFixture('calltoaction');
  const config = setTitleFont(
    await buildAccountDefaultStateFixture('calltoaction'),
    UPLOADED_FONT_FAMILY,
  );
  const coordinate = widgetFixtureCoordinate('calltoaction');
  return withTokyoProductControlDefaults(
    coordinate.accountId,
    () =>
      materializeAccountInstancePublicPackage({
        compiled,
        accountId: coordinate.accountId,
        accountCapsule: 'test-capsule',
        requestId: 'test-request',
        instanceId: coordinate.instanceId,
        baseLocale: coordinate.baseLocale,
        displayName: coordinate.displayName,
        config,
      }),
    {
      fontLibrary: buildUploadedFontLibrary(),
      resolveAssets: args.resolveAssets,
    },
  );
}

async function testAccountAssetFontMaterialization(): Promise<void> {
  const result = await materializeCallToActionWithUploadedFont({
    resolveAssets: (assetRefs) => {
      assert.deepEqual(assetRefs, [UPLOADED_FONT_ASSET_REF]);
      return jsonResponse({
        assets: [resolvedUploadedFontAsset()],
      });
    },
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.match(result.value.runtimeJs, /"Uploaded Font"/);
  assert.match(result.value.runtimeJs, /"source":"account-asset"/);
  assert.match(result.value.runtimeJs, /UploadedFont\.woff2/);
  assert.match(result.value.runtimeJs, /"contentType":"font\/woff2"/);
}

async function testAccountAssetFontResolveFailures(): Promise<void> {
  const wrongType = await materializeCallToActionWithUploadedFont({
    resolveAssets: (assetRefs) =>
      jsonResponse({
        assets: [resolvedUploadedFontAsset({ assetRef: assetRefs[0]!, assetType: 'image' })],
      }),
  });
  assert.equal(wrongType.ok, false, JSON.stringify(wrongType));
  if (!wrongType.ok) {
    assert.equal(wrongType.error.reasonKey, 'coreui.errors.typography.fontAsset.invalid');
    assert.equal(wrongType.error.detail, UPLOADED_FONT_ASSET_REF);
    assert.deepEqual(wrongType.error.paths, [`fontLibrary.fonts.${UPLOADED_FONT_FAMILY}.assetRef`]);
  }

  const wrongContentType = await materializeCallToActionWithUploadedFont({
    resolveAssets: (assetRefs) =>
      jsonResponse({
        assets: [resolvedUploadedFontAsset({ assetRef: assetRefs[0]!, contentType: 'font/woff' })],
      }),
  });
  assert.equal(wrongContentType.ok, false, JSON.stringify(wrongContentType));
  if (!wrongContentType.ok) {
    assert.equal(wrongContentType.error.reasonKey, 'coreui.errors.typography.fontAsset.invalid');
    assert.equal(wrongContentType.error.detail, UPLOADED_FONT_ASSET_REF);
    assert.deepEqual(wrongContentType.error.paths, [`fontLibrary.fonts.${UPLOADED_FONT_FAMILY}.assetRef`]);
  }

  const missing = await materializeCallToActionWithUploadedFont({
    resolveAssets: () =>
      jsonResponse(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.assets.resolve.missing',
            detail: UPLOADED_FONT_ASSET_REF,
          },
        },
        422,
      ),
  });
  assert.equal(missing.ok, false, JSON.stringify(missing));
  if (!missing.ok) {
    assert.equal(missing.error.reasonKey, 'coreui.errors.assets.resolve.missing');
    assert.equal(missing.error.detail, UPLOADED_FONT_ASSET_REF);
  }
}

async function testLocalePackageMaterializerWrapper(): Promise<void> {
  const compiled = await buildCompiledWidgetFixture('faq');
  const config = await buildAccountDefaultStateFixture('faq');
  const coordinate = widgetFixtureCoordinate('faq');
  const fields = extractSavedTextFieldsForEditableFields({
    contract: compiled.editableFields!,
    config,
  });
  const overlayValues = Object.fromEntries(fields.map((field) => [field.path, `fr:${field.baseText}`]));
  const result = await withTokyoProductControlDefaults(coordinate.accountId, () =>
    materializeAccountInstanceLocalePublicPackage({
      compiled,
      accountId: coordinate.accountId,
      accountCapsule: 'test-capsule',
      requestId: 'test-request',
      instanceId: coordinate.instanceId,
      baseLocale: coordinate.baseLocale,
      requestedLocale: 'fr',
      activeLocales: ['fr'],
      displayName: coordinate.displayName,
      config,
      overlayValues,
    }),
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.match(result.value.package.indexHtml, /<html lang="fr">/);
  assert.match(result.value.package.runtimeJs, /var selectedLocale = "fr";/);
  assert.match(result.value.package.runtimeJs, /"languages":\["en","fr"\]/);
  const overlayFingerprint = result.value.evidence.overlayFingerprint;
  if (typeof overlayFingerprint !== 'string') throw new Error('locale overlay fingerprint missing');
  assert.match(overlayFingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.value.evidence.localeCoordinate.requestedLocale, 'fr');
  assert.equal(result.value.evidence.materializerContractVersion, 'ck-runtime-materializer:124B');
}

async function testLocalePackageRejectsBaseAndInactiveLocales(): Promise<void> {
  const compiled = await buildCompiledWidgetFixture('faq');
  const config = await buildAccountDefaultStateFixture('faq');
  const coordinate = widgetFixtureCoordinate('faq');
  const fields = extractSavedTextFieldsForEditableFields({
    contract: compiled.editableFields!,
    config,
  });
  const overlayValues = Object.fromEntries(fields.map((field) => [field.path, `fr:${field.baseText}`]));
  const baseResult = await materializeAccountInstanceLocalePublicPackage({
    compiled,
    accountId: coordinate.accountId,
    accountCapsule: 'test-capsule',
    requestId: 'test-request',
    instanceId: coordinate.instanceId,
    baseLocale: coordinate.baseLocale,
    requestedLocale: coordinate.baseLocale,
    activeLocales: ['fr'],
    displayName: coordinate.displayName,
    config,
    overlayValues,
  });
  assert.equal(baseResult.ok, false, JSON.stringify(baseResult));
  if (!baseResult.ok) assert.equal(baseResult.error.detail, 'locale_package_base_locale_requested');

  const inactiveResult = await materializeAccountInstanceLocalePublicPackage({
    compiled,
    accountId: coordinate.accountId,
    accountCapsule: 'test-capsule',
    requestId: 'test-request',
    instanceId: coordinate.instanceId,
    baseLocale: coordinate.baseLocale,
    requestedLocale: 'fr',
    activeLocales: ['de'],
    displayName: coordinate.displayName,
    config,
    overlayValues,
  });
  assert.equal(inactiveResult.ok, false, JSON.stringify(inactiveResult));
  if (!inactiveResult.ok) assert.equal(inactiveResult.error.detail, 'locale_package_inactive_locale');
}

async function testLocaleMaterializationRouteWiring(): Promise<void> {
  const generateRoute = await readRouteSource('roma/app/api/account/instances/[instanceId]/translations/generate/route.ts');
  assert.match(generateRoute, /materializeAccountInstanceLocalePackages\(\{/);
  assert.match(generateRoute, /localePackages/);
  assert.match(generateRoute, /generateAccountInstanceTranslations\(\{/);
  assert.match(generateRoute, /generateAccountInstanceTranslations\(\{[\s\S]*onActivity: activity/);
  assertLocalePackageCallsDoNotStreamActivity(generateRoute);

  const localePackageHelper = await readRouteSource('roma/lib/account-instance-locale-package.ts');
  assert.doesNotMatch(localePackageHelper, /package-materializing|Writing \$\{locale\} package|locale-completed/);

  const settingsRoute = await readRouteSource('roma/app/api/account/locales/route.ts');
  assert.match(settingsRoute, /materializeAccountInstanceLocalePackages\(\{/);
  assert.match(settingsRoute, /deleteAccountInstanceLocalePackageArtifact\(\{/);
  assert.match(settingsRoute, /locale-package-delete/);
  assert.match(settingsRoute, /locale-package-materialize/);
}

async function testLocalePackageFailureCoordinates(): Promise<void> {
  const result = buildLocalePackageMaterializationFailure({
    status: 409,
    kind: 'VALIDATION',
    reasonKey: 'coreui.errors.instance.embedNotReady',
    detail: 'write_failed',
    completed: [
      {
        accountId: 'CLICKEEN',
        instanceId: 'inst_faq',
        locale: 'fr',
        publicPackageFingerprint: 'sha256:stored',
      },
    ],
    remainingLocales: ['it', 'de'],
    accountId: 'CLICKEEN',
    instanceId: 'inst_faq',
    locale: 'es',
    phase: 'package-write',
  });
  assert.equal(result.ok, false);
  assert.equal(result.value.ok, false);
  assert.deepEqual(result.value.completed, [
    {
      accountId: 'CLICKEEN',
      instanceId: 'inst_faq',
      locale: 'fr',
      publicPackageFingerprint: 'sha256:stored',
    },
  ]);
  assert.deepEqual(result.value.skipped, [
    {
      accountId: 'CLICKEEN',
      instanceId: 'inst_faq',
      locale: 'it',
      phase: 'not-attempted-after-failure',
    },
    {
      accountId: 'CLICKEEN',
      instanceId: 'inst_faq',
      locale: 'de',
      phase: 'not-attempted-after-failure',
    },
  ]);
  assert.deepEqual(result.value.failed, {
    accountId: 'CLICKEEN',
    instanceId: 'inst_faq',
    locale: 'es',
    phase: 'package-write',
    reasonKey: 'coreui.errors.instance.embedNotReady',
    detail: 'write_failed',
  });

  assert.deepEqual(
    buildLocalePackageDeleteFailureCoordinate({
      accountId: 'CLICKEEN',
      instanceId: 'inst_faq',
      locale: 'fr',
      reasonKey: 'coreui.errors.db.writeFailed',
      detail: 'delete_failed',
    }),
    {
      accountId: 'CLICKEEN',
      instanceId: 'inst_faq',
      locale: 'fr',
      phase: 'locale-package-delete',
      reasonKey: 'coreui.errors.db.writeFailed',
      detail: 'delete_failed',
    },
  );
}

async function testTokyoLocalePackageStorageWiring(): Promise<void> {
  const packageSource = await readRouteSource('tokyo-worker/src/domains/account-instances/package-files.ts');
  assert.match(packageSource, /writeInstanceLocalePackage/);
  assert.match(packageSource, /deleteInstanceLocalePackage/);
  assert.match(packageSource, /localePackageAccountPublicId/);
  assert.match(packageSource, /localePackageSourceUpdatedAt/);
  assert.match(packageSource, /materializerContractVersion/);

  const routeSource = await readRouteSource('tokyo-worker/src/routes/internal-instance-routes.ts');
  assert.equal(routeSource.includes('/locales\\/([^/]+)\\/package'), true);
  assert.match(routeSource, /writeInstanceLocalePackage\(\{/);
  assert.match(routeSource, /deleteInstanceLocalePackage\(\{/);

  const publicServing = await readRouteSource('tokyo-worker/src/routes/clk-live-routes.ts');
  assert.match(publicServing, /instance-locale/);
  assert.match(publicServing, /readInstanceLocalePackageObject/);
  assert.match(publicServing, /Locale not available/);
  assert.doesNotMatch(publicServing, /materializeRuntimePackage|generateAccountInstanceTranslations|readAccountInstanceTranslationValues/);
}

async function testMaterializerRejectsOverlayAtBase(): Promise<void> {
  const compiled = await buildCompiledWidgetFixture('faq');
  const state = await buildAccountDefaultStateFixture('faq');
  const result = await materializeRuntimePackage({
    compiled: {
      widgetname: compiled.widgetname,
      displayName: compiled.displayName,
      editableFields: compiled.editableFields,
      controls: compiled.controls,
      widgetPackage: { files: compiled.widgetPackage?.files ?? {} },
    },
    artifactCoordinate: {
      kind: 'account-instance-widget',
      accountPublicId: 'CLICKEEN',
      instanceId: 'inst_overlay_reject',
      baseLocale: 'en',
      requestedLocale: 'en',
    },
    displayName: 'overlay reject',
    state,
    localeOverlay: {
      locale: 'en',
      keyKind: 'current_saved_content_concrete_path',
      values: {},
    },
    evidence: {
      schemaWidgetContractFingerprint: 'schema',
      sourceFingerprint: 'source',
      sourceReference: 'test',
      overlayFingerprint: null,
    },
  });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) return;
  assert.equal(result.error.reason, 'locale_overlay_unexpected_for_base');
}

const tests: Array<{ name: string; run: () => Promise<void> }> = [
  { name: 'all-widget dual-build parity matrix', run: testAllWidgetDualBuildParity },
  { name: 'Roma adapter input contract', run: testAdapterInputContract },
  { name: 'create/save/duplicate route package submission', run: testCreateSaveDuplicateRoutePackageSubmission },
  { name: 'instance meta removed contract', run: testInstanceMetaRemovedContract },
  { name: 'error mapping', run: testErrorMapping },
  { name: 'byte-exact state serialization', run: testByteExactStateSerialization },
  { name: 'adapter evidence plumbing', run: testAdapterEvidencePlumbing },
  { name: 'route-facing materializer wrapper', run: testRouteFacingMaterializerWrapper },
  { name: 'account-asset font materialization', run: testAccountAssetFontMaterialization },
  { name: 'account-asset font resolve failures', run: testAccountAssetFontResolveFailures },
  { name: 'locale package materializer wrapper', run: testLocalePackageMaterializerWrapper },
  { name: 'locale package rejects base and inactive locales', run: testLocalePackageRejectsBaseAndInactiveLocales },
  { name: 'locale materialization route wiring', run: testLocaleMaterializationRouteWiring },
  { name: 'locale package failure coordinates', run: testLocalePackageFailureCoordinates },
  { name: 'Tokyo locale package storage wiring', run: testTokyoLocalePackageStorageWiring },
  { name: 'base rejects overlay', run: testMaterializerRejectsOverlayAtBase },
  { name: 'dependency guard', run: assertRomaIsOnly124CCaller },
];

async function main() {
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
