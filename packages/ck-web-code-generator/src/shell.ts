import type { ExactLocaleOverlays, ResolvedWebCodeContext, SavedInstanceStructuredSource } from './types';
import { normalizeCanonicalLocalesFile, normalizeLocaleToken, resolveLocaleLabel } from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);
export const TYPOGRAPHY_FONT_STYLE_MODULE_ID = 'generated/typography-fonts.css';

type RecordValue = Record<string, unknown>;

function record(value: unknown, path: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`ck.web_code.shell_invalid:${path}`);
  return value as RecordValue;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new Error(`ck.web_code.shell_invalid:${path}`);
  return value;
}

function nonEmptyText(value: unknown, path: string): string {
  const resolved = text(value, path);
  if (!resolved.trim()) throw new Error(`ck.web_code.shell_invalid:${path}`);
  return resolved;
}

function number(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`ck.web_code.shell_invalid:${path}`);
  return value;
}

function numberInRange(value: unknown, min: number, max: number, path: string): number {
  const resolved = number(value, path);
  if (resolved < min || resolved > max) throw new Error(`ck.web_code.shell_invalid:${path}`);
  return resolved;
}

function declared<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  const resolved = text(value, path);
  if (!allowed.includes(resolved as T)) throw new Error(`ck.web_code.shell_invalid:${path}`);
  return resolved as T;
}

function exactLocale(value: unknown, path: string): string {
  const coordinate = nonEmptyText(value, path);
  const normalized = normalizeLocaleToken(coordinate);
  if (coordinate !== coordinate.trim() || coordinate.includes('_') || !normalized || normalized !== coordinate.toLowerCase()) {
    throw new Error(`ck.web_code.shell_invalid:${path}`);
  }
  return coordinate;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`ck.web_code.shell_invalid:${path}`);
  return value;
}

function optionalText(value: unknown, fallback: string, path: string): string {
  return value === undefined ? fallback : text(value, path);
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function setAttr(tag: string, name: string, value: string | null): string {
  const pattern = new RegExp(`\\s${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}=(?:"[^"]*"|'[^']*')`, 'i');
  const bare = new RegExp(`\\s${name}(?=\\s|>|\\/)`, 'i');
  let next = tag.replace(pattern, '').replace(bare, '');
  if (value === null) return next;
  return next.replace(/\s*\/?\s*>$/, ` ${name}="${escapeAttr(value)}"$&`);
}

function mergeStyle(tag: string, declarations: Record<string, string>): string {
  const existing = /\sstyle=(?:"([^"]*)"|'([^']*)')/i.exec(tag);
  const values = new Map<string, string>();
  String(existing?.[1] ?? existing?.[2] ?? '').split(';').forEach((part) => {
    const split = part.indexOf(':');
    if (split > 0) values.set(part.slice(0, split).trim(), part.slice(split + 1).trim());
  });
  Object.entries(declarations).forEach(([key, value]) => values.set(key, value));
  return setAttr(tag, 'style', [...values].map(([key, value]) => `${key}: ${value}`).join('; '));
}

function transformTag(html: string, selector: RegExp, transform: (tag: string) => string, reason: string): string {
  let found = false;
  const next = html.replace(/<[^!][^>]*>/g, (tag) => {
    if (found || !selector.test(tag)) return tag;
    found = true;
    return transform(tag);
  });
  if (!found) throw new Error(`ck.web_code.shell_anchor_missing:${reason}`);
  return next;
}

function role(roleName: string): RegExp {
  return new RegExp(`\\sdata-role=["']${roleName}["']`, 'i');
}

