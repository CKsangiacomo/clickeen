import { parseCanonicalAssetRef, toCanonicalAssetVersionPath } from '@clickeen/ck-contracts';
import {
  DEFAULT_GRADIENT,
  MODE_ORDER,
  type FillMode,
  type FillValue,
  type GradientStop,
  type GradientValue,
  type ImageValue,
  type VideoValue,
} from './fill-types';
import { clampNumber, parseColor } from './color-utils';

function resolveAssetBaseHref(): string {
  if (typeof window === 'undefined') return 'http://localhost/';
  return window.location.href || 'http://localhost/';
}

export function assetVersionIdToPath(versionIdRaw: string): string | null {
  const versionId = String(versionIdRaw || '').trim();
  const canonical = toCanonicalAssetVersionPath(versionId);
  return canonical || null;
}

export function assetVersionIdToUrl(versionIdRaw: string): string | null {
  const path = assetVersionIdToPath(versionIdRaw);
  if (!path) return null;
  try {
    return new URL(path, resolveAssetBaseHref()).toString();
  } catch {
    return path;
  }
}

export function assetVersionIdFromUrl(raw: string): string | null {
  const parsed = parseCanonicalAssetRef(raw);
  if (!parsed || parsed.kind !== 'version') return null;
  return parsed.versionKey;
}

function normalizeImageValue(raw: unknown): ImageValue {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { fit: 'cover', position: 'center', repeat: 'no-repeat' };
  }
  const value = raw as Record<string, unknown>;
  const assetVersionIdRaw =
    value.asset && typeof value.asset === 'object' && !Array.isArray(value.asset)
      ? String((value.asset as Record<string, unknown>).versionId || '').trim()
      : '';
  const assetVersionId = assetVersionIdToPath(assetVersionIdRaw) ? assetVersionIdRaw : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const fit = value.fit === 'contain' ? 'contain' : 'cover';
  const position = typeof value.position === 'string' && value.position.trim() ? value.position.trim() : 'center';
  const repeat = typeof value.repeat === 'string' && value.repeat.trim() ? value.repeat.trim() : 'no-repeat';
  return {
    ...(assetVersionId ? { asset: { versionId: assetVersionId } } : {}),
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
  const assetVersionIdRaw =
    value.asset && typeof value.asset === 'object' && !Array.isArray(value.asset)
      ? String((value.asset as Record<string, unknown>).versionId || '').trim()
      : '';
  const posterVersionIdRaw =
    value.poster && typeof value.poster === 'object' && !Array.isArray(value.poster)
      ? String((value.poster as Record<string, unknown>).versionId || '').trim()
      : '';
  const assetVersionId = assetVersionIdToPath(assetVersionIdRaw) ? assetVersionIdRaw : '';
  const posterVersionId = assetVersionIdToPath(posterVersionIdRaw) ? posterVersionIdRaw : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const fit = value.fit === 'contain' ? 'contain' : 'cover';
  const position = typeof value.position === 'string' && value.position.trim() ? value.position.trim() : 'center';
  const loop = typeof value.loop === 'boolean' ? value.loop : true;
  const muted = typeof value.muted === 'boolean' ? value.muted : true;
  const autoplay = typeof value.autoplay === 'boolean' ? value.autoplay : true;
  return {
    ...(assetVersionId ? { asset: { versionId: assetVersionId } } : {}),
    ...(name ? { name } : {}),
    ...(posterVersionId ? { poster: { versionId: posterVersionId } } : {}),
    fit,
    position,
    loop,
    muted,
    autoplay,
  };
}

function normalizeGradientValue(raw: unknown): GradientValue | { css?: string } | undefined {
  if (typeof raw === 'string') {
    const css = raw.trim();
    return css ? { css } : undefined;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const value = raw as Record<string, unknown>;
  const css = typeof value.css === 'string' ? value.css.trim() : '';
  if (css) return { css };
  const kindRaw = typeof value.kind === 'string' ? value.kind.trim() : '';
  const kind: GradientValue['kind'] = kindRaw === 'radial' || kindRaw === 'conic' ? kindRaw : 'linear';
  const angle = clampNumber(typeof value.angle === 'number' ? value.angle : 0, 0, 360);
  const stopsRaw = Array.isArray(value.stops) ? value.stops : [];
  const stops = stopsRaw
    .map((stop) => {
      if (!stop || typeof stop !== 'object' || Array.isArray(stop)) return null;
      const entry = stop as Record<string, unknown>;
      const color = typeof entry.color === 'string' ? entry.color.trim() : '';
      if (!color) return null;
      const position = clampNumber(typeof entry.position === 'number' ? entry.position : 0, 0, 100);
      return { color, position };
    })
    .filter((stop): stop is GradientStop => Boolean(stop));
  return { kind, angle, stops };
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
    return { type: 'gradient', gradient: normalizeGradientValue(raw.gradient) };
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
  if (/url\(\s*(['"]?)([^'")]+)\1\s*\)/i.test(value)) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith('/')) return null;
  if (/-gradient\(/i.test(value)) {
    return { type: 'gradient', gradient: { css: value } };
  }
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
  if (desired !== 'none' && allowedModes.includes(desired)) return desired;
  return allowedModes[0] || 'color';
}

export function readImageName(fill: FillValue): string | null {
  return typeof fill.image?.name === 'string' && fill.image.name.trim() ? fill.image.name.trim() : null;
}

export function readVideoName(fill: FillValue): string | null {
  return typeof fill.video?.name === 'string' && fill.video.name.trim() ? fill.video.name.trim() : null;
}

export function readImageSrc(fill: FillValue): string | null {
  const versionId = String(fill.image?.asset?.versionId || '').trim();
  if (!versionId) return null;
  return assetVersionIdToUrl(versionId);
}

export function readVideoSrc(fill: FillValue): string | null {
  const versionId = String(fill.video?.asset?.versionId || '').trim();
  if (!versionId) return null;
  return assetVersionIdToUrl(versionId);
}

export function defaultGradientAngle(): number {
  return DEFAULT_GRADIENT.angle;
}
