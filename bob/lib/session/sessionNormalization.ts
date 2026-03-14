import type { CompiledWidget } from '../types';
import { applyWidgetNormalizationRules } from '../compiler/modules/normalization';

const GLOBAL_TYPOGRAPHY_ROLE_SCALES: Record<string, Record<'xs' | 's' | 'm' | 'l' | 'xl', string>> = {
  title: { xs: '20px', s: '28px', m: '36px', l: '44px', xl: '60px' },
  body: { xs: '14px', s: '16px', m: '18px', l: '22px', xl: '24px' },
  section: { xs: '12px', s: '13px', m: '14px', l: '16px', xl: '18px' },
  question: { xs: '14px', s: '16px', m: '18px', l: '22px', xl: '24px' },
  answer: { xs: '14px', s: '16px', m: '18px', l: '22px', xl: '24px' },
  button: { xs: '13px', s: '15px', m: '18px', l: '20px', xl: '24px' },
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function enforceGlobalTypographyRoleScales(config: Record<string, unknown>) {
  const typography = config.typography;
  if (!isPlainRecord(typography)) return;

  const roles = typography.roles;
  if (!isPlainRecord(roles)) return;

  const globalFamily =
    typeof typography.globalFamily === 'string' && typography.globalFamily.trim()
      ? typography.globalFamily.trim()
      : 'Inter';

  Object.values(roles).forEach((roleValue) => {
    if (!isPlainRecord(roleValue)) return;
    const family =
      typeof roleValue.family === 'string' && roleValue.family.trim()
        ? roleValue.family.trim()
        : globalFamily;
    roleValue.family = family;

    const sizePreset =
      typeof roleValue.sizePreset === 'string' && roleValue.sizePreset.trim()
        ? roleValue.sizePreset.trim()
        : 'm';
    roleValue.sizePreset = sizePreset;

    const weight =
      typeof roleValue.weight === 'string' && roleValue.weight.trim()
        ? roleValue.weight.trim()
        : '400';
    roleValue.weight = weight;

    const fontStyle =
      typeof roleValue.fontStyle === 'string' && roleValue.fontStyle.trim()
        ? roleValue.fontStyle.trim()
        : 'normal';
    roleValue.fontStyle = fontStyle;

    if (typeof roleValue.color === 'string') {
      const trimmed = roleValue.color.trim();
      roleValue.color = trimmed || '#131313';
    } else if (!isPlainRecord(roleValue.color)) {
      roleValue.color = '#131313';
    }

    const lineHeightPreset =
      typeof roleValue.lineHeightPreset === 'string' && roleValue.lineHeightPreset.trim()
        ? roleValue.lineHeightPreset.trim()
        : 'normal';
    roleValue.lineHeightPreset = lineHeightPreset;
    if (!Object.prototype.hasOwnProperty.call(roleValue, 'lineHeightCustom')) {
      roleValue.lineHeightCustom = 1.4;
    }

    const trackingPreset =
      typeof roleValue.trackingPreset === 'string' && roleValue.trackingPreset.trim()
        ? roleValue.trackingPreset.trim()
        : 'normal';
    roleValue.trackingPreset = trackingPreset;
    if (!Object.prototype.hasOwnProperty.call(roleValue, 'trackingCustom')) {
      roleValue.trackingCustom = 0;
    }
  });

  const roleScales = isPlainRecord(typography.roleScales)
    ? (typography.roleScales as Record<string, unknown>)
    : ((typography.roleScales = {}) as Record<string, unknown>);

  Object.entries(GLOBAL_TYPOGRAPHY_ROLE_SCALES).forEach(([roleKey, presetMap]) => {
    if (!isPlainRecord(roles[roleKey])) return;
    const currentRoleScale = isPlainRecord(roleScales[roleKey])
      ? (roleScales[roleKey] as Record<string, unknown>)
      : ((roleScales[roleKey] = {}) as Record<string, unknown>);
    currentRoleScale.xs = presetMap.xs;
    currentRoleScale.s = presetMap.s;
    currentRoleScale.m = presetMap.m;
    currentRoleScale.l = presetMap.l;
    currentRoleScale.xl = presetMap.xl;
  });
}

export function applyWidgetNormalizations(
  normalization: CompiledWidget['normalization'],
  config: Record<string, unknown>,
): Record<string, unknown> {
  const next = applyWidgetNormalizationRules(config, normalization);
  enforceGlobalTypographyRoleScales(next);
  return next;
}
