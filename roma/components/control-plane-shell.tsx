import Link from 'next/link';
import type { ReactNode } from 'react';
import { ROMA_MODULES, type RomaModuleKey } from '../lib/modules';

type ControlPlaneShellProps = {
  moduleKey: RomaModuleKey;
  title: string;
  subtitle?: string;
  children: ReactNode;
  focusMode?: boolean;
};

function renderNav(active: RomaModuleKey, compact = false) {
  return (
    <nav aria-label="Roma modules" className={compact ? 'roma-nav roma-nav--compact' : 'roma-nav'}>
      {ROMA_MODULES.map((module) => {
        const moduleHref = module.key === 'builder' ? '/builder' : module.href;
        const isActive = module.key === active;
        return (
          <Link
            key={module.key}
            href={moduleHref}
            aria-current={isActive ? 'page' : undefined}
            className={isActive ? 'roma-nav__link roma-nav__link--active' : 'roma-nav__link'}
          >
            <span className="roma-nav__label">{module.label}</span>
            {!compact ? <span className="roma-nav__meta">{module.description}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function ControlPlaneShell({ moduleKey, title, subtitle, children, focusMode = false }: ControlPlaneShellProps) {
  return (
    <div className={focusMode ? 'roma-shell roma-shell--focus' : 'roma-shell'}>
      <aside className="roma-shell__rail">{renderNav(moduleKey)}</aside>

      <main className="roma-shell__main">
        <header className="roma-shell__topbar">
          <div className="roma-shell__topbar-left">
            <details className="roma-shell__drawer">
              <summary>Modules</summary>
              {renderNav(moduleKey, true)}
            </details>
            <div className="roma-shell__search-wrap">
              <input
                className="roma-shell__search"
                type="search"
                name="q"
                placeholder="Search instances, assets, and workspaces"
                aria-label="Search"
              />
            </div>
          </div>
          <div className="roma-shell__actions">
            <button className="roma-btn roma-btn--ghost" type="button">
              Invite members
            </button>
            <button className="roma-btn" type="button">
              New
            </button>
          </div>
        </header>

        <section className="roma-shell__content">
          <div className="roma-shell__heading">
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {children}
        </section>
      </main>
    </div>
  );
}
