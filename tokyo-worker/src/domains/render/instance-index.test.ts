import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../../types.ts';
import { readAccountInstanceIndex } from './instance-index.ts';

function createTestEnv(): Env {
  return {
    TOKYO_DEV_JWT: 'test',
    TOKYO_R2: {
      async get() {
        return null;
      },
    } as unknown as R2Bucket,
  } as Env;
}

test('missing account instance index is a valid empty account index', async () => {
  const result = await readAccountInstanceIndex({
    env: createTestEnv(),
    accountId: 'A1B2C3D4',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.entries, []);
  assert.equal(result.value.accountId, 'A1B2C3D4');
});
