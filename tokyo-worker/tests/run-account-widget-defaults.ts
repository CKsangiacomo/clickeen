import assert from 'node:assert/strict';
import {
  COMMON_WIDGET_FACTORY_DEFAULTS,
  createDefaultAccountFontLibrary,
} from '@clickeen/widget-foundation';
import { normalizeAccountWidgetDefaultsDocument } from '../src/domains/account-widget-defaults';

const valid = {
  accountId: 'CLICKEEN',
  fontLibrary: createDefaultAccountFontLibrary(),
  common: structuredClone(COMMON_WIDGET_FACTORY_DEFAULTS),
  widgets: {
    calltoaction: {
      core: {},
    },
  },
  seededAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

assert.ok(normalizeAccountWidgetDefaultsDocument(valid, 'CLICKEEN'));
assert.equal(valid.fontLibrary.fonts.Orio?.source, 'tokyo');

const retiredShellOnly = {
  ...valid,
  shell: valid.common,
} as Record<string, unknown>;
delete retiredShellOnly.common;
assert.equal(normalizeAccountWidgetDefaultsDocument(retiredShellOnly, 'CLICKEEN'), null);
assert.equal(
  normalizeAccountWidgetDefaultsDocument({ ...valid, shell: valid.common }, 'CLICKEEN'),
  null,
);

console.log('PASS Tokyo Widget Defaults rejects the retired shell key');
