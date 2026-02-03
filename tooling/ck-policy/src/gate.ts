import type { ActionKey, BudgetKey } from './registry';
import type { Policy } from './types';

export type GateDecision =
  | { allow: true }
  | { allow: false; upsell: 'UP'; reasonKey: string; detail?: string };

export type BudgetDecision =
  | { ok: true; nextUsed: number }
  | { ok: false; upsell: 'UP'; reasonKey: string; detail?: string };

function assertEditorRole(policy: Policy) {
  if (policy.role === 'viewer') {
    return {
      allow: false,
      upsell: 'UP',
      reasonKey: 'coreui.upsell.reason.role.editorRequired',
      detail: 'This action requires an editor role.',
    } as const;
  }
  return null;
}

export function can(policy: Policy, actionKey: ActionKey, _payload?: unknown): GateDecision {
  const editorDeny = assertEditorRole(policy);
  if (editorDeny) return editorDeny;

  switch (actionKey) {
    case 'instance.create': {
      if (policy.profile === 'minibob') {
        return { allow: false, upsell: 'UP', reasonKey: 'coreui.upsell.reason.minibob.createAccount' };
      }
      return { allow: true };
    }
    case 'instance.publish': {
      if (policy.profile === 'minibob') {
        return { allow: false, upsell: 'UP', reasonKey: 'coreui.upsell.reason.minibob.createAccount' };
      }
      return { allow: true };
    }
    case 'context.websiteUrl.set': {
      return { allow: true };
    }
    case 'embed.seoGeo.toggle': {
      return { allow: true };
    }
    case 'platform.upload': {
      const uploadBudget = policy.budgets['budget.uploads.count'];
      if (uploadBudget && uploadBudget.max === 0) {
        return { allow: false, upsell: 'UP', reasonKey: 'coreui.upsell.reason.platform.uploads' };
      }
      return { allow: true };
    }
    case 'widget.faq.section.add': {
      return { allow: true };
    }
    case 'widget.faq.qa.add': {
      return { allow: true };
    }
    default: {
      const exhaustive: never = actionKey;
      throw new Error(`[ck-policy] Unhandled actionKey: ${exhaustive}`);
    }
  }
}

export function canConsume(policy: Policy, budgetKey: BudgetKey, amount = 1): BudgetDecision {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('[ck-policy] canConsume amount must be a positive finite number');
  }

  const budget = policy.budgets[budgetKey];
  if (!budget) {
    throw new Error(`[ck-policy] Policy is missing budget key: ${budgetKey}`);
  }

  if (budget.max == null) return { ok: true, nextUsed: budget.used + amount };
  if (budget.used + amount <= budget.max) return { ok: true, nextUsed: budget.used + amount };

  return {
    ok: false,
    upsell: 'UP',
    reasonKey: 'coreui.upsell.reason.budgetExceeded',
    detail: `${String(budgetKey)} budget exceeded (max=${budget.max}).`,
  };
}

export function consume(policy: Policy, budgetKey: BudgetKey, amount = 1): Policy {
  const decision = canConsume(policy, budgetKey, amount);
  if (!decision.ok) {
    throw new Error(`[ck-policy] Budget denied: ${budgetKey}`);
  }
  const next = structuredClone(policy) as Policy;
  next.budgets[budgetKey].used = decision.nextUsed;
  return next;
}
