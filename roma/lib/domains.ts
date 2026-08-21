import ROMA_NAVIGATION_UI_COPY from '../l10n/navigation/en.json';

export type RomaDomainKey =
  | 'home'
  | 'profile'
  | 'builder'
  | 'widgets'
  | 'widgetCatalog'
  | 'assets'
  | 'team'
  | 'billing'
  | 'usage'
  | 'ai'
  | 'settings'
  | 'widgetDefaults';

export type RomaDomainDefinition = {
  key: RomaDomainKey;
  label: string;
  href: string;
};

export const ROMA_DOMAINS: readonly RomaDomainDefinition[] = [
  { key: 'home', label: ROMA_NAVIGATION_UI_COPY.domains.home, href: '/home' },
  { key: 'profile', label: ROMA_NAVIGATION_UI_COPY.domains.profile, href: '/profile' },
  { key: 'widgets', label: ROMA_NAVIGATION_UI_COPY.domains.widgets, href: '/widgets' },
  { key: 'widgetCatalog', label: ROMA_NAVIGATION_UI_COPY.domains.widgetCatalog, href: '/widgets/catalog' },
  { key: 'builder', label: ROMA_NAVIGATION_UI_COPY.domains.builder, href: '/builder' },
  { key: 'assets', label: ROMA_NAVIGATION_UI_COPY.domains.assets, href: '/assets' },
  { key: 'team', label: ROMA_NAVIGATION_UI_COPY.domains.team, href: '/team' },
  { key: 'billing', label: ROMA_NAVIGATION_UI_COPY.domains.billing, href: '/billing' },
  { key: 'usage', label: ROMA_NAVIGATION_UI_COPY.domains.usage, href: '/usage' },
  { key: 'ai', label: ROMA_NAVIGATION_UI_COPY.domains.ai, href: '/ai' },
  { key: 'settings', label: ROMA_NAVIGATION_UI_COPY.domains.settings, href: '/settings' },
  { key: 'widgetDefaults', label: ROMA_NAVIGATION_UI_COPY.domains.widgetDefaults, href: '/settings/widget-defaults' },
] as const;

export const ROMA_MAIN_DOMAIN_KEYS: readonly RomaDomainKey[] = [
  'home',
  'widgets',
  'builder',
  'assets',
  'settings',
];

export const ROMA_SETTINGS_DOMAIN_KEYS: readonly RomaDomainKey[] = [
  'settings',
  'profile',
  'team',
  'billing',
  'usage',
  'ai',
  'widgetDefaults',
];

export const ROMA_WIDGETS_DOMAIN_KEYS: readonly RomaDomainKey[] = [
  'widgets',
  'widgetCatalog',
];

export const ROMA_MAIN_DOMAINS = ROMA_MAIN_DOMAIN_KEYS.map((key) => {
  const domain = ROMA_DOMAINS.find((entry) => entry.key === key);
  if (!domain) throw new Error(`missing Roma main domain: ${key}`);
  return domain;
});

export const ROMA_SETTINGS_DOMAINS = ROMA_SETTINGS_DOMAIN_KEYS.map((key) => {
  const domain = ROMA_DOMAINS.find((entry) => entry.key === key);
  if (!domain) throw new Error(`missing Roma settings domain: ${key}`);
  return key === 'settings' ? { ...domain, label: ROMA_NAVIGATION_UI_COPY.variants.account } : domain;
});

export const ROMA_WIDGETS_DOMAINS = ROMA_WIDGETS_DOMAIN_KEYS.map((key) => {
  const domain = ROMA_DOMAINS.find((entry) => entry.key === key);
  if (!domain) throw new Error(`missing Roma widgets domain: ${key}`);
  return key === 'widgets' ? { ...domain, label: ROMA_NAVIGATION_UI_COPY.variants.yourWidgets } : domain;
});

export const DEFAULT_HOME_ROUTE = '/home';
