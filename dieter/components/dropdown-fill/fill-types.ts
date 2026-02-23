export type FillMode = 'color' | 'gradient' | 'image' | 'video';

export type GradientStop = { color: string; position: number };

export type GradientValue = {
  kind: 'linear' | 'radial' | 'conic';
  angle: number;
  stops: GradientStop[];
};

export type ImageValue = {
  src: string;
  name?: string;
  fit?: 'cover' | 'contain';
  position?: string;
  repeat?: string;
};

export type VideoValue = {
  src: string;
  name?: string;
  poster?: string;
  fit?: 'cover' | 'contain';
  position?: string;
  loop?: boolean;
  muted?: boolean;
  autoplay?: boolean;
};

export type FillValue = {
  type: 'none' | FillMode;
  color?: string;
  gradient?: GradientValue | { css?: string };
  image?: ImageValue;
  video?: VideoValue;
};

export const MODE_ORDER: FillMode[] = ['color', 'gradient', 'image', 'video'];

export const DEFAULT_GRADIENT = {
  angle: 135,
  stops: [
    { color: '#ff3b30', position: 0 },
    { color: '#007aff', position: 100 },
  ],
} as const;
