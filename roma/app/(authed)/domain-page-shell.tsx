import { Suspense } from 'react';
import type { ComponentType } from 'react';
import type { RomaDomainKey } from '../../lib/domains';
import { RomaShell, RomaShellDefaultActions } from '../../components/roma-shell';
import { RomaAccountNoticeModal } from '../../components/roma-account-notice-modal';
import { RomaDomainErrorBoundary } from '../../components/roma-domain-error-boundary';
import { RomaLoadingState } from '../../components/roma-system-state';

type DomainPageShellProps = {
  activeDomain: RomaDomainKey;
  title: string;
  Component: ComponentType;
};

export function DomainPageShell({ activeDomain, title, Component }: DomainPageShellProps) {
  return (
    <RomaShell activeDomain={activeDomain} title={title} headerRight={<RomaShellDefaultActions />}>
      <RomaAccountNoticeModal />
      <Suspense fallback={<RomaLoadingState className="rd-canvas-module" />}>
        <RomaDomainErrorBoundary domainLabel={title} resetKey={activeDomain}>
          <Component />
        </RomaDomainErrorBoundary>
      </Suspense>
    </RomaShell>
  );
}
