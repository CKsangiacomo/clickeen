import type { CompiledControl } from '../types';
import { getAt } from '../utils/paths';
import {
  getCkTypographyAllowedStyles,
  getCkTypographyAllowedWeights,
  isCkTypographyFamily,
} from './typography-fonts';

export type WidgetDataError = {
  path: string;
  message: string;
};

const TOKEN_SEGMENT = /^__[^.]+__$/;

const TYPOGRAPHY_SCALE_KEYS = ['xs', 's', 'm', 'l', 'xl'] as const;
const NUMERIC_STRING = /^-?\d+(?:\.\d+)?$/;

function isNumericString(value: string): boolean {
  return NUMERIC_STRING.test(value.trim());
}

function isCssLengthString(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed === '0' || trimmed === '0.0' || trimmed === '0.00') return true;
  if (/^var\(.+\)$/.test(trimmed)) return true;
  if (/^(?:calc|clamp|min|max)\(.+\)$/.test(trimmed)) return true;
  return /^-?\d+(?:\.\d+)?(px|rem|em|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc)$/.test(trimmed);
}

function inferRoleScaleKind(scale: Record<string, unknown>): 'number' | 'css-length' | null {
  let numericCount = 0;
  let lengthCount = 0;
  for (const key of TYPOGRAPHY_SCALE_KEYS) {
    const raw = scale[key];
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    if (isNumericString(value)) numericCount += 1;
    else if (isCssLengthString(value)) lengthCount += 1;
    else return null;
  }
  if (numericCount === TYPOGRAPHY_SCALE_KEYS.length) return 'number';
  if (lengthCount === TYPOGRAPHY_SCALE_KEYS.length) return 'css-length';
  return null;
}

export function getTypographyRoleScaleKind(
  data: Record<string, unknown>,
  roleKey: string,
): 'number' | 'css-length' | null {
  const raw = getAt<unknown>(data, `typography.roleScales.${roleKey}`);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return inferRoleScaleKind(raw as Record<string, unknown>);
}

export function validateNumberConstraints(control: CompiledControl, value: number): string | null {
  if (typeof control.min === 'number' && value < control.min) return `Value must be >= ${control.min}`;
  if (typeof control.max === 'number' && value > control.max) return `Value must be <= ${control.max}`;
  return null;
}

export function validateArrayItemIds(control: CompiledControl, value: unknown): string | null {
  if (!control.itemIdPath) return null;
  if (!Array.isArray(value)) return 'Value must be an array';

  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return `Array items must be objects with "${control.itemIdPath}"`;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const id = (item as any)[control.itemIdPath];
    if (typeof id !== 'string' || !id.trim()) {
      return `Array items must include a non-empty "${control.itemIdPath}"`;
    }
    if (seen.has(id)) {
      return `Duplicate "${control.itemIdPath}" value "${id}"`;
    }
    seen.add(id);
  }
  return null;
}

function toEnumValues(control: CompiledControl): string[] | null {
  if (control.enumValues && control.enumValues.length > 0) return control.enumValues;
  const fromOptions = control.options?.map((opt) => opt.value).filter(Boolean);
  return fromOptions && fromOptions.length > 0 ? fromOptions : null;
}

function isValidCssPropertyValue(property: 'color' | 'background', value: string): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
  return CSS.supports(property, value);
}

function validateControlValue(control: CompiledControl, value: unknown): string | null {
  if (!control.kind || control.kind === 'unknown') {
    return 'Control kind is missing or unknown';
  }
  if (value === undefined) return 'Missing required value';

  if (control.kind === 'boolean') {
    return typeof value === 'boolean' ? null : 'Value must be a boolean';
  }

  if (control.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'Value must be a finite number';
    return validateNumberConstraints(control, value);
  }

  if (control.kind === 'string' || control.kind === 'enum') {
    if (typeof value !== 'string') return 'Value must be a string';
    if (control.kind === 'enum') {
      const allowed = toEnumValues(control);
      if (!allowed) return 'Control is missing enum values';
      if (!allowed.includes(value)) return `Value must be one of: ${allowed.join(', ')}`;
    }
    return null;
  }

  if (control.kind === 'color') {
    if (typeof value !== 'string') return 'Value must be a string';
    const trimmed = value.trim();
    if (!trimmed) return 'Missing required value';
    const property: 'color' | 'background' = control.allowImage ? 'background' : 'color';
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
      return 'Cannot validate CSS values (CSS.supports unavailable)';
    }
    if (!isValidCssPropertyValue(property, trimmed)) {
      return property === 'background' ? 'Value must be a valid CSS background' : 'Value must be a valid CSS color';
    }
    return null;
  }

  if (control.kind === 'array') {
    if (!Array.isArray(value)) return 'Value must be an array';
    return validateArrayItemIds(control, value);
  }

  if (control.kind === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Value must be an object';
    return null;
  }

  if (control.kind === 'json') {
    // JSON accepts any value except undefined.
    return null;
  }

  return 'Unsupported control kind';
}

