import { getAt } from '../../lib/utils/paths';

export type ShowIfAst =
  | { type: 'path'; value: string }
  | { type: 'literal'; value: string | number | boolean | null | undefined }
  | { type: 'call'; name: string; args: ShowIfAst[] }
  | { type: 'not'; child: ShowIfAst }
  | { type: 'and' | 'or'; left: ShowIfAst; right: ShowIfAst }
  | { type: 'eq' | 'neq'; left: ShowIfAst; right: ShowIfAst };

export type ShowIfEntry = {
  el: HTMLElement;
  ast: ShowIfAst | null;
  raw: string;
};

type Token =
  | { t: 'paren'; v: '(' | ')' }
  | { t: 'comma' }
  | { t: 'op'; v: '&&' | '||' | '==' | '!=' | '!' }
  | { t: 'string'; v: string }
  | { t: 'number'; v: number }
  | { t: 'boolean'; v: boolean }
  | { t: 'path'; v: string };

function tokenizeShowIf(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = input.trim();

  const isIdentChar = (c: string) => /[A-Za-z0-9._]/.test(c);

  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ t: 'paren', v: ch });
      i += 1;
      continue;
    }
    if (ch === ',') {
      tokens.push({ t: 'comma' });
      i += 1;
      continue;
    }
    if (ch === '&' && src.slice(i, i + 2) === '&&') {
      tokens.push({ t: 'op', v: '&&' });
      i += 2;
      continue;
    }
    if (ch === '|' && src.slice(i, i + 2) === '||') {
      tokens.push({ t: 'op', v: '||' });
      i += 2;
      continue;
    }
    if (ch === '!' && src[i + 1] === '=') {
      tokens.push({ t: 'op', v: '!=' });
      i += 2;
      continue;
    }
    if (ch === '=' && src[i + 1] === '=') {
      tokens.push({ t: 'op', v: '==' });
      i += 2;
      continue;
    }
    if (ch === '!') {
      tokens.push({ t: 'op', v: '!' });
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let j = i + 1;
      let val = '';
      while (j < src.length && src[j] !== quote) {
        val += src[j];
        j += 1;
      }
      if (j >= src.length) throw new Error('Unclosed string in show-if expression');
      tokens.push({ t: 'string', v: val });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      let raw = '';
      while (j < src.length && /[0-9.]/.test(src[j])) {
        raw += src[j];
        j += 1;
      }
      const num = Number(raw);
      if (!Number.isFinite(num)) throw new Error(`Invalid number "${raw}" in show-if expression`);
      tokens.push({ t: 'number', v: num });
      i = j;
      continue;
    }
    if (isIdentChar(ch)) {
      let j = i;
      let raw = '';
      while (j < src.length && isIdentChar(src[j])) {
        raw += src[j];
        j += 1;
      }
      if (raw === 'true' || raw === 'false') {
        tokens.push({ t: 'boolean', v: raw === 'true' });
      } else {
        tokens.push({ t: 'path', v: raw });
      }
      i = j;
      continue;
    }
    throw new Error(`Unexpected token "${ch}" in show-if expression`);
  }

  return tokens;
}

function parseShowIf(raw: string): ShowIfAst | null {
  const tokens = tokenizeShowIf(raw);
  let idx = 0;

  function peek() {
    return tokens[idx];
  }

  function consume() {
    return tokens[idx++];
  }

  function parsePrimary(): ShowIfAst {
    const tok = consume();
    if (!tok) throw new Error('Unexpected end of expression');
    if (tok.t === 'paren' && tok.v === '(') {
      const node = parseOr();
      const closing = consume();
      if (!closing || closing.t !== 'paren' || closing.v !== ')') {
        throw new Error('Unclosed parenthesis in show-if');
      }
      return node;
    }
    if (tok.t === 'op' && tok.v === '!') {
      return { type: 'not', child: parsePrimary() };
    }
    if (tok.t === 'string' || tok.t === 'number' || tok.t === 'boolean') {
      return { type: 'literal', value: tok.v };
    }
    if (tok.t === 'path') {
      const next = peek();
      if (next && next.t === 'paren' && next.v === '(') {
        consume();
        const args: ShowIfAst[] = [];
        const nextTok = peek();
        if (nextTok && nextTok.t === 'paren' && nextTok.v === ')') {
          consume();
          return { type: 'call', name: tok.v, args };
        }

        while (true) {
          args.push(parseOr());
          const sep = peek();
          if (sep && sep.t === 'comma') {
            consume();
            continue;
          }
          const closing = consume();
          if (!closing || closing.t !== 'paren' || closing.v !== ')') {
            throw new Error('Unclosed function call in show-if');
          }
          break;
        }
        return { type: 'call', name: tok.v, args };
      }

      return { type: 'path', value: tok.v };
    }
    throw new Error(`Unexpected token ${tok.t}`);
  }

  function parseEquality(): ShowIfAst {
    let left = parsePrimary();
    while (true) {
      const tok = peek();
      if (!tok || tok.t !== 'op' || (tok.v !== '==' && tok.v !== '!=')) break;
      consume();
      const right = parsePrimary();
      left = { type: tok.v === '==' ? 'eq' : 'neq', left, right };
    }
    return left;
  }

  function parseAnd(): ShowIfAst {
    let left = parseEquality();
    while (true) {
      const tok = peek();
      if (!tok || tok.t !== 'op' || tok.v !== '&&') break;
      consume();
      const right = parseEquality();
      left = { type: 'and', left, right };
    }
    return left;
  }

  function parseOr(): ShowIfAst {
    let left = parseAnd();
    while (true) {
      const tok = peek();
      if (!tok || tok.t !== 'op' || tok.v !== '||') break;
      consume();
      const right = parseAnd();
      left = { type: 'or', left, right };
    }
    return left;
  }

  if (tokens.length === 0) return null;
  const ast = parseOr();
  if (idx < tokens.length) {
    const tok = tokens[idx];
    throw new Error(`Unexpected trailing token "${'v' in tok ? tok.v : tok.t}" in show-if expression`);
  }
  return ast;
}

