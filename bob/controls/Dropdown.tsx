import { useState, useRef, useEffect, type FC, type ReactNode, Children, cloneElement, isValidElement } from 'react';

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Dropdown: FC<DropdownProps> = ({ trigger, children, size = 'lg' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const triggerWithProps = Children.map(trigger, (child) => {
    if (isValidElement(child)) {
      return cloneElement(child as any, { onClick: () => setIsOpen(!isOpen), 'aria-expanded': isOpen });
    }
    return child;
  });

  return (
    <div ref={ref} className="diet-dropdown" data-state={isOpen ? 'open' : 'closed'} data-size={size} style={{ width: '100%' }}>
      {triggerWithProps}
      <div className="diet-dropdown__surface" role="menu" data-dropdown-surface>
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>{children}</div>
      </div>
    </div>
  );
};

