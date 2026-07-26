import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NextRequest } from 'next/server';
import {
  createDefaultAccountFontLibrary,
  resolveAccountTypographyFamilySelection,
  validateAccountTypographyFontSelections,
  WIDGET_SHELL_FACTORY_DEFAULTS,
  type AccountFontLibrary,
} from '@clickeen/widget-shell';
import {
  expandTypographyFamilyOps,
  isTypographyFamilySelectionError,
} from '@clickeen/bob/control-host';
import { validateAccountWidgetDefaultsContract } from '../lib/account-widget-defaults-contract';
import type { AccountWidgetDefaultsDocument } from '../lib/account-widget-defaults-direct';

const ORIO = 'Orio';

function buildFontLibrary(): AccountFontLibrary {
  const base = createDefaultAccountFontLibrary();
  return {
    ...base,
    fonts: {
      ...base.fonts,
      [ORIO]: {
        label: ORIO,
        source: 'account-asset',
        category: 'display',
        familyClass: 'sans',
        usage: 'heading-only',
        weights: ['400'],
        styles: ['normal'],
        assetRef: 'Orio.woff2',
        contentType: 'font/woff2',
      },
    },
  };
}

function setRoleFont(
  root: Record<string, unknown>,
  role: string,
  family: string,
  weight: string,
  fontStyle: string,
): void {
  const typography = root.typography as Record<string, unknown>;
  const roles = typography.roles as Record<string, unknown>;
  const record = roles[role] as Record<string, unknown>;
  record.family = family;
  record.weight = weight;
  record.fontStyle = fontStyle;
}

