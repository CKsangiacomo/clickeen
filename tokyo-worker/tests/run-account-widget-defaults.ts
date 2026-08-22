import assert from 'node:assert/strict';
import {
  COMMON_WIDGET_FACTORY_DEFAULTS,
  createDefaultAccountFontLibrary,
} from '@clickeen/widget-foundation';
import {
  accountWidgetDefaultsKey,
  createInitialAccountWidgetDefaults,
  readAccountWidgetDefaults,
  writeAccountWidgetDefaults,
  type AccountWidgetDefaultsDocument,
} from '../src/domains/account-widget-defaults';
import type { Env } from '../src/types';

class MemoryR2 {
  readonly objects = new Map<string, string>();

  async get(key: string) {
    const value = this.objects.get(key);
    if (value === undefined) return null;
    return {
      json: async () => JSON.parse(value) as unknown,
    };
  }

  async put(key: string, value: string | ArrayBuffer | ArrayBufferView) {
    const source = typeof value === 'string'
      ? value
      : value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    this.objects.set(key, typeof source === 'string' ? source : new TextDecoder().decode(source));
    return {};
  }
}

const accountId = 'CLICKEEN';
const r2 = new MemoryR2();
const env = { TOKYO_R2: r2 as unknown as R2Bucket } as Env;
const initial: AccountWidgetDefaultsDocument = {
  accountId,
  fontLibrary: createDefaultAccountFontLibrary(),
  common: structuredClone(COMMON_WIDGET_FACTORY_DEFAULTS as unknown as Record<string, unknown>),
  widgets: {},
  seededAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

await assert.rejects(
  readAccountWidgetDefaults({ env, accountId }),
  /tokyo\.widgetDefaults\.missing/,
);

const created = await createInitialAccountWidgetDefaults({
  env,
  accountId,
  widgetDefaults: initial,
});
assert.deepEqual(created, initial);
assert.deepEqual(await readAccountWidgetDefaults({ env, accountId }), initial);
assert.deepEqual(
  JSON.parse(r2.objects.get(accountWidgetDefaultsKey(accountId))!),
  initial,
  'Tokyo must persist the sparse document exactly without adding Widget entries',
);
await assert.rejects(
  createInitialAccountWidgetDefaults({ env, accountId, widgetDefaults: initial }),
  /tokyo\.widgetDefaults\.exists/,
);

const saved: AccountWidgetDefaultsDocument = {
  ...initial,
  widgets: {
    faq: { core: { content: { title: 'Exact complete override' } } },
  },
  updatedAt: '2026-01-02T00:00:00.000Z',
};
assert.deepEqual(
  await writeAccountWidgetDefaults({ env, accountId, widgetDefaults: saved }),
  saved,
);
assert.deepEqual(await readAccountWidgetDefaults({ env, accountId }), saved);

r2.objects.set(accountWidgetDefaultsKey(accountId), '{invalid');
await assert.rejects(
  readAccountWidgetDefaults({ env, accountId }),
  /tokyo\.widgetDefaults\.invalid/,
  'corrupt stored defaults must not become absence or a repaired document',
);

assert.equal(initial.fontLibrary.fonts.Orio?.source, 'tokyo');
console.log('PASS Tokyo stores sparse Widget Defaults exactly and fails missing/corrupt truth');
