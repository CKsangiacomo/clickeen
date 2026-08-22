import assert from 'node:assert/strict';
import { callTokyo } from '../lib/tokyo-client';

const CLOUDFLARE_REQUEST_CONTEXT_SYMBOL = Symbol.for('__cloudflare-request-context__');

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
    const result = await callTokyo(
      { accountId: 'CLICKEEN' },
      {
        path: '/__internal/instances/ABCD123456/unpublish',
        method: 'POST',
        decode: (payload) => payload,
        errorKey: 'roma.errors.proxy.tokyo_unavailable',
        errorDetail: 'tokyo_instance_unpublish_http_error',
      },
    );
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
    callTokyo(
      { accountId: 'CLICKEEN' },
      {
        path: '/__internal/instances',
        method: 'POST',
        body,
        decode: (payload) => payload,
        errorKey: 'roma.errors.proxy.tokyo_unavailable',
        errorDetail: 'tokyo_instance_create_http_error',
      },
    ),
    /circular/i,
  );
}

const tests: Array<{ name: string; run: () => Promise<void> }> = [
  {
    name: 'Tokyo binding failure becomes a structured route failure',
    run: testTokyoBindingFailureIsStructured,
  },
  {
    name: 'invalid Tokyo body does not masquerade as availability failure',
    run: testInvalidTokyoBodyDoesNotMasqueradeAsAvailabilityFailure,
  },
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
