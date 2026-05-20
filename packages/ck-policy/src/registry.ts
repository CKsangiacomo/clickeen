import { getEntitlementsMatrix } from './matrix';

const matrix = getEntitlementsMatrix();

// Keep in sync with packages/ck-policy/entitlements.matrix.json (registry is the typed source of truth).
export const ENTITLEMENT_KEYS = [
  'l10n.locales.max',
  'l10n.versions.max',
  'branding.remove',
  'embed.seoGeo.enabled',
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
      owner: 'Berlin account locale routes',
      note: 'Berlin rejects selected translated locales above the plan limit. Base language is not counted.',
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
      status: 'gap',
      owner: 'Bob widget editor ops; save/publish boundary pending',
      note: 'Widget limits map the backlink path to this policy key and Bob rejects editor ops when the account cannot remove branding. Server save/publish enforcement remains a named gap.',
    },
  },
  'embed.seoGeo.enabled': {
    label: 'SEO/GEO embed',
    description: 'Allow generating and serving SEO/GEO optimized embed artifacts (Iframe++).',
    enforcement: {
      status: 'enforced',
      owner: 'Bob embed UI and Tokyo-worker public artifact operation',
      note: 'Bob gates the embed option; Tokyo-worker materializes SEO/GEO public artifacts only when the flag is true.',
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
      owner: 'Venice/public embed telemetry',
      note: 'Not surfaced as an active customer-facing limit before GA. Enforcement requires Venice monthly view counters keyed by account/instance plus a public embed deny/upsell response once the counter exceeds policy.',
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
      owner: 'Roma widget catalog/create routes',
      note: 'Roma filters catalog create options and rejects direct create requests that would exceed the account distinct-widget-type limit.',
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
      status: 'gap',
      owner: 'Bob widget editor ops; save/publish boundary pending',
      note: 'Widget limits map widget paths to this policy key and Bob rejects editor ops above the plan limit. Server save/publish enforcement remains a named gap.',
    },
  },
  'items.group.medium.max': {
    label: 'Items group (medium)',
    description: 'Shared max items limit for medium list-style widgets.',
    enforcement: {
      status: 'gap',
      owner: 'Bob widget editor ops; save/publish boundary pending',
      note: 'Widget limits map widget paths to this policy key and Bob rejects editor ops above the plan limit. Server save/publish enforcement remains a named gap.',
    },
  },
  'items.group.large.max': {
    label: 'Items group (large)',
    description: 'Shared max items limit for large list-style widgets.',
    enforcement: {
      status: 'gap',
      owner: 'Bob widget editor ops; save/publish boundary pending',
      note: 'Widget limits map aggregate widget paths to this policy key and Bob rejects editor ops above the plan limit. Server save/publish enforcement remains a named gap.',
    },
  },
};

function assertMetaMatchesRegistry(): void {
  const metaKeys = Object.keys(ENTITLEMENT_META).sort();
  const registryKeys = [...ENTITLEMENT_KEYS].sort();
  if (metaKeys.length !== registryKeys.length) {
    throw new Error('[ck-policy] Entitlement meta is out of sync with registry');
  }
  for (let i = 0; i < registryKeys.length; i += 1) {
    if (registryKeys[i] !== metaKeys[i]) {
      throw new Error('[ck-policy] Entitlement meta is out of sync with registry');
    }
  }
}

function assertRegistryMatchesMatrix(): void {
  const matrixKeys = Object.keys(matrix.entitlements).sort();
  const registryKeys = [...ENTITLEMENT_KEYS].sort();
  if (matrixKeys.length !== registryKeys.length) {
    throw new Error('[ck-policy] Entitlement registry is out of sync with entitlements.matrix.json');
  }
  for (let i = 0; i < matrixKeys.length; i += 1) {
    if (matrixKeys[i] !== registryKeys[i]) {
      throw new Error('[ck-policy] Entitlement registry is out of sync with entitlements.matrix.json');
    }
  }

  for (const key of FLAG_KEYS) {
    if (matrix.entitlements[key]?.kind !== 'flag') {
      throw new Error(`[ck-policy] Entitlement ${key} must be kind=flag`);
    }
  }
  for (const key of PLAN_LIMIT_KEYS) {
    if (matrix.entitlements[key]?.kind !== 'limit') {
      throw new Error(`[ck-policy] Entitlement ${key} must be kind=limit`);
    }
  }
}

assertRegistryMatchesMatrix();
assertMetaMatchesRegistry();
