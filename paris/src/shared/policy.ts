import { resolvePolicy } from '@clickeen/ck-policy';
import type { Policy, PolicyProfile } from '@clickeen/ck-policy';
import type { WorkspaceRow } from './types';
import { ckError } from './errors';

export function resolveEditorPolicyFromRequest(req: Request, workspace: WorkspaceRow) {
  const url = new URL(req.url);
  const subject = (url.searchParams.get('subject') || '').trim().toLowerCase();

  let profile: PolicyProfile;
  let role: Policy['role'];

  if (subject === 'minibob') {
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
