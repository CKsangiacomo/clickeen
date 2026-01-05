export type CapabilityKind = 'flag' | 'cap' | 'budget' | 'action';

export type CapabilityEnforcement = 'ui' | 'ops' | 'paris' | 'venice' | 'sf' | 'multi';

export type Capability = {
  key: string;
  kind: CapabilityKind;
  labelKey: string;
  descriptionKey?: string;
  enforcement: CapabilityEnforcement;
};

export const FLAG_KEYS = ['embed.seoGeo.enabled', 'context.websiteUrl.enabled', 'platform.uploads.enabled'] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

export const CAP_KEYS = [
  'workspace.editors.max',
  'workspace.instances.max',
  'workspace.widgetTypes.max',
  'widget.faq.sections.max',
  'widget.faq.qa.max',
  'widget.faq.qaPerSection.max',
] as const;
export type CapKey = (typeof CAP_KEYS)[number];

export const BUDGET_KEYS = ['platform.uploads.files'] as const;
export type BudgetKey = (typeof BUDGET_KEYS)[number];

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

export const CAPABILITIES: readonly Capability[] = [
  {
    key: 'embed.seoGeo.enabled',
    kind: 'flag',
    labelKey: 'coreui.capability.embed.seoGeo',
    enforcement: 'multi',
  },
  {
    key: 'context.websiteUrl.enabled',
    kind: 'flag',
    labelKey: 'coreui.capability.context.websiteUrl',
    enforcement: 'multi',
  },
  {
    key: 'platform.uploads.enabled',
    kind: 'flag',
    labelKey: 'coreui.capability.platform.uploads',
    enforcement: 'multi',
  },
  {
    key: 'workspace.editors.max',
    kind: 'cap',
    labelKey: 'coreui.capability.workspace.editorsMax',
    enforcement: 'paris',
  },
  {
    key: 'workspace.instances.max',
    kind: 'cap',
    labelKey: 'coreui.capability.workspace.instancesMax',
    enforcement: 'paris',
  },
  {
    key: 'workspace.widgetTypes.max',
    kind: 'cap',
    labelKey: 'coreui.capability.workspace.widgetTypesMax',
    enforcement: 'paris',
  },
  {
    key: 'widget.faq.sections.max',
    kind: 'cap',
    labelKey: 'faq.capability.sectionsMax',
    enforcement: 'multi',
  },
  {
    key: 'widget.faq.qa.max',
    kind: 'cap',
    labelKey: 'faq.capability.qaMax',
    enforcement: 'multi',
  },
  {
    key: 'widget.faq.qaPerSection.max',
    kind: 'cap',
    labelKey: 'faq.capability.qaPerSectionMax',
    enforcement: 'multi',
  },
  {
    key: 'platform.uploads.files',
    kind: 'budget',
    labelKey: 'coreui.budget.platform.uploads.files',
    enforcement: 'multi',
  },
  {
    key: 'instance.create',
    kind: 'action',
    labelKey: 'coreui.action.instance.create',
    enforcement: 'paris',
  },
  {
    key: 'instance.publish',
    kind: 'action',
    labelKey: 'coreui.action.instance.publish',
    enforcement: 'paris',
  },
  {
    key: 'context.websiteUrl.set',
    kind: 'action',
    labelKey: 'coreui.action.context.websiteUrl.set',
    enforcement: 'multi',
  },
  {
    key: 'embed.seoGeo.toggle',
    kind: 'action',
    labelKey: 'coreui.action.embed.seoGeo.toggle',
    enforcement: 'multi',
  },
  {
    key: 'platform.upload',
    kind: 'action',
    labelKey: 'coreui.action.platform.upload',
    enforcement: 'multi',
  },
  {
    key: 'widget.faq.section.add',
    kind: 'action',
    labelKey: 'faq.action.section.add',
    enforcement: 'multi',
  },
  {
    key: 'widget.faq.qa.add',
    kind: 'action',
    labelKey: 'faq.action.qa.add',
    enforcement: 'multi',
  },
] as const;
