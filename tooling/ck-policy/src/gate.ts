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

function assertCap(policy: Policy, capKey: keyof Policy['caps'], current: number) {
  const max = policy.caps[capKey];
  if (max == null) return null;
  if (current < max) return null;
  return {
    allow: false,
    upsell: 'UP',
    reasonKey: 'coreui.upsell.reason.capReached',
    detail: `${String(capKey)} reached (max=${max}).`,
  } as const;
}

export function can(policy: Policy, actionKey: ActionKey, payload?: unknown): GateDecision {
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
      if (policy.flags['context.websiteUrl.enabled'] !== true) {
        return { allow: false, upsell: 'UP', reasonKey: 'coreui.upsell.reason.context.websiteUrl' };
      }
      return { allow: true };
    }
    case 'embed.seoGeo.toggle': {
      if (policy.flags['embed.seoGeo.enabled'] !== true) {
        return { allow: false, upsell: 'UP', reasonKey: 'coreui.upsell.reason.embed.seoGeo' };
      }
      return { allow: true };
    }
    case 'platform.upload': {
      if (policy.flags['platform.uploads.enabled'] !== true) {
        return { allow: false, upsell: 'UP', reasonKey: 'coreui.upsell.reason.platform.uploads' };
      }
      // Uploads are gated via budgets; use canConsume/consume for enforcement.
      return { allow: true };
    }
    case 'widget.faq.section.add': {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('[ck-policy] widget.faq.section.add requires payload: { currentSections: number }');
      }
      const { currentSections } = payload as { currentSections?: unknown };
      if (typeof currentSections !== 'number' || !Number.isFinite(currentSections) || currentSections < 0) {
        throw new Error('[ck-policy] widget.faq.section.add requires payload.currentSections as a non-negative number');
      }
      const deny = assertCap(policy, 'widget.faq.sections.max', currentSections);
      if (deny) return deny;
      return { allow: true };
    }
    case 'widget.faq.qa.add': {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error(
          '[ck-policy] widget.faq.qa.add requires payload: { currentQaInSection: number; currentQaTotal: number }'
        );
      }
      const { currentQaInSection, currentQaTotal } = payload as {
        currentQaInSection?: unknown;
        currentQaTotal?: unknown;
      };
      if (typeof currentQaInSection !== 'number' || !Number.isFinite(currentQaInSection) || currentQaInSection < 0) {
        throw new Error('[ck-policy] widget.faq.qa.add requires payload.currentQaInSection as a non-negative number');
      }
      if (typeof currentQaTotal !== 'number' || !Number.isFinite(currentQaTotal) || currentQaTotal < 0) {
        throw new Error('[ck-policy] widget.faq.qa.add requires payload.currentQaTotal as a non-negative number');
      }
      const denyTotal = assertCap(policy, 'widget.faq.qa.max', currentQaTotal);
      if (denyTotal) return denyTotal;
      const denyPerSection = assertCap(policy, 'widget.faq.qaPerSection.max', currentQaInSection);
      if (denyPerSection) return denyPerSection;
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

  if (budgetKey === 'platform.uploads.files' && policy.flags['platform.uploads.enabled'] !== true) {
    return {
      ok: false,
      upsell: 'UP',
      reasonKey: 'coreui.upsell.reason.platform.uploads',
      detail: 'Uploads are disabled for this policy.',
    };
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
