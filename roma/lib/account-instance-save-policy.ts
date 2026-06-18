import {
  evaluateLimits,
  resolvePolicyFromEntitlementsSnapshot,
  type LimitsSpec,
  type LimitContext,
  type Policy,
  type PolicyEntitlementsSnapshot,
  type PolicyProfile,
} from '@clickeen/ck-policy';

const SOCIAL_SHARE_ENTITLEMENT = 'widget.socialShare.enabled';
const SOCIAL_SHARE_PATH = 'behavior.socialShare.enabled';

type SavePolicyContext = {
  profile: PolicyProfile;
  role: Policy['role'];
  entitlements?: PolicyEntitlementsSnapshot | null;
};

type SavePolicyValidationResult =
  | { ok: true }
  | {
      ok: false;
      status: 422;
      error: {
        kind: 'VALIDATION';
        reasonKey: string;
        detail: string;
        paths: string[];
      };
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function socialShareRequested(config: Record<string, unknown>): boolean {
  const behavior = isRecord(config.behavior) ? config.behavior : {};
  const socialShare = isRecord(behavior.socialShare) ? behavior.socialShare : {};
  return socialShare.enabled === true;
}

export function validateAccountInstanceSavePolicy(args: {
  config: Record<string, unknown>;
  authz: SavePolicyContext;
  limits: LimitsSpec;
  context?: LimitContext;
}): SavePolicyValidationResult {
  const policy = resolvePolicyFromEntitlementsSnapshot({
    profile: args.authz.profile,
    role: args.authz.role,
    entitlements: args.authz.entitlements ?? null,
  });

  if (socialShareRequested(args.config) && policy.flags[SOCIAL_SHARE_ENTITLEMENT] !== true) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.upsell.reason.flagBlocked',
        detail: SOCIAL_SHARE_ENTITLEMENT,
        paths: [SOCIAL_SHARE_PATH],
      },
    };
  }

  const violations = evaluateLimits({
    config: args.config,
    limits: args.limits,
    policy,
    context: args.context ?? 'publish',
  });

  if (!violations.length) return { ok: true };

  const first = violations[0];
  return {
    ok: false,
    status: 422,
    error: {
      kind: 'VALIDATION',
      reasonKey: first.reasonKey,
      detail: first.detail ?? first.key,
      paths: Array.from(new Set(violations.map((violation) => violation.path))),
    },
  };
}
