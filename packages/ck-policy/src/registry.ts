// Keep in sync with packages/ck-policy/entitlements.matrix.json (registry is the typed source of truth).
export const ENTITLEMENT_KEYS = [
  'l10n.locales.max',
  'l10n.versions.max',
  'branding.remove',
  'embed.seoGeo.enabled',
  'widget.socialShare.enabled',
  'copilot.turns.monthly.max',
  'storage.bytes.max',
  'views.monthly.max',
  'instances.published.max',
  'widgets.types.max',
  'uploads.size.max',
  'items.group.small.max',
  'items.group.medium.max',
  'items.group.large.max',
] as const;
export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

export const FLAG_KEYS = [
  'branding.remove',
  'embed.seoGeo.enabled',
  'widget.socialShare.enabled',
] as const satisfies readonly EntitlementKey[];
export type FlagKey = (typeof FLAG_KEYS)[number];

export const PLAN_LIMIT_KEYS = [
  'l10n.locales.max',
  'l10n.versions.max',
  'copilot.turns.monthly.max',
  'storage.bytes.max',
  'views.monthly.max',
  'instances.published.max',
  'widgets.types.max',
  'uploads.size.max',
  'items.group.small.max',
  'items.group.medium.max',
  'items.group.large.max',
] as const satisfies readonly EntitlementKey[];
export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[number];

export type EntitlementMeta = {
  label: string;
  description: string;
  enforcement: {
    status: 'enforced' | 'gap';
    owner: string;
    note: string;
  };
};

export const ENTITLEMENT_META: Record<EntitlementKey, EntitlementMeta> = {
  'l10n.locales.max': {
    label: 'Translation languages',
    description: 'Maximum translated languages the account can add. The base language is implied and not counted.',
    enforcement: {
      status: 'enforced',
      owner: 'Roma account locale settings',
      note: 'Roma rejects selected translated locales above the plan limit before saving account locale settings. Base language is not counted.',
    },
  },
  'l10n.versions.max': {
    label: 'Translation value history',
    description: 'Maximum retained translated-value history entries if a later workflow enables history.',
    enforcement: {
      status: 'gap',
      owner: 'Unassigned translation workflow',
      note: 'The active PRD 103 path stores the current translated locale values only. Manual edits overwrite the current value map, and regeneration may replace them. No active workflow retains multiple translated-value versions.',
    },
  },
  'branding.remove': {
    label: 'Remove branding',
    description: 'Allow removing Clickeen branding.',
    enforcement: {
      status: 'enforced',
      owner: 'Bob widget editor ops and Roma save policy',
      note: 'Widget limits map the backlink path to this policy key. Bob rejects editor ops when the account cannot remove branding, and Roma rejects non-entitled saves before submitted package bytes reach Tokyo-worker.',
    },
  },
  'embed.seoGeo.enabled': {
    label: 'SEO/GEO embed',
    description: 'Allow generating and serving SEO/GEO optimized embed artifacts (Iframe++).',
    enforcement: {
      status: 'enforced',
      owner: 'Roma product save/publish and public code flow',
      note: 'Product policy belongs to Roma/account flow; Tokyo stores and serves submitted artifact files.',
    },
  },
  'widget.socialShare.enabled': {
    label: 'Widget social share',
    description: 'Allow generated widget packages to include the paid social share overlay.',
    enforcement: {
      status: 'enforced',
      owner: 'Bob widget editor ops and Roma save policy',
      note: 'Widget limits map behavior.socialShare.enabled to this policy key. Bob rejects non-entitled edits, and Roma rejects non-entitled saves before submitted package bytes reach Tokyo-worker.',
    },
  },
  'copilot.turns.monthly.max': {
    label: 'Copilot turns',
    description: 'Monthly AI copilot turns.',
    enforcement: {
      status: 'enforced',
      owner: 'Roma copilot grant issuance',
      note: 'Roma blocks copilot grant issuance when the monthly turn limit is exceeded.',
    },
  },
  'storage.bytes.max': {
    label: 'Storage',
    description: 'Total account storage available for uploaded assets (bytes).',
    enforcement: {
      status: 'enforced',
      owner: 'Tokyo-worker assets',
      note: 'Tokyo-worker rejects uploads that exceed the account storage limit.',
    },
  },
  'views.monthly.max': {
    label: 'Monthly views',
    description: 'Maximum monthly public embed views.',
    enforcement: {
      status: 'gap',
      owner: 'clk.live public-serving telemetry',
      note: 'Not surfaced as an active customer-facing limit before GA. Enforcement requires public-serving monthly view counters keyed by account/instance plus a public artifact deny/upsell response once the counter exceeds policy.',
    },
  },
  'instances.published.max': {
    label: 'Published instances',
    description: 'Maximum published instances.',
    enforcement: {
      status: 'enforced',
      owner: 'Roma publish route',
      note: 'Roma rejects publish when the account is already at the plan limit.',
    },
  },
  'widgets.types.max': {
    label: 'Widget types',
    description: 'Maximum distinct widget types per account.',
    enforcement: {
      status: 'enforced',
      owner: 'Roma system widget/create routes',
      note: 'Roma filters system widget create options and rejects direct create requests that would exceed the account distinct-widget-type limit.',
    },
  },
  'uploads.size.max': {
    label: 'Upload size max',
    description: 'Maximum upload size per file (bytes).',
    enforcement: {
      status: 'enforced',
      owner: 'Tokyo-worker assets',
      note: 'Tokyo-worker rejects files above the per-upload plan limit.',
    },
  },
  'items.group.small.max': {
    label: 'Items group (small)',
    description: 'Shared max items limit for small list-style widgets.',
    enforcement: {
      status: 'enforced',
      owner: 'Bob widget editor ops and Roma save policy',
      note: 'Widget limits map widget paths to this policy key. Bob rejects editor ops above the plan limit, and Roma rejects over-limit saves before submitted package bytes reach Tokyo-worker.',
    },
  },
  'items.group.medium.max': {
    label: 'Items group (medium)',
    description: 'Shared max items limit for medium list-style widgets.',
    enforcement: {
      status: 'enforced',
      owner: 'Bob widget editor ops and Roma save policy',
      note: 'Widget limits map widget paths to this policy key. Bob rejects editor ops above the plan limit, and Roma rejects over-limit saves before submitted package bytes reach Tokyo-worker.',
    },
  },
  'items.group.large.max': {
    label: 'Items group (large)',
    description: 'Shared max items limit for large list-style widgets.',
    enforcement: {
      status: 'enforced',
      owner: 'Bob widget editor ops and Roma save policy',
      note: 'Widget limits map aggregate widget paths to this policy key. Bob rejects editor ops above the plan limit, and Roma rejects over-limit saves before submitted package bytes reach Tokyo-worker.',
    },
  },
};