function validateControlInData(control: CompiledControl, data: Record<string, unknown>, errors: WidgetDataError[]) {
  const segments = control.path.split('.').filter(Boolean);

  const walk = (idx: number, current: unknown, acc: string[]) => {
    if (idx >= segments.length) {
      const err = validateControlValue(control, current);
      if (err) errors.push({ path: acc.join('.'), message: err });
      return;
    }

    const segment = segments[idx];
    if (TOKEN_SEGMENT.test(segment)) {
      if (!Array.isArray(current)) {
        errors.push({ path: acc.join('.'), message: 'Expected an array' });
        return;
      }
      current.forEach((item, itemIndex) => walk(idx + 1, item, [...acc, String(itemIndex)]));
      return;
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      errors.push({
        path: acc.join('.'),
        message: `Expected an object to resolve "${segment}"`,
      });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next = (current as any)[segment];
    walk(idx + 1, next, [...acc, segment]);
  };

  walk(0, data, []);
}

function validateTypographyRoleScales(data: Record<string, unknown>, errors: WidgetDataError[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typography = (data as any).typography;
  if (!typography || typeof typography !== 'object' || Array.isArray(typography)) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roles = (typography as any).roles;
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleScales = (typography as any).roleScales;
  if (!roleScales || typeof roleScales !== 'object' || Array.isArray(roleScales)) {
    errors.push({ path: 'typography.roleScales', message: 'Expected an object' });
    return;
  }

  Object.keys(roles).forEach((roleKey) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = (roles as any)[roleKey];
    if (!role || typeof role !== 'object' || Array.isArray(role)) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scale = (roleScales as any)[roleKey];
    if (!scale || typeof scale !== 'object' || Array.isArray(scale)) {
      errors.push({ path: `typography.roleScales.${roleKey}`, message: 'Expected an object' });
      return;
    }

    TYPOGRAPHY_SCALE_KEYS.forEach((k) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = (scale as any)[k];
      if (typeof v !== 'string' || !v.trim()) {
        errors.push({ path: `typography.roleScales.${roleKey}.${k}`, message: 'Missing required value' });
      }
    });

    const scaleKind = inferRoleScaleKind(scale as Record<string, unknown>);
    if (!scaleKind) {
      errors.push({
        path: `typography.roleScales.${roleKey}`,
        message: 'Role scale must be all numbers or all CSS lengths',
      });
    }

    const sizeCustom = role.sizeCustom;
    if (typeof sizeCustom !== 'string' || !sizeCustom.trim()) {
      errors.push({ path: `typography.roles.${roleKey}.sizeCustom`, message: 'Missing required value' });
    } else if (scaleKind === 'number' && !isNumericString(sizeCustom)) {
      errors.push({
        path: `typography.roles.${roleKey}.sizeCustom`,
        message: 'Custom size must be a number (no units), e.g. "110"',
      });
    } else if (scaleKind === 'css-length' && !isCssLengthString(sizeCustom)) {
      errors.push({
        path: `typography.roles.${roleKey}.sizeCustom`,
        message: 'Custom size must be a CSS length, e.g. "24px" or "var(--fs-24)"',
      });
    }
  });
}

function validateTypographyFontsAndWeights(data: Record<string, unknown>, errors: WidgetDataError[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typography = (data as any).typography;
  if (!typography || typeof typography !== 'object' || Array.isArray(typography)) return;

  const globalFamily = typography.globalFamily;
  if (typeof globalFamily !== 'string' || !globalFamily.trim()) {
    errors.push({ path: 'typography.globalFamily', message: 'Missing required value' });
  } else if (!isCkTypographyFamily(globalFamily)) {
    errors.push({ path: 'typography.globalFamily', message: `Unknown font family "${globalFamily}"` });
  }

  const roles = typography.roles;
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) return;

  Object.keys(roles).forEach((roleKey) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = (roles as any)[roleKey];
    if (!role || typeof role !== 'object' || Array.isArray(role)) return;

    const family = role.family;
    if (typeof family !== 'string' || !family.trim()) {
      errors.push({ path: `typography.roles.${roleKey}.family`, message: 'Missing required value' });
      return;
    }
    if (!isCkTypographyFamily(family)) {
      errors.push({ path: `typography.roles.${roleKey}.family`, message: `Unknown font family "${family}"` });
      return;
    }

    const weight = role.weight;
    if (typeof weight !== 'string' || !weight.trim()) {
      errors.push({ path: `typography.roles.${roleKey}.weight`, message: 'Missing required value' });
      return;
    }

    const allowed = getCkTypographyAllowedWeights(family);
    if (!allowed.includes(weight)) {
      errors.push({
        path: `typography.roles.${roleKey}.weight`,
        message: `Value must be one of: ${allowed.join(', ')}`,
      });
    }

    const fontStyle = role.fontStyle;
    if (typeof fontStyle !== 'string' || !fontStyle.trim()) {
      errors.push({ path: `typography.roles.${roleKey}.fontStyle`, message: 'Missing required value' });
      return;
    }

    const allowedStyles = getCkTypographyAllowedStyles(family);
    if (!allowedStyles.includes(fontStyle)) {
      errors.push({
        path: `typography.roles.${roleKey}.fontStyle`,
        message: `Value must be one of: ${allowedStyles.join(', ')}`,
      });
    }
  });
}

export function validateWidgetData(args: {
  data: Record<string, unknown>;
  controls: CompiledControl[];
}): WidgetDataError[] {
  const errors: WidgetDataError[] = [];
  for (const control of args.controls) {
    validateControlInData(control, args.data, errors);
  }
  validateTypographyRoleScales(args.data, errors);
  validateTypographyFontsAndWeights(args.data, errors);
  return errors;
}
