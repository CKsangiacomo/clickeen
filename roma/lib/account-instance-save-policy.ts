import {
  evaluateLimits,
  resolvePolicyFromEntitlementsSnapshot,
  type LimitsSpec,
  type LimitContext,
  type Policy,
  type PolicyEntitlementsSnapshot,
  type PolicyProfile,
} from '@clickeen/ck-policy';
import { validateWidgetLocaleSwitcherSettings } from '@clickeen/ck-contracts';

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
  if (args.media.type === 'none') {
    if (Object.prototype.hasOwnProperty.call(args.media, 'image') || Object.prototype.hasOwnProperty.call(args.media, 'video')) {
      return structureViolation({
        detail: `${args.widgetLabel} empty media fill must not include image or video data.`,
        paths: [`${args.path}.image`, `${args.path}.video`],
      });
    }
    return { ok: true };
  }
  if (args.media.type !== 'image' && args.media.type !== 'video') {
    return structureViolation({
      detail: `${args.widgetLabel} requires none, image, or video media fill.`,
      paths: [`${args.path}.type`],
    });
  }
  if (!isRecord(args.media[args.media.type])) {
    return structureViolation({
      detail: `${args.widgetLabel} media fill is missing its ${args.media.type} bucket.`,
      paths: [`${args.path}.${args.media.type}`],
    });
  }
  const bucket = args.media[args.media.type];
  if (isRecord(bucket)) {
    const src = typeof bucket.src === 'string' ? bucket.src.trim() : '';
    const assetRef = typeof bucket.assetRef === 'string' ? bucket.assetRef.trim() : '';
    if (!src && !assetRef) {
      return structureViolation({
        detail: `${args.widgetLabel} media fill requires a source or asset reference.`,
        paths: [`${args.path}.${args.media.type}.src`, `${args.path}.${args.media.type}.assetRef`],
      });
    }
  }
  return { ok: true };
}

function validateEnum(args: {
  widgetLabel: string;
  value: unknown;
  path: string;
  values: string[];
}): SavePolicyValidationResult {
  if (typeof args.value !== 'string' || !args.values.includes(args.value)) {
    return structureViolation({
      detail: `${args.widgetLabel} ${args.path} must be one of: ${args.values.join(', ')}.`,
      paths: [args.path],
    });
  }
  return { ok: true };
}

function validateBoolean(args: {
  widgetLabel: string;
  value: unknown;
  path: string;
}): SavePolicyValidationResult {
  if (typeof args.value !== 'boolean') {
    return structureViolation({
      detail: `${args.widgetLabel} ${args.path} must be a boolean.`,
      paths: [args.path],
    });
  }
  return { ok: true };
}

function validateNumberRange(args: {
  widgetLabel: string;
  value: unknown;
  path: string;
  min: number;
  max: number;
}): SavePolicyValidationResult {
  if (
    typeof args.value !== 'number' ||
    !Number.isFinite(args.value) ||
    args.value < args.min ||
    args.value > args.max
  ) {
    return structureViolation({
      detail: `${args.widgetLabel} ${args.path} must be ${args.min}..${args.max}.`,
      paths: [args.path],
    });
  }
  return { ok: true };
}

