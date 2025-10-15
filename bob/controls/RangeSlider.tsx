import type { FC } from 'react';

interface RangeSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const RangeSlider: FC<RangeSliderProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  size = 'md',
}) => {
  const id = `rangeslider-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="diet-input" data-size={size}>
      <label className="diet-input__label label" htmlFor={id}>
        {label}
      </label>
      <div className="diet-input__inner" style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 'var(--space-2)' }}>
        <input
          id={id}
          className="diet-input__field"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="label-small" style={{ minWidth: 32, textAlign: 'right' }}>
          {value}
          {unit}
        </span>
      </div>
    </div>
  );
};

