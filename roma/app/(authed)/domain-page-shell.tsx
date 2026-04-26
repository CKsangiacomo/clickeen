import { Suspense } from 'react';
import type { ComponentType } from 'react';
import type { RomaDomainKey } from '../../lib/domains';
import { RomaShell, RomaShellDefaultActions } from '../../components/roma-shell';
import { RomaAccountNoticeModal } from '../../components/roma-account-notice-modal';
import { RomaDomainErrorBoundary } from '../../components/roma-domain-error-boundary';

type DomainPageShellProps = {
  activeDomain: RomaDomainKey;
  title: string;
  Component: ComponentType;
};

export function DomainPageShell({ activeDomain, title, Component }: DomainPageShellProps) {
  return (
    <RomaShell activeDomain={activeDomain} title={title} headerRight={<RomaShellDefaultActions />}>
      <RomaAccountNoticeModal />
      <Suspense fallback={<section className="roma-module-surface">Loading domain...</section>}>
        <RomaDomainErrorBoundary domainLabel={title} resetKey={activeDomain}>
          <Component />
        </RomaDomainErrorBoundary>
      </Suspense>
    </RomaShell>
  );
}
