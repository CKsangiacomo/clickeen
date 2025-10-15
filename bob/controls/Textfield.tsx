import type { FC } from 'react';

interface TextfieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Textfield: FC<TextfieldProps> = ({ label, value, onChange, placeholder, size = 'md' }) => {
  const id = `textfield-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <label className="diet-input" data-size={size} htmlFor={id}>
      <span className="diet-input__label">{label}</span>
      <div className="diet-input__inner">
        <input
          id={id}
          className="diet-input__field"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    </label>
  );
};