export function validateShowIfExpression(raw: string): void {
  const ast = parseShowIf(raw);
  const visit = (node: ShowIfAst | null): void => {
    if (!node) return;
    if (node.type === 'call') {
      if (node.name !== 'hasLinks') throw new Error(`Unknown show-if function "${node.name}"`);
      node.args.forEach(visit);
      return;
    }
    if (node.type === 'not') {
      visit(node.child);
      return;
    }
    if (node.type === 'and' || node.type === 'or' || node.type === 'eq' || node.type === 'neq') {
      visit(node.left);
      visit(node.right);
    }
  };
  visit(ast);
}

export function evaluateShowIfExpression(raw: string, data: Record<string, unknown>): boolean {
  const ast = parseShowIf(raw);
  return ast ? evalAst(ast, data) : true;
}

function resolveValue(node: ShowIfAst, data: Record<string, unknown>): unknown {
  if (node.type === 'path') return getAt<unknown>(data, node.value);
  if (node.type === 'literal') return node.value;
  if (node.type === 'call') return evalCall(node, data);
  return evalAst(node, data);
}

function hasLinksInValue(value: unknown, seen: Set<unknown> = new Set()): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return /<a\b[^>]*href=/i.test(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((item) => hasLinksInValue(item, seen));
  }
  return Object.values(value as Record<string, unknown>).some((item) => hasLinksInValue(item, seen));
}

function evalCall(node: Extract<ShowIfAst, { type: 'call' }>, data: Record<string, unknown>): unknown {
  if (node.name === 'hasLinks') {
    const values = node.args.map((arg) => resolveValue(arg, data));
    return values.some((value) => hasLinksInValue(value));
  }

  throw new Error(`Unknown show-if function "${node.name}"`);
}

function evalAst(node: ShowIfAst, data: Record<string, unknown>): boolean {
  switch (node.type) {
    case 'path':
      return Boolean(resolveValue(node, data));
    case 'literal':
      return Boolean(node.value);
    case 'call':
      return Boolean(resolveValue(node, data));
    case 'not':
      return !evalAst(node.child, data);
    case 'and':
      return evalAst(node.left, data) && evalAst(node.right, data);
    case 'or':
      return evalAst(node.left, data) || evalAst(node.right, data);
    case 'eq': {
      const leftVal = resolveValue(node.left, data);
      const rightVal = resolveValue(node.right, data);
      return leftVal === rightVal;
    }
    case 'neq': {
      const leftVal = resolveValue(node.left, data);
      const rightVal = resolveValue(node.right, data);
      return leftVal !== rightVal;
    }
    default:
      return true;
  }
}

export function buildShowIfEntries(container: HTMLElement): ShowIfEntry[] {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>('[data-bob-showif]'));
  const entries: ShowIfEntry[] = [];
  nodes.forEach((node) => {
    const raw = node.getAttribute('data-bob-showif') || '';
    if (!raw.trim()) return;
    const ast = parseShowIf(raw);
    entries.push({ el: node, ast, raw });
  });
  return entries;
}

export function applyShowIfVisibility(entries: ShowIfEntry[], data: Record<string, unknown>) {
  entries.forEach((entry) => {
    const isVisible = entry.ast ? evalAst(entry.ast, data) : true;
    entry.el.toggleAttribute('hidden', !isVisible);
    entry.el.setAttribute('style', isVisible ? '' : 'display: none;');
  });
}
