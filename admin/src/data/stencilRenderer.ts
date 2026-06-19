export type StencilContext = Record<string, unknown>;

type RenderOptions = {
  /**
   * Keys to skip when interpolating `{{token}}` placeholders inside context string values.
   * Useful when a key contains raw markup that may legitimately include moustache syntax.
   */
  skipInterpolationKeys?: Set<string>;
};

function isTruthy(value: unknown): boolean {
  if (!value) return false;
  if (value === 'false' || value === '0') return false;
  return true;
}

function resolveKey(key: string, stack: StencilContext[]): unknown {
  let remaining = key;
  let upLevels = 0;
  while (remaining.startsWith('../')) {
    upLevels += 1;
    remaining = remaining.slice(3);
  }
  const segments = remaining.split('.').filter(Boolean);
  const ctxIndex = stack.length - 1 - upLevels;
  if (ctxIndex < 0) return undefined;

  const resolveFrom = (context: StencilContext): unknown => {
    let value: unknown = context;
    for (let i = 0; i < segments.length; i += 1) {
      if (value == null) return undefined;
      if (typeof value !== 'object') return undefined;
      value = (value as Record<string, unknown>)[segments[i]];
    }
    return value;
  };

  if (upLevels > 0) return resolveFrom(stack[ctxIndex]);

  for (let index = ctxIndex; index >= 0; index -= 1) {
    const value = resolveFrom(stack[index]);
    if (typeof value !== 'undefined') return value;
  }
  return undefined;
}

export function interpolateStencilContext(context: StencilContext, options?: RenderOptions): StencilContext {
  const skip = options?.skipInterpolationKeys ?? new Set<string>();

  const root = context;
  const placeholderRegex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

  const walk = (value: unknown, key?: string): unknown => {
    if (key && skip.has(key)) return value;
    if (typeof value === 'string') {
      return value.replace(placeholderRegex, (_match, token: string) => {
        const replacement = root[token];
        return typeof replacement === 'string' ? replacement : '';
      });
    }
    if (Array.isArray(value)) return value.map((entry) => walk(entry));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      Object.entries(value).forEach(([childKey, childValue]) => {
        out[childKey] = walk(childValue, childKey);
      });
      return out;
    }
    return value;
  };

  return walk(context) as StencilContext;
}

export function renderStencil(stencil: string, context: StencilContext): string {
  const renderBlock = (input: string, stack: StencilContext[]): string => {
    const openRegex = /{{#(each|if|unless)\s+([^}]+)}}/g;
    const tagRegex = /{{#(each|if|unless)\s+[^}]+}}|{{\/(each|if|unless)}}|{{else}}/g;
    let output = '';
    let cursor = 0;
    let openMatch: RegExpExecArray | null;

    while ((openMatch = openRegex.exec(input))) {
      const blockType = openMatch[1] as 'each' | 'if' | 'unless';
      const key = openMatch[2].trim();
      const contentStart = openRegex.lastIndex;
      output += input.slice(cursor, openMatch.index);

      tagRegex.lastIndex = contentStart;
      let depth = 1;
      let elseIndex: number | null = null;
      let closeStart = -1;
      let closeEnd = -1;
      let tagMatch: RegExpExecArray | null;

      while ((tagMatch = tagRegex.exec(input))) {
        if (tagMatch[1]) {
          depth += 1;
          continue;
        }

        if (tagMatch[2]) {
          depth -= 1;
          if (depth === 0) {
            closeStart = tagMatch.index;
            closeEnd = tagRegex.lastIndex;
            break;
          }
          continue;
        }

        if (blockType === 'if' && depth === 1 && elseIndex === null) {
          elseIndex = tagMatch.index;
        }
      }

      if (closeStart < 0 || closeEnd < 0) {
        throw new Error(`[stencilRenderer] Unclosed ${blockType} block for ${key}`);
      }

      const truthyBlock = input.slice(contentStart, elseIndex ?? closeStart);
      const falsyBlock = elseIndex === null ? undefined : input.slice(elseIndex + '{{else}}'.length, closeStart);
      const value = resolveKey(key, stack);

      if (blockType === 'each') {
        if (Array.isArray(value)) {
          output += value
            .map((item: unknown) =>
              renderBlock(
                truthyBlock,
                [...stack, typeof item === 'object' && item !== null ? (item as StencilContext) : { this: item }],
              ),
            )
            .join('');
        }
      } else if (blockType === 'if') {
        const selectedBlock = isTruthy(value) ? truthyBlock : falsyBlock;
        output += selectedBlock ? renderBlock(selectedBlock, stack) : '';
      } else if (!isTruthy(value)) {
        output += renderBlock(truthyBlock, stack);
      }

      cursor = closeEnd;
      openRegex.lastIndex = cursor;
    }

    input = output + input.slice(cursor);

    input = input.replace(/{{\s*([^#/][^}\s]+)\s*}}/g, (_match, key: string) => {
      const value = resolveKey(key, stack);
      return value == null ? '' : String(value);
    });

    return input;
  };

  return renderBlock(stencil, [context]);
}
