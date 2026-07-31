'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { RomaDomainKey } from '../lib/domains';
import { RomaNav } from './roma-nav';

type RomaShellProps = {
  activeDomain: RomaDomainKey;
  title: string;
  children: ReactNode;
  canvasClassName?: string;
  headerRight?: ReactNode;
  fullCanvas?: boolean;
};

type RomaShellActions = {
  openNavigation: (returnFocus?: HTMLElement | null) => void;
};

const RomaShellActionsContext = createContext<RomaShellActions | null>(null);

export function useRomaShellActions(): RomaShellActions {
  const actions = useContext(RomaShellActionsContext);
  if (!actions) throw new Error('useRomaShellActions must be used within RomaShell');
  return actions;
}

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
  fullCanvas = false,
}: RomaShellProps) {
  const [compact, setCompact] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const navigationReturnFocusRef = useRef<HTMLElement | null>(null);

  const closeNavigation = useCallback((returnFocus: boolean) => {
    setNavigationOpen(false);
    if (returnFocus) {
      requestAnimationFrame(() => {
        (navigationReturnFocusRef.current ?? openerRef.current)?.focus({ preventScroll: true });
      });
    }
  }, []);

  const openNavigation = useCallback((returnFocus?: HTMLElement | null) => {
    navigationReturnFocusRef.current = returnFocus ?? openerRef.current;
    setNavigationOpen(true);
  }, []);

  const shellActions = useMemo<RomaShellActions>(() => ({ openNavigation }), [openNavigation]);

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
  }, [closeNavigation, navigationOpen]);

  return (
    <RomaShellActionsContext.Provider value={shellActions}>
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
        <main className={`page${fullCanvas ? ' roma-builder-page' : ''}`}>
          <button
            type="button"
            data-navigation-scrim
            tabIndex={-1}
            aria-label="Close navigation"
            onClick={() => closeNavigation(true)}
          />
          {!fullCanvas ? (
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
                    else openNavigation(openerRef.current);
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
              <div className="page__actions">{headerRight}</div>
            </header>
          ) : null}
          <section className={`page__content${canvasClassName ? ` ${canvasClassName}` : ''}`}>
            {children}
          </section>
        </main>
      </div>
    </RomaShellActionsContext.Provider>
  );
}