function validateCardWrapper(args: {
  widgetLabel: string;
  cardwrapper: unknown;
  path: string;
}): SavePolicyValidationResult {
  const cardwrapper = isRecord(args.cardwrapper) ? args.cardwrapper : null;
  if (!cardwrapper) {
    return structureViolation({
      detail: `${args.widgetLabel} requires visual frame settings.`,
      paths: [args.path],
    });
  }
  const requiredBooleans = ['radiusLinked'];
  for (const key of requiredBooleans) {
    if (typeof cardwrapper[key] !== 'boolean') {
      return structureViolation({
        detail: `${args.widgetLabel} ${args.path}.${key} must be a boolean.`,
        paths: [`${args.path}.${key}`],
      });
    }
  }
  const requiredStrings = ['radius', 'radiusTL', 'radiusTR', 'radiusBR', 'radiusBL'];
  for (const key of requiredStrings) {
    if (typeof cardwrapper[key] !== 'string' || !cardwrapper[key]) {
      return structureViolation({
        detail: `${args.widgetLabel} ${args.path}.${key} must be a string.`,
        paths: [`${args.path}.${key}`],
      });
    }
  }
  const border = isRecord(cardwrapper.border) ? cardwrapper.border : null;
  if (!border) {
    return structureViolation({
      detail: `${args.widgetLabel} requires visual frame border settings.`,
      paths: [`${args.path}.border`],
    });
  }
  if (typeof border.enabled !== 'boolean' || typeof border.width !== 'number' || typeof border.color !== 'string') {
    return structureViolation({
      detail: `${args.widgetLabel} visual frame border is invalid.`,
      paths: [`${args.path}.border`],
    });
  }
  const shadow = isRecord(cardwrapper.shadow) ? cardwrapper.shadow : null;
  if (!shadow) {
    return structureViolation({
      detail: `${args.widgetLabel} requires visual frame shadow settings.`,
      paths: [`${args.path}.shadow`],
    });
  }
  if (
    typeof shadow.enabled !== 'boolean' ||
    typeof shadow.inset !== 'boolean' ||
    typeof shadow.x !== 'number' ||
    typeof shadow.y !== 'number' ||
    typeof shadow.blur !== 'number' ||
    typeof shadow.spread !== 'number' ||
    typeof shadow.alpha !== 'number' ||
    typeof shadow.color !== 'string'
  ) {
    return structureViolation({
      detail: `${args.widgetLabel} visual frame shadow is invalid.`,
      paths: [`${args.path}.shadow`],
    });
  }
  if (shadow.alpha < 0 || shadow.alpha > 100) {
    return structureViolation({
      detail: `${args.widgetLabel} visual frame shadow alpha must be 0..100.`,
      paths: [`${args.path}.shadow.alpha`],
    });
  }
  return { ok: true };
}

function validateLogoAssetMetadata(args: {
  asset: unknown;
  path: string;
}): SavePolicyValidationResult {
  if (!isRecord(args.asset)) {
    return structureViolation({
      detail: 'Logo asset metadata must be an object.',
      paths: [args.path],
    });
  }
  const allowed = new Set(['assetRef', 'name', 'source']);
  const extra = Object.keys(args.asset).find((key) => !allowed.has(key));
  if (extra) {
    return structureViolation({
      detail: 'Logo asset metadata contains unsupported fields.',
      paths: [`${args.path}.${extra}`],
    });
  }
  const assetRef = typeof args.asset.assetRef === 'string' ? args.asset.assetRef : '';
  if (!assetRef || assetRef !== assetRef.trim()) {
    return structureViolation({
      detail: 'Logo asset metadata requires an asset reference.',
      paths: [`${args.path}.assetRef`],
    });
  }
  if (args.asset.name != null && typeof args.asset.name !== 'string') {
    return structureViolation({
      detail: 'Logo asset metadata name must be a string.',
      paths: [`${args.path}.name`],
    });
  }
  if (args.asset.source != null && typeof args.asset.source !== 'string') {
    return structureViolation({
      detail: 'Logo asset metadata source must be a string.',
      paths: [`${args.path}.source`],
    });
  }
  return { ok: true };
}

