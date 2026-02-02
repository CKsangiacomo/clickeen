import { getEntitlementsMatrix } from './matrix';

const matrix = getEntitlementsMatrix();

// Keep in sync with config/entitlements.matrix.json (registry is the typed source of truth).
export const CAPABILITY_KEYS = [
  'seoGeo.enabled',
  'l10n.enabled',
  'l10n.layer.geo.enabled',
  'l10n.layer.industry.enabled',
  'l10n.layer.experiment.enabled',
  'l10n.layer.account.enabled',
  'l10n.layer.behavior.enabled',
  'l10n.layer.user.enabled',
  'l10n.locales.max',
  'l10n.versions.max',
  'personalization.preview.enabled',
  'personalization.onboarding.enabled',
  'personalization.sources.website.depth',
  'personalization.sources.gbp.enabled',
  'personalization.sources.facebook.enabled',
  'branding.remove',
  'context.websiteUrl.enabled',
  'links.enabled',
  'media.meta.enabled',
  'list.primary.max',
  'list.secondary.rich.max',
  'list.secondary.rich.total.max',
  'list.secondary.dense.max',
  'text.question.max',
  'text.answer.max',
  'text.caption.max',
  'text.headerHtml.max',
  'budget.copilot.turns',
  'budget.edits',
  'budget.uploads',
  'views.monthly.max',
  'instances.published.max',
] as const;
export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

export const FLAG_KEYS = [
  'seoGeo.enabled',
  'l10n.enabled',
  'l10n.layer.geo.enabled',
  'l10n.layer.industry.enabled',
  'l10n.layer.experiment.enabled',
  'l10n.layer.account.enabled',
  'l10n.layer.behavior.enabled',
  'l10n.layer.user.enabled',
  'personalization.preview.enabled',
  'personalization.onboarding.enabled',
  'personalization.sources.gbp.enabled',
  'personalization.sources.facebook.enabled',
  'branding.remove',
  'context.websiteUrl.enabled',
  'links.enabled',
  'media.meta.enabled',
] as const satisfies readonly CapabilityKey[];
export type FlagKey = (typeof FLAG_KEYS)[number];

export const CAP_KEYS = [
  'l10n.locales.max',
  'l10n.versions.max',
  'personalization.sources.website.depth',
  'list.primary.max',
  'list.secondary.rich.max',
  'list.secondary.rich.total.max',
  'list.secondary.dense.max',
  'text.question.max',
  'text.answer.max',
  'text.caption.max',
  'text.headerHtml.max',
  'views.monthly.max',
  'instances.published.max',
] as const satisfies readonly CapabilityKey[];
export type CapKey = (typeof CAP_KEYS)[number];

export const BUDGET_KEYS = [
  'budget.copilot.turns',
  'budget.edits',
  'budget.uploads',
] as const satisfies readonly CapabilityKey[];
export type BudgetKey = (typeof BUDGET_KEYS)[number];

export const ENTITLEMENT_KEYS = CAPABILITY_KEYS;

export type CapabilityMeta = {
  label: string;
  description: string;
};

export const CAPABILITY_META: Record<CapabilityKey, CapabilityMeta> = {
  'seoGeo.enabled': {
    label: 'SEO/GEO optimization',
    description: 'Allow indexable embed output (schema + excerpt).',
  },
  'l10n.enabled': {
    label: 'Localization enabled',
    description: 'Enable localization overlays for instances.',
  },
  'l10n.layer.geo.enabled': {
    label: 'Geo overlays',
    description: 'Allow geo layer overlays.',
  },
  'l10n.layer.industry.enabled': {
    label: 'Industry overlays',
    description: 'Allow industry layer overlays.',
  },
  'l10n.layer.experiment.enabled': {
    label: 'Experiment overlays',
    description: 'Allow experiment layer overlays.',
  },
  'l10n.layer.account.enabled': {
    label: 'Account overlays',
    description: 'Allow account layer overlays.',
  },
  'l10n.layer.behavior.enabled': {
    label: 'Behavior overlays',
    description: 'Allow behavior layer overlays.',
  },
  'l10n.layer.user.enabled': {
    label: 'User overlays',
    description: 'Allow user layer overlays.',
  },
  'l10n.locales.max': {
    label: 'Max locales',
    description: 'Maximum locale overlays per instance.',
  },
  'l10n.versions.max': {
    label: 'Max l10n versions',
    description: 'Maximum overlay versions retained.',
  },
  'personalization.preview.enabled': {
    label: 'Personalization preview',
    description: 'Allow personalization preview UI.',
  },
  'personalization.onboarding.enabled': {
    label: 'Personalization onboarding',
    description: 'Allow onboarding personalization flow.',
  },
  'personalization.sources.website.depth': {
    label: 'Website crawl depth',
    description: 'Maximum website crawl depth for personalization.',
  },
  'personalization.sources.gbp.enabled': {
    label: 'Google Business Profile',
    description: 'Allow GBP as a personalization source.',
  },
  'personalization.sources.facebook.enabled': {
    label: 'Facebook source',
    description: 'Allow Facebook as a personalization source.',
  },
  'branding.remove': {
    label: 'Remove branding',
    description: 'Allow removing Clickeen branding.',
  },
  'context.websiteUrl.enabled': {
    label: 'Website URL context',
    description: 'Allow setting website URL context.',
  },
  'links.enabled': {
    label: 'Links enabled',
    description: 'Allow links in rich text fields.',
  },
  'media.meta.enabled': {
    label: 'Media metadata',
    description: 'Allow media metadata in outputs.',
  },
  'list.primary.max': {
    label: 'Primary list max',
    description: 'Maximum primary list items.',
  },
  'list.secondary.rich.max': {
    label: 'Secondary rich max',
    description: 'Maximum rich secondary list items.',
  },
  'list.secondary.rich.total.max': {
    label: 'Secondary rich total',
    description: 'Maximum total rich secondary list items.',
  },
  'list.secondary.dense.max': {
    label: 'Secondary dense max',
    description: 'Maximum dense secondary list items.',
  },
  'text.question.max': {
    label: 'Question length',
    description: 'Maximum question text length.',
  },
  'text.answer.max': {
    label: 'Answer length',
    description: 'Maximum answer text length.',
  },
  'text.caption.max': {
    label: 'Caption length',
    description: 'Maximum caption text length.',
  },
  'text.headerHtml.max': {
    label: 'Header HTML length',
    description: 'Maximum header rich text length.',
  },
  'budget.copilot.turns': {
    label: 'Copilot turns',
    description: 'Monthly AI copilot turns.',
  },
  'budget.edits': {
    label: 'AI edits',
    description: 'Monthly AI edit operations.',
  },
  'budget.uploads': {
    label: 'Uploads',
    description: 'Monthly uploads budget.',
  },
  'views.monthly.max': {
    label: 'Monthly views',
    description: 'Maximum monthly views.',
  },
  'instances.published.max': {
    label: 'Published instances',
    description: 'Maximum published instances.',
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
