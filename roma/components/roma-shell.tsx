import Link from 'next/link';
import type { ReactNode } from 'react';
import type { RomaDomainKey } from '../lib/domains';
import { RomaNav } from './roma-nav';

type RomaShellProps = {
  activeDomain: RomaDomainKey;
  title: string;
  children: ReactNode;
  canvasClassName?: string;
  headerRight?: ReactNode;
};

export function RomaShellDefaultActions() {
  return (
    <>
      <Link className="diet-btn-txt" data-size="md" data-variant="line2" href="/team">
        <span className="diet-btn-txt__label">Invite members</span>
      </Link>
      <Link className="diet-btn-txt" data-size="md" data-variant="primary" href="/widgets?intent=create">
        <span className="diet-btn-txt__label">New widget</span>
      </Link>
    </>
  );
}

export function RomaShell({
  activeDomain,
  title,
  children,
  canvasClassName,
  headerRight,
}: RomaShellProps) {
  return (
    <div className="roma-layout">
      <aside className="roma-layout__nav">
        <RomaNav activeDomain={activeDomain} />
      </aside>
      <main className="roma-layout__main">
        <div className="rd-domain">
          <header className="rd-header">
            <div className="rd-header-left">
              <details className="roma-nav-drawer">
                <summary>Domains</summary>
                <RomaNav activeDomain={activeDomain} compact />
              </details>
              <h1 className="heading-2 rd-header-title">{title}</h1>
            </div>
            <div className="rd-header-right">
              {headerRight}
            </div>
          </header>
          <section className={canvasClassName || 'rd-canvas'}>{children}</section>
        </div>
      </main>
    </div>
  );
}
