import type { BudgetKey } from '@clickeen/ck-policy';
import { getRequestContext } from '@cloudflare/next-on-pages';

type RomaKv = {
  get(key: string): Promise<string | null>;
};

const STORAGE_BYTES_BUDGET_KEY = 'budget.uploads.bytes';
const ACCOUNT_STORAGE_USAGE_PREFIX = 'usage.storage.v1';

function budgetCounterKey(accountId: string, budgetKey: BudgetKey, periodKey: string): string {
  return `usage.budget.v1.${budgetKey}.${periodKey}.acct:${accountId}`;
}

function storageBudgetCounterKey(accountId: string, budgetKey: BudgetKey): string {
  return `${ACCOUNT_STORAGE_USAGE_PREFIX}.${budgetKey}.acct:${accountId}`;
}

function currentBudgetPeriodKey(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function requireUsageKv(): RomaKv {
  const env = getRequestContext().env as { USAGE_KV?: RomaKv };
  if (env.USAGE_KV) return env.USAGE_KV;
  throw new Error('[Roma] Missing USAGE_KV binding');
}

export async function readAccountBudgetUsed(accountId: string, budgetKey: BudgetKey): Promise<number> {
  const counterKey =
    budgetKey === STORAGE_BYTES_BUDGET_KEY
      ? storageBudgetCounterKey(accountId, budgetKey)
      : budgetCounterKey(accountId, budgetKey, currentBudgetPeriodKey());
  const raw = await requireUsageKv().get(counterKey);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}
