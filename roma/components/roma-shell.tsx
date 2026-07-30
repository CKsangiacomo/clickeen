'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
      <Link className="diet-btn-txt" data-size="lg" data-variant="line2" href="/team">
        <span className="diet-btn-txt__label body-l">Invite members</span>
      </Link>
      <Link className="diet-btn-txt" data-size="lg" data-variant="primary" href="/widgets">
        <span className="diet-btn-txt__label body-l">Widgets</span>
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
  const [compact, setCompact] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const closeNavigation = (returnFocus: boolean) => {
    setNavigationOpen(false);
    if (returnFocus) {
      requestAnimationFrame(() => openerRef.current?.focus({ preventScroll: true }));
    }
  };

  useEffect(() => {
    const fullWorkspace = window.matchMedia('(min-width: 600px) and (min-height: 600px)');
    const syncMode = () => {
      const nextCompact = !fullWorkspace.matches;
      setCompact(nextCompact);
      if (!nextCompact) setNavigationOpen(false);
    };
    syncMode();
    fullWorkspace.addEventListener('change', syncMode);
    return () => fullWorkspace.removeEventListener('change', syncMode);
  }, []);

  useEffect(() => {
    if (!navigationOpen) return;
    requestAnimationFrame(() => {
      navigationRef.current
        ?.querySelector<HTMLAnchorElement>('a.roma-nav__link')
        ?.focus({ preventScroll: true });
    });
  }, [navigationOpen]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !navigationOpen) return;
      event.preventDefault();
      closeNavigation(true);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [navigationOpen]);

  return (
    <>
      <div className="main-container" data-navigation-open={navigationOpen ? 'true' : undefined}>
        <aside
          ref={navigationRef}
          className="left-nav"
          id="roma-primary-navigation"
          inert={compact && !navigationOpen ? true : undefined}
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest('a[href]')) {
              closeNavigation(false);
            }
          }}
        >
          <RomaNav activeDomain={activeDomain} />
        </aside>
        <main className={`page${canvasClassName === 'rd-canvas--builder' ? ' roma-builder-page' : ''}`}>
          <button
            type="button"
            data-navigation-scrim
            tabIndex={-1}
            aria-label="Close navigation"
            onClick={() => closeNavigation(true)}
          />
          <header className="page__header">
            <div className="roma-page-heading">
              <button
                ref={openerRef}
                className="roma-nav-trigger diet-btn-ic"
                data-size="md"
                data-variant="neutral"
                type="button"
                aria-label={navigationOpen ? 'Close navigation' : 'Open navigation'}
                aria-controls="roma-primary-navigation"
                aria-expanded={navigationOpen}
                onClick={() => {
                  if (navigationOpen) closeNavigation(true);
                  else setNavigationOpen(true);
                }}
              >
                <Image
                  src="/dieter/icons/svg/line.3.horizontal.decrease.circle.svg"
                  alt=""
                  width={20}
                  height={20}
                />
              </button>
              <h1 className="heading-2">{title}</h1>
            </div>
            <div className="page__actions">
              {headerRight}
            </div>
          </header>
          <section className={`page__content${canvasClassName ? ` ${canvasClassName}` : ''}`}>{children}</section>
        </main>
      </div>
      <section className="roma-portrait-boundary" aria-label="Unsupported workspace">
        <h1 className="heading-3">Rotate your device or use a larger screen</h1>
        <p className="body-s">Roma needs a wider workspace.</p>
      </section>
    </>
  );
}
