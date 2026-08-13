/**
 * PRD 128 Phase 2 gate test — SF concurrency lease release on cancellation.
 *
 * PRD 128B correction: TransformStream.flush() does NOT run on downstream
 * cancellation. withStreamInflightLimit must release the lease on ALL exit
 * paths: completion, error, cancellation. This test proves it.
 *
 * Run: cd sanfrancisco && npx tsx tests/run-concurrency.ts
 */

import assert from 'node:assert/strict';
import { withStreamInflightLimit } from '../src/concurrency';
import { HttpError } from '../src/http';

function assertPass(label: string, fn: () => Promise<void>) {
  return fn().then(
    () => { console.log(`  ✅ ${label}`); },
    (err) => {
      console.error(`  ❌ ${label}`);
      throw err;
    },
  );
}

/**
 * Creates a Response with a controllable stream body.
 * complete() closes the source stream (normal completion).
 * The returned Response's body is NOT locked — withStreamInflightLimit
 * will get its own reader.
 */
function controlledResponse(): { response: Response; complete: () => void } {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(c) { controller = c; },
  });
  const response = new Response(stream, {
    headers: { 'content-type': 'text/event-stream' },
  });
  return {
    response,
    complete: () => {
      controller?.enqueue(new TextEncoder().encode('data: done\n\n'));
      controller?.close();
    },
  };
}

async function run(): Promise<void> {
  console.log('=== PRD 128 Phase 2 Gate Test — Concurrency Release ===');

  await assertPass('normal completion releases the lease', async () => {
    const { response, complete } = controlledResponse();
    const wrapped = await withStreamInflightLimit(() => Promise.resolve(response));
    // Read the wrapped body to completion
    const reader = wrapped.body!.getReader();
    complete(); // signal the source to end
    await reader.read(); // consumes data
    // Wait for pump to see done and release
    await new Promise(resolve => setTimeout(resolve, 20));
    // After normal completion, a new request should succeed (lease released)
    const { response: r2, complete: c2 } = controlledResponse();
    const wrapped2 = await withStreamInflightLimit(() => Promise.resolve(r2));
    assert.ok(wrapped2, 'second request succeeded — lease was released');
    c2();
  });

  await assertPass('downstream cancellation releases the lease', async () => {
    const { response } = controlledResponse();
    const wrapped = await withStreamInflightLimit(() => Promise.resolve(response));
    // Cancel the downstream reader — this is the path that TransformStream.flush() misses
    const reader = wrapped.body!.getReader();
    await reader.cancel('user stop');
    // Give the release a tick to propagate
    await new Promise(resolve => setTimeout(resolve, 20));
    // After cancellation, a new request should succeed (lease released)
    const { response: r2, complete: c2 } = controlledResponse();
    const wrapped2 = await withStreamInflightLimit(() => Promise.resolve(r2));
    assert.ok(wrapped2, 'request after cancel succeeded — lease was released on cancellation');
    c2();
  });

  await assertPass('error in fn() releases the lease', async () => {
    try {
      await withStreamInflightLimit(() => Promise.reject(new Error('fail')));
    } catch { /* expected */ }
    // After the error, a new request should succeed
    const { response, complete } = controlledResponse();
    const wrapped = await withStreamInflightLimit(() => Promise.resolve(response));
    assert.ok(wrapped, 'request after error succeeded — lease was released on fn error');
    complete();
  });

  await assertPass('over-limit request is rejected with 429', async () => {
    // Fill all 8 slots with active (unconsumed) streams
    const active: Array<{ complete: () => void }> = [];
    for (let i = 0; i < 8; i++) {
      const { response, complete } = controlledResponse();
      const wrapped = await withStreamInflightLimit(() => Promise.resolve(response));
      // Start reading but don't complete — holds the lease
      wrapped.body!.getReader().read().catch(() => {});
      active.push({ complete });
    }
    await new Promise(resolve => setTimeout(resolve, 20));

    // The 9th should be rejected
    let rejected = false;
    try {
      const { response } = controlledResponse();
      await withStreamInflightLimit(() => Promise.resolve(response));
    } catch (err) {
      rejected = true;
      assert.ok(err instanceof HttpError, 'rejection is an HttpError');
      assert.equal((err as HttpError).status, 429, 'status is 429');
      assert.equal((err as HttpError).error.code, 'BUDGET_EXCEEDED');
    }
    assert.ok(rejected, '9th request was rejected');

    // Release one slot → the next request should succeed
    active[0].complete();
    await new Promise(resolve => setTimeout(resolve, 20));

    const { response, complete } = controlledResponse();
    const wrapped = await withStreamInflightLimit(() => Promise.resolve(response));
    assert.ok(wrapped, 'request after release succeeded');
    complete();

    // Clean up remaining
    for (const a of active.slice(1)) a.complete();
  });

  console.log('\n=== All concurrency gate tests passed ===');
}

run().then(
  () => { console.log('\nDone.'); },
  (err) => {
    console.error('\nTEST FAILURE:', err);
    process.exitCode = 1;
  },
);
