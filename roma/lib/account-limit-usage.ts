export type RomaUsageKv = {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: {
      expirationTtl?: number;
    },
  ): Promise<void>;
};

function copilotTurnCounterKey(accountId: string, periodKey: string): string {
  return `usage.limit.copilot.turns.monthly.max.${periodKey}.acct:${accountId}`;
}

function currentLimitPeriodKey(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function secondsUntilNextLimitPeriod(now = new Date()): number {
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return Math.max(1, Math.ceil((nextMonth.getTime() - now.getTime()) / 1000) + 172_800);
}

async function readCopilotTurnsUsed(
  counterKey: string,
  usageKv: RomaUsageKv,
): Promise<number> {
  const raw = await usageKv.get(counterKey);
  if (raw === null) return 0;
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) {
    throw new Error(`[Roma] Invalid USAGE_KV counter: ${counterKey}`);
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`[Roma] Invalid USAGE_KV counter: ${counterKey}`);
  }
  return parsed;
}

export async function reserveAccountCopilotTurn(args: {
  accountId: string;
  max: number | null;
  usageKv: RomaUsageKv | null | undefined;
}): Promise<{ ok: true; used: number } | { ok: false; used: number }> {
  if (!args.usageKv) {
    throw new Error('[Roma] Missing USAGE_KV binding');
  }
  const periodKey = currentLimitPeriodKey();
  const counterKey = copilotTurnCounterKey(args.accountId, periodKey);
  const current = await readCopilotTurnsUsed(counterKey, args.usageKv);
  if (args.max != null && current + 1 > args.max) {
    return { ok: false, used: current };
  }
  const nextUsed = current + 1;
  await args.usageKv.put(counterKey, String(nextUsed), { expirationTtl: secondsUntilNextLimitPeriod() });
  return { ok: true, used: nextUsed };
}