function cssBackground(raw: unknown, path: string): string {
  const fill = record(raw, path);
  const type = declared(fill.type, ['none', 'color', 'gradient', 'image', 'video'] as const, `${path}.type`);
  if (type === 'none') return 'transparent';
  if (type === 'color') return nonEmptyText(fill.color, `${path}.color`);
  if (type === 'image') {
    const image = record(fill.image, `${path}.image`);
    const src = text(image.src, `${path}.image.src`);
    if (!/^https?:\/\/|^\//i.test(src)) throw new Error(`ck.web_code.shell_invalid:${path}.image.src`);
    return `url("${src.replace(/"/g, '%22')}") ${nonEmptyText(image.position, `${path}.image.position`)} / ${declared(image.fit, ['cover', 'contain'] as const, `${path}.image.fit`)} ${nonEmptyText(image.repeat, `${path}.image.repeat`)}`;
  }
  if (type === 'video') {
    const video = record(fill.video, `${path}.video`);
    const src = text(video.src, `${path}.video.src`);
    if (!/^https?:\/\/|^\//i.test(src)) throw new Error(`ck.web_code.shell_invalid:${path}.video.src`);
    declared(video.fit, ['cover', 'contain'] as const, `${path}.video.fit`);
    nonEmptyText(video.position, `${path}.video.position`);
    bool(video.loop, `${path}.video.loop`);
    bool(video.muted, `${path}.video.muted`);
    bool(video.autoplay, `${path}.video.autoplay`);
    if (video.poster !== undefined && (typeof video.poster !== 'string' || !video.poster.trim())) throw new Error(`ck.web_code.shell_invalid:${path}.video.poster`);
    return 'transparent';
  }
  if (type === 'gradient') {
    const gradient = record(fill.gradient, `${path}.gradient`);
    const kind = declared(gradient.kind, ['linear', 'radial', 'conic'] as const, `${path}.gradient.kind`);
    const angle = numberInRange(gradient.angle, 0, 360, `${path}.gradient.angle`);
    if (!Array.isArray(gradient.stops) || gradient.stops.length < 2) throw new Error(`ck.web_code.shell_invalid:${path}.gradient.stops`);
    const stops = gradient.stops.map((item, index) => {
      const stop = record(item, `${path}.gradient.stops.${index}`);
      return `${nonEmptyText(stop.color, `${path}.gradient.stops.${index}.color`)} ${numberInRange(stop.position, 0, 100, `${path}.gradient.stops.${index}.position`)}%`;
    }).join(', ');
    return kind === 'radial' ? `radial-gradient(circle, ${stops})` : kind === 'conic' ? `conic-gradient(from ${angle}deg, ${stops})` : `linear-gradient(${angle}deg, ${stops})`;
  }
  throw new Error(`ck.web_code.shell_invalid:${path}.type`);
}

function box(raw: unknown, path: string): Record<'top' | 'right' | 'bottom' | 'left', number> {
  const value = record(raw, path);
  const linked = bool(value.linked, `${path}.linked`);
  const all = numberInRange(value.all, 0, 1000, `${path}.all`);
  const declaredSides = {
    top: numberInRange(value.top, 0, 1000, `${path}.top`), right: numberInRange(value.right, 0, 1000, `${path}.right`),
    bottom: numberInRange(value.bottom, 0, 1000, `${path}.bottom`), left: numberInRange(value.left, 0, 1000, `${path}.left`),
  };
  return {
    top: linked ? all : declaredSides.top,
    right: linked ? all : declaredSides.right,
    bottom: linked ? all : declaredSides.bottom,
    left: linked ? all : declaredSides.left,
  };
}

function shadow(raw: unknown, path: string): string {
  const value = record(raw, path);
  const enabled = bool(value.enabled, `${path}.enabled`);
  const alpha = numberInRange(value.alpha, 0, 100, `${path}.alpha`);
  const inset = bool(value.inset, `${path}.inset`);
  if (inset) throw new Error(`ck.web_code.shell_invalid:${path}.inset`);
  const color = nonEmptyText(value.color, `${path}.color`);
  const x = numberInRange(value.x, -200, 200, `${path}.x`);
  const y = numberInRange(value.y, -200, 200, `${path}.y`);
  const blur = numberInRange(value.blur, 0, 400, `${path}.blur`);
  const spread = numberInRange(value.spread, -200, 200, `${path}.spread`);
  if (!enabled) return 'none';
  return `${inset ? 'inset ' : ''}${x}px ${y}px ${blur}px ${spread}px color-mix(in oklab, ${color}, transparent ${100 - alpha}%)`;
}

function insideFade(raw: unknown, path: string): { background: string; layer: 'below-content' | 'above-content' } {
  const config = record(raw, path);
  const linked = bool(config.linked, `${path}.linked`);
  const layer = text(config.layer, `${path}.layer`);
  if (layer !== 'below-content' && layer !== 'above-content') throw new Error(`ck.web_code.shell_invalid:${path}.layer`);
  const sides: Array<'top' | 'right' | 'bottom' | 'left'> = ['top', 'right', 'bottom', 'left'];
  const parts = Object.fromEntries(['all', ...sides].map((key) => {
    const value = record(config[key], `${path}.${key}`);
    const part = {
      enabled: bool(value.enabled, `${path}.${key}.enabled`),
      inset: bool(value.inset, `${path}.${key}.inset`),
      alpha: numberInRange(value.alpha, 0, 100, `${path}.${key}.alpha`),
      x: numberInRange(value.x, -200, 200, `${path}.${key}.x`),
      y: numberInRange(value.y, -200, 200, `${path}.${key}.y`),
      blur: numberInRange(value.blur, 0, 400, `${path}.${key}.blur`),
      spread: numberInRange(value.spread, -200, 200, `${path}.${key}.spread`),
      color: nonEmptyText(value.color, `${path}.${key}.color`),
    };
    if (!part.inset) throw new Error(`ck.web_code.shell_invalid:${path}.${key}.inset`);
    return [key, part];
  })) as Record<string, { enabled: boolean; inset: boolean; alpha: number; x: number; y: number; blur: number; spread: number; color: string }>;
  const layers = sides.flatMap((side) => {
    const value = parts[linked ? 'all' : side];
    const { enabled, alpha, blur, spread } = value;
    const axis = side === 'left' || side === 'right' ? value.x : value.y;
    const size = Math.max(0, Math.min(400, Math.abs(axis) + blur + Math.max(0, spread)));
    if (!enabled || alpha <= 0 || size <= 0) return [];
    const mix = `color-mix(in oklab, ${value.color}, transparent ${100 - alpha}%)`;
    const direction = side === 'left' ? 'to right' : side === 'right' ? 'to left' : side === 'top' ? 'to bottom' : 'to top';
    const placement = side === 'left' || side === 'right' ? `${side} / ${size}px 100%` : `${side} / 100% ${size}px`;
    return [`linear-gradient(${direction}, ${mix}, transparent) ${placement} no-repeat`];
  });
  return { background: layers.length ? layers.join(', ') : 'none', layer };
}

function insideFadeMarkup(value: { background: string; layer: 'below-content' | 'above-content' }): string {
  if (value.background === 'none') return '';
  return `<div class="ck-inside-shadow-layer" data-layer="${value.layer}" aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;border-radius:inherit;z-index:${value.layer === 'above-content' ? '3' : '1'};background:${escapeAttr(value.background)}"></div>`;
}

function radius(value: unknown, path: string): string {
  const token = declared(value, ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full'] as const, path);
  return !token || token === 'none' ? '0' : `var(--control-radius-${token})`;
}

function fluidTypographySize(role: string, size: string, scale: RecordValue): string {
  const parsePx = (value: unknown): number | null => {
    const match = typeof value === 'string' ? value.trim().match(/^(\d+(?:\.\d+)?)px$/) : null;
    return match ? Number(match[1]) : null;
  };
  const maximum = parsePx(size);
  const minimum = parsePx(scale.xs);
  if (maximum === null || minimum === null || minimum <= 0 || maximum <= minimum) return size;
  const format = (value: number) => String(Math.round(value * 10000) / 10000);
  if (new Set(['title', 'bigBang', 'timer', 'cardTitle']).has(role)) {
    return `clamp(${minimum}px, calc(${minimum}px + ${format(((maximum - minimum) * 100) / 960)}cqi), ${maximum}px)`;
  }
  return `clamp(${minimum}px, ${format((maximum * 100) / 960)}cqi, ${maximum}px)`;
}

function typographyDeclarations(source: RecordValue, context: ResolvedWebCodeContext): Record<string, string> {
  const typography = record(source.typography, 'typography');
  const globalFamily = text(typography.globalFamily, 'typography.globalFamily');
  const roles = record(typography.roles, 'typography.roles');
  const scales = record(typography.roleScales, 'typography.roleScales');
  const out: Record<string, string> = {};
  const tracking: Record<string, string> = { tighter: '-0.03em', tight: '-0.015em', normal: '0em', wide: '0.015em', wider: '0.03em' };
  const leading: Record<string, string> = { snug: '1', tight: '1.15', relaxed: '1.4', loose: '1.6' };
  const normalLeading: Record<string, string> = { title: 'var(--lh-tight)', body: 'var(--lh-body)', section: 'var(--lh-tight)', question: 'var(--lh-tight)', answer: 'var(--lh-body)', heading: 'var(--lh-tight)', timer: '1', label: 'var(--lh-tight)', button: 'var(--lh-tight)' };
  Object.entries(roles).forEach(([name, raw]) => {
    const roleValue = record(raw, `typography.roles.${name}`);
    const preset = roleValue.sizePreset === undefined ? 'm' : declared(roleValue.sizePreset, ['xs', 's', 'm', 'l', 'xl', 'custom'] as const, `typography.roles.${name}.sizePreset`);
    const roleScale = record(scales[name], `typography.roleScales.${name}`);
    ['xs', 's', 'm', 'l', 'xl'].forEach((scaleName) => {
      const scaleValue = text(roleScale[scaleName], `typography.roleScales.${name}.${scaleName}`);
      if (!/^(?:0|(?:\d+(?:\.\d+)?)(?:px|rem|em|vw|vh|%))$/.test(scaleValue) && !/^(?:var|calc|clamp|min|max)\(.+\)$/.test(scaleValue)) {
        throw new Error(`ck.web_code.shell_invalid:typography.roleScales.${name}.${scaleName}`);
      }
    });
    if (roleValue.sizeCustom !== undefined) numberInRange(roleValue.sizeCustom, 1, 400, `typography.roles.${name}.sizeCustom`);
    if (roleValue.trackingCustom !== undefined) numberInRange(roleValue.trackingCustom, -1, 1, `typography.roles.${name}.trackingCustom`);
    if (roleValue.lineHeightCustom !== undefined) numberInRange(roleValue.lineHeightCustom, 0.5, 4, `typography.roles.${name}.lineHeightCustom`);
    const color = roleValue.color === undefined ? { type: 'color', color: 'var(--color-system-black)' } : record(roleValue.color, `typography.roles.${name}.color`);
    const family = optionalText(roleValue.family, globalFamily, `typography.roles.${name}.family`).replace(/"/g, '');
    const familyClass = context.typography.curatedFonts[family]?.familyClass;
    if (familyClass !== 'sans' && familyClass !== 'serif') throw new Error(`ck.web_code.typography_font_missing:${family}`);
    const familyValue = familyClass === 'serif' ? `"${family}", serif` : family === 'Inter' ? '"Inter", sans-serif' : `"${family}", "Inter", sans-serif`;
    const fontStyle = roleValue.fontStyle === undefined ? 'normal' : declared(roleValue.fontStyle, ['normal', 'italic'] as const, `typography.roles.${name}.fontStyle`);
    const weight = optionalText(roleValue.weight, '400', `typography.roles.${name}.weight`);
    if (!/^\d{3}$/.test(weight)) throw new Error(`ck.web_code.shell_invalid:typography.roles.${name}.weight`);
    const selectedSize = preset === 'custom' ? `${numberInRange(roleValue.sizeCustom, 1, 400, `typography.roles.${name}.sizeCustom`)}px` : text(roleScale[preset], `typography.roleScales.${name}.${preset}`);
    const size = fluidTypographySize(name, selectedSize, roleScale);
    const trackingPreset = roleValue.trackingPreset === undefined ? 'normal' : declared(roleValue.trackingPreset, ['tighter', 'tight', 'normal', 'wide', 'wider', 'custom'] as const, `typography.roles.${name}.trackingPreset`);
    const trackingValue = trackingPreset === 'custom' ? `${numberInRange(roleValue.trackingCustom, -1, 1, `typography.roles.${name}.trackingCustom`)}em` : tracking[trackingPreset];
    const linePreset = roleValue.lineHeightPreset === undefined ? 'normal' : declared(roleValue.lineHeightPreset, ['snug', 'tight', 'normal', 'relaxed', 'loose', 'custom'] as const, `typography.roles.${name}.lineHeightPreset`);
    const lineValue = linePreset === 'custom' ? String(numberInRange(roleValue.lineHeightCustom, 0.5, 4, `typography.roles.${name}.lineHeightCustom`)) : linePreset === 'normal' ? (normalLeading[name] ?? 'normal') : leading[linePreset];
    const aliases = new Set([name, name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()]);
    aliases.forEach((varName) => {
      out[`--typo-${varName}-family`] = familyValue;
      out[`--typo-${varName}-style`] = fontStyle;
      out[`--typo-${varName}-weight`] = weight;
      out[`--typo-${varName}-size`] = size;
      out[`--typo-${varName}-tracking`] = trackingValue;
      out[`--typo-${varName}-line-height`] = lineValue;
      out[`--typo-${varName}-color`] = cssBackground(color, `typography.roles.${name}.color`);
    });
  });
  return out;
}

function videoLayer(fillRaw: unknown): string {
  const fill = record(fillRaw, 'fill');
  if (fill.type !== 'video') return '';
  const video = record(fill.video, 'fill.video');
  const flags = `${video.autoplay === true ? ' autoplay' : ''}${video.muted === true ? ' muted' : ''}${video.loop === true ? ' loop' : ''}`;
  const poster = typeof video.poster === 'string' && video.poster ? ` poster="${escapeAttr(video.poster)}"` : '';
  return `<div class="ck-fill-layer" data-fill-kind="video" aria-hidden="true"><video playsinline${flags}${poster} src="${escapeAttr(text(video.src, 'fill.video.src'))}" style="width:100%;height:100%;display:block;object-fit:${escapeAttr(text(video.fit, 'fill.video.fit'))};object-position:${escapeAttr(text(video.position, 'fill.video.position'))}"></video></div>`;
}

function selectedTypographyFamilies(source: RecordValue): Set<string> {
  const typography = record(source.typography, 'typography');
  const globalFamily = nonEmptyText(typography.globalFamily, 'typography.globalFamily');
  const roles = record(typography.roles, 'typography.roles');
  return new Set([globalFamily, ...Object.entries(roles).map(([name, raw]) => optionalText(record(raw, `typography.roles.${name}`).family, globalFamily, `typography.roles.${name}.family`))]);
}

function typographyFontCss(context: ResolvedWebCodeContext, selectedFamilies: Set<string>): string {
  const imports: string[] = [];
  const faces: string[] = [];
  Object.entries(context.typography.curatedFonts).forEach(([family, meta]) => {
    if (!selectedFamilies.has(family)) return;
    if (!family.trim() || family.includes('"') || !meta || typeof meta !== 'object') {
      throw new Error('ck.web_code.typography_font_invalid');
    }
    if (
      (meta.familyClass !== 'sans' && meta.familyClass !== 'serif') ||
      !Array.isArray(meta.weights) || !meta.weights.length || meta.weights.some((weight) => typeof weight !== 'string' || !/^\d{3}$/.test(weight)) ||
      !Array.isArray(meta.styles) || !meta.styles.length || meta.styles.some((style) => style !== 'normal' && style !== 'italic')
    ) {
      throw new Error(`ck.web_code.typography_font_invalid:${family}`);
    }
    if (meta.source === 'google') {
      if (typeof meta.spec !== 'string' || !/^[A-Za-z0-9+,:;@.\-]+$/.test(meta.spec)) {
        throw new Error(`ck.web_code.typography_font_invalid:${family}`);
      }
      imports.push(`@import url("https://fonts.googleapis.com/css2?family=${meta.spec}&display=swap");`);
      return;
    }
    if (meta.source !== 'account-asset' || !/^https?:\/\/|^\//i.test(meta.url)) {
      throw new Error(`ck.web_code.typography_font_invalid:${family}`);
    }
    const mime = meta.contentType.split(';', 1)[0]?.trim().toLowerCase();
    const format = mime === 'font/woff2' ? 'woff2' : mime === 'font/woff' || mime === 'application/font-woff' || mime === 'application/x-font-woff' ? 'woff' : mime === 'font/ttf' || mime === 'application/x-font-ttf' ? 'truetype' : mime === 'font/otf' || mime === 'application/x-font-otf' ? 'opentype' : '';
    if (!format) {
      throw new Error(`ck.web_code.typography_font_invalid:${family}`);
    }
    const url = meta.url.replace(/"/g, '%22');
    faces.push(...meta.styles.flatMap((style) => meta.weights.map((weight) => `@font-face{font-family:"${family}";src:url("${url}") format("${format}");font-style:${style};font-weight:${weight};font-display:swap;}`)));
  });
  return [...imports, ...faces].join('\n');
}

function validateSelectedFonts(source: RecordValue, context: ResolvedWebCodeContext): void {
  const typography = record(source.typography, 'typography');
  const globalFamily = text(typography.globalFamily, 'typography.globalFamily');
  const roles = record(typography.roles, 'typography.roles');
  const selections = [{ family: globalFamily, weight: null, style: null }, ...Object.entries(roles).map(([name, raw]) => {
    const roleValue = record(raw, `typography.roles.${name}`);
    return {
      family: optionalText(roleValue.family, globalFamily, `typography.roles.${name}.family`),
      weight: optionalText(roleValue.weight, '400', `typography.roles.${name}.weight`),
      style: optionalText(roleValue.fontStyle, 'normal', `typography.roles.${name}.fontStyle`),
    };
  })];
  selections.forEach((selection) => {
    const font = context.typography.curatedFonts[selection.family];
    if (!font) throw new Error(`ck.web_code.typography_font_missing:${selection.family}`);
    if (selection.weight && !font.weights.includes(selection.weight)) throw new Error(`ck.web_code.typography_weight_invalid:${selection.family}:${selection.weight}`);
    if (selection.style && !font.styles.includes(selection.style as 'normal' | 'italic')) throw new Error(`ck.web_code.typography_style_invalid:${selection.family}:${selection.style}`);
  });
}

export function renderTypographyFontStyleModule(
  sources: SavedInstanceStructuredSource[],
  context: ResolvedWebCodeContext,
): string {
  const families = new Set<string>();
  sources.forEach((raw) => {
    const source = record(raw, 'source');
    validateSelectedFonts(source, context);
    selectedTypographyFamilies(source).forEach((family) => families.add(family));
  });
  const css = typographyFontCss(context, families);
  return css ? `/* ck-style-module:${TYPOGRAPHY_FONT_STYLE_MODULE_ID} */\n${css}\n/* ck-style-module:end */\n\n` : '';
}

export function materializeShell(args: {
  html: string;
  stylesCss: string;
  source: SavedInstanceStructuredSource;
  overlays: ExactLocaleOverlays | null;
  baseLocale: string;
  context: ResolvedWebCodeContext;
}): { html: string; stylesCss: string } {
  const source = record(args.source, 'source');
  validateSelectedFonts(source, args.context);
  const typographyVars = typographyDeclarations(source, args.context);
  const header = record(source.header, 'header');
  const cta = record(source.headerCta, 'headerCta');
  const stage = record(source.stage, 'stage');
  const pod = record(source.pod, 'pod');
  const appearance = record(source.appearance, 'appearance');
  const coreSize = record(source.coreSize, 'coreSize');
  const stagePadding = record(stage.padding, 'stage.padding');
  const podPadding = record(pod.padding, 'pod.padding');
  const stageDesktop = box(stagePadding.desktop, 'stage.padding.desktop');
  const stageMobile = box(stagePadding.mobile, 'stage.padding.mobile');
  const podDesktop = box(podPadding.desktop, 'pod.padding.desktop');
  const podMobile = box(podPadding.mobile, 'pod.padding.mobile');
  const canvas = record(stage.canvas, 'stage.canvas');
  const canvasMode = declared(canvas.mode, ['wrap', 'viewport', 'fixed'] as const, 'stage.canvas.mode');
  numberInRange(canvas.width, 0, 10000, 'stage.canvas.width');
  numberInRange(canvas.height, 0, 10000, 'stage.canvas.height');
  declared(header.placement, ['top', 'bottom', 'left', 'right'] as const, 'header.placement');
  bool(header.enabled, 'header.enabled');
  text(header.title, 'header.title');
  bool(header.showSubtitle, 'header.showSubtitle');
  text(header.subtitleHtml, 'header.subtitleHtml');
  declared(header.alignment, ['left', 'center', 'right'] as const, 'header.alignment');
  declared(header.ctaPlacement, ['right', 'below'] as const, 'header.ctaPlacement');
  declared(cta.openMode, ['same-tab', 'new-tab', 'new-window'] as const, 'headerCta.openMode');
  bool(cta.enabled, 'headerCta.enabled');
  text(cta.label, 'headerCta.label');
  const ctaHref = text(cta.href, 'headerCta.href').trim();
  if (ctaHref) {
    try {
      const parsed = new URL(ctaHref);
      if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) throw new Error();
    } catch {
      throw new Error('ck.web_code.shell_invalid:headerCta.href');
    }
  }
  bool(cta.iconEnabled, 'headerCta.iconEnabled');
  declared(cta.iconName, ['checkmark', 'arrow.right', 'chevron.right', 'arrowshape.forward', 'arrowshape.turn.up.right'] as const, 'headerCta.iconName');
  declared(cta.iconPlacement, ['left', 'right'] as const, 'headerCta.iconPlacement');
  declared(pod.widthMode, ['wrap', 'fixed', 'full'] as const, 'pod.widthMode');
  const coreMode = declared(coreSize.mode, ['auto', 'fixed', 'responsive'] as const, 'coreSize.mode');
  const coreFixedHeight = numberInRange(coreSize.fixedHeight, 0, 2000, 'coreSize.fixedHeight');
  const coreMinHeight = numberInRange(coreSize.minHeight, 0, 2000, 'coreSize.minHeight');
  const corePreferredVw = numberInRange(coreSize.preferredVw, 0, 200, 'coreSize.preferredVw');
  const coreMaxHeight = numberInRange(coreSize.maxHeight, coreMinHeight, 2400, 'coreSize.maxHeight');
  const stageInside = insideFade(stage.insideShadow, 'stage.insideShadow');
  const podInside = insideFade(pod.insideShadow, 'pod.insideShadow');
  const stageHasVideo = record(stage.background, 'stage.background').type === 'video';
  const podHasVideo = record(pod.background, 'pod.background').type === 'video';
  const floating = stage.floating === undefined ? null : record(stage.floating, 'stage.floating');
  const floatingEnabled = floating ? bool(floating.enabled, 'stage.floating.enabled') : false;
  const floatingAnchors = new Set(['top', 'bottom', 'left', 'right', 'center', 'top-left', 'top-right', 'bottom-left', 'bottom-right']);
  const floatingAnchor = floating ? text(floating.anchor, 'stage.floating.anchor') : '';
  if (floating && !floatingAnchors.has(floatingAnchor)) throw new Error('ck.web_code.shell_invalid:stage.floating.anchor');
  const declaredFloatingOffset = floating ? numberInRange(floating.offset, 0, 400, 'stage.floating.offset') : 0;
  const floatingOffset = floatingEnabled && floatingAnchor !== 'center' ? declaredFloatingOffset : 0;
  const alignment = declared(stage.alignment, ['left', 'right', 'top', 'bottom', 'center'] as const, 'stage.alignment');
  let align = alignment === 'left' ? ['flex-start', 'center'] : alignment === 'right' ? ['flex-end', 'center'] : alignment === 'bottom' ? ['center', 'flex-end'] : alignment === 'top' ? ['center', 'flex-start'] : ['center', 'center'];
  if (floatingEnabled) {
    const vertical = floatingAnchor.startsWith('top') ? 'flex-start' : floatingAnchor.startsWith('bottom') ? 'flex-end' : 'center';
    const horizontal = floatingAnchor.endsWith('left') || floatingAnchor === 'left' ? 'flex-start' : floatingAnchor.endsWith('right') || floatingAnchor === 'right' ? 'flex-end' : 'center';
    align = [horizontal, vertical];
  }
  let html = args.html;
  html = html.replace(/<html\b[^>]*>/i, (tag) => setAttr(tag, 'lang', args.baseLocale));
  html = transformTag(html, role('stage'), (tag) => {
    let next = setAttr(tag, 'data-canvas-mode', canvasMode);
    if (floatingEnabled) {
      next = setAttr(next, 'data-stage-floating', 'true');
      next = setAttr(next, 'data-stage-floating-anchor', floatingAnchor);
      next = setAttr(next, 'data-stage-floating-offset', String(floatingOffset));
    } else if (alignment === 'center') {
      next = setAttr(next, 'data-stage-center-compensated', 'true');
    }
    const styles: Record<string, string> = {
      '--stage-bg': cssBackground(stage.background, 'stage.background'),
      '--stage-shadow': shadow(stage.shadow, 'stage.shadow'),
      '--stage-fixed-width': number(canvas.width, 'stage.canvas.width') > 0 ? `${canvas.width}px` : 'auto',
      '--stage-fixed-height': number(canvas.height, 'stage.canvas.height') > 0 ? `${canvas.height}px` : 'auto',
      '--stage-pad-desktop-top': `${stageDesktop.top}px`, '--stage-pad-desktop-right': `${stageDesktop.right}px`, '--stage-pad-desktop-bottom': `${stageDesktop.bottom}px`, '--stage-pad-desktop-left': `${stageDesktop.left}px`,
      '--stage-pad-mobile-top': `${stageMobile.top}px`, '--stage-pad-mobile-right': `${stageMobile.right}px`, '--stage-pad-mobile-bottom': `${stageMobile.bottom}px`, '--stage-pad-mobile-left': `${stageMobile.left}px`,
      'justify-content': align[0], 'align-items': align[1], 'position': 'relative',
      ...(stageHasVideo && !floatingEnabled ? { isolation: 'isolate' } : {}),
    };
    if (floatingEnabled) Object.assign(styles, { position: 'fixed', inset: `${floatingOffset}px`, width: 'auto', height: 'auto', 'min-height': '0', margin: '0', padding: '0', 'z-index': '1000', 'pointer-events': 'none', background: 'transparent', 'box-shadow': 'none' });
    return mergeStyle(next, styles);
  }, 'stage');
  html = transformTag(html, role('pod'), (tag) => {
    const border = record(appearance.podBorder, 'appearance.podBorder');
    const borderEnabled = bool(border.enabled, 'appearance.podBorder.enabled');
    const borderWidth = numberInRange(border.width, 0, 12, 'appearance.podBorder.width');
    const borderColor = text(border.color, 'appearance.podBorder.color');
    const linked = bool(pod.radiusLinked, 'pod.radiusLinked');
    [pod.radius, pod.radiusTL, pod.radiusTR, pod.radiusBR, pod.radiusBL].forEach((value, index) => radius(value, `pod.radius.${index}`));
    const radii = linked ? [pod.radius, pod.radius, pod.radius, pod.radius] : [pod.radiusTL, pod.radiusTR, pod.radiusBR, pod.radiusBL];
    let next = setAttr(tag, 'data-width-mode', text(pod.widthMode, 'pod.widthMode'));
    return mergeStyle(next, {
      '--pod-bg': cssBackground(pod.background, 'pod.background'), '--pod-shadow': shadow(pod.shadow, 'pod.shadow'),
      '--pod-border-width': borderEnabled ? `${borderWidth}px` : '0px',
      '--pod-border-color': borderEnabled ? borderColor : 'transparent',
      '--pod-radius': radii.map((item, index) => radius(item, `pod.radius.${index}`)).join(' '), '--content-width': `${numberInRange(pod.contentWidth, 0, 10000, 'pod.contentWidth')}px`,
      '--pod-pad-desktop-top': `${podDesktop.top}px`, '--pod-pad-desktop-right': `${podDesktop.right}px`, '--pod-pad-desktop-bottom': `${podDesktop.bottom}px`, '--pod-pad-desktop-left': `${podDesktop.left}px`,
      '--pod-pad-mobile-top': `${podMobile.top}px`, '--pod-pad-mobile-right': `${podMobile.right}px`, '--pod-pad-mobile-bottom': `${podMobile.bottom}px`, '--pod-pad-mobile-left': `${podMobile.left}px`, 'position': 'relative', ...(podHasVideo ? { isolation: 'isolate' } : {}), ...(floatingEnabled ? { 'pointer-events': 'auto' } : {}), ...(stageHasVideo || stageInside.layer === 'below-content' ? { 'z-index': '2' } : {}),
    });
  }, 'pod');
  html = transformTag(html, /\sclass=["'][^"']*\bck-headerLayout\b/i, (tag) => {
    const ctaAppearance = record(appearance.headerCta, 'appearance.headerCta');
    const ctaBorder = record(ctaAppearance.border, 'appearance.headerCta.border');
    const ctaBorderEnabled = bool(ctaBorder.enabled, 'appearance.headerCta.border.enabled');
    const ctaBorderWidth = numberInRange(ctaBorder.width, 0, 12, 'appearance.headerCta.border.width');
    const ctaBorderColor = text(ctaBorder.color, 'appearance.headerCta.border.color');
    bool(ctaAppearance.paddingLinked, 'appearance.headerCta.paddingLinked');
    const ctaPaddingInline = numberInRange(ctaAppearance.paddingInline, 0, 200, 'appearance.headerCta.paddingInline');
    const ctaPaddingBlock = numberInRange(ctaAppearance.paddingBlock, 0, 200, 'appearance.headerCta.paddingBlock');
    const ctaIconSize = numberInRange(ctaAppearance.iconSize, 0, 200, 'appearance.headerCta.iconSize');
    let next = setAttr(tag, 'data-has-header', bool(header.enabled, 'header.enabled') ? 'true' : 'false');
    next = setAttr(next, 'data-header-placement', text(header.placement, 'header.placement'));
    return mergeStyle(next, {
      '--ck-header-gap': `${numberInRange(header.gap, 0, 200, 'header.gap')}px`, '--ck-header-inner-gap': `${numberInRange(header.innerGap, 0, 200, 'header.innerGap')}px`, '--ck-header-text-gap': `${numberInRange(header.textGap, 0, 200, 'header.textGap')}px`,
      '--ck-header-cta-bg': cssBackground(ctaAppearance.background, 'appearance.headerCta.background'),
      '--ck-header-cta-fg': cssBackground(ctaAppearance.textColor, 'appearance.headerCta.textColor'),
      '--ck-header-cta-radius': radius(ctaAppearance.radius, 'appearance.headerCta.radius'),
      '--ck-header-cta-border-width': ctaBorderEnabled ? `${ctaBorderWidth}px` : '0px',
      '--ck-header-cta-border-color': ctaBorderEnabled ? ctaBorderColor : 'transparent',
      '--ck-header-cta-padding-inline': `${ctaPaddingInline}px`,
      '--ck-header-cta-padding-block': `${ctaPaddingBlock}px`,
      '--ck-header-cta-icon-size': `${ctaIconSize}px`,
      '--ck-header-cta-icon': bool(cta.iconEnabled, 'headerCta.iconEnabled') ? `url("/dieter/icons/svg/${escapeAttr(text(cta.iconName, 'headerCta.iconName'))}.svg")` : 'none',
      ...typographyVars,
    });
  }, 'header-layout');
  html = transformTag(html, /\sclass=["'][^"']*\bck-header\b/i, (tag) => setAttr(setAttr(setAttr(tag, 'data-align', text(header.alignment, 'header.alignment')), 'data-cta-placement', text(header.ctaPlacement, 'header.ctaPlacement')), 'data-cta', bool(cta.enabled, 'headerCta.enabled') ? 'true' : 'false'), 'header');
  html = transformTag(html, role('header-cta'), (tag) => {
    const mode = text(cta.openMode, 'headerCta.openMode');
    let next = setAttr(tag, 'data-icon-placement', text(cta.iconPlacement, 'headerCta.iconPlacement'));
    next = setAttr(next, 'target', ctaHref && mode === 'new-tab' ? '_blank' : null);
    next = setAttr(next, 'rel', ctaHref && mode === 'new-tab' ? 'noopener' : null);
    next = setAttr(next, 'href', ctaHref || null);
    next = setAttr(next, 'aria-disabled', ctaHref ? null : 'true');
    next = setAttr(next, 'tabindex', ctaHref ? null : '-1');
    return next;
  }, 'header-cta');
  html = transformTag(html, /\sclass=["'][^"']*\bck-header__ctaIcon\b/i, (tag) => setAttr(tag, 'hidden', bool(cta.iconEnabled, 'headerCta.iconEnabled') ? null : ''), 'header-cta-icon');
  html = transformTag(html, /\sclass=["'][^"']*\bck-headerLayout__body\b/i, (tag) => {
    const mode = coreMode;
    let next = setAttr(tag, 'data-core-size-mode', mode);
    if (mode === 'fixed') next = mergeStyle(next, { height: `${coreFixedHeight}px` });
    if (mode === 'responsive') next = mergeStyle(next, { 'min-height': `clamp(${coreMinHeight}px, ${corePreferredVw}vw, ${coreMaxHeight}px)` });
    return next;
  }, 'core');
  html = transformTag(html, role('root'), (tag) => mergeStyle(tag, podHasVideo || podInside.layer === 'below-content' ? { position: 'relative', 'z-index': '2' } : { position: 'relative' }), 'root');

  const stageVideo = videoLayer(stage.background);
  const podVideo = videoLayer(pod.background);
  if (stageVideo && !floatingEnabled) html = html.replace(/(<[^>]+data-role=["']stage["'][^>]*>)/i, `$1${stageVideo}`);
  if (podVideo) html = html.replace(/(<[^>]+data-role=["']pod["'][^>]*>)/i, `$1${podVideo}`);
  const stageInsideMarkup = insideFadeMarkup(stageInside);
  const podInsideMarkup = insideFadeMarkup(podInside);
  if (stageInsideMarkup && !floatingEnabled) html = html.replace(/(<[^>]+data-role=["']stage["'][^>]*>)/i, `$1${stageInsideMarkup}`);
  if (podInsideMarkup) html = html.replace(/(<[^>]+data-role=["']pod["'][^>]*>)/i, `$1${podInsideMarkup}`);

  const locale = record(source.localeSwitcher, 'localeSwitcher');
  const localeEnabled = bool(locale.enabled, 'localeSwitcher.enabled');
  const localeAttachTo = declared(locale.attachTo, ['stage', 'pod'] as const, 'localeSwitcher.attachTo');
  const localePosition = declared(locale.position, ['top-left', 'top-center', 'top-right', 'right-middle', 'bottom-right', 'bottom-center', 'bottom-left', 'left-middle'] as const, 'localeSwitcher.position');
  const localeBackground = cssBackground(appearance.localeSwitcherBackground, 'appearance.localeSwitcherBackground');
  const localeForeground = cssBackground(appearance.localeSwitcherTextColor, 'appearance.localeSwitcherTextColor');
  const localeBorder = record(appearance.localeSwitcherBorder, 'appearance.localeSwitcherBorder');
  const localeBorderEnabled = bool(localeBorder.enabled, 'appearance.localeSwitcherBorder.enabled');
  const localeBorderWidth = numberInRange(localeBorder.width, 0, 12, 'appearance.localeSwitcherBorder.width');
  const localeBorderColor = text(localeBorder.color, 'appearance.localeSwitcherBorder.color');
  const localeRadius = radius(appearance.localeSwitcherRadius, 'appearance.localeSwitcherRadius');
  const localePaddingInline = numberInRange(appearance.localeSwitcherPaddingInline, 0, 200, 'appearance.localeSwitcherPaddingInline');
  const localePaddingBlock = numberInRange(appearance.localeSwitcherPaddingBlock, 0, 200, 'appearance.localeSwitcherPaddingBlock');
  const baseLocale = exactLocale(args.baseLocale, 'baseLocale');
  const localeCoordinates = [args.baseLocale, ...Object.keys(args.overlays ?? {})];
  const seenLocales = new Set<string>();
  localeCoordinates.forEach((coordinate) => {
    const normalized = exactLocale(coordinate, `locale.${coordinate}`).toLowerCase();
    if (seenLocales.has(normalized)) throw new Error(`ck.web_code.instance_locale_invalid:${coordinate}`);
    seenLocales.add(normalized);
  });
  if (localeEnabled && localeCoordinates.length > 1) {
    const options = localeCoordinates.map((coordinate, index) => `<option value="${escapeAttr(coordinate)}"${index === 0 ? ' selected' : ''}>${escapeAttr(resolveLocaleLabel({ locales: CANONICAL_LOCALES, uiLocale: args.baseLocale, locale: coordinate }))}</option>`).join('');
    const localeStyles: Record<string, string> = {
      '--ck-locale-switcher-bg': localeBackground, '--ck-locale-switcher-fg': localeForeground,
      '--ck-locale-switcher-radius': localeRadius, '--ck-locale-switcher-border-width': localeBorderEnabled ? `${localeBorderWidth}px` : '0px',
      '--ck-locale-switcher-border-color': localeBorderEnabled ? localeBorderColor : 'transparent',
      '--ck-locale-switcher-padding-inline': `${localePaddingInline}px`, '--ck-locale-switcher-padding-block': `${localePaddingBlock}px`,
      '--ck-locale-switcher-arrow': 'url("/dieter/icons/svg/chevron.down.svg")',
    };
    Object.entries(typographyVars).filter(([name]) => name.startsWith('--typo-locale-switcher-')).forEach(([name, value]) => { localeStyles[name] = value; });
    const localeStyle = Object.entries(localeStyles).map(([name, value]) => `${name}: ${value}`).join('; ');
    const markup = `<div class="ck-locale-switcher" data-host="${localeAttachTo}" data-position="${localePosition}" style="${escapeAttr(localeStyle)}"><select class="ck-locale-switcher__select" aria-label="Language" data-current-locale="${escapeAttr(args.baseLocale)}">${options}</select></div>`;
    html = html.replace(new RegExp(`(<[^>]+data-role=["']${localeAttachTo}["'][^>]*>)`, 'i'), `$1${markup}`);
  }
  const behavior = record(source.behavior, 'behavior');
  bool(behavior.seoGeoAeoEnabled, 'behavior.seoGeoAeoEnabled');
  bool(behavior.showBacklink, 'behavior.showBacklink');
  const social = record(behavior.socialShare, 'behavior.socialShare');
  const socialEnabled = bool(social.enabled, 'behavior.socialShare.enabled');
  const channels = record(social.channels, 'behavior.socialShare.channels');
  const labels: Record<string, string> = { copy: 'Copy link', sms: 'SMS', email: 'Email', whatsapp: 'WhatsApp', telegram: 'Telegram', signal: 'Signal', messenger: 'Messenger', wechat: 'WeChat', line: 'LINE', slack: 'Slack', teams: 'Teams', discord: 'Discord', x: 'X', linkedin: 'LinkedIn', facebook: 'Facebook', reddit: 'Reddit', instagram: 'Instagram', tiktok: 'TikTok' };
  Object.keys(channels).forEach((name) => { if (!Object.hasOwn(labels, name)) throw new Error(`ck.web_code.shell_invalid:behavior.socialShare.channels.${name}`); });
  Object.keys(labels).forEach((name) => {
    if (!Object.hasOwn(channels, name)) throw new Error(`ck.web_code.shell_invalid:behavior.socialShare.channels.${name}`);
    bool(channels[name], `behavior.socialShare.channels.${name}`);
  });
  const socialAttachTo = declared(social.attachTo, ['stage', 'pod'] as const, 'behavior.socialShare.attachTo');
  const socialPosition = declared(social.position, ['top-left', 'top-center', 'top-right', 'right-middle', 'bottom-right', 'bottom-center', 'bottom-left', 'left-middle'] as const, 'behavior.socialShare.position');
  if (socialEnabled) {
    const cards = (names: string[]) => names.filter((name) => channels[name] === true).map((name) => `<button type="button" class="ck-socialShare__card" data-action="${name}" data-ck-share-label="${labels[name]}"><span class="ck-socialShare__cardLabel">${labels[name]}</span></button>`).join('');
    const messageCards = cards(['copy', 'sms', 'email', 'whatsapp', 'telegram', 'signal', 'messenger', 'wechat', 'line', 'slack', 'teams', 'discord']);
    const socialCards = cards(['x', 'linkedin', 'facebook', 'reddit', 'instagram', 'tiktok']);
    if (messageCards || socialCards) {
      const markup = `<div class="ck-socialShare" data-ck-social-share-root data-host="${socialAttachTo}" data-position="${socialPosition}"><div class="ck-socialShare__toast" role="status" aria-live="polite"></div><div class="ck-socialShare__topbar"><details class="ck-socialShare__details"><summary class="ck-socialShare__button">Share</summary><div class="ck-socialShare__menu" role="menu" aria-label="Share"><div class="ck-socialShare__section"${messageCards ? '' : ' hidden'}><div class="ck-socialShare__sectionTitle">Send this widget as message</div><div class="ck-socialShare__grid">${messageCards}</div></div><div class="ck-socialShare__section"${socialCards ? '' : ' hidden'}><div class="ck-socialShare__sectionTitle">Share this widget on social</div><div class="ck-socialShare__grid">${socialCards}</div></div></div></details></div></div>`;
      html = html.replace(new RegExp(`(<[^>]+data-role=["']${socialAttachTo}["'][^>]*>)`, 'i'), `$1${markup}`);
    }
  }
  const fontModule = renderTypographyFontStyleModule([source], args.context);
  const staticShellCss = `.ck-fill-layer{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;border-radius:inherit}\n.stage[data-stage-center-compensated="true"]>.pod{left:calc((var(--stage-pad-desktop-right,0px) - var(--stage-pad-desktop-left,0px))/2);top:calc((var(--stage-pad-desktop-bottom,0px) - var(--stage-pad-desktop-top,0px))/2)}\n@media(max-width:900px){.stage[data-stage-center-compensated="true"]>.pod{left:calc((var(--stage-pad-mobile-right,0px) - var(--stage-pad-mobile-left,0px))/2);top:calc((var(--stage-pad-mobile-bottom,0px) - var(--stage-pad-mobile-top,0px))/2)}}`;
  const shellModule = `/* ck-style-module:generated/static-shell.css */\n${staticShellCss}\n/* ck-style-module:end */\n`;
  return { html, stylesCss: `${fontModule}${args.stylesCss.trimEnd()}\n\n${shellModule}` };
}
