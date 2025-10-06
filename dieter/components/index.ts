// Dieter Component Contracts — minimized for Phase‑1
// Only Button and Segmented remain as public primitives.

export type Size = 'xs' | 'sm' | 'md';

// Button (control/primary/danger) with layout types
export interface DieterButtonProps {
  size?: Size;
  variant?: 'control' | 'primary' | 'danger';
  layout?: 'icon-only' | 'icon-text' | 'text-only';
  disabled?: boolean;
  buttonType?: 'button' | 'submit' | 'reset';
}

// Segmented control (single-select)
export interface DieterSegmentedProps {
  size?: Size;
  options: string[];
  value?: string;
  onChange?: (next: string) => void;
}


