import { SPLIT_LAYOUTS, type SplitLayout, type Primitive } from './schemas';

const ACTION_VARIANTS = new Set(['primary', 'secondary', 'ghost']);
const TEXT_VARIANTS = new Set(['body', 'caption', 'label']);
const STACK_DIRECTIONS = new Set(['vertical', 'horizontal']);
const MEDIA_VARIANTS = new Set(['image', 'video', 'widget']);

export function assertSplitLayout(value: unknown, ctx = 'layout'): SplitLayout {
  if (typeof value !== 'string' || !SPLIT_LAYOUTS.includes(value as SplitLayout)) {
    throw new Error(`[composition] Invalid ${ctx} "${String(value)}". Expected one of: ${SPLIT_LAYOUTS.join(', ')}`);
  }
  return value as SplitLayout;
}

function assertClassName(value: unknown, ctx: string): void {
  if (value == null) return;
  if (typeof value !== 'string') {
    throw new Error(`[composition] Invalid ${ctx}.className (expected string)`);
  }
}

function assertAttrs(value: unknown, ctx: string): void {
  if (value == null) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[composition] Invalid ${ctx}.attrs (expected object)`);
  }
  for (const [key, val] of Object.entries(value)) {
    if (typeof val !== 'string') {
      throw new Error(`[composition] Invalid ${ctx}.attrs.${key} (expected string)`);
    }
  }
}

export function assertPrimitive(value: unknown, ctx = 'primitive'): Primitive {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[composition] Invalid ${ctx} (expected object)`);
  }
  const primitive = value as Primitive;
  if (typeof primitive.type !== 'string') {
    throw new Error(`[composition] ${ctx}.type is required`);
  }
  assertClassName((primitive as any).className, ctx);
  assertAttrs((primitive as any).attrs, ctx);

  switch (primitive.type) {
    case 'heading': {
      const level = (primitive as any).level;
      const content = (primitive as any).content;
      if (![1, 2, 3, 4].includes(level)) {
        throw new Error(`[composition] ${ctx}.level must be 1-4`);
      }
      if (typeof content !== 'string') {
        throw new Error(`[composition] ${ctx}.content must be a string`);
      }
      return primitive;
    }
    case 'text': {
      const variant = (primitive as any).variant;
      const content = (primitive as any).content;
      if (!TEXT_VARIANTS.has(variant)) {
        throw new Error(`[composition] ${ctx}.variant must be body|caption|label`);
      }
      if (typeof content !== 'string') {
        throw new Error(`[composition] ${ctx}.content must be a string`);
      }
      return primitive;
    }
    case 'action': {
      const variant = (primitive as any).variant;
      const content = (primitive as any).content;
      const href = (primitive as any).href;
      const onClick = (primitive as any).onClick;
      if (!ACTION_VARIANTS.has(variant)) {
        throw new Error(`[composition] ${ctx}.variant must be primary|secondary|ghost`);
      }
      if (typeof content !== 'string') {
        throw new Error(`[composition] ${ctx}.content must be a string`);
      }
      if (href && typeof href !== 'string') {
        throw new Error(`[composition] ${ctx}.href must be a string`);
      }
      if (onClick && typeof onClick !== 'string') {
        throw new Error(`[composition] ${ctx}.onClick must be a string`);
      }
      if ((href && onClick) || (!href && !onClick)) {
        throw new Error(`[composition] ${ctx} requires exactly one of href or onClick`);
      }
      return primitive;
    }
    case 'media': {
      const variant = (primitive as any).variant;
      const src = (primitive as any).src;
      const alt = (primitive as any).alt;
      const curatedRef = (primitive as any).curatedRef;
      if (!MEDIA_VARIANTS.has(variant)) {
        throw new Error(`[composition] ${ctx}.variant must be image|video|widget`);
      }
      if (variant === 'image') {
        if (typeof src !== 'string' || !src.trim()) {
          throw new Error(`[composition] ${ctx}.src is required for image`);
        }
        if (typeof alt !== 'string') {
          throw new Error(`[composition] ${ctx}.alt is required for image`);
        }
      }
      if (variant === 'video') {
        if (typeof src !== 'string' || !src.trim()) {
          throw new Error(`[composition] ${ctx}.src is required for video`);
        }
      }
      if (variant === 'widget') {
        if (typeof curatedRef !== 'string' || !curatedRef.trim()) {
          throw new Error(`[composition] ${ctx}.curatedRef is required for widget`);
        }
      }
      return primitive;
    }
    case 'stack': {
      const direction = (primitive as any).direction;
      const children = (primitive as any).children;
      if (!STACK_DIRECTIONS.has(direction)) {
        throw new Error(`[composition] ${ctx}.direction must be vertical|horizontal`);
      }
      if (!Array.isArray(children)) {
        throw new Error(`[composition] ${ctx}.children must be an array`);
      }
      children.forEach((child, index) => assertPrimitive(child, `${ctx}.children[${index}]`));
      return primitive;
    }
    case 'grid': {
      const columns = (primitive as any).columns;
      const children = (primitive as any).children;
      if (typeof columns !== 'number' || !Number.isFinite(columns) || columns < 1) {
        throw new Error(`[composition] ${ctx}.columns must be a number >= 1`);
      }
      if (!Array.isArray(children)) {
        throw new Error(`[composition] ${ctx}.children must be an array`);
      }
      children.forEach((child, index) => assertPrimitive(child, `${ctx}.children[${index}]`));
      return primitive;
    }
    default:
      throw new Error(`[composition] ${ctx}.type "${String((primitive as any).type)}" is not supported`);
  }
}

export function assertPrimitives(value: unknown, ctx = 'primitives'): Primitive[] {
  if (!Array.isArray(value)) {
    throw new Error(`[composition] ${ctx} must be an array`);
  }
  value.forEach((entry, index) => assertPrimitive(entry, `${ctx}[${index}]`));
  return value as Primitive[];
}
