import type { Primitive } from '../../src/core/schemas';
import { actionGroupToPrimitives, type ActionGroup } from '../../src/core/actions';

type RenderOptions = {
  widgetPlaceholderClass?: string;
};

const DEFAULT_WIDGET_PLACEHOLDER = 'ck-widget-embed';

const headingClassForLevel = (level: number) => {
  switch (level) {
    case 1:
      return 'heading-1';
    case 2:
      return 'display-2';
    case 3:
      return 'display-3';
    default:
      return 'heading-3';
  }
};

const textClassForVariant = (variant: string) => {
  switch (variant) {
    case 'caption':
      return 'body-s';
    case 'label':
      return 'label-s';
    default:
      return 'body-website';
  }
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeAttrs = (attrs?: Record<string, string>) => {
  if (!attrs) return {};
  const { class: _class, className: _className, ...rest } = attrs as Record<string, string>;
  return rest;
};

const joinClasses = (...values: Array<string | undefined | null | false>) => values.filter(Boolean).join(' ');

const resolveHeadingClass = (level: number, className?: string) => {
  if (className && className.trim()) return className;
  return headingClassForLevel(level);
};

const resolveTextClass = (variant: string, className?: string) => {
  if (className && className.trim()) return className;
  return textClassForVariant(variant);
};

const attrsToString = (attrs?: Record<string, string>) => {
  if (!attrs) return '';
  const sanitized = sanitizeAttrs(attrs);
  const pairs = Object.entries(sanitized)
    .map(([key, value]) => ` ${key}="${escapeHtml(value)}"`)
    .join('');
  return pairs;
};

function renderPrimitive(primitive: Primitive, options: RenderOptions): string {
  switch (primitive.type) {
    case 'heading': {
      const tag = `h${primitive.level}`;
      const className = resolveHeadingClass(primitive.level, primitive.className);
      return `<${tag} class="${escapeHtml(className)}"${attrsToString(primitive.attrs)}>${escapeHtml(
        primitive.content,
      )}</${tag}>`;
    }
    case 'text': {
      const className = resolveTextClass(primitive.variant, primitive.className);
      return `<p class="${escapeHtml(className)}"${attrsToString(primitive.attrs)}>${escapeHtml(
        primitive.content,
      )}</p>`;
    }
    case 'action': {
      const className = joinClasses('ck-btn', `ck-btn--${primitive.variant}`, primitive.className);
      if (primitive.href) {
        return `<a class="${escapeHtml(className)}" href="${escapeHtml(primitive.href)}"${attrsToString(
          primitive.attrs,
        )}>${escapeHtml(primitive.content)}</a>`;
      }
      return `<button class="${escapeHtml(className)}" type="button" data-action="${escapeHtml(
        primitive.onClick || '',
      )}"${attrsToString(primitive.attrs)}>${escapeHtml(primitive.content)}</button>`;
    }
    case 'media': {
      const className = joinClasses('ck-media', primitive.className);
      if (primitive.variant === 'image') {
        return `<img class="${escapeHtml(className)}" src="${escapeHtml(primitive.src || '')}" alt="${escapeHtml(
          primitive.alt || '',
        )}"${attrsToString(primitive.attrs)} />`;
      }
      if (primitive.variant === 'video') {
        return `<video class="${escapeHtml(className)}" src="${escapeHtml(primitive.src || '')}" controls playsinline${attrsToString(
          primitive.attrs,
        )}></video>`;
      }
      const placeholderClass = options.widgetPlaceholderClass || DEFAULT_WIDGET_PLACEHOLDER;
      return `<div class="${escapeHtml(
        joinClasses(placeholderClass, primitive.className),
      )}" data-curated-ref="${escapeHtml(primitive.curatedRef || '')}"${attrsToString(primitive.attrs)}></div>`;
    }
    case 'stack': {
      const baseClass = primitive.direction === 'horizontal' ? 'ck-row' : 'ck-stack';
      const className = joinClasses(baseClass, primitive.className);
      const children = primitive.children.map((child) => renderPrimitive(child, options)).join('');
      return `<div class="${escapeHtml(className)}"${attrsToString(primitive.attrs)}>${children}</div>`;
    }
    case 'grid': {
      const className = joinClasses('ck-grid', primitive.className);
      const style = ` style="display:grid;gap:var(--prague-gap);grid-template-columns:repeat(${primitive.columns},minmax(0,1fr));"`;
      const children = primitive.children.map((child) => renderPrimitive(child, options)).join('');
      return `<div class="${escapeHtml(className)}"${style}${attrsToString(primitive.attrs)}>${children}</div>`;
    }
    default:
      return '';
  }
}

export function renderPrimitivesToHtml(primitives: Primitive[], options: RenderOptions = {}): string {
  return primitives.map((primitive) => renderPrimitive(primitive, options)).join('');
}

export function renderActionGroupToHtml(actionGroup: ActionGroup, options: RenderOptions = {}): string {
  return renderPrimitivesToHtml([actionGroupToPrimitives(actionGroup)], options);
}
