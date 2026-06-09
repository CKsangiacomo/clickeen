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

function structureViolation(args: {
  reasonKey?: string;
  detail: string;
  paths: string[];
}): SavePolicyValidationResult {
  return {
    ok: false,
    status: 422,
    error: {
      kind: 'VALIDATION',
      reasonKey: args.reasonKey ?? 'coreui.errors.widget.structureInvalid',
      detail: args.detail,
      paths: args.paths,
    },
  };
}

function validateMediaFill(args: {
  widgetLabel: string;
  media: unknown;
  path: string;
}): SavePolicyValidationResult {
  if (!isRecord(args.media)) {
    return structureViolation({
      detail: `${args.widgetLabel} requires media fill.`,
      paths: [args.path],
    });
  }
  if (Object.prototype.hasOwnProperty.call(args.media, 'kind')) {
    return structureViolation({
      detail: `${args.widgetLabel} media must use fill.type, not media.kind.`,
      paths: [`${args.path}.kind`],
    });
  }
  if (args.media.type !== 'image' && args.media.type !== 'video') {
    return structureViolation({
      detail: `${args.widgetLabel} requires image or video media fill.`,
      paths: [`${args.path}.type`],
    });
  }
  if (!isRecord(args.media[args.media.type])) {
    return structureViolation({
      detail: `${args.widgetLabel} media fill is missing its ${args.media.type} bucket.`,
      paths: [`${args.path}.${args.media.type}`],
    });
  }
  return { ok: true };
}

function validateSplitCarouselMediaStructure(config: Record<string, unknown>): SavePolicyValidationResult {
  const splitCarouselMedia = isRecord(config.splitCarouselMedia) ? config.splitCarouselMedia : null;
  const items = Array.isArray(splitCarouselMedia?.items) ? splitCarouselMedia.items : null;
  if (!items) {
    return structureViolation({
      detail: 'split-carousel-media requires splitCarouselMedia.items.',
      paths: ['splitCarouselMedia.items'],
    });
  }
  if (items.length < 2 || items.length > 6) {
    return structureViolation({
      detail: `split-carousel-media requires 2-6 visuals; received ${items.length}.`,
      paths: ['splitCarouselMedia.items'],
    });
  }

  const ids = new Set<string>();
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const itemPath = `splitCarouselMedia.items.${index}`;
    if (!isRecord(item)) {
      return structureViolation({
        detail: `split-carousel-media item ${index + 1} must be an object.`,
        paths: [itemPath],
      });
    }
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!id || ids.has(id)) {
      return structureViolation({
        detail: `split-carousel-media item ${index + 1} requires a unique stable id.`,
        paths: [`${itemPath}.id`],
      });
    }
    ids.add(id);

    const mediaGate = validateMediaFill({
      widgetLabel: `split-carousel-media item ${index + 1}`,
      media: item.media,
      path: `${itemPath}.media`,
    });
    if (!mediaGate.ok) return mediaGate;
  }

  return { ok: true };
}

function validateSplitMediaStructure(config: Record<string, unknown>): SavePolicyValidationResult {
  const splitMedia = isRecord(config.splitMedia) ? config.splitMedia : null;
  return validateMediaFill({
    widgetLabel: 'split-media',
    media: splitMedia?.media,
    path: 'splitMedia.media',
  });
}

export function validateAccountInstanceConfigStructure(args: {
  widgetType: string;
  config: Record<string, unknown>;
}): SavePolicyValidationResult {
  if (args.widgetType === 'split-carousel-media') {
    return validateSplitCarouselMediaStructure(args.config);
  }
  if (args.widgetType === 'split-media') {
    return validateSplitMediaStructure(args.config);
  }
  return { ok: true };
}

export function validateAccountInstanceSavePolicy(args: {
  widgetType?: string;
  config: Record<string, unknown>;
  authz: SavePolicyContext;
  limits?: LimitsSpec | null;
  context?: LimitContext;
}): SavePolicyValidationResult {
  if (args.widgetType) {
    const structureGate = validateAccountInstanceConfigStructure({
      widgetType: args.widgetType,
      config: args.config,
    });
    if (!structureGate.ok) return structureGate;
  }

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
    limits: args.limits ?? null,
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
