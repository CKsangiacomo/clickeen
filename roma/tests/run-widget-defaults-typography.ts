import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NextRequest } from 'next/server';
import {
  createDefaultAccountFontLibrary,
  validateAccountTypographyFontSelections,
  WIDGET_SHELL_FACTORY_DEFAULTS,
  type AccountFontLibrary,
} from '@clickeen/widget-shell';
import { validateAccountWidgetDefaultsContract } from '../lib/account-widget-defaults-contract';
import type { AccountWidgetDefaultsDocument } from '../lib/account-widget-defaults-direct';
import type { TokyoWidgetDefinition } from '../lib/account-instance-direct';

function definitionsFor(value: AccountWidgetDefaultsDocument): TokyoWidgetDefinition[] {
  return [{
    widgetType: 'calltoaction',
    defaults: structuredClone(value.widgets.calltoaction!.core),
  } as TokyoWidgetDefinition];
}

function fontLibraryWithOrio(): AccountFontLibrary {
  const library = createDefaultAccountFontLibrary();
  library.fonts.Orio = {
    label: 'Orio',
    source: 'account-asset',
    category: 'display',
    familyClass: 'sans',
    usage: 'heading-only',
    weights: ['400'],
    styles: ['normal'],
    assetRef: 'Orio.woff2',
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
  const roles = (
    (root.typography as Record<string, unknown>).roles as Record<string, unknown>
  );
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
    fontLibrary: fontLibraryWithOrio(),
    shell: structuredClone(
      WIDGET_SHELL_FACTORY_DEFAULTS as unknown as Record<string, unknown>,
    ),
    widgets: { calltoaction: { core: structuredClone(spec.defaults) } },
    seededAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

async function main(): Promise<void> {
  const request = new NextRequest('https://roma.test/api/account/widget-defaults');
  const valid = await document();
  assert.deepEqual(
    validateAccountTypographyFontSelections({
      fontLibrary: valid.fontLibrary,
      typography: undefined,
    }),
    [],
  );
  setRoleFont(valid.shell, 'title', 'Orio', '400');
  assert.deepEqual(
    await validateAccountWidgetDefaultsContract({ request, widgetDefaults: valid, widgetDefinitions: definitionsFor(valid) }),
    { ok: true },
  );

  setRoleFont(valid.widgets.calltoaction!.core, 'eyebrow', 'Orio', '700');
  const invalid = await validateAccountWidgetDefaultsContract({
    request,
    widgetDefaults: valid,
    widgetDefinitions: definitionsFor(valid),
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.error.reasonKey, 'coreui.errors.typography.selection.invalid');
    assert.deepEqual(invalid.error.paths, [
      'calltoaction:typography.roles.eyebrow.weight',
    ]);
  }

  const malformed = await document();
  malformed.shell.typography = { roles: { title: 'bad' } };
  const malformedResult = await validateAccountWidgetDefaultsContract({
    request,
    widgetDefaults: malformed,
    widgetDefinitions: definitionsFor(malformed),
  });
  assert.equal(malformedResult.ok, false);
  if (!malformedResult.ok) {
    assert.deepEqual(malformedResult.error.paths, ['shell:typography.roles.title']);
  }
  console.log('PASS Widget Defaults accepts account fonts and rejects invalid combinations');
}

void main();
