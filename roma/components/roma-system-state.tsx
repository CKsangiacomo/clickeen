import type { CSSProperties } from 'react';
import { ROMA_UI_COPY } from '../lib/ui-copy';

export function RomaLoadingState({
  className,
  inline = false,
}: {
  className?: string;
  inline?: boolean;
}) {
  const stateClassName = className ? `diet-loading-state ${className}` : 'diet-loading-state';
  const content = <span className="diet-spinner" data-size="medium" aria-hidden="true" />;
  return inline ? (
    <span className={stateClassName} role="status" aria-label={ROMA_UI_COPY.state.loadingAccessibleLabel}>
      {content}
    </span>
  ) : (
    <div className={stateClassName} role="status" aria-label={ROMA_UI_COPY.state.loadingAccessibleLabel}>
      {content}
    </div>
  );
}

export function RomaEmptyState({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={className ? `diet-empty-state ${className}` : 'diet-empty-state'}>
      <span
        className="diet-empty-state__icon diet-icon diet-icon-mask"
        style={{ '--diet-icon-source': 'url("/dieter/icons/svg/ellipsis.svg")' } as CSSProperties}
        aria-hidden="true"
      />
      <span className="diet-empty-state__label body-s">{children}</span>
    </div>
  );
}
