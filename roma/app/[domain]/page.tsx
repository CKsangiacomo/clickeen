import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { ComponentType } from 'react';
import type { RomaDomainKey } from '../../lib/domains';
import { HomeDomain } from '../../components/home-domain';
import { WidgetsDomain } from '../../components/widgets-domain';
import { TemplatesDomain } from '../../components/templates-domain';
import { AssetsDomain } from '../../components/assets-domain';
import { TeamDomain } from '../../components/team-domain';
import { BillingDomain } from '../../components/billing-domain';
import { UsageDomain } from '../../components/usage-domain';
import { AiDomain } from '../../components/ai-domain';
import { SettingsDomain } from '../../components/settings-domain';
import { RomaShell, RomaShellDefaultActions } from '../../components/roma-shell';

type DomainPageProps = {
  params: Promise<{ domain: string }>;
};

type DomainConfig = {
  activeDomain: RomaDomainKey;
  title: string;
  fallback: string;
  component: ComponentType;
};

const DOMAIN_CONFIGS: Record<string, DomainConfig> = {
  home: {
    activeDomain: 'home',
    title: 'Home',
    fallback: 'Loading home context...',
    component: HomeDomain,
  },
  widgets: {
    activeDomain: 'widgets',
    title: 'Widgets',
    fallback: 'Loading widgets context...',
    component: WidgetsDomain,
  },
  templates: {
    activeDomain: 'templates',
    title: 'Templates',
    fallback: 'Loading templates context...',
    component: TemplatesDomain,
  },
  assets: {
    activeDomain: 'assets',
    title: 'Assets',
    fallback: 'Loading assets context...',
    component: AssetsDomain,
  },
  team: {
    activeDomain: 'team',
    title: 'Team',
    fallback: 'Loading team context...',
    component: TeamDomain,
  },
  billing: {
    activeDomain: 'billing',
    title: 'Billing',
    fallback: 'Loading billing context...',
    component: BillingDomain,
  },
  usage: {
    activeDomain: 'usage',
    title: 'Usage',
    fallback: 'Loading usage context...',
    component: UsageDomain,
  },
  ai: {
    activeDomain: 'ai',
    title: 'AI',
    fallback: 'Loading AI context...',
    component: AiDomain,
  },
  settings: {
    activeDomain: 'settings',
    title: 'Settings',
    fallback: 'Loading settings context...',
    component: SettingsDomain,
  },
};

export default async function RomaDomainPage({ params }: DomainPageProps) {
  const { domain: rawDomain } = await params;
  const domain = String(rawDomain || '')
    .trim()
    .toLowerCase();
  const config = DOMAIN_CONFIGS[domain];
  if (!config) notFound();

  const DomainComponent = config.component;

  return (
    <RomaShell
      activeDomain={config.activeDomain}
      title={config.title}
      headerRight={<RomaShellDefaultActions />}
    >
      <Suspense fallback={<section className="roma-module-surface">{config.fallback}</section>}>
        <DomainComponent />
      </Suspense>
    </RomaShell>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
