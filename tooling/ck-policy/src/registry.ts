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
  'media.images.enabled',
  'media.videos.enabled',
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
  'media.images.enabled',
  'media.videos.enabled',
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
] as const satisfies readonly CapabilityKey[];
export type CapKey = (typeof CAP_KEYS)[number];

export const BUDGET_KEYS = [
  'budget.copilot.turns',
  'budget.edits',
  'budget.uploads',
] as const satisfies readonly CapabilityKey[];
export type BudgetKey = (typeof BUDGET_KEYS)[number];

export const ENTITLEMENT_KEYS = CAPABILITY_KEYS;

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
