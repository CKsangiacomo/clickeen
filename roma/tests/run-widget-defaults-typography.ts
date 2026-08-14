import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NextRequest } from 'next/server';
import {
  createDefaultAccountFontLibrary,
  isCommonWidgetControlPath,
  validateAccountTypographyFontSelections,
  COMMON_WIDGET_FACTORY_DEFAULTS,
  type AccountFontLibrary,
} from '@clickeen/widget-foundation';
import { validateAccountWidgetDefaultsContract } from '../lib/account-widget-defaults-contract';
import {
  normalizeAccountWidgetDefaultsDocument,
  type AccountWidgetDefaultsDocument,
} from '../lib/account-widget-defaults-direct';
import { readValuefieldInput } from '../components/widget-defaults-builder-controls';

function fontLibraryWithAccountFont(): AccountFontLibrary {
  const library = createDefaultAccountFontLibrary();
  library.fonts['Custom Display'] = {
    label: 'Custom Display',
    source: 'account-asset',
    category: 'display',
    familyClass: 'sans',
    usage: 'heading-only',
    weights: ['400'],
    styles: ['normal'],
    assetRef: 'CustomDisplay.woff2',
    contentType: 'font/woff2',
  };
  return library;
}

function setRoleFont(
  root: Record<string, unknown>,
  role: string,
  family: string,
  weight: string,
): void {
  const roles = (root.typography as Record<string, unknown>).roles as Record<string, unknown>;
  Object.assign(roles[role] as Record<string, unknown>, {
    family,
    weight,
    fontStyle: 'normal',
  });
}

async function document(): Promise<AccountWidgetDefaultsDocument> {
  const spec = JSON.parse(
    await readFile(
      new URL('../../tokyo/product/widgets/calltoaction/spec.json', import.meta.url),
      'utf8',
    ),
  ) as { defaults: Record<string, unknown> };
  return {
    accountId: 'CLICKEEN',
    fontLibrary: fontLibraryWithAccountFont(),
    common: structuredClone(COMMON_WIDGET_FACTORY_DEFAULTS as unknown as Record<string, unknown>),
    widgets: { calltoaction: { core: structuredClone(spec.defaults) } },
    seededAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

async function main(): Promise<void> {
  assert.equal(readValuefieldInput(0, { min: 0, max: 160 }), 0);
  assert.equal(readValuefieldInput(-0.25, { min: -2, max: 2 }), -0.25);
  assert.equal(readValuefieldInput(-1, { min: 0, max: 160 }), null);
  assert.equal(readValuefieldInput(161, { min: 0, max: 160 }), null);
  assert.equal(readValuefieldInput(Number.NaN, { min: 0, max: 160 }), null);
  const request = new NextRequest('https://roma.test/api/account/widget-defaults');
  const globalOrio = createDefaultAccountFontLibrary().fonts.Orio;
  assert.equal(globalOrio?.source, 'tokyo');
  if (globalOrio?.source === 'tokyo') {
    assert.equal(globalOrio.filePath, '/fonts/special/Orio.woff');
  }
  const valid = await document();
  assert.ok(valid.common.coreSize);
  assert.equal(isCommonWidgetControlPath('coreSize.mode'), true);
  assert.equal(isCommonWidgetControlPath(' coreSize.mode'), false);
  assert.ok(normalizeAccountWidgetDefaultsDocument(valid));
  const retiredShellOnly = {
    ...valid,
    shell: valid.common,
  } as Record<string, unknown>;
  delete retiredShellOnly.common;
  assert.equal(normalizeAccountWidgetDefaultsDocument(retiredShellOnly), null);
  assert.equal(
    normalizeAccountWidgetDefaultsDocument({
      ...valid,
      shell: valid.common,
    }),
    null,
  );
  assert.deepEqual(
    validateAccountTypographyFontSelections({
      fontLibrary: valid.fontLibrary,
      typography: undefined,
    }),
    [],
  );
  setRoleFont(valid.common, 'title', 'Custom Display', '400');
  assert.deepEqual(
    await validateAccountWidgetDefaultsContract({ request, widgetDefaults: valid }),
    { ok: true },
  );

  const misplacedCoreSize = await document();
  misplacedCoreSize.widgets.calltoaction!.core.coreSize = structuredClone(
    misplacedCoreSize.common.coreSize,
  );
  const misplacedCoreSizeResult = await validateAccountWidgetDefaultsContract({
    request,
    widgetDefaults: misplacedCoreSize,
  });
  assert.equal(misplacedCoreSizeResult.ok, false);
  if (!misplacedCoreSizeResult.ok) {
    assert.ok(misplacedCoreSizeResult.error.paths?.includes('calltoaction:coreSize.mode'));
  }

  setRoleFont(valid.widgets.calltoaction!.core, 'eyebrow', 'Custom Display', '700');
  const invalid = await validateAccountWidgetDefaultsContract({
    request,
    widgetDefaults: valid,
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.error.reasonKey, 'coreui.errors.typography.selection.invalid');
    assert.deepEqual(invalid.error.paths, ['calltoaction:typography.roles.eyebrow.weight']);
  }

  const malformed = await document();
  malformed.common.typography = { roles: { title: 'bad' } };
  const malformedResult = await validateAccountWidgetDefaultsContract({
    request,
    widgetDefaults: malformed,
  });
  assert.equal(malformedResult.ok, false);
  if (!malformedResult.ok) {
    assert.deepEqual(malformedResult.error.paths, ['common:typography.roles.title']);
  }
  console.log('PASS Widget Defaults common/core and typography contracts');
}

void main();
