import assert from 'node:assert/strict';
import { reserveAccountCopilotTurn, type RomaUsageKv } from '../lib/account-limit-usage';

function usageKv(raw: string | null): {
  kv: RomaUsageKv;
  reads: string[];
  writes: Array<{ key: string; value: string }>;
} {
  const reads: string[] = [];
  const writes: Array<{ key: string; value: string }> = [];
  return {
    reads,
    writes,
    kv: {
      async get(key) {
        reads.push(key);
        return raw;
      },
      async put(key, value) {
        writes.push({ key, value });
      },
    },
  };
}

async function main(): Promise<void> {
  const accepted = usageKv('19');
  assert.deepEqual(
    await reserveAccountCopilotTurn({ accountId: 'CLICKEEN', max: 20, usageKv: accepted.kv }),
    { ok: true, used: 20 },
  );
  assert.equal(accepted.writes.length, 1);
  assert.equal(accepted.reads[0], accepted.writes[0]?.key);
  assert.equal(accepted.writes[0]?.value, '20');

  const denied = usageKv('20');
  assert.deepEqual(
    await reserveAccountCopilotTurn({ accountId: 'CLICKEEN', max: 20, usageKv: denied.kv }),
    { ok: false, used: 20 },
  );
  assert.equal(denied.writes.length, 0);

  const unlimited = usageKv('20');
  assert.deepEqual(
    await reserveAccountCopilotTurn({ accountId: 'CLICKEEN', max: null, usageKv: unlimited.kv }),
    { ok: true, used: 21 },
  );

  for (const raw of ['', ' ', '01', '1e2', '-1', '1.0', '+1']) {
    await assert.rejects(
      reserveAccountCopilotTurn({ accountId: 'CLICKEEN', max: 20, usageKv: usageKv(raw).kv }),
      /Invalid USAGE_KV counter/,
    );
  }

  await assert.rejects(
    reserveAccountCopilotTurn({ accountId: 'CLICKEEN', max: 20, usageKv: null }),
    /Missing USAGE_KV binding/,
  );
}

void main();
