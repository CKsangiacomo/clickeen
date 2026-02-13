import type { BudgetKey } from '@clickeen/ck-policy';
import type { Env } from './types';

export type BudgetScope =
  | { kind: 'workspace'; workspaceId: string }
  | { kind: 'account'; accountId: string }
  | { kind: 'minibob'; sessionKey: string }
  | { kind: 'anon'; fingerprint: string };

export type BudgetConsumeResult =
  | { ok: true; used: number; nextUsed: number }
  | { ok: false; used: number; max: number; reasonKey: 'coreui.upsell.reason.budgetExceeded'; detail: string };

function resolveStage(env: Env): string {
  const raw = typeof env.ENV_STAGE === 'string' ? env.ENV_STAGE.trim().toLowerCase() : '';
  return raw || 'cloud-dev';
}

function getUtcPeriodKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function requireUsageKv(env: Env): KVNamespace | null {
  if (env.USAGE_KV) return env.USAGE_KV;
  if (resolveStage(env) === 'local') return null;
  throw new Error('[ParisWorker] Missing USAGE_KV binding');
}

function scopeKey(scope: BudgetScope): string {
  if (scope.kind === 'workspace') return `ws:${scope.workspaceId}`;
  if (scope.kind === 'account') return `acct:${scope.accountId}`;
  if (scope.kind === 'minibob') return `minibob:${scope.sessionKey}`;
  return `anon:${scope.fingerprint}`;
}

function budgetCounterKey(args: { budgetKey: BudgetKey; periodKey: string; scope: BudgetScope }): string {
  return `usage.budget.v1.${args.budgetKey}.${args.periodKey}.${scopeKey(args.scope)}`;
}

async function readCounter(kv: KVNamespace, key: string): Promise<number> {
  const raw = await kv.get(key);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function currentUtcBudgetPeriodKey(now = new Date()): string {
  return getUtcPeriodKey(now);
}

export async function readBudgetUsed(args: { env: Env; scope: BudgetScope; budgetKey: BudgetKey; periodKey?: string }): Promise<number> {
  const kv = requireUsageKv(args.env);
  if (!kv) return 0;
  const periodKey = args.periodKey ?? getUtcPeriodKey(new Date());
  const key = budgetCounterKey({ budgetKey: args.budgetKey, periodKey, scope: args.scope });
  return readCounter(kv, key);
}

export async function consumeBudget(args: {
  env: Env;
  scope: BudgetScope;
  budgetKey: BudgetKey;
  max: number | null;
  amount?: number;
}): Promise<BudgetConsumeResult> {
  const amount = typeof args.amount === 'number' ? args.amount : 1;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('[ParisWorker] consumeBudget amount must be a positive finite number');
  }

  if (args.max == null) {
    const used = await readBudgetUsed({ env: args.env, scope: args.scope, budgetKey: args.budgetKey });
    return { ok: true, used, nextUsed: used + amount };
  }

  const max = Math.max(0, Math.floor(args.max));
  const kv = requireUsageKv(args.env);
  if (!kv) return { ok: true, used: 0, nextUsed: amount };

  const periodKey = getUtcPeriodKey(new Date());
  const key = budgetCounterKey({ budgetKey: args.budgetKey, periodKey, scope: args.scope });
  const used = await readCounter(kv, key);
  const nextUsed = used + amount;
  if (nextUsed > max) {
    return {
      ok: false,
      used,
      max,
      reasonKey: 'coreui.upsell.reason.budgetExceeded',
      detail: `${args.budgetKey} budget exceeded (max=${max})`,
    };
  }

  // Best-effort metering (KV is not atomic). Prefer slight undercount over breaking requests in pre-GA.
  await kv.put(key, String(nextUsed), { expirationTtl: 400 * 24 * 60 * 60 });
  return { ok: true, used, nextUsed };
}
