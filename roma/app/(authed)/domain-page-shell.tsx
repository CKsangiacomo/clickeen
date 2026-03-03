import { Suspense } from 'react';
import type { ComponentType } from 'react';
import type { RomaDomainKey } from '../../lib/domains';
import { RomaShell, RomaShellDefaultActions } from '../../components/roma-shell';
import { RomaAccountNoticeModal } from '../../components/roma-account-notice-modal';

type DomainPageShellProps = {
  activeDomain: RomaDomainKey;
  title: string;
  fallback: string;
  Component: ComponentType;
};

export function DomainPageShell({ activeDomain, title, fallback, Component }: DomainPageShellProps) {
  return (
    <RomaShell activeDomain={activeDomain} title={title} headerRight={<RomaShellDefaultActions />}>
      <RomaAccountNoticeModal />
      <Suspense fallback={<section className="roma-module-surface">{fallback}</section>}>
        <Component />
      </Suspense>
    </RomaShell>
  );
}
