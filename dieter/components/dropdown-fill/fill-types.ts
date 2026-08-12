export type FillMode = 'color' | 'gradient' | 'image' | 'video';

export type GradientStop = { color: string; position: number };

export type GradientKind = 'linear' | 'radial' | 'conic';

export type GradientValue = {
  kind: GradientKind;
  angle: number;
  stops: GradientStop[];
};

export type ImageValue = {
  assetRef: string;
  name?: string;
  fit: 'cover' | 'contain';
  position: string;
  repeat: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
};

export type VideoValue = {
  assetRef: string;
  name?: string;
  posterAssetRef?: string;
  fit: 'cover' | 'contain';
  position: string;
  loop: boolean;
  muted: boolean;
  autoplay: boolean;
};

export type FillValue =
  | { type: 'none' }
  | { type: 'color'; color: string }
  | { type: 'gradient'; gradient: GradientValue }
  | { type: 'image'; image: ImageValue }
  | { type: 'video'; video: VideoValue };

export const DEFAULT_GRADIENT = {
  kind: 'linear',
  angle: 135,
  stops: [
    { color: '#ff3b30', position: 0 },
    { color: '#007aff', position: 100 },
  ],
} as const;
