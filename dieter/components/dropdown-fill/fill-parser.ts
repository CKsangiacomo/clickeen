import {
  MODE_ORDER,
  type FillMode,
  type FillValue,
  type GradientStop,
  type GradientValue,
  type ImageValue,
  type VideoValue,
} from './fill-types';
import { parseColor } from './color-utils';

function readDeclaredString(raw: unknown): string | null {
  return typeof raw === 'string' && raw && raw === raw.trim() ? raw : null;
}

function readOptionalDeclaredString(raw: unknown): string | null {
  if (raw === undefined) return '';
  return readDeclaredString(raw);
}

function readDeclaredImageValue(raw: unknown): ImageValue | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const assetRef = readDeclaredString(value.assetRef);
  const name = readOptionalDeclaredString(value.name);
  const fit = value.fit === 'cover' || value.fit === 'contain' ? value.fit : null;
  const position = readDeclaredString(value.position);
  const repeat = readDeclaredString(value.repeat);
  if (!assetRef || name == null || !fit || !position || !repeat) return null;
  return {
    assetRef,
    ...(name ? { name } : {}),
    fit,
    position,
    repeat,
  };
}

function readDeclaredVideoValue(raw: unknown): VideoValue | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const assetRef = readDeclaredString(value.assetRef);
  const posterAssetRef = readOptionalDeclaredString(value.posterAssetRef);
  const name = readOptionalDeclaredString(value.name);
  const fit = value.fit === 'cover' || value.fit === 'contain' ? value.fit : null;
  const position = readDeclaredString(value.position);
  const loop = typeof value.loop === 'boolean' ? value.loop : null;
  const muted = typeof value.muted === 'boolean' ? value.muted : null;
  const autoplay = typeof value.autoplay === 'boolean' ? value.autoplay : null;
  if (!assetRef || posterAssetRef == null || name == null || !fit || !position || loop == null || muted == null || autoplay == null) return null;
  return {
    assetRef,
    ...(posterAssetRef ? { posterAssetRef } : {}),
    ...(name ? { name } : {}),
    fit,
    position,
    loop,
    muted,
    autoplay,
  };
}

function readDeclaredGradientValue(raw: unknown, root: HTMLElement): GradientValue | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (value.kind !== 'linear' || typeof value.angle !== 'number' || !Number.isFinite(value.angle) || value.angle < 0 || value.angle > 360) return null;
  const stopsRaw = Array.isArray(value.stops) ? value.stops : [];
  const stops = stopsRaw
    .map((stop) => {
      if (!stop || typeof stop !== 'object' || Array.isArray(stop)) return null;
      const entry = stop as Record<string, unknown>;
      const color = readDeclaredString(entry.color);
      if (!color || !parseColor(color, root)) return null;
      if (typeof entry.position !== 'number' || !Number.isFinite(entry.position) || entry.position < 0 || entry.position > 100) return null;
      return { color, position: entry.position };
    })
    .filter((stop): stop is GradientStop => Boolean(stop));
  return stops.length === stopsRaw.length && stops.length >= 2 ? { kind: 'linear', angle: value.angle, stops } : null;
}

function coerceFillValue(raw: Record<string, unknown>, root: HTMLElement): FillValue | null {
  const typeRaw = typeof raw.type === 'string' ? raw.type : '';
  if (!typeRaw) return null;
  if (typeRaw === 'none') return { type: 'none' };
  if (!MODE_ORDER.includes(typeRaw as FillMode)) return null;

  if (typeRaw === 'color') {
    const color = readDeclaredString(raw.color);
    if (!color || !parseColor(color, root)) return null;
    return { type: 'color', color };
  }
  if (typeRaw === 'gradient') {
    const gradient = readDeclaredGradientValue(raw.gradient, root);
    return gradient ? { type: 'gradient', gradient } : null;
  }
  if (typeRaw === 'image') {
    const image = readDeclaredImageValue(raw.image);
    return image ? { type: 'image', image } : null;
  }
  if (typeRaw === 'video') {
    const video = readDeclaredVideoValue(raw.video);
    return video ? { type: 'video', video } : null;
  }
  return { type: 'none' };
}

export function parseFillValue(raw: string, root: HTMLElement): FillValue | null {
  const value = String(raw ?? '');
  if (!value || value !== value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return coerceFillValue(parsed as Record<string, unknown>, root);
  } catch {
    return null;
  }
}

export function resolveModeFromFill(
  currentMode: FillMode,
  allowedModes: FillMode[],
  fill: FillValue,
): FillMode {
  const desired = fill.type === 'none' ? currentMode : fill.type;
  if (allowedModes.includes(desired)) return desired;
  return allowedModes[0] || 'color';
}

export function readImageName(fill: FillValue): string | null {
  return typeof fill.image?.name === 'string' && fill.image.name ? fill.image.name : null;
}

export function readVideoName(fill: FillValue): string | null {
  return typeof fill.video?.name === 'string' && fill.video.name ? fill.video.name : null;
}

export function readImageAssetRef(fill: FillValue): string | null {
  return typeof fill.image?.assetRef === 'string' && fill.image.assetRef ? fill.image.assetRef : null;
}

export function readVideoAssetRef(fill: FillValue): string | null {
  return typeof fill.video?.assetRef === 'string' && fill.video.assetRef ? fill.video.assetRef : null;
}

export function readVideoPosterAssetRef(fill: FillValue): string | null {
  return typeof fill.video?.posterAssetRef === 'string' && fill.video.posterAssetRef ? fill.video.posterAssetRef : null;
}
