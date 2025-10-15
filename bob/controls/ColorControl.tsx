import type { FC } from 'react';

interface ColorControlProps {
  label: string;
  color: string;
  onChange: (color: string) => void;
}

export const ColorControl: FC<ColorControlProps> = ({ label, color, onChange }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span className="label">{label}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <span className="label-small" style={{ textTransform: 'uppercase' }}>{color}</span>
      <label className="color-swatch" style={{ background: color, width: '28px', height: '28px', borderRadius: 'var(--radius-2)', border: '1px solid var(--control-border)', cursor: 'pointer' }}>
        <input type="color" value={color} onChange={(e) => onChange(e.target.value)} style={{ visibility: 'hidden', width: '100%', height: '100%' }} />
      </label>
    </div>
  </div>
);

