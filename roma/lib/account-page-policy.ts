import {
  readPolicyLimit,
  resolvePolicyFromEntitlementsSnapshot,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';

export type PageProductAction =
  | 'open_page'
  | 'save_page'
  | 'publish_page'
  | 'unpublish_page'
  | 'delete_page';

export type PageProductPolicyResult =
  | { ok: true; limit: number | null }
  | {
      ok: false;
      status: 402 | 500;
      payload:
        | {
            ok: false;
            kind: 'UPGRADE_REQUIRED';
            upgrade: { gate: 'pages.max'; action: PageProductAction; current: 0; limit: 0 };
          }
        | {
            error: {
              kind: 'UPSTREAM_UNAVAILABLE';
              reasonKey: 'roma.errors.policy.invalidEntitlement';
              detail: string;
            };
          };
    };

export function resolvePageProductPolicy(
  authz: RomaAccountAuthzCapsulePayload,
  action: PageProductAction,
): PageProductPolicyResult {
  try {
    const policy = resolvePolicyFromEntitlementsSnapshot({
      profile: authz.profile,
      role: authz.role,
      entitlements: authz.entitlements ?? null,
    });
    const limit = readPolicyLimit(policy, 'pages.max');
    return limit === 0
      ? {
          ok: false,
          status: 402,
          payload: {
            ok: false,
            kind: 'UPGRADE_REQUIRED',
            upgrade: { gate: 'pages.max', action, current: 0, limit: 0 },
          },
        }
      : { ok: true, limit };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      payload: {
        error: {
          kind: 'UPSTREAM_UNAVAILABLE',
          reasonKey: 'roma.errors.policy.invalidEntitlement',
          detail: error instanceof Error ? error.message : String(error),
        },
      },
    };
  }
}
