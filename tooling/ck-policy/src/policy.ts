import type { Policy, PolicyProfile } from './types';
import { BUDGET_KEYS, CAP_KEYS, FLAG_KEYS } from './registry';

type ResolvePolicyArgs = {
  profile: PolicyProfile;
  role: Policy['role'];
};

function createTotalPolicyBase(args: ResolvePolicyArgs): Policy {
  const flags = Object.fromEntries(FLAG_KEYS.map((k) => [k, false])) as Policy['flags'];
  const caps = Object.fromEntries(CAP_KEYS.map((k) => [k, 0])) as Policy['caps'];
  const budgets = Object.fromEntries(
    BUDGET_KEYS.map((k) => [k, { max: 0, used: 0 }])
  ) as Policy['budgets'];

  return {
    v: 1,
    profile: args.profile,
    role: args.role,
    flags,
    caps,
    budgets,
  };
}

export function resolvePolicy(args: ResolvePolicyArgs): Policy {
  const policy = createTotalPolicyBase(args);

  if (args.profile === 'devstudio') {
    policy.flags['embed.seoGeo.enabled'] = true;
    policy.flags['context.websiteUrl.enabled'] = true;
    policy.flags['platform.uploads.enabled'] = true;

    policy.caps['workspace.editors.max'] = null;
    policy.caps['workspace.instances.max'] = null;
    policy.caps['workspace.widgetTypes.max'] = null;
    policy.caps['widget.faq.sections.max'] = null;
    policy.caps['widget.faq.qa.max'] = null;
    policy.caps['widget.faq.qaPerSection.max'] = null;

    policy.budgets['platform.uploads.files'].max = null;
    return policy;
  }

  if (args.profile === 'minibob') {
    // MiniBob: demo surface. Editing is allowed, but persistence + premium capabilities are blocked.
    policy.flags['embed.seoGeo.enabled'] = false;
    policy.flags['context.websiteUrl.enabled'] = false;
    policy.flags['platform.uploads.enabled'] = true;

    // Keep caps strict for demo.
    policy.caps['workspace.editors.max'] = 0;
    policy.caps['workspace.instances.max'] = 0;
    policy.caps['workspace.widgetTypes.max'] = 0;
    policy.caps['widget.faq.sections.max'] = 2;
    policy.caps['widget.faq.qa.max'] = 6;
    policy.caps['widget.faq.qaPerSection.max'] = 4;

    policy.budgets['platform.uploads.files'].max = 0;
    return policy;
  }

  if (args.profile === 'free') {
    policy.flags['embed.seoGeo.enabled'] = false;
    policy.flags['context.websiteUrl.enabled'] = true;
    policy.flags['platform.uploads.enabled'] = true;

    policy.caps['workspace.editors.max'] = 1;
    policy.caps['workspace.instances.max'] = 1;
    policy.caps['workspace.widgetTypes.max'] = 1;
    policy.caps['widget.faq.sections.max'] = 2;
    policy.caps['widget.faq.qa.max'] = 8;
    policy.caps['widget.faq.qaPerSection.max'] = 4;

    policy.budgets['platform.uploads.files'].max = 0;
    return policy;
  }

  if (args.profile === 'tier1') {
    policy.flags['embed.seoGeo.enabled'] = true;
    policy.flags['context.websiteUrl.enabled'] = true;
    policy.flags['platform.uploads.enabled'] = true;

    policy.caps['workspace.editors.max'] = 5;
    policy.caps['workspace.instances.max'] = 10;
    policy.caps['workspace.widgetTypes.max'] = null;
    policy.caps['widget.faq.sections.max'] = 10;
    policy.caps['widget.faq.qa.max'] = 100;
    policy.caps['widget.faq.qaPerSection.max'] = 20;

    policy.budgets['platform.uploads.files'].max = 0;
    return policy;
  }

  if (args.profile === 'tier2') {
    policy.flags['embed.seoGeo.enabled'] = true;
    policy.flags['context.websiteUrl.enabled'] = true;
    policy.flags['platform.uploads.enabled'] = true;

    policy.caps['workspace.editors.max'] = null;
    policy.caps['workspace.instances.max'] = null;
    policy.caps['workspace.widgetTypes.max'] = null;
    policy.caps['widget.faq.sections.max'] = null;
    policy.caps['widget.faq.qa.max'] = null;
    policy.caps['widget.faq.qaPerSection.max'] = null;

    policy.budgets['platform.uploads.files'].max = null;
    return policy;
  }

  // tier3
  policy.flags['embed.seoGeo.enabled'] = true;
  policy.flags['context.websiteUrl.enabled'] = true;
  policy.flags['platform.uploads.enabled'] = true;

  policy.caps['workspace.editors.max'] = null;
  policy.caps['workspace.instances.max'] = null;
  policy.caps['workspace.widgetTypes.max'] = null;
  policy.caps['widget.faq.sections.max'] = null;
  policy.caps['widget.faq.qa.max'] = null;
  policy.caps['widget.faq.qaPerSection.max'] = null;

  policy.budgets['platform.uploads.files'].max = null;
  return policy;
}
