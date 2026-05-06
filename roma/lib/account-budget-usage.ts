import type { BudgetKey } from '@clickeen/ck-policy';

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

function budgetCounterKey(accountId: string, budgetKey: BudgetKey, periodKey: string): string {
  return `usage.budget.v1.${budgetKey}.${periodKey}.acct:${accountId}`;
}

function currentBudgetPeriodKey(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function secondsUntilNextBudgetPeriod(now = new Date()): number {
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return Math.max(1, Math.ceil((nextMonth.getTime() - now.getTime()) / 1000) + 172_800);
}

export async function readAccountBudgetUsed(
  accountId: string,
  budgetKey: BudgetKey,
  usageKv: RomaUsageKv | null | undefined,
): Promise<number> {
  const counterKey = budgetCounterKey(accountId, budgetKey, currentBudgetPeriodKey());
  if (!usageKv) {
    throw new Error('[Roma] Missing USAGE_KV binding');
  }
  const raw = await usageKv.get(counterKey);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

export async function reserveAccountBudgetUse(args: {
  accountId: string;
  budgetKey: BudgetKey;
  max: number | null;
  usageKv: RomaUsageKv | null | undefined;
  amount?: number;
}): Promise<{ ok: true; used: number } | { ok: false; used: number }> {
  if (!args.usageKv) {
    throw new Error('[Roma] Missing USAGE_KV binding');
  }
  const amount = Math.max(1, Math.trunc(args.amount ?? 1));
  const periodKey = currentBudgetPeriodKey();
  const counterKey = budgetCounterKey(args.accountId, args.budgetKey, periodKey);
  const current = await readAccountBudgetUsed(args.accountId, args.budgetKey, args.usageKv);
  if (args.max != null && current + amount > args.max) {
    return { ok: false, used: current };
  }
  const nextUsed = current + amount;
  await args.usageKv.put(counterKey, String(nextUsed), { expirationTtl: secondsUntilNextBudgetPeriod() });
  return { ok: true, used: nextUsed };
}
