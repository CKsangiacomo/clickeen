import type { ActionKey } from './registry';
import type { Policy } from './types';

export type GateDecision =
  | { allow: true }
  | { allow: false; upsell: 'UP'; reasonKey: string; detail?: string };

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
      return { allow: true };
    }
    case 'instance.update': {
      return { allow: true };
    }
    default: {
      const exhaustive: never = actionKey;
      throw new Error(`[ck-policy] Unhandled actionKey: ${exhaustive}`);
    }
  }
}
