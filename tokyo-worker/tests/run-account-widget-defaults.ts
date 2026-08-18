import assert from 'node:assert/strict';
import {
  COMMON_WIDGET_FACTORY_DEFAULTS,
  createDefaultAccountFontLibrary,
} from '@clickeen/widget-foundation';

const valid = {
  accountId: 'CLICKEEN',
  fontLibrary: createDefaultAccountFontLibrary(),
  common: structuredClone(COMMON_WIDGET_FACTORY_DEFAULTS),
  widgets: {
    'big-bang': {
      core: {},
    },
  },
  seededAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

assert.equal(valid.fontLibrary.fonts.Orio?.source, 'tokyo');
console.log('PASS Tokyo Widget Defaults uses the exact generated font library');
