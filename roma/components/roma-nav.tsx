import Image from 'next/image';
import Link from 'next/link';
import {
  ROMA_MAIN_DOMAINS,
  ROMA_SETTINGS_DOMAINS,
  ROMA_WIDGETS_DOMAINS,
  type RomaDomainDefinition,
  type RomaDomainKey,
} from '../lib/domains';
import { RomaSignOutButton } from './roma-sign-out-button';

type RomaNavProps = {
  activeDomain: RomaDomainKey;
};

function RomaNavLink({ domain, active }: { domain: RomaDomainDefinition; active: boolean }) {
  if (active) {
    return (
      <span
        key={domain.key}
        aria-current="page"
        className="roma-nav__link roma-nav__link--active"
        title={domain.description}
      >
        <span className="roma-nav__label label-s">{domain.label}</span>
      </span>
    );
  }
  return (
    <Link
      key={domain.key}
      href={domain.href}
      className="roma-nav__link"
      title={domain.description}
    >
      <span className="roma-nav__label label-s">{domain.label}</span>
    </Link>
  );
}

function RomaNavGroup({
  label,
  domains,
  activeDomain,
}: {
  label: string;
  domains: readonly RomaDomainDefinition[];
  activeDomain: RomaDomainKey;
}) {
  const active = domains.some((domain) => domain.key === activeDomain);
  return (
    <details className="roma-nav__group" open={active}>
      <summary className={active ? 'roma-nav__link roma-nav__link--active' : 'roma-nav__link'}>
        <span className="roma-nav__label label-s">{label}</span>
      </summary>
      <div className="roma-nav__subnav">
        {domains.map((domain) => (
          <RomaNavLink key={domain.key} domain={domain} active={domain.key === activeDomain} />
        ))}
      </div>
    </details>
  );
}

export function RomaNav({ activeDomain }: RomaNavProps) {
  return (
    <nav aria-label="Roma nav" className="roma-nav">
      <div className="roma-nav__brand">
        <Link href="/home" className="roma-nav__brand-link" aria-label="Clickeen home">
          <Image
            src="/brand/clickeen-logo-full.svg"
            alt="Clickeen"
            width={3060}
            height={557}
            className="roma-nav__brand-logo"
            priority
          />
        </Link>
      </div>
      {ROMA_MAIN_DOMAINS.map((domain) => {
        if (domain.key === 'widgets') {
          return <RomaNavGroup key={domain.key} label="Widgets" domains={ROMA_WIDGETS_DOMAINS} activeDomain={activeDomain} />;
        }
        if (domain.key === 'settings') {
          return <RomaNavGroup key={domain.key} label="Settings" domains={ROMA_SETTINGS_DOMAINS} activeDomain={activeDomain} />;
        }
        return <RomaNavLink key={domain.key} domain={domain} active={domain.key === activeDomain} />;
      })}
      <div className="roma-nav__footer">
        <RomaSignOutButton />
      </div>
    </nav>
  );
}
