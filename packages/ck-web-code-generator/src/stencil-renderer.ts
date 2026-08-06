export type StencilContext = Record<string, unknown>;

export type RenderOptions = {
  /**
   * Keys to skip when interpolating `{{token}}` placeholders inside context
   * string values.
   */
  skipInterpolationKeys?: Set<string>;
  rawKeys?: Set<string>;
  rawPathPatterns?: Set<string>;
  transformRawPathValue?: (value: string, path: string) => string;
  strict?: boolean;
};

type ContextFrame = {
  value: StencilContext;
  path: string;
};

type ResolvedValue = {
  value: unknown;
  path: string;
};

function encodeHtmlEntities(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case "'":
        return '&#39;';
      default:
        return '&quot;';
    }
  });
}

function isTruthy(value: unknown): boolean {
  if (!value) return false;
  if (value === 'false' || value === '0') return false;
  return true;
}

function splitParentLookup(key: string): { remaining: string; upLevels: number } {
  let remaining = key;
  let upLevels = 0;
  while (remaining.startsWith('../')) {
    upLevels += 1;
    remaining = remaining.slice(3);
  }
  return { remaining, upLevels };
}

function joinPath(parent: string, child: string): string {
  if (!parent) return child;
  if (!child) return parent;
  return `${parent}.${child}`;
}

function resolveKey(key: string, stack: ContextFrame[]): ResolvedValue {
  const { remaining, upLevels } = splitParentLookup(key);
  const segments = remaining.split('.').filter(Boolean);
  const frameIndex = stack.length - 1 - upLevels;
  if (frameIndex < 0) return { value: undefined, path: '' };

  const frame = stack[frameIndex]!;
  let value: unknown = frame.value;
  const sourceSegments: string[] = [];
  for (const segment of segments) {
    if (value == null || typeof value !== 'object') {
      return {
        value: undefined,
        path: joinPath(frame.path, sourceSegments.join('.')),
      };
    }
    value = (value as Record<string, unknown>)[segment];
    if (segment !== '@index' && segment !== '@path') sourceSegments.push(segment);
  }
  const explicitPath = segments.length === 1 && segments[0] === '@path';
  return {
    value,
    path: explicitPath ? frame.path : joinPath(frame.path, sourceSegments.join('.')),
  };
}

function patternMatchesPath(pattern: string, path: string): boolean {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expression = escaped.replace(/\\\[\\\]/g, '\\.[0-9]+');
  return new RegExp(`^${expression}$`).test(path);
}

export function interpolateStencilContext(
  context: StencilContext,
  options?: RenderOptions,
): StencilContext {
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
      const output: Record<string, unknown> = {};
      Object.entries(value).forEach(([childKey, childValue]) => {
        output[childKey] = walk(childValue, childKey);
      });
      return output;
    }
    return value;
  };

  return walk(context) as StencilContext;
}

