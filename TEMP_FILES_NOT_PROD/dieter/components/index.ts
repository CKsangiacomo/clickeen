// Dieter Component Contracts — minimized for Phase‑1
// Only Button and Segmented remain as public primitives.

export type Size = 'xs' | 'sm' | 'md';

// Button (control/primary/danger) with footprints
export interface DieterButtonProps {
  size?: Size;
  variant?: 'control' | 'primary' | 'danger';
  footprint?: 'icon-only' | 'icon+label';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

// Segmented control (single-select)
export interface DieterSegmentedProps {
  size?: Size;
  options: string[];
  value?: string;
  onChange?: (next: string) => void;
}


