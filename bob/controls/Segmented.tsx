import type { FC } from 'react';

interface SegmentedOption {
  label: string;
  value: string;
}

interface SegmentedProps {
  value: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  size?: 'sm' | 'md' | 'lg';
}

export const Segmented: FC<SegmentedProps> = ({ value, onChange, options, size = 'lg' }) => {
  return (
    <div className="diet-segmented" data-size={size} role="group">
      {options.map((opt) => (
        <label key={opt.value} className="diet-segment" data-type="text-only">
          <input
            className="diet-segment__input"
            type="radio"
            name={`seg-${options.map((o) => o.value).join('-')}`}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span className="diet-segment__surface" />
          <span className="diet-segment__label">{opt.label}</span>
        </label>
      ))}
    </div>
  );
};

