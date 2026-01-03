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
  type Node =
    | { type: 'text'; value: string }
    | { type: 'var'; key: string }
    | { type: 'if'; key: string; truthy: Node[]; falsy: Node[] }
    | { type: 'unless'; key: string; body: Node[] }
    | { type: 'each'; key: string; body: Node[] };

  const OPEN = '{{';
  const CLOSE = '}}';

  const parse = (input: string): Node[] => {
    const parseUntil = (
      startIndex: number,
      stopTags: Set<string>,
    ): { nodes: Node[]; index: number; stopTag: string | null } => {
      const nodes: Node[] = [];
      let index = startIndex;

      while (index < input.length) {
        const openIndex = input.indexOf(OPEN, index);
        if (openIndex === -1) {
          if (index < input.length) nodes.push({ type: 'text', value: input.slice(index) });
          return { nodes, index: input.length, stopTag: null };
        }

        if (openIndex > index) nodes.push({ type: 'text', value: input.slice(index, openIndex) });

        const closeIndex = input.indexOf(CLOSE, openIndex + OPEN.length);
        if (closeIndex === -1) {
          nodes.push({ type: 'text', value: input.slice(openIndex) });
          return { nodes, index: input.length, stopTag: null };
        }

        const rawToken = input.slice(openIndex + OPEN.length, closeIndex);
        const token = rawToken.trim();
        index = closeIndex + CLOSE.length;

        if (stopTags.has(token)) {
          return { nodes, index, stopTag: token };
        }

        if (token.startsWith('#if ')) {
          const key = token.slice(4).trim();
          const truthyRes = parseUntil(index, new Set(['else', '/if']));
          let falsy: Node[] = [];
          if (truthyRes.stopTag === 'else') {
            const falsyRes = parseUntil(truthyRes.index, new Set(['/if']));
            falsy = falsyRes.nodes;
            index = falsyRes.index;
            if (falsyRes.stopTag !== '/if') {
              nodes.push({ type: 'text', value: `${OPEN}${rawToken}${CLOSE}` }, ...truthyRes.nodes);
              if (truthyRes.stopTag) nodes.push({ type: 'text', value: `${OPEN}${truthyRes.stopTag}${CLOSE}` });
              nodes.push(...falsyRes.nodes);
              continue;
            }
          } else if (truthyRes.stopTag === '/if') {
            index = truthyRes.index;
          } else {
            nodes.push({ type: 'text', value: `${OPEN}${rawToken}${CLOSE}` }, ...truthyRes.nodes);
            continue;
          }

          nodes.push({ type: 'if', key, truthy: truthyRes.nodes, falsy });
          continue;
        }

        if (token.startsWith('#unless ')) {
          const key = token.slice(8).trim();
          const bodyRes = parseUntil(index, new Set(['/unless']));
          index = bodyRes.index;
          if (bodyRes.stopTag !== '/unless') {
            nodes.push({ type: 'text', value: `${OPEN}${rawToken}${CLOSE}` }, ...bodyRes.nodes);
            if (bodyRes.stopTag) nodes.push({ type: 'text', value: `${OPEN}${bodyRes.stopTag}${CLOSE}` });
            continue;
          }
          nodes.push({ type: 'unless', key, body: bodyRes.nodes });
          continue;
        }

        if (token.startsWith('#each ')) {
          const key = token.slice(6).trim();
          const bodyRes = parseUntil(index, new Set(['/each']));
          index = bodyRes.index;
          if (bodyRes.stopTag !== '/each') {
            nodes.push({ type: 'text', value: `${OPEN}${rawToken}${CLOSE}` }, ...bodyRes.nodes);
            if (bodyRes.stopTag) nodes.push({ type: 'text', value: `${OPEN}${bodyRes.stopTag}${CLOSE}` });
            continue;
          }
          nodes.push({ type: 'each', key, body: bodyRes.nodes });
          continue;
        }

        if (token.startsWith('#') || token.startsWith('/')) {
          nodes.push({ type: 'text', value: `${OPEN}${rawToken}${CLOSE}` });
          continue;
        }

        if (token) nodes.push({ type: 'var', key: token });
      }

      return { nodes, index, stopTag: null };
    };

    return parseUntil(0, new Set()).nodes;
  };

  const renderNodes = (nodes: Node[], stack: StencilContext[]): string =>
    nodes
      .map((node) => {
        if (node.type === 'text') return node.value;
        if (node.type === 'var') {
          const value = resolveKey(node.key, stack);
          return value == null ? '' : String(value);
        }
        if (node.type === 'if') {
          const value = resolveKey(node.key, stack);
          return renderNodes(isTruthy(value) ? node.truthy : node.falsy, stack);
        }
        if (node.type === 'unless') {
          const value = resolveKey(node.key, stack);
          return isTruthy(value) ? '' : renderNodes(node.body, stack);
        }
        if (node.type === 'each') {
          const value = resolveKey(node.key, stack);
          if (!Array.isArray(value)) return '';
          return value
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((item: any) =>
              renderNodes(node.body, [...stack, typeof item === 'object' && item !== null ? item : { this: item }]),
            )
            .join('');
        }
        return '';
      })
      .join('');

  return renderNodes(parse(stencil), [context]);
}
