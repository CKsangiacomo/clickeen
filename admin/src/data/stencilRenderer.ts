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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = stack[ctxIndex];
  for (let i = 0; i < segments.length; i += 1) {
    if (value == null) return undefined;
    value = value[segments[i]];
  }
  return value;
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
    const eachRegex = /{{#each\s+([^\s}]+)}}([\s\S]*?){{\/each}}/g;
    input = input.replace(eachRegex, (_match, key: string, block: string) => {
      const value = resolveKey(key, stack);
      if (!Array.isArray(value)) return '';
      return value
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => renderBlock(block, [...stack, typeof item === 'object' && item !== null ? item : { this: item }]))
        .join('');
    });

    const ifElseRegex = /{{#if\s+([^\s}]+)}}([\s\S]*?)(?:{{else}}([\s\S]*?))?{{\/if}}/g;
    input = input.replace(ifElseRegex, (_match, key: string, truthy: string, falsy: string | undefined) => {
      const value = resolveKey(key, stack);
      const block = isTruthy(value) ? truthy : falsy;
      return block ? renderBlock(block, stack) : '';
    });

    const unlessRegex = /{{#unless\s+([^\s}]+)}}([\s\S]*?){{\/unless}}/g;
    input = input.replace(unlessRegex, (_match, key: string, block: string) => {
      const value = resolveKey(key, stack);
      if (isTruthy(value)) return '';
      return renderBlock(block, stack);
    });

    input = input.replace(/{{\s*([^#\/][^}\s]+)\s*}}/g, (_match, key: string) => {
      const value = resolveKey(key, stack);
      return value == null ? '' : String(value);
    });

    return input;
  };

  return renderBlock(stencil, [context]);
}