function validateLogoShowcaseStructure(config: Record<string, unknown>): SavePolicyValidationResult {
  const logoshowcase = isRecord(config.logoshowcase) ? config.logoshowcase : null;
  const strips = Array.isArray(logoshowcase?.strips) ? logoshowcase.strips : [];
  for (let stripIndex = 0; stripIndex < strips.length; stripIndex += 1) {
    const strip = strips[stripIndex];
    const logos = isRecord(strip) && Array.isArray(strip.logos) ? strip.logos : [];
    for (let logoIndex = 0; logoIndex < logos.length; logoIndex += 1) {
      const logo = logos[logoIndex];
      if (!isRecord(logo) || !Object.prototype.hasOwnProperty.call(logo, 'asset')) continue;
      const gate = validateLogoAssetMetadata({
        asset: logo.asset,
        path: `logoshowcase.strips.${stripIndex}.logos.${logoIndex}.asset`,
      });
      if (!gate.ok) return gate;
    }
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
    if (typeof item.alt !== 'string') {
      return structureViolation({
        detail: `split-carousel-media item ${index + 1} requires alt text.`,
        paths: [`${itemPath}.alt`],
      });
    }

    const mediaGate = validateMediaFill({
      widgetLabel: `split-carousel-media item ${index + 1}`,
      media: item.media,
      path: `${itemPath}.media`,
    });
    if (!mediaGate.ok) return mediaGate;
  }

  const media = isRecord(splitCarouselMedia?.media) ? splitCarouselMedia.media : null;
  const fitGate = validateEnum({
    widgetLabel: 'split-carousel-media',
    value: media?.fit,
    path: 'splitCarouselMedia.media.fit',
    values: ['cover', 'contain'],
  });
  if (!fitGate.ok) return fitGate;
  const positionGate = validateEnum({
    widgetLabel: 'split-carousel-media',
    value: media?.position,
    path: 'splitCarouselMedia.media.position',
    values: ['top', 'bottom', 'left', 'right', 'center'],
  });
  if (!positionGate.ok) return positionGate;

  const carousel = isRecord(splitCarouselMedia?.carousel) ? splitCarouselMedia.carousel : null;
  const transitionGate = validateEnum({
    widgetLabel: 'split-carousel-media',
    value: carousel?.transition,
    path: 'splitCarouselMedia.carousel.transition',
    values: ['slide', 'fade'],
  });
  if (!transitionGate.ok) return transitionGate;
  const autoplayGate = validateBoolean({
    widgetLabel: 'split-carousel-media',
    value: carousel?.autoplay,
    path: 'splitCarouselMedia.carousel.autoplay',
  });
  if (!autoplayGate.ok) return autoplayGate;
  const intervalGate = validateNumberRange({
    widgetLabel: 'split-carousel-media',
    value: carousel?.intervalMs,
    path: 'splitCarouselMedia.carousel.intervalMs',
    min: 2000,
    max: 12000,
  });
  if (!intervalGate.ok) return intervalGate;
  for (const key of ['loop', 'showArrows', 'showDots']) {
    const gate = validateBoolean({
      widgetLabel: 'split-carousel-media',
      value: carousel?.[key],
      path: `splitCarouselMedia.carousel.${key}`,
    });
    if (!gate.ok) return gate;
  }

  return validateCardWrapper({
    widgetLabel: 'split-carousel-media',
    cardwrapper: isRecord(splitCarouselMedia?.appearance) ? splitCarouselMedia.appearance.cardwrapper : null,
    path: 'splitCarouselMedia.appearance.cardwrapper',
  });
}

function validateSplitMediaStructure(config: Record<string, unknown>): SavePolicyValidationResult {
  const splitMedia = isRecord(config.splitMedia) ? config.splitMedia : null;
  const mediaGate = validateMediaFill({
    widgetLabel: 'split-media',
    media: splitMedia?.media,
    path: 'splitMedia.media',
  });
  if (!mediaGate.ok) return mediaGate;
  const fitGate = validateEnum({
    widgetLabel: 'split-media',
    value: splitMedia?.fit,
    path: 'splitMedia.fit',
    values: ['cover', 'contain'],
  });
  if (!fitGate.ok) return fitGate;
  const positionGate = validateEnum({
    widgetLabel: 'split-media',
    value: splitMedia?.position,
    path: 'splitMedia.position',
    values: ['top', 'bottom', 'left', 'right', 'center'],
  });
  if (!positionGate.ok) return positionGate;
  return validateCardWrapper({
    widgetLabel: 'split-media',
    cardwrapper: isRecord(splitMedia?.appearance) ? splitMedia.appearance.cardwrapper : null,
    path: 'splitMedia.appearance.cardwrapper',
  });
}

export function validateAccountInstanceConfigStructure(args: {
  widgetType: string;
  config: Record<string, unknown>;
}): SavePolicyValidationResult {
  const localeSwitcherIssue = validateWidgetLocaleSwitcherSettings(args.config.localeSwitcher);
  if (localeSwitcherIssue) return structureViolation({ reasonKey: localeSwitcherIssue.reasonKey, detail: localeSwitcherIssue.detail, paths: [localeSwitcherIssue.path] });
  if (args.widgetType === 'split-carousel-media') {
    return validateSplitCarouselMediaStructure(args.config);
  }
  if (args.widgetType === 'split-media') {
    return validateSplitMediaStructure(args.config);
  }
  if (args.widgetType === 'logoshowcase') {
    return validateLogoShowcaseStructure(args.config);
  }
  return { ok: true };
}

export function validateAccountInstanceSavePolicy(args: {
  widgetType?: string;
  config: Record<string, unknown>;
  authz: SavePolicyContext;
  limits: LimitsSpec;
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
