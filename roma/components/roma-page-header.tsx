import type { ReactNode } from 'react';

type RomaPageHeaderProps = {
  width: 'contained' | 'full';
  title: ReactNode;
  navigationTrigger?: ReactNode;
  headingExtras?: ReactNode;
  actions?: ReactNode;
};

export function RomaPageHeader({
  width,
  title,
  navigationTrigger,
  headingExtras,
  actions,
}: RomaPageHeaderProps) {
  return (
    <header className="page__header" data-width={width}>
      <div className="page__heading">
        {navigationTrigger}
        <h1 className="heading-2">{title}</h1>
        {headingExtras}
      </div>
      <div className="page__actions">{actions}</div>
    </header>
  );
}
