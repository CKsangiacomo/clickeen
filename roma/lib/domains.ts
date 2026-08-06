export type RomaDomainKey =
  | 'home'
  | 'profile'
  | 'builder'
  | 'widgets'
  | 'widgetTemplates'
  | 'widgetCatalog'
  | 'pages'
  | 'pageTemplates'
  | 'pageCatalog'
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
  description: string;
};

export const ROMA_DOMAINS: readonly RomaDomainDefinition[] = [
  { key: 'home', label: 'Home', href: '/home', description: 'Reserved for account insights and messages.' },
  { key: 'profile', label: 'User Settings', href: '/profile', description: 'Person-scoped settings for the signed-in user.' },
  { key: 'widgets', label: 'Widgets', href: '/widgets', description: 'Manage account-owned instances.' },
  { key: 'widgetTemplates', label: 'My templates', href: '/widgets/templates', description: 'Manage Widget templates saved by this account.' },
  { key: 'widgetCatalog', label: 'Widget catalog', href: '/widgets/catalog', description: 'Start from Clickeen Widget templates.' },
  { key: 'builder', label: 'Builder', href: '/builder', description: 'Edit widget instances in Bob.' },
  { key: 'pages', label: 'Pages', href: '/pages', description: 'Manage account Pages.' },
  { key: 'pageTemplates', label: 'My templates', href: '/pages/templates', description: 'Manage Page templates saved by this account.' },
  { key: 'pageCatalog', label: 'Page catalog', href: '/pages/catalog', description: 'Start from Clickeen Page templates.' },
  { key: 'assets', label: 'Assets', href: '/assets', description: 'Account library and usage mapping.' },
  { key: 'team', label: 'Team', href: '/team', description: 'Members and roles.' },
  { key: 'billing', label: 'Billing', href: '/billing', description: 'Current plan; billing provider not connected.' },
  { key: 'usage', label: 'Usage', href: '/usage', description: 'Storage usage and quota snapshot.' },
  { key: 'ai', label: 'AI', href: '/ai', description: 'AI entitlement profile and limits.' },
  { key: 'settings', label: 'Settings', href: '/settings', description: 'Account languages, ownership, and final controls.' },
  { key: 'widgetDefaults', label: 'Widget Defaults', href: '/settings/widget-defaults', description: 'Account defaults for new widget instances.' },
] as const;

export const ROMA_MAIN_DOMAIN_KEYS: readonly RomaDomainKey[] = [
  'home',
  'widgets',
  'builder',
  'pages',
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
  'widgetTemplates',
  'widgetCatalog',
];

export const ROMA_PAGES_DOMAIN_KEYS: readonly RomaDomainKey[] = [
  'pages',
  'pageTemplates',
  'pageCatalog',
];

export const ROMA_MAIN_DOMAINS = ROMA_MAIN_DOMAIN_KEYS.map((key) => {
  const domain = ROMA_DOMAINS.find((entry) => entry.key === key);
  if (!domain) throw new Error(`missing Roma main domain: ${key}`);
  return domain;
});

export const ROMA_SETTINGS_DOMAINS = ROMA_SETTINGS_DOMAIN_KEYS.map((key) => {
  const domain = ROMA_DOMAINS.find((entry) => entry.key === key);
  if (!domain) throw new Error(`missing Roma settings domain: ${key}`);
  return key === 'settings' ? { ...domain, label: 'Account' } : domain;
});

export const ROMA_WIDGETS_DOMAINS = ROMA_WIDGETS_DOMAIN_KEYS.map((key) => {
  const domain = ROMA_DOMAINS.find((entry) => entry.key === key);
  if (!domain) throw new Error(`missing Roma widgets domain: ${key}`);
  return key === 'widgets' ? { ...domain, label: 'Your widgets' } : domain;
});

export const ROMA_PAGES_DOMAINS = ROMA_PAGES_DOMAIN_KEYS.map((key) => {
  const domain = ROMA_DOMAINS.find((entry) => entry.key === key);
  if (!domain) throw new Error(`missing Roma Pages domain: ${key}`);
  return key === 'pages' ? { ...domain, label: 'Your pages' } : domain;
});

export const DEFAULT_HOME_ROUTE = '/home';
