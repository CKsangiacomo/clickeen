import type { FillMode, FillValue } from './fill-types';

export function parseFillValue(raw: string): FillValue {
  return JSON.parse(raw) as FillValue;
}

export function resolveModeFromFill(
  currentMode: FillMode,
  fill: FillValue,
): FillMode {
  return fill.type === 'none' ? currentMode : fill.type;
}

export function readImageName(fill: Extract<FillValue, { type: 'image' }>): string | null {
  return fill.image.name ?? null;
}

export function readVideoName(fill: Extract<FillValue, { type: 'video' }>): string | null {
  return fill.video.name ?? null;
}

export function readImageAssetRef(fill: Extract<FillValue, { type: 'image' }>): string {
  return fill.image.assetRef;
}

export function readVideoAssetRef(fill: Extract<FillValue, { type: 'video' }>): string {
  return fill.video.assetRef;
}

export function readVideoPosterAssetRef(fill: Extract<FillValue, { type: 'video' }>): string | null {
  return fill.video.posterAssetRef ?? null;
}
