import type { PlanLimitKey } from '@clickeen/ck-policy';

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

function limitCounterKey(accountId: string, limitKey: PlanLimitKey, periodKey: string): string {
  return `usage.limit.${limitKey}.${periodKey}.acct:${accountId}`;
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

export async function readAccountLimitUsed(
  accountId: string,
  limitKey: PlanLimitKey,
  usageKv: RomaUsageKv | null | undefined,
): Promise<number> {
  const counterKey = limitCounterKey(accountId, limitKey, currentLimitPeriodKey());
  if (!usageKv) {
    throw new Error('[Roma] Missing USAGE_KV binding');
  }
  const raw = await usageKv.get(counterKey);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

export async function reserveAccountLimitUse(args: {
  accountId: string;
  limitKey: PlanLimitKey;
  max: number | null;
  usageKv: RomaUsageKv | null | undefined;
  amount?: number;
}): Promise<{ ok: true; used: number } | { ok: false; used: number }> {
  if (!args.usageKv) {
    throw new Error('[Roma] Missing USAGE_KV binding');
  }
  const amount = Math.max(1, Math.trunc(args.amount ?? 1));
  const periodKey = currentLimitPeriodKey();
  const counterKey = limitCounterKey(args.accountId, args.limitKey, periodKey);
  const current = await readAccountLimitUsed(args.accountId, args.limitKey, args.usageKv);
  if (args.max != null && current + amount > args.max) {
    return { ok: false, used: current };
  }
  const nextUsed = current + amount;
  await args.usageKv.put(counterKey, String(nextUsed), { expirationTtl: secondsUntilNextLimitPeriod() });
  return { ok: true, used: nextUsed };
}
