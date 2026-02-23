export function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function roundTo(value: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

export function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map((c) => c + c)
      .join('')}`;
  }
  if (/^[0-9a-f]{4}$/.test(hex)) {
    const expanded = hex
      .split('')
      .map((c) => c + c)
      .join('');
    return `#${expanded.slice(0, 6)}`;
  }
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  if (/^[0-9a-f]{8}$/.test(hex)) return `#${hex.slice(0, 6)}`;
  return null;
}

export function normalizeAssetReferenceUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const baseHref = typeof window !== 'undefined' ? window.location.href : 'http://localhost/';
    return new URL(trimmed, baseHref).toString();
  } catch {
    return trimmed;
  }
}

export function sameAssetReferenceUrl(left: string, right: string): boolean {
  const leftNormalized = normalizeAssetReferenceUrl(left);
  const rightNormalized = normalizeAssetReferenceUrl(right);
  if (!leftNormalized || !rightNormalized) return false;
  return leftNormalized === rightNormalized;
}

export function hexToRgba(value: string): { r: number; g: number; b: number; a: number } | null {
  const raw = value.trim().replace(/^#/, '');
  if (!/^[0-9a-f]+$/i.test(raw)) return null;
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    return { r, g, b, a: 1 };
  }
  if (raw.length === 4) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    const a = parseInt(raw[3] + raw[3], 16) / 255;
    return { r, g, b, a };
  }
  if (raw.length === 6 || raw.length === 8) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    const a = raw.length === 8 ? parseInt(raw.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  return null;
}

