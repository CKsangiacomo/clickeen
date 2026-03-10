import type { Primitive } from './schemas';

export type ActionItem = {
  type: 'link' | 'button' | 'modal';
  variant: 'primary' | 'secondary' | 'ghost';
  label: string;
  href?: string;
  onClick?: string;
  className?: string;
  attrs?: Record<string, string>;
};

export type ActionGroup = {
  layout: 'row' | 'column' | 'grid';
  columns?: number;
  className?: string;
  actions: ActionItem[];
};

type LegacyCta = { label: string; href: string } | null | undefined;

type LegacyActionGroupOptions = {
  layout?: ActionGroup['layout'];
  className?: string;
  primaryClassName?: string;
  secondaryClassName?: string;
  primaryAttrs?: Record<string, string>;
  secondaryAttrs?: Record<string, string>;
};

const ACTION_VARIANTS = new Set(['primary', 'secondary', 'ghost']);
const ACTION_TYPES = new Set(['link', 'button', 'modal']);
const ACTION_LAYOUTS = new Set(['row', 'column', 'grid']);

export function assertActionGroup(value: unknown, ctx = 'actionGroup'): ActionGroup {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[composition] Invalid ${ctx} (expected object)`);
  }
  const group = value as ActionGroup;
  if (!ACTION_LAYOUTS.has(group.layout)) {
    throw new Error(`[composition] ${ctx}.layout must be row|column|grid`);
  }
  if (!Array.isArray(group.actions) || group.actions.length === 0) {
    throw new Error(`[composition] ${ctx}.actions must be a non-empty array`);
  }
  if (group.layout === 'grid') {
    if (typeof group.columns !== 'number' || !Number.isFinite(group.columns) || group.columns < 1) {
      throw new Error(`[composition] ${ctx}.columns must be a number >= 1 for grid layouts`);
    }
  }
  for (const [index, action] of group.actions.entries()) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      throw new Error(`[composition] ${ctx}.actions[${index}] must be an object`);
    }
    if (!ACTION_TYPES.has(action.type)) {
      throw new Error(`[composition] ${ctx}.actions[${index}].type must be link|button|modal`);
    }
    if (!ACTION_VARIANTS.has(action.variant)) {
      throw new Error(`[composition] ${ctx}.actions[${index}].variant must be primary|secondary|ghost`);
    }
    if (typeof action.label !== 'string') {
      throw new Error(`[composition] ${ctx}.actions[${index}].label must be a string`);
    }
    if (action.href && typeof action.href !== 'string') {
      throw new Error(`[composition] ${ctx}.actions[${index}].href must be a string`);
    }
    if (action.onClick && typeof action.onClick !== 'string') {
      throw new Error(`[composition] ${ctx}.actions[${index}].onClick must be a string`);
    }
    if ((action.href && action.onClick) || (!action.href && !action.onClick)) {
      throw new Error(`[composition] ${ctx}.actions[${index}] requires exactly one of href or onClick`);
    }
    if (action.className && typeof action.className !== 'string') {
      throw new Error(`[composition] ${ctx}.actions[${index}].className must be a string`);
    }
    if (action.attrs != null) {
      if (!action.attrs || typeof action.attrs !== 'object' || Array.isArray(action.attrs)) {
        throw new Error(`[composition] ${ctx}.actions[${index}].attrs must be an object`);
      }
      for (const [key, val] of Object.entries(action.attrs)) {
        if (typeof val !== 'string') {
          throw new Error(`[composition] ${ctx}.actions[${index}].attrs.${key} must be a string`);
        }
      }
    }
  }
  return group;
}

export function actionGroupFromLegacy(primary: LegacyCta, secondary: LegacyCta, options: LegacyActionGroupOptions = {}): ActionGroup | null {
  if (!primary && !secondary) return null;
  const actions: ActionItem[] = [];
  if (primary) {
    actions.push({
      type: 'link',
      variant: 'primary',
      label: primary.label,
      href: primary.href,
      className: options.primaryClassName,
      attrs: options.primaryAttrs,
    });
  }
  if (secondary) {
    actions.push({
      type: 'link',
      variant: 'secondary',
      label: secondary.label,
      href: secondary.href,
      className: options.secondaryClassName,
      attrs: options.secondaryAttrs,
    });
  }
  return {
    layout: options.layout ?? 'row',
    className: options.className,
    actions,
  };
}

export function actionGroupToPrimitives(group: ActionGroup): Primitive {
  assertActionGroup(group);
  const actionPrimitives: Primitive[] = group.actions.map((action) => ({
    type: 'action',
    variant: action.variant,
    content: action.label,
    href: action.href,
    onClick: action.onClick,
    className: action.className,
    attrs: action.attrs,
  }));

  if (group.layout === 'grid') {
    return {
      type: 'grid',
      columns: group.columns ?? 2,
      className: group.className,
      children: actionPrimitives,
    };
  }

  return {
    type: 'stack',
    direction: group.layout === 'column' ? 'vertical' : 'horizontal',
    className: group.className,
    children: actionPrimitives,
  };
}
