import Image from 'next/image';
import Link from 'next/link';
import { ROMA_DOMAINS, type RomaDomainKey } from '../lib/domains';

type RomaNavProps = {
  activeDomain: RomaDomainKey;
  compact?: boolean;
};

export function RomaNav({ activeDomain, compact = false }: RomaNavProps) {
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
      {ROMA_DOMAINS.map((domain) => {
        const isActive = domain.key === activeDomain;
        return (
          <Link
            key={domain.key}
            href={domain.href}
            aria-current={isActive ? 'page' : undefined}
            className={isActive ? 'roma-nav__link roma-nav__link--active' : 'roma-nav__link'}
            title={domain.description}
          >
            <span className="roma-nav__label label-s">{domain.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