async function buildDocument(): Promise<AccountWidgetDefaultsDocument> {
  const spec = JSON.parse(
    await readFile(
      new URL('../../tokyo/product/widgets/calltoaction/spec.json', import.meta.url),
      'utf8',
    ),
  ) as { defaults: Record<string, unknown> };
  const shell = structuredClone(
    WIDGET_SHELL_FACTORY_DEFAULTS as unknown as Record<string, unknown>,
  );
  const core = structuredClone(spec.defaults);
  setRoleFont(shell, 'title', ORIO, '400', 'normal');
  setRoleFont(core, 'eyebrow', ORIO, '400', 'normal');
  return {
    accountId: 'CLICKEEN',
    fontLibrary: buildFontLibrary(),
    shell,
    widgets: { calltoaction: { core } },
    seededAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

async function readWidgetDefaults(widgetType: string): Promise<Record<string, unknown>> {
  const spec = JSON.parse(
    await readFile(
      new URL(`../../tokyo/product/widgets/${widgetType}/spec.json`, import.meta.url),
      'utf8',
    ),
  ) as { defaults: Record<string, unknown> };
  return structuredClone(spec.defaults);
}

function testTransitionLaw(): void {
  const fontLibrary = buildFontLibrary();
  const toUploaded = resolveAccountTypographyFamilySelection({
    fontLibrary,
    requestedFamily: ORIO,
    currentWeight: '700',
    currentFontStyle: 'italic',
  });
  assert.deepEqual(toUploaded, {
    ok: true,
    value: { family: ORIO, weight: '400', fontStyle: 'normal' },
  });
  const toInter = resolveAccountTypographyFamilySelection({
    fontLibrary,
    requestedFamily: 'Inter',
    currentWeight: '400',
    currentFontStyle: 'normal',
    requestedWeight: '700',
    requestedFontStyle: 'italic',
  });
  assert.deepEqual(toInter, {
    ok: true,
    value: { family: 'Inter', weight: '700', fontStyle: 'italic' },
  });
  const invalid = resolveAccountTypographyFamilySelection({
    fontLibrary,
    requestedFamily: ORIO,
    currentWeight: '400',
    currentFontStyle: 'normal',
    requestedWeight: '700',
  });
  assert.equal(invalid.ok, false);
  assert.equal(
    resolveAccountTypographyFamilySelection({
      fontLibrary,
      requestedFamily: ' Inter ',
      currentWeight: '400',
      currentFontStyle: 'normal',
    }).ok,
    false,
  );
  assert.equal(
    resolveAccountTypographyFamilySelection({
      fontLibrary,
      requestedFamily: ORIO,
      currentWeight: ' 400 ',
      currentFontStyle: 'normal',
    }).ok,
    false,
  );
  assert.deepEqual(
    validateAccountTypographyFontSelections({
      fontLibrary,
      typography: {
        globalFamily: ' Inter ',
        roles: {
          title: { family: ORIO, weight: ' 400 ', fontStyle: 'normal' },
        },
      },
    }),
    ['typography.globalFamily', 'typography.roles.title.weight'],
  );
  assert.deepEqual(
    validateAccountTypographyFontSelections({ fontLibrary, typography: null }),
    ['typography'],
  );
  assert.deepEqual(
    validateAccountTypographyFontSelections({
      fontLibrary,
      typography: { globalFamily: 'Inter', roles: { title: null } },
    }),
    ['typography.roles.title'],
  );
}

async function testAtomicExpansionAndRejection(): Promise<void> {
  const document = await buildDocument();
  setRoleFont(document.shell, 'title', 'Inter', '700', 'italic');
  const expanded = expandTypographyFamilyOps({
    instanceData: document.shell,
    fontLibrary: document.fontLibrary,
    ops: [{ op: 'set', path: 'typography.roles.title.family', value: ORIO }],
  });
  assert.deepEqual(expanded, [
    { op: 'set', path: 'typography.roles.title.family', value: ORIO },
    { op: 'set', path: 'typography.roles.title.weight', value: '400' },
    { op: 'set', path: 'typography.roles.title.fontStyle', value: 'normal' },
  ]);
  const before = JSON.stringify(document.shell);
  assert.throws(
    () =>
      expandTypographyFamilyOps({
        instanceData: document.shell,
        fontLibrary: document.fontLibrary,
        ops: [
          { op: 'set', path: 'typography.roles.title.family', value: ORIO },
          { op: 'set', path: 'typography.roles.title.weight', value: '700' },
        ],
      }),
    isTypographyFamilySelectionError,
  );
  const uploadedState = structuredClone(document.shell);
  setRoleFont(uploadedState, 'title', ORIO, '400', 'normal');
  const uploadedBefore = JSON.stringify(uploadedState);
  assert.throws(
    () =>
      expandTypographyFamilyOps({
        instanceData: uploadedState,
        fontLibrary: document.fontLibrary,
        ops: [
          { op: 'set', path: 'typography.roles.title.weight', value: '700' },
        ],
    }),
    isTypographyFamilySelectionError,
  );
  assert.equal(JSON.stringify(uploadedState), uploadedBefore);
  assert.equal(JSON.stringify(document.shell), before);
}

async function testRouteContractPaths(): Promise<void> {
  const request = new NextRequest('https://roma.test/api/account/widget-defaults');
  const valid = await buildDocument();
  assert.deepEqual(
    await validateAccountWidgetDefaultsContract({ request, widgetDefaults: valid }),
    { ok: true },
  );

  const shellTypographyOnly = structuredClone(valid);
  shellTypographyOnly.widgets = {
    logoshowcase: { core: await readWidgetDefaults('logoshowcase') },
  };
  assert.deepEqual(
    await validateAccountWidgetDefaultsContract({
      request,
      widgetDefaults: shellTypographyOnly,
    }),
    { ok: true },
  );

  const invalidShell = structuredClone(valid);
  setRoleFont(invalidShell.shell, 'title', ORIO, '700', 'normal');
  const shellResult = await validateAccountWidgetDefaultsContract({
    request,
    widgetDefaults: invalidShell,
  });
  assert.equal(shellResult.ok, false);
  if (!shellResult.ok) {
    assert.equal(shellResult.error.reasonKey, 'coreui.errors.typography.selection.invalid');
    assert.deepEqual(shellResult.error.paths, ['shell:typography.roles.title.weight']);
  }

  const invalidCore = structuredClone(valid);
  setRoleFont(invalidCore.widgets.calltoaction!.core, 'eyebrow', ORIO, '700', 'normal');
  const coreResult = await validateAccountWidgetDefaultsContract({
    request,
    widgetDefaults: invalidCore,
  });
  assert.equal(coreResult.ok, false);
  if (!coreResult.ok) {
    assert.equal(coreResult.error.reasonKey, 'coreui.errors.typography.selection.invalid');
    assert.deepEqual(coreResult.error.paths, [
      'calltoaction:typography.roles.eyebrow.weight',
    ]);
  }

  const malformed = structuredClone(valid);
  malformed.shell.typography = null;
  const malformedResult = await validateAccountWidgetDefaultsContract({
    request,
    widgetDefaults: malformed,
  });
  assert.equal(malformedResult.ok, false);
  if (!malformedResult.ok) {
    assert.equal(
      malformedResult.error.reasonKey,
      'coreui.errors.typography.selection.invalid',
    );
    assert.deepEqual(malformedResult.error.paths, ['shell:typography']);
  }

  const missingRoles = structuredClone(valid);
  delete (
    (missingRoles.shell.typography as Record<string, unknown>).roles as Record<
      string,
      unknown
    >
  ).body;
  delete (
    (
      missingRoles.widgets.calltoaction!.core.typography as Record<string, unknown>
    ).roles as Record<string, unknown>
  ).eyebrow;
  const missingRolesResult = await validateAccountWidgetDefaultsContract({
    request,
    widgetDefaults: missingRoles,
  });
  assert.equal(missingRolesResult.ok, false);
  if (!missingRolesResult.ok) {
    assert.equal(
      missingRolesResult.error.reasonKey,
      'coreui.errors.typography.selection.invalid',
    );
    assert.deepEqual(missingRolesResult.error.paths, [
      'shell:typography.roles.body',
      'calltoaction:typography.roles.eyebrow',
    ]);
  }
}

async function main(): Promise<void> {
  testTransitionLaw();
  console.log('PASS shared account font transition law');
  await testAtomicExpansionAndRejection();
  console.log('PASS atomic family transition and unchanged rejection');
  await testRouteContractPaths();
  console.log('PASS Widget Defaults shell/core typography contract');
}

void main();
