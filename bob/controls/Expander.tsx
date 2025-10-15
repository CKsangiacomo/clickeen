import type { FC, ReactNode } from 'react';
import { getIcon } from '@bob/lib/icons';

interface ExpanderProps {
  label: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Expander: FC<ExpanderProps> = ({ label, children, size = 'lg' }) => {
  const id = `expander-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="diet-expander" data-size={size}>
      <input type="checkbox" className="diet-expander__input sr-only" id={id} />
      <label className="diet-expander__trigger diet-btn" htmlFor={id}>
        <span className="diet-btn__label">{label}</span>
        <span className="diet-btn__icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: getIcon('chevron.down') }} />
      </label>
      <div className="diet-expander__content">{children}</div>
    </div>
  );
};

