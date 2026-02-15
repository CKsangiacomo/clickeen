import Link from 'next/link';

type ModuleSurfaceProps = {
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function ModuleSurface({
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: ModuleSurfaceProps) {
  return (
    <section className="roma-module-surface" aria-label="Module placeholder">
      <p>{description}</p>
      <div className="roma-module-surface__actions">
        <Link href={primaryHref} className="roma-btn roma-btn--inline">
          {primaryLabel}
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link href={secondaryHref} className="roma-btn roma-btn--ghost roma-btn--inline">
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
