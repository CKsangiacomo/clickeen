import { resolvePolicy } from '@clickeen/ck-policy';
import type { Policy, PolicyProfile } from '@clickeen/ck-policy';
import type { WorkspaceRow } from './types';
import { ckError } from './errors';

export function resolveEditorPolicyFromRequest(req: Request, workspace: WorkspaceRow) {
  const url = new URL(req.url);
  const subject = (url.searchParams.get('subject') || '').trim().toLowerCase();

  let profile: PolicyProfile;
  let role: Policy['role'];

  if (subject === 'devstudio') {
    profile = 'devstudio';
    role = 'owner';
  } else if (subject === 'minibob') {
    profile = 'minibob';
    role = 'editor';
  } else if (subject === 'workspace') {
    profile = workspace.tier;
    role = 'editor';
  } else {
    return { ok: false as const, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.subject.invalid' }, 422) };
  }

  const policy = resolvePolicy({ profile, role });
  return { ok: true as const, policy, profile };
}

export function resolveWebsiteDepthCap(policy: Policy): number {
  const depth = policy?.limits?.personalization?.websiteDepth ?? 1;
  if (typeof depth !== 'number' || !Number.isFinite(depth) || depth < 1) return 1;
  return Math.min(Math.max(1, Math.floor(depth)), 5);
}

export function isFlagEnabled(policy: Policy, key: string): boolean {
  const flags = policy?.flags;
  if (!flags || typeof flags !== 'object') return false;
  return Boolean((flags as Record<string, unknown>)[key]);
}
