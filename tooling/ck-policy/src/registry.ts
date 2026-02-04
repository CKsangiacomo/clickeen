import { getEntitlementsMatrix } from './matrix';

const matrix = getEntitlementsMatrix();

// Keep in sync with config/entitlements.matrix.json (registry is the typed source of truth).
export const CAPABILITY_KEYS = [
  'l10n.locales.max',
  'l10n.locales.custom.max',
  'l10n.versions.max',
  'personalization.sources.website.depth.max',
  'branding.remove',
  'budget.copilot.turns',
  'budget.uploads.count',
  'budget.uploads.bytes',
  'budget.personalization.runs',
  'budget.personalization.website.crawls',
  'budget.snapshots.regens',
  'budget.l10n.publishes',
  'views.monthly.max',
  'instances.published.max',
  'widgets.types.max',
  'uploads.size.max',
  'cap.group.items.small.max',
  'cap.group.items.medium.max',
  'cap.group.items.large.max',
] as const;
export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

export const FLAG_KEYS = [
  'branding.remove',
] as const satisfies readonly CapabilityKey[];
export type FlagKey = (typeof FLAG_KEYS)[number];

export const CAP_KEYS = [
  'l10n.locales.max',
  'l10n.locales.custom.max',
  'l10n.versions.max',
  'personalization.sources.website.depth.max',
  'views.monthly.max',
  'instances.published.max',
  'widgets.types.max',
  'uploads.size.max',
  'cap.group.items.small.max',
  'cap.group.items.medium.max',
  'cap.group.items.large.max',
] as const satisfies readonly CapabilityKey[];
export type CapKey = (typeof CAP_KEYS)[number];

export const BUDGET_KEYS = [
  'budget.copilot.turns',
  'budget.uploads.count',
  'budget.uploads.bytes',
  'budget.personalization.runs',
  'budget.personalization.website.crawls',
  'budget.snapshots.regens',
  'budget.l10n.publishes',
] as const satisfies readonly CapabilityKey[];
export type BudgetKey = (typeof BUDGET_KEYS)[number];

export const ENTITLEMENT_KEYS = CAPABILITY_KEYS;

export type CapabilityMeta = {
  label: string;
  description: string;
};

export const CAPABILITY_META: Record<CapabilityKey, CapabilityMeta> = {
  'l10n.locales.max': {
    label: 'Max locales',
    description: 'Maximum locale overlays per widget (total, including EN).',
  },
  'l10n.locales.custom.max': {
    label: 'Max custom locales',
    description: 'Maximum user-selectable locales per widget (excluding EN).',
  },
  'l10n.versions.max': {
    label: 'Max l10n versions',
    description: 'Maximum overlay versions retained.',
  },
  'personalization.sources.website.depth.max': {
    label: 'Website crawl depth',
    description: 'Maximum website crawl depth for personalization.',
  },
  'branding.remove': {
    label: 'Remove branding',
    description: 'Allow removing Clickeen branding.',
  },
  'budget.copilot.turns': {
    label: 'Copilot turns',
    description: 'Monthly AI copilot turns.',
  },
  'budget.uploads.count': {
    label: 'Uploads',
    description: 'Monthly uploads budget (count).',
  },
  'budget.uploads.bytes': {
    label: 'Upload bytes',
    description: 'Monthly uploads budget (bytes).',
  },
  'budget.personalization.runs': {
    label: 'Personalization runs',
    description: 'Monthly personalization runs budget.',
  },
  'budget.personalization.website.crawls': {
    label: 'Website crawls',
    description: 'Monthly website crawls budget.',
  },
  'budget.snapshots.regens': {
    label: 'Snapshot regenerations',
    description: 'Monthly snapshot regeneration budget.',
  },
  'budget.l10n.publishes': {
    label: 'L10n publishes',
    description: 'Monthly localization publish budget.',
  },
  'views.monthly.max': {
    label: 'Monthly views',
    description: 'Maximum monthly views.',
  },
  'instances.published.max': {
    label: 'Published instances',
    description: 'Maximum published instances.',
  },
  'widgets.types.max': {
    label: 'Widget types',
    description: 'Maximum distinct widget types per workspace.',
  },
  'uploads.size.max': {
    label: 'Upload size max',
    description: 'Maximum upload size per file (bytes).',
  },
  'cap.group.items.small.max': {
    label: 'Items cap group (small)',
    description: 'Shared max items cap for “small” list-style widgets.',
  },
  'cap.group.items.medium.max': {
    label: 'Items cap group (medium)',
    description: 'Shared max items cap for “medium” list-style widgets.',
  },
  'cap.group.items.large.max': {
    label: 'Items cap group (large)',
    description: 'Shared max items cap for “large” list-style widgets.',
  },
};

function assertMetaMatchesRegistry(): void {
  const metaKeys = Object.keys(CAPABILITY_META).sort();
  const registryKeys = [...CAPABILITY_KEYS].sort();
  if (metaKeys.length !== registryKeys.length) {
    throw new Error('[ck-policy] Capability meta is out of sync with registry');
  }
  for (let i = 0; i < registryKeys.length; i += 1) {
    if (registryKeys[i] !== metaKeys[i]) {
      throw new Error('[ck-policy] Capability meta is out of sync with registry');
    }
  }
}

function assertRegistryMatchesMatrix(): void {
  const matrixKeys = Object.keys(matrix.capabilities).sort();
  const registryKeys = [...CAPABILITY_KEYS].sort();
  if (matrixKeys.length !== registryKeys.length) {
    throw new Error('[ck-policy] Capability registry is out of sync with entitlements.matrix.json');
  }
  for (let i = 0; i < matrixKeys.length; i += 1) {
    if (matrixKeys[i] !== registryKeys[i]) {
      throw new Error('[ck-policy] Capability registry is out of sync with entitlements.matrix.json');
    }
  }

  for (const key of FLAG_KEYS) {
    if (matrix.capabilities[key]?.kind !== 'flag') {
      throw new Error(`[ck-policy] Capability ${key} must be kind=flag`);
    }
  }
  for (const key of CAP_KEYS) {
    if (matrix.capabilities[key]?.kind !== 'cap') {
      throw new Error(`[ck-policy] Capability ${key} must be kind=cap`);
    }
  }
  for (const key of BUDGET_KEYS) {
    if (matrix.capabilities[key]?.kind !== 'budget') {
      throw new Error(`[ck-policy] Capability ${key} must be kind=budget`);
    }
  }
}

assertRegistryMatchesMatrix();
assertMetaMatchesRegistry();

export const ACTION_KEYS = [
  'instance.create',
  'instance.publish',
  'context.websiteUrl.set',
  'embed.seoGeo.toggle',
  'platform.upload',
  'widget.faq.section.add',
  'widget.faq.qa.add',
] as const;
export type ActionKey = (typeof ACTION_KEYS)[number];
