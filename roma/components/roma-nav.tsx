import Image from 'next/image';
import Link from 'next/link';
import {
  ROMA_MAIN_DOMAINS,
  ROMA_SETTINGS_DOMAINS,
  ROMA_SETTINGS_DOMAIN_KEYS,
  type RomaDomainDefinition,
  type RomaDomainKey,
} from '../lib/domains';
import { RomaSignOutButton } from './roma-sign-out-button';

type RomaNavProps = {
  activeDomain: RomaDomainKey;
  compact?: boolean;
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

export function RomaNav({ activeDomain, compact = false }: RomaNavProps) {
  const settingsActive = ROMA_SETTINGS_DOMAIN_KEYS.includes(activeDomain);
  return (
    <nav aria-label="Roma nav" className={compact ? 'roma-nav roma-nav--compact' : 'roma-nav'}>
      {!compact ? (
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
      ) : null}
      {ROMA_MAIN_DOMAINS.filter((domain) => domain.key !== 'settings').map((domain) => (
        <RomaNavLink key={domain.key} domain={domain} active={domain.key === activeDomain} />
      ))}
      <details className="roma-nav__settings" open={settingsActive}>
        <summary className={settingsActive ? 'roma-nav__link roma-nav__link--active' : 'roma-nav__link'}>
          <span className="roma-nav__label label-s">Settings</span>
        </summary>
        <div className="roma-nav__subnav">
          {ROMA_SETTINGS_DOMAINS.map((domain) => (
            <RomaNavLink key={domain.key} domain={domain} active={domain.key === activeDomain} />
          ))}
        </div>
      </details>
      <div className="roma-nav__footer">
        <RomaSignOutButton />
      </div>
    </nav>
  );
}
