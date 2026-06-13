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

function readAssetRef(raw: unknown): string { return typeof raw === 'string' ? raw : ''; }

function normalizeImageValue(raw: unknown): ImageValue {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { fit: 'cover', position: 'center', repeat: 'no-repeat' };
  }
  const value = raw as Record<string, unknown>;
  const assetRef = readAssetRef(value.assetRef);
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const fit = value.fit === 'contain' ? 'contain' : 'cover';
  const position = typeof value.position === 'string' && value.position.trim() ? value.position.trim() : 'center';
  const repeat = typeof value.repeat === 'string' && value.repeat.trim() ? value.repeat.trim() : 'no-repeat';
  return {
    ...(assetRef ? { assetRef } : {}),
    ...(name ? { name } : {}),
    fit,
    position,
    repeat,
  };
}

function normalizeVideoValue(raw: unknown): VideoValue {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { fit: 'cover', position: 'center', loop: true, muted: true, autoplay: true };
  }
  const value = raw as Record<string, unknown>;
  const assetRef = readAssetRef(value.assetRef);
  const posterAssetRef = readAssetRef(value.posterAssetRef);
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const fit = value.fit === 'contain' ? 'contain' : 'cover';
  const position = typeof value.position === 'string' && value.position.trim() ? value.position.trim() : 'center';
  const loop = typeof value.loop === 'boolean' ? value.loop : true;
  const muted = typeof value.muted === 'boolean' ? value.muted : true;
  const autoplay = typeof value.autoplay === 'boolean' ? value.autoplay : true;
  return {
    ...(assetRef ? { assetRef } : {}),
    ...(posterAssetRef ? { posterAssetRef } : {}),
    ...(name ? { name } : {}),
    fit,
    position,
    loop,
    muted,
    autoplay,
  };
}

function normalizeGradientValue(raw: unknown): GradientValue | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (value.kind !== 'linear' || typeof value.angle !== 'number' || !Number.isFinite(value.angle) || value.angle < 0 || value.angle > 360) return null;
  const stopsRaw = Array.isArray(value.stops) ? value.stops : [];
  const stops = stopsRaw
    .map((stop) => {
      if (!stop || typeof stop !== 'object' || Array.isArray(stop)) return null;
      const entry = stop as Record<string, unknown>;
      const color = typeof entry.color === 'string' ? entry.color : '';
      if (!color) return null;
      if (typeof entry.position !== 'number' || !Number.isFinite(entry.position) || entry.position < 0 || entry.position > 100) return null;
      return { color, position: entry.position };
    })
    .filter((stop): stop is GradientStop => Boolean(stop));
  return stops.length === stopsRaw.length && stops.length >= 2 ? { kind: 'linear', angle: value.angle, stops } : null;
}

function coerceFillValue(raw: Record<string, unknown>): FillValue | null {
  const typeRaw = typeof raw.type === 'string' ? raw.type.trim().toLowerCase() : '';
  if (!typeRaw) return { type: 'none' };
  if (typeRaw === 'none') return { type: 'none' };
  if (!MODE_ORDER.includes(typeRaw as FillMode)) return null;

  if (typeRaw === 'color') {
    const color = typeof raw.color === 'string' ? raw.color.trim() : '';
    const value = typeof raw.value === 'string' ? raw.value.trim() : '';
    return { type: 'color', color: color || value || 'transparent' };
  }
  if (typeRaw === 'gradient') {
    const gradient = normalizeGradientValue(raw.gradient);
    return gradient ? { type: 'gradient', gradient } : null;
  }
  if (typeRaw === 'image') {
    return { type: 'image', image: normalizeImageValue(raw.image) };
  }
  if (typeRaw === 'video') {
    return { type: 'video', video: normalizeVideoValue(raw.video) };
  }
  return { type: 'none' };
}

function parseFillString(value: string, root: HTMLElement): FillValue | null {
  if (!value) return { type: 'none' };
  const parsed = parseColor(value, root);
  if (!parsed) return null;
  return { type: 'color', color: value };
}

export function parseFillValue(raw: string, root: HTMLElement): FillValue | null {
  const value = String(raw ?? '').trim();
  if (!value) return { type: 'none' };
  if (value.startsWith('{') || value.startsWith('[') || value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      if (typeof parsed === 'string') return parseFillString(parsed, root);
      if (parsed == null) return { type: 'none' };
      if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return coerceFillValue(parsed as Record<string, unknown>);
    } catch {
      return parseFillString(value, root);
    }
  }
  return parseFillString(value, root);
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
  return typeof fill.image?.name === 'string' && fill.image.name.trim() ? fill.image.name.trim() : null;
}

export function readVideoName(fill: FillValue): string | null {
  return typeof fill.video?.name === 'string' && fill.video.name.trim() ? fill.video.name.trim() : null;
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
