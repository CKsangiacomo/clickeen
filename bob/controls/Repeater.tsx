import type { FC, ReactNode } from 'react';

interface RepeaterProps<T = any> {
  label: string;
  items: T[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  renderItem: (item: T, index: number) => ReactNode;
}

export const Repeater: FC<RepeaterProps> = ({ label, items, onAdd, onRemove, renderItem }) => {
  return (
    <div>
      <div className="label" style={{ marginBottom: 'var(--space-2)' }}>{label}</div>
      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
        {(items || []).map((item, index) => (
          <div key={(item as any)?.id ?? index} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            {renderItem(item, index)}
            <button type="button" className="diet-btn" data-size="sm" data-variant="ghost" onClick={() => onRemove(index)}>
              <span className="diet-btn__label">Remove</span>
            </button>
          </div>
        ))}
        <button type="button" className="diet-btn" data-size="md" data-variant="neutral" onClick={onAdd}>
          <span className="diet-btn__label">+ Add</span>
        </button>
      </div>
    </div>
  );
};