export function rgbToHsv(r: number, g: number, b: number, alpha = 1): { h: number; s: number; v: number; a: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    switch (max) {
      case rNorm:
        h = 60 * (((gNorm - bNorm) / delta) % 6);
        break;
      case gNorm:
        h = 60 * ((bNorm - rNorm) / delta + 2);
        break;
      case bNorm:
        h = 60 * ((rNorm - gNorm) / delta + 4);
        break;
      default:
        break;
    }
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v, a: clampNumber(alpha, 0, 1) };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function toHex(value: number): string {
  return clampNumber(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

export function formatHex(hsv: { h: number; s: number; v: number; a: number }): string {
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getComputedColor(value: string, root: HTMLElement): string {
  const temp = document.createElement('div');
  temp.style.color = value;
  temp.style.display = 'none';
  root.appendChild(temp);
  const computed = getComputedStyle(temp).color;
  root.removeChild(temp);
  return computed;
}

function tryParseTransparentColorMix(value: string, root: HTMLElement): { r: number; g: number; b: number; a: number } | null {
  const trimmed = value.trim();
  if (!/^color-mix\(/i.test(trimmed)) return null;

  const parsePct = (raw: string): number | null => {
    const num = Number.parseFloat(raw);
    if (!Number.isFinite(num)) return null;
    if (num < 0 || num > 100) return null;
    return num / 100;
  };

  const tailTransparent = trimmed.match(/^color-mix\(\s*in\s+oklab\s*,\s*(.+?)\s*,\s*transparent\s+([0-9.]+)%\s*\)$/i);
  const headTransparent = trimmed.match(/^color-mix\(\s*in\s+oklab\s*,\s*transparent\s+([0-9.]+)%\s*,\s*(.+?)\s*\)$/i);

  let colorExpr: string | null = null;
  let transparentWeight: number | null = null;
  if (tailTransparent) {
    colorExpr = tailTransparent[1]?.trim() ?? null;
    transparentWeight = parsePct(tailTransparent[2] ?? '');
  } else if (headTransparent) {
    transparentWeight = parsePct(headTransparent[1] ?? '');
    colorExpr = headTransparent[2]?.trim() ?? null;
  }

  if (!colorExpr || transparentWeight == null) return null;

  const base = colorStringToRgba(colorExpr, root);
  if (!base) return null;

  const baseWeight = 1 - transparentWeight;
  return { r: base.r, g: base.g, b: base.b, a: clampNumber(base.a * baseWeight, 0, 1) };
}

function colorStringToRgba(
  value: string,
  root: HTMLElement,
): { r: number; g: number; b: number; a: number } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const transparentMix = tryParseTransparentColorMix(trimmed, root);
  if (transparentMix) return transparentMix;

  if (trimmed.startsWith('#')) {
    return hexToRgba(trimmed);
  }

  if (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    !/\bvar\(/i.test(trimmed) &&
    !CSS.supports('color', trimmed)
  ) {
    return null;
  }

  const computed = getComputedColor(trimmed, root);
  return parseCssColor(computed);
}

export function parseColor(value: string, root: HTMLElement): { h: number; s: number; v: number; a: number } | null {
  const rgba = colorStringToRgba(value, root);
  if (!rgba) return null;
  return rgbToHsv(rgba.r, rgba.g, rgba.b, rgba.a);
}

export function parseCssColor(computed: string): { r: number; g: number; b: number; a: number } | null {
  const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
  const clamp255 = (value: number) => Math.min(Math.max(value, 0), 255);

  const parseAlpha = (token: string | null | undefined): number => {
    if (!token) return 1;
    const raw = token.trim();
    if (!raw) return 1;
    if (raw.endsWith('%')) {
      const pct = Number.parseFloat(raw.slice(0, -1));
      return Number.isFinite(pct) ? clamp01(pct / 100) : 1;
    }
    const num = Number.parseFloat(raw);
    return Number.isFinite(num) ? clamp01(num) : 1;
  };

  const parseRgb255 = (token: string): number | null => {
    const raw = token.trim();
    if (!raw) return null;
    if (raw.endsWith('%')) {
      const pct = Number.parseFloat(raw.slice(0, -1));
      if (!Number.isFinite(pct)) return null;
      return clamp255(Math.round((pct / 100) * 255));
    }
    const num = Number.parseFloat(raw);
    if (!Number.isFinite(num)) return null;
    return clamp255(Math.round(num));
  };

  const parseSrgbChannel = (token: string): number | null => {
    const raw = token.trim();
    if (!raw) return null;
    if (raw.endsWith('%')) {
      const pct = Number.parseFloat(raw.slice(0, -1));
      if (!Number.isFinite(pct)) return null;
      return clamp255(Math.round((pct / 100) * 255));
    }
    const num = Number.parseFloat(raw);
    if (!Number.isFinite(num)) return null;
    const normalized = num > 1 ? num / 255 : num;
    return clamp255(Math.round(clamp01(normalized) * 255));
  };

  const trimmed = computed.trim();
  const hexMatch = trimmed.match(/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch) return hexToRgba(trimmed);

  const srgbMatch = trimmed.match(/^color\(\s*srgb\s+(.+)\)$/i);
  if (srgbMatch) {
    const body = srgbMatch[1].trim().replace(/\)\s*$/, '');
    const [channelsPart, alphaPart] = body.split(/\s*\/\s*/);
    const channels = channelsPart.split(/\s+/).filter(Boolean);
    if (channels.length >= 3) {
      const r = parseSrgbChannel(channels[0]);
      const g = parseSrgbChannel(channels[1]);
      const b = parseSrgbChannel(channels[2]);
      if (r != null && g != null && b != null) return { r, g, b, a: parseAlpha(alphaPart) };
    }
  }

  const rgbMatch = trimmed.match(/^rgba?\(\s*(.+)\s*\)$/i);
  if (rgbMatch) {
    const body = rgbMatch[1];
    const hasSlash = body.includes('/');
    const [channelsPartRaw, alphaPartRaw] = hasSlash ? body.split(/\s*\/\s*/) : [body, null];
    const tokens = channelsPartRaw
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    let alphaToken: string | null = alphaPartRaw ? alphaPartRaw.trim() : null;
    if (!alphaToken && tokens.length >= 4) {
      alphaToken = tokens[3];
    }

    if (tokens.length >= 3) {
      const r = parseRgb255(tokens[0]);
      const g = parseRgb255(tokens[1]);
      const b = parseRgb255(tokens[2]);
      if (r != null && g != null && b != null) return { r, g, b, a: parseAlpha(alphaToken) };
    }
  }

  return null;
}