export function renderStencil(
  stencil: string,
  context: StencilContext,
  options?: RenderOptions,
): string {
  const rawKeys = options?.rawKeys ?? new Set<string>();
  const rawPathPatterns = options?.rawPathPatterns ?? new Set<string>();
  const strict = options?.strict === true;
  type Node =
    | { type: 'text'; value: string }
    | { type: 'var'; key: string }
    | { type: 'if'; key: string; truthy: Node[]; falsy: Node[] }
    | { type: 'unless'; key: string; body: Node[] }
    | { type: 'each'; key: string; body: Node[] };

  const open = '{{';
  const close = '}}';

  const parse = (input: string): Node[] => {
    const parseUntil = (
      startIndex: number,
      stopTags: Set<string>,
    ): { nodes: Node[]; index: number; stopTag: string | null } => {
      const nodes: Node[] = [];
      let index = startIndex;

      while (index < input.length) {
        const openIndex = input.indexOf(open, index);
        if (openIndex === -1) {
          if (index < input.length) nodes.push({ type: 'text', value: input.slice(index) });
          return { nodes, index: input.length, stopTag: null };
        }

        if (openIndex > index) nodes.push({ type: 'text', value: input.slice(index, openIndex) });
        const closeIndex = input.indexOf(close, openIndex + open.length);
        if (closeIndex === -1) {
          nodes.push({ type: 'text', value: input.slice(openIndex) });
          return { nodes, index: input.length, stopTag: null };
        }

        const rawToken = input.slice(openIndex + open.length, closeIndex);
        const token = rawToken.trim();
        index = closeIndex + close.length;
        if (stopTags.has(token)) return { nodes, index, stopTag: token };

        if (token.startsWith('#if ')) {
          const key = token.slice(4).trim();
          const truthyResult = parseUntil(index, new Set(['else', '/if']));
          let falsy: Node[] = [];
          if (truthyResult.stopTag === 'else') {
            const falsyResult = parseUntil(truthyResult.index, new Set(['/if']));
            falsy = falsyResult.nodes;
            index = falsyResult.index;
            if (falsyResult.stopTag !== '/if') {
              nodes.push({ type: 'text', value: `${open}${rawToken}${close}` }, ...truthyResult.nodes);
              if (truthyResult.stopTag) nodes.push({ type: 'text', value: `${open}${truthyResult.stopTag}${close}` });
              nodes.push(...falsyResult.nodes);
              continue;
            }
          } else if (truthyResult.stopTag === '/if') {
            index = truthyResult.index;
          } else {
            nodes.push({ type: 'text', value: `${open}${rawToken}${close}` }, ...truthyResult.nodes);
            continue;
          }
          nodes.push({ type: 'if', key, truthy: truthyResult.nodes, falsy });
          continue;
        }

        if (token.startsWith('#unless ')) {
          const key = token.slice(8).trim();
          const bodyResult = parseUntil(index, new Set(['/unless']));
          index = bodyResult.index;
          if (bodyResult.stopTag !== '/unless') {
            nodes.push({ type: 'text', value: `${open}${rawToken}${close}` }, ...bodyResult.nodes);
            if (bodyResult.stopTag) nodes.push({ type: 'text', value: `${open}${bodyResult.stopTag}${close}` });
            continue;
          }
          nodes.push({ type: 'unless', key, body: bodyResult.nodes });
          continue;
        }

        if (token.startsWith('#each ')) {
          const key = token.slice(6).trim();
          const bodyResult = parseUntil(index, new Set(['/each']));
          index = bodyResult.index;
          if (bodyResult.stopTag !== '/each') {
            nodes.push({ type: 'text', value: `${open}${rawToken}${close}` }, ...bodyResult.nodes);
            if (bodyResult.stopTag) nodes.push({ type: 'text', value: `${open}${bodyResult.stopTag}${close}` });
            continue;
          }
          nodes.push({ type: 'each', key, body: bodyResult.nodes });
          continue;
        }

        if (token.startsWith('#') || token.startsWith('/')) {
          nodes.push({ type: 'text', value: `${open}${rawToken}${close}` });
          continue;
        }
        if (token) nodes.push({ type: 'var', key: token });
      }
      return { nodes, index, stopTag: null };
    };
    return parseUntil(0, new Set()).nodes;
  };

  const renderNodes = (nodes: Node[], stack: ContextFrame[]): string =>
    nodes
      .map((node) => {
        if (node.type === 'text') return node.value;
        if (node.type === 'var') {
          const resolved = resolveKey(node.key, stack);
          if (resolved.value == null) {
            if (strict) throw new Error(`ck.web_code.stencil.value_missing:${resolved.path || node.key}`);
            return '';
          }
          const rendered = String(resolved.value);
          const isRawPath = [...rawPathPatterns].some((pattern) => patternMatchesPath(pattern, resolved.path));
          if (rawKeys.has(node.key)) return rendered;
          if (isRawPath) return options?.transformRawPathValue?.(rendered, resolved.path) ?? rendered;
          return encodeHtmlEntities(rendered);
        }
        if (node.type === 'if') {
          return renderNodes(isTruthy(resolveKey(node.key, stack).value) ? node.truthy : node.falsy, stack);
        }
        if (node.type === 'unless') {
          return isTruthy(resolveKey(node.key, stack).value) ? '' : renderNodes(node.body, stack);
        }
        const resolved = resolveKey(node.key, stack);
        if (!Array.isArray(resolved.value)) {
          if (strict) throw new Error(`ck.web_code.stencil.repeater_invalid:${resolved.path || node.key}`);
          return '';
        }
        return resolved.value
          .map((item, index) => {
            const itemPath = joinPath(resolved.path, String(index));
            const itemContext: StencilContext =
              item && typeof item === 'object' && !Array.isArray(item)
                ? { ...(item as Record<string, unknown>) }
                : { this: item };
            itemContext['@index'] = index;
            itemContext['@path'] = itemPath;
            return renderNodes(node.body, [...stack, { value: itemContext, path: itemPath }]);
          })
          .join('');
      })
      .join('');

  return renderNodes(parse(stencil), [{ value: context, path: '' }]);
}
