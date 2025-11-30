import { useEffect, useRef, useState } from 'react';
import type { PanelId } from '../lib/types';
import { getAt } from '../lib/utils/paths';

declare global {
  interface Window {
    Dieter?: {
      hydrateAll?: (scope?: HTMLElement) => void;
    };
  }
}

const loadedStyles = new Set<string>();
const loadedScripts = new Map<string, Promise<void>>();
const stylePromises = new Map<string, Promise<void>>();

function loadStyle(href: string): Promise<void> {
  if (!href) return Promise.resolve();
  if (loadedStyles.has(href)) return Promise.resolve();
  const existing = stylePromises.get(href);
  if (existing) return existing;
  const head = document.head;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  const p = new Promise<void>((resolve, reject) => {
    link.onload = () => {
      loadedStyles.add(href);
      resolve();
    };
    link.onerror = () => reject(new Error(`Failed to load style ${href}`));
  });
  stylePromises.set(href, p);
  head.appendChild(link);
  return p;
}

function loadScript(src: string): Promise<void> {
  if (!src) return Promise.resolve();
  const existing = loadedScripts.get(src);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false; // preserve order
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script ${src}`));
    document.head.appendChild(script);
  });
  loadedScripts.set(src, p);
  return p;
}

function ensureAssets(dieterAssets: { styles?: string[]; scripts?: string[] } | undefined): Promise<void> {
  const stylePromises: Array<Promise<void>> = [];
  if (dieterAssets?.styles) {
    dieterAssets.styles.forEach((href) => stylePromises.push(loadStyle(href)));
  }

  const scriptList = dieterAssets?.scripts || [];
  // Load scripts sequentially to preserve dependency order
  const scriptsPromise = scriptList.reduce<Promise<void>>(async (chain, src) => {
    await chain;
    await loadScript(src);
  }, Promise.resolve());

  return Promise.all([...stylePromises, scriptsPromise]).then(() => undefined);
}

function runHydrators(scope: HTMLElement) {
  if (typeof window === 'undefined' || !window.Dieter) return;
  const entries = Object.entries(window.Dieter).filter(
    ([name, fn]) =>
      typeof fn === 'function' &&
      name.toLowerCase().startsWith('hydrate') &&
      name.toLowerCase() !== 'hydrateall',
  );
  for (const [, fn] of entries) {
    try {
      (fn as (el?: HTMLElement) => void)(scope);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('[TdMenuContent] Hydrator error', err);
      }
    }
  }
}

type TdMenuContentProps = {
  panelId: PanelId | null;
  panelHtml: string;
  widgetKey?: string;
  instanceData: Record<string, unknown>;
  setValue: (path: string, value: unknown, meta?: { source?: 'field' | 'load' | 'external' | 'unknown'; path?: string; ts?: number }) => void;
  lastUpdate?: { source: 'field' | 'load' | 'external' | 'unknown'; path: string; ts: number } | null;
  defaults?: Record<string, unknown>;
  dieterAssets?: {
    styles: string[];
    scripts: string[];
  };
};

const GROUP_LABELS: Record<string, string> = {
  wgtappearance: 'Widget appearance',
  wgtlayout: 'Widget layout',
  podstageappearance: 'Stage/Pod appearance',
  podstagelayout: 'Stage/Pod layout',
};

function labelForGroup(key: string | null): string {
  if (!key) return '';
  return GROUP_LABELS[key] || key.replace(/-/g, ' ');
}

type ShowIfAst =
  | { type: 'path'; value: string }
  | { type: 'literal'; value: string | number | boolean | null | undefined }
  | { type: 'not'; child: ShowIfAst }
  | { type: 'and' | 'or'; left: ShowIfAst; right: ShowIfAst }
  | { type: 'eq' | 'neq'; left: ShowIfAst; right: ShowIfAst };

type ShowIfEntry = {
  el: HTMLElement;
  ast: ShowIfAst | null;
  raw: string;
};

type Token =
  | { t: 'paren'; v: '(' | ')' }
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
      tokens.push({ t: 'number', v: Number(raw) });
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
  return parseOr();
}

function normalizeValue(val: unknown): string | number | boolean | null | undefined {
  if (val === null || val === undefined) return val;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    const num = Number(trimmed);
    if (!Number.isNaN(num) && trimmed !== '') return num;
    return trimmed;
  }
  return val as any;
}

function resolveValue(node: ShowIfAst, data: Record<string, unknown>): unknown {
  if (node.type === 'path') return getAt<unknown>(data, node.value);
  if (node.type === 'literal') return node.value;
  return evalAst(node, data);
}

function evalAst(node: ShowIfAst, data: Record<string, unknown>): boolean {
  switch (node.type) {
    case 'path': {
      const value = getAt<unknown>(data, node.value);
      return Boolean(value);
    }
    case 'literal':
      return Boolean(node.value);
    case 'not':
      return !evalAst(node.child, data);
    case 'and':
      return evalAst(node.left, data) && evalAst(node.right, data);
    case 'or':
      return evalAst(node.left, data) || evalAst(node.right, data);
    case 'eq': {
      const leftVal = normalizeValue(resolveValue(node.left, data));
      const rightVal = normalizeValue(resolveValue(node.right, data));
      return leftVal === rightVal;
    }
    case 'neq': {
      const leftVal = normalizeValue(resolveValue(node.left, data));
      const rightVal = normalizeValue(resolveValue(node.right, data));
      return leftVal !== rightVal;
    }
    default:
      return true;
  }
}

function buildShowIfEntries(container: HTMLElement): ShowIfEntry[] {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>('[data-bob-showif]'));
  const entries: ShowIfEntry[] = [];
  nodes.forEach((node) => {
    const raw = node.getAttribute('data-bob-showif') || '';
    if (!raw.trim()) return;
    try {
      const ast = parseShowIf(raw);
      entries.push({ el: node, ast, raw });
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('[TdMenuContent] Failed to parse show-if', raw, err);
      }
    }
  });
  return entries;
}

function applyShowIfVisibility(entries: ShowIfEntry[], data: Record<string, unknown>) {
  entries.forEach((entry) => {
    let isVisible = true;
    if (entry.ast) {
      try {
        isVisible = evalAst(entry.ast, data);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.warn('[TdMenuContent] show-if evaluation failed', entry.raw, err);
        }
      }
    }
    const hideTarget =
      entry.el.closest<HTMLElement>('[data-bob-group], .diet-textfield, .diet-toggle, [data-bob-control]') || entry.el;
    hideTarget.toggleAttribute('hidden', !isVisible);
    hideTarget.setAttribute('style', isVisible ? '' : 'display: none;');
  });
}

function applyGroupHeaders(scope: HTMLElement) {
  const children = Array.from(scope.children) as HTMLElement[];
  if (!children.length) return;

  const rebuilt = document.createDocumentFragment();
  let idx = 0;

  while (idx < children.length) {
    const node = children[idx];
    const key = node.getAttribute?.('data-bob-group');
    if (!key) {
      rebuilt.appendChild(node);
      idx += 1;
      continue;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'tdmenucontent__group';
    wrapper.setAttribute('data-bob-group', key);
    const label = node.getAttribute('data-bob-group-label') || labelForGroup(key);
    const header = document.createElement('div');
    header.className = 'overline-small tdmenucontent__group-label';
    header.textContent = label;
    wrapper.appendChild(header);

    while (idx < children.length) {
      const current = children[idx];
      const currentKey = current.getAttribute?.('data-bob-group');
      if (currentKey !== key) break;
      wrapper.appendChild(current);
      idx += 1;
    }

    rebuilt.appendChild(wrapper);
  }

  scope.innerHTML = '';
  scope.appendChild(rebuilt);
}

function evaluateShowIf(expr: string | undefined, data: Record<string, unknown>): boolean {
  if (!expr) return true;
  try {
    const ast = parseShowIf(expr);
    if (!ast) return true;
    return evalAst(ast, data);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('[TdMenuContent] Unable to parse showIf expression', expr, err);
    }
    return true;
  }
}

export function TdMenuContent({ panelId, panelHtml, widgetKey, instanceData, setValue, defaults, dieterAssets, lastUpdate }: TdMenuContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderKey, setRenderKey] = useState(0);
  const showIfEntriesRef = useRef<ShowIfEntry[]>([]);
  const activePathRef = useRef<string | null>(null);
  const lastUpdateRef = useRef<TdMenuContentProps['lastUpdate']>();

  useEffect(() => {
    lastUpdateRef.current = lastUpdate ?? null;
  }, [lastUpdate]);

  // Reset caches when switching widgets
  useEffect(() => {
    loadedStyles.clear();
    loadedScripts.clear();
  }, [widgetKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFocusIn = (event: FocusEvent) => {
      activePathRef.current = resolvePathFromTarget(event.target);
    };
    const handleFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as HTMLElement | null;
      if (!next || !container.contains(next)) {
        activePathRef.current = null;
      }
    };

    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('focusout', handleFocusOut);
    return () => {
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('focusout', handleFocusOut);
    };
  }, [panelHtml]);

  // Inject panel HTML when it changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = panelHtml || '';
    applyGroupHeaders(container);

    ensureAssets(dieterAssets)
      .then(() => {
        if (container) {
          runHydrators(container);
          showIfEntriesRef.current = buildShowIfEntries(container);
          setRenderKey((n) => n + 1);
        }
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('[TdMenuContent] Failed to load Dieter assets', err);
        }
      });
  }, [panelHtml, dieterAssets?.styles, dieterAssets?.scripts]);

  // Bind controls: set values from instanceData, attach listeners, honor showIf
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const fields = Array.from(container.querySelectorAll<HTMLElement>('[data-bob-path]'));

    const cleanupFns: Array<() => void> = [];

    fields.forEach((field) => {
      const path = field.getAttribute('data-bob-path');
      if (!path) return;

      const rawValue = getAt(instanceData, path);
      const defaultValue = defaults ? getAt(defaults, path) : undefined;
      const value = rawValue === undefined ? defaultValue : rawValue;

      const isActive = activePathRef.current === path;
      const lastUpdate = lastUpdateRef.current;

      if (field instanceof HTMLInputElement && field.type === 'checkbox') {
        const nextChecked = Boolean(value);
        if (isActive) return;
        if (field.checked !== nextChecked) {
          field.checked = nextChecked;
        }
      } else if ('value' in field) {
        const nextValue =
          field instanceof HTMLInputElement && field.dataset.bobJson != null
            ? (() => {
                try {
                  return JSON.stringify(value ?? defaultValue ?? []);
                } catch {
                  return '';
                }
              })()
            : value == null
              ? ''
              : String(value);

        const currentValue = (field as HTMLInputElement).value;
        const unchanged = currentValue === nextValue;
        const isEcho = lastUpdate && lastUpdate.source === 'field' && lastUpdate.path === path;
        if (isActive || unchanged) {
          // Skip if user is typing here or nothing changed.
        } else if (!isEcho) {
          (field as HTMLInputElement).value = nextValue;
          if (field instanceof HTMLInputElement) {
            if (field.dataset.bobJson != null) {
              field.dispatchEvent(
                new CustomEvent('external-sync', {
                  detail: { value: nextValue, source: 'tdmenu' },
                })
              );
            } else if (field.classList.contains('diet-dropdown-edit__field')) {
              field.dispatchEvent(
                new CustomEvent('external-sync', {
                  detail: { value: nextValue, source: 'tdmenu' },
                })
              );
            } else if (field.classList.contains('diet-textedit__field')) {
              field.dispatchEvent(new CustomEvent('external-sync', { detail: { value: nextValue } }));
            }
          }
        }
      }

      const handler = (event: Event) => {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
        if (!target) return;

        if (target instanceof HTMLInputElement && target.type === 'checkbox') {
          setValue(path, target.checked, { source: 'field', path, ts: Date.now() });
          return;
        }

        if ('value' in target) {
          const rawValue = (target as HTMLInputElement).value;
          if (target instanceof HTMLInputElement && target.dataset.bobJson != null) {
            try {
              const parsed = rawValue ? JSON.parse(rawValue) : [];
              setValue(path, parsed, { source: 'field', path, ts: Date.now() });
            } catch {
              setValue(path, rawValue, { source: 'field', path, ts: Date.now() });
            }
          } else {
            setValue(path, rawValue, { source: 'field', path, ts: Date.now() });
          }
        }
      };

      if (field instanceof HTMLInputElement && field.type === 'checkbox') {
        field.addEventListener('change', handler);
        cleanupFns.push(() => field.removeEventListener('change', handler));
      } else {
        field.addEventListener('input', handler);
        field.addEventListener('change', handler);
        cleanupFns.push(() => {
          field.removeEventListener('input', handler);
          field.removeEventListener('change', handler);
        });
      }
    });


    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  }, [instanceData, setValue, panelHtml, renderKey, defaults]);

  // Re-apply show-if visibility when data changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!showIfEntriesRef.current.length) return;
    applyShowIfVisibility(showIfEntriesRef.current, instanceData);
  }, [instanceData, renderKey]);

  if (!panelId) {
    return (
      <div className="tdmenucontent">
        <div className="heading-3">No controls</div>
      </div>
    );
  }

  return (
    <div className="tdmenucontent">
      <div className="heading-3">{panelId}</div>
      <div className="tdmenucontent__fields" ref={containerRef} />
    </div>
  );
}

function resolvePathFromTarget(target: EventTarget | null): string | null {
  if (!target || !(target instanceof HTMLElement)) return null;
  const direct = target.closest<HTMLElement>('[data-bob-path]');
  if (direct) return direct.getAttribute('data-bob-path');

  const controlRoot = target.closest<HTMLElement>('.diet-dropdown-edit, .diet-textedit, .diet-repeater');
  if (controlRoot) {
    const hidden = controlRoot.querySelector<HTMLElement>('[data-bob-path]');
    if (hidden) return hidden.getAttribute('data-bob-path');
  }
  return null;
}
