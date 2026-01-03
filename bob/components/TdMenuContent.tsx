import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PanelId } from '../lib/types';
import type { ApplyWidgetOpsResult, WidgetOp } from '../lib/ops';
import { getAt } from '../lib/utils/paths';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import { applyI18nToDom } from '../lib/i18n/dom';

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

function syncSegmentedPressedState(input: HTMLInputElement) {
  const segment = input.closest('.diet-segment');
  if (!segment) return;
  const button = segment.querySelector<HTMLElement>('.diet-btn-ictxt, .diet-btn-ic, .diet-btn-txt');
  if (!button) return;
  button.setAttribute('aria-pressed', input.checked ? 'true' : 'false');
}

type TdMenuContentProps = {
  panelId: PanelId | null;
  panelHtml: string;
  widgetKey?: string;
  instanceData: Record<string, unknown>;
  applyOps: (ops: WidgetOp[]) => ApplyWidgetOpsResult;
  canUndo?: boolean;
  undoLastOps?: () => void;
  lastUpdate?: { source: 'field' | 'load' | 'external' | 'ops' | 'unknown'; path: string; ts: number } | null;
  dieterAssets?: {
    styles: string[];
    scripts: string[];
  };
  header?: ReactNode;
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
  | { type: 'call'; name: string; args: ShowIfAst[] }
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
      const next = peek();
      if (next && next.t === 'paren' && next.v === '(') {
        consume(); // (
        const args: ShowIfAst[] = [];
        const nextTok = peek();
        if (nextTok && nextTok.t === 'paren' && nextTok.v === ')') {
          consume(); // )
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
  return parseOr();
}

function normalizeValue(val: unknown): unknown {
  return val;
}

function resolveValue(node: ShowIfAst, data: Record<string, unknown>): unknown {
  if (node.type === 'path') {
    const val = getAt<unknown>(data, node.value);
    return val;
  }
  if (node.type === 'literal') return node.value;
  if (node.type === 'call') {
    return evalCall(node, data);
  }
  return evalAst(node, data);
}

function evalCall(node: Extract<ShowIfAst, { type: 'call' }>, data: Record<string, unknown>): unknown {
  const name = node.name;
  if (name === 'contains') {
    const hay = node.args[0] ? resolveValue(node.args[0], data) : '';
    const needle = node.args[1] ? resolveValue(node.args[1], data) : '';
    const hayText =
      typeof hay === 'string'
        ? hay
        : (() => {
            try {
              return JSON.stringify(hay) ?? '';
            } catch {
              return '';
            }
          })();
    const needleText = typeof needle === 'string' ? needle : String(needle ?? '');
    return hayText.includes(needleText);
  }

  throw new Error(`Unknown show-if function "${name}"`);
}

function evalAst(node: ShowIfAst, data: Record<string, unknown>): boolean {
  switch (node.type) {
    case 'path': {
      const value = resolveValue(node, data);
      return Boolean(value);
    }
    case 'literal':
      return Boolean(node.value);
    case 'call': {
      const value = resolveValue(node, data);
      return Boolean(value);
    }
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

function collectShowIfPaths(raw: string): string[] {
  if (!raw.trim()) return [];
  try {
    return tokenizeShowIf(raw)
      .filter((tok): tok is { t: 'path'; v: string } => tok.t === 'path')
      .map((tok) => tok.v);
  } catch {
    return [];
  }
}

function autoNestShowIfDependentClusters(scope: HTMLElement) {
  const topLevelClusters = Array.from(
    scope.querySelectorAll<HTMLElement>(':scope > .tdmenucontent__cluster'),
  );
  if (topLevelClusters.length < 2) return;

  const clusterOrder = new Map<HTMLElement, number>();
  const pathOwner = new Map<string, HTMLElement>();

  const registerClusterPaths = (cluster: HTMLElement) => {
    const paths = Array.from(cluster.querySelectorAll<HTMLElement>('[data-bob-path]'))
      .map((el) => el.getAttribute('data-bob-path'))
      .filter((p): p is string => Boolean(p && p.trim()));
    paths.forEach((p) => pathOwner.set(p, cluster));
  };

  const findControllingCluster = (cluster: HTMLElement): HTMLElement | null => {
    const showIfNodes = [
      ...(cluster.hasAttribute('data-bob-showif') ? [cluster] : []),
      ...Array.from(cluster.querySelectorAll<HTMLElement>('[data-bob-showif]')),
    ];

    let controller: HTMLElement | null = null;
    let bestOrder = -1;

    showIfNodes.forEach((node) => {
      const raw = node.getAttribute('data-bob-showif') || '';
      collectShowIfPaths(raw).forEach((path) => {
        const owner = pathOwner.get(path);
        if (!owner) return;
        const order = clusterOrder.get(owner);
        if (order == null) return;
        if (order > bestOrder) {
          bestOrder = order;
          controller = owner;
        }
      });
    });

    return controller;
  };

  topLevelClusters.forEach((cluster, idx) => {
    const controller = findControllingCluster(cluster);
    if (controller && controller !== cluster && !controller.contains(cluster)) {
      controller.appendChild(cluster);
    }

    clusterOrder.set(cluster, idx);
    registerClusterPaths(cluster);
  });
}

export function TdMenuContent({
  panelId,
  panelHtml,
  widgetKey,
  instanceData,
  applyOps,
  canUndo,
  undoLastOps,
  dieterAssets,
  lastUpdate,
  header,
}: TdMenuContentProps) {
  const session = useWidgetSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderKey, setRenderKey] = useState(0);
  const showIfEntriesRef = useRef<ShowIfEntry[]>([]);
  const activePathRef = useRef<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
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
      const path = resolvePathFromTarget(event.target);
      activePathRef.current = path;
      if (path) setSelectedPath(path);
      session.setSelectedPath(path);
    };
    const handleFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as HTMLElement | null;
      if (!next || !container.contains(next)) {
        activePathRef.current = null;
        session.setSelectedPath(null);
      }
    };

    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('focusout', handleFocusOut);
    return () => {
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('focusout', handleFocusOut);
    };
  }, [panelHtml]);

  useEffect(() => {
    // (reserved for future per-path UX enhancements)
  }, [selectedPath]);

  // Inject panel HTML when it changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = panelHtml || '';
    autoNestShowIfDependentClusters(container);
    applyGroupHeaders(container);

    ensureAssets(dieterAssets)
      .then(() => {
        if (container) {
          runHydrators(container);
          applyI18nToDom(container, session.compiled?.widgetname ?? null).catch((err) => {
            if (process.env.NODE_ENV === 'development') {
              // eslint-disable-next-line no-console
              console.warn('[TdMenuContent] i18n apply failed', err);
            }
          });
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
  }, [panelHtml, dieterAssets?.styles, dieterAssets?.scripts, session.compiled?.widgetname]);

  // Bind controls: render values from instanceData, emit strict ops, honor showIf
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleBobOpsEvent = (event: Event) => {
      // Dieter controls may emit an explicit ops bundle (e.g. typography family -> {family,weight,style}).
      const detail = (event as any).detail;
      const ops = detail?.ops as WidgetOp[] | undefined;
      if (!Array.isArray(ops) || ops.length === 0) return;
      event.stopPropagation();
      const applied = applyOps(ops);
      if (!applied.ok && process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('[TdMenuContent] Failed to apply ops event', applied.errors);
      }
    };

    const applySet = (path: string, rawValue: unknown) => {
      const applied = applyOps([{ op: 'set', path, value: rawValue }]);
      if (!applied.ok && process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('[TdMenuContent] Failed to apply set op', applied.errors);
      }
    };

    const setOp = (path: string, value: unknown): WidgetOp => ({ op: 'set', path, value });

    const handleContainerEvent = (event: Event) => {
      const detail = (event as any).detail;
      if (detail?.bobIgnore === true) return;

      const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (!target) return;
      // Dropdown Edit can host a PopAddLink input that must not be treated as widget instanceData updates.
      if (target.closest('.diet-popaddlink')) return;
      const path = resolvePathFromTarget(target);
      if (!path) return;

      if (target instanceof HTMLInputElement && target.type === 'checkbox') {
        if (path === 'pod.radiusLinked' && target.checked) {
          const source = getAt<unknown>(instanceData, 'pod.radiusTL');
          const ops: WidgetOp[] = [
            { op: 'set', path: 'pod.radiusLinked', value: true },
            { op: 'set', path: 'pod.radius', value: source },
            { op: 'set', path: 'pod.radiusTL', value: source },
            { op: 'set', path: 'pod.radiusTR', value: source },
            { op: 'set', path: 'pod.radiusBR', value: source },
            { op: 'set', path: 'pod.radiusBL', value: source },
          ];
          applyOps(ops);
          return;
        }
        if (path === 'pod.paddingLinked') {
          const nextLinked = target.checked;
          const linkedValue = getAt<unknown>(instanceData, 'pod.padding');
          const topValue = getAt<unknown>(instanceData, 'pod.paddingTop');
          const source = nextLinked ? topValue : linkedValue;
          if (!isFiniteNumber(source)) {
            applySet(path, nextLinked);
            return;
          }
          const ops: WidgetOp[] = [
            setOp('pod.paddingLinked', nextLinked),
            ...(nextLinked ? [setOp('pod.padding', source)] : []),
            setOp('pod.paddingTop', source),
            setOp('pod.paddingRight', source),
            setOp('pod.paddingBottom', source),
            setOp('pod.paddingLeft', source),
          ];
          applyOps(ops);
          return;
        }
        if (path === 'stage.paddingLinked') {
          const nextLinked = target.checked;
          const linkedValue = getAt<unknown>(instanceData, 'stage.padding');
          const topValue = getAt<unknown>(instanceData, 'stage.paddingTop');
          const source = nextLinked ? topValue : linkedValue;
          if (!isFiniteNumber(source)) {
            applySet(path, nextLinked);
            return;
          }
          const ops: WidgetOp[] = [
            setOp('stage.paddingLinked', nextLinked),
            ...(nextLinked ? [setOp('stage.padding', source)] : []),
            setOp('stage.paddingTop', source),
            setOp('stage.paddingRight', source),
            setOp('stage.paddingBottom', source),
            setOp('stage.paddingLeft', source),
          ];
          applyOps(ops);
          return;
        }
        if (path === 'layout.itemPaddingLinked') {
          const nextLinked = target.checked;
          const linkedValue = getAt<unknown>(instanceData, 'layout.itemPadding');
          const topValue = getAt<unknown>(instanceData, 'layout.itemPaddingTop');
          const source = nextLinked ? topValue : linkedValue;
          if (!isFiniteNumber(source)) {
            applySet(path, nextLinked);
            return;
          }
          const ops: WidgetOp[] = [
            setOp('layout.itemPaddingLinked', nextLinked),
            ...(nextLinked ? [setOp('layout.itemPadding', source)] : []),
            setOp('layout.itemPaddingTop', source),
            setOp('layout.itemPaddingRight', source),
            setOp('layout.itemPaddingBottom', source),
            setOp('layout.itemPaddingLeft', source),
          ];
          applyOps(ops);
          return;
        }
        applySet(path, target.checked);
        return;
      }

      if ('value' in target) {
        const rawValue = (target as HTMLInputElement).value;
        const currentValue = getAt(instanceData, path);

        if (target instanceof HTMLInputElement && target.dataset.bobJson != null) {
          const parsed = parseBobJsonValue(target, rawValue);
          if (parsed == null) {
            if (process.env.NODE_ENV === 'development') {
              // eslint-disable-next-line no-console
              console.warn('[TdMenuContent] Ignoring invalid JSON input for path', path);
            }
            return;
          }
          applySet(path, parsed);
          return;
        }

        if (isFiniteNumber(currentValue)) {
          const trimmed = rawValue.trim();
          if (!trimmed) {
            if (process.env.NODE_ENV === 'development') {
              // eslint-disable-next-line no-console
              console.warn('[TdMenuContent] Ignoring empty numeric input for path', path);
            }
            return;
          }
          const parsed = Number(trimmed);
          if (!Number.isFinite(parsed)) {
            if (process.env.NODE_ENV === 'development') {
              // eslint-disable-next-line no-console
              console.warn('[TdMenuContent] Ignoring invalid numeric input for path', path);
            }
            return;
          }
          applySet(path, parsed);
          return;
        }

        // Typography: switching to "custom" should prefill sizeCustom with the current preset size.
        const sizePresetMatch = path.match(/^typography\.roles\.([^.]+)\.sizePreset$/);
        if (sizePresetMatch && rawValue === 'custom') {
          const roleKey = sizePresetMatch[1];
          const currentPreset = getAt<unknown>(instanceData, path);
          if (typeof currentPreset === 'string' && currentPreset.trim() && currentPreset !== 'custom') {
            const scaleValue = getAt<unknown>(instanceData, `typography.roleScales.${roleKey}.${currentPreset}`);
            if (typeof scaleValue === 'string' && scaleValue.trim()) {
              const applied = applyOps([
                { op: 'set', path: `typography.roles.${roleKey}.sizeCustom`, value: scaleValue },
                { op: 'set', path, value: rawValue },
              ]);
              if (!applied.ok && process.env.NODE_ENV === 'development') {
                // eslint-disable-next-line no-console
                console.warn('[TdMenuContent] Failed to apply typography sizePreset ops', applied.errors);
              }
              return;
            }
          }
        }

        applySet(path, rawValue);
      }
    };

    container.addEventListener('bob-ops', handleBobOpsEvent as EventListener, true);
    container.addEventListener('input', handleContainerEvent, true);
    container.addEventListener('change', handleContainerEvent, true);

    const fields = Array.from(container.querySelectorAll<HTMLElement>('[data-bob-path]'));

    fields.forEach((field) => {
      const path = field.getAttribute('data-bob-path');
      if (!path) return;

      const rawValue = getAt(instanceData, path);
      const value = rawValue;

      const isActive = activePathRef.current === path;
      const lastUpdate = lastUpdateRef.current;

      if (field instanceof HTMLInputElement && field.type === 'radio') {
        const nextChecked = value != null && String(value) === field.value;
        if (!isActive && field.checked !== nextChecked) {
          field.checked = nextChecked;
          syncSegmentedPressedState(field);
        } else if (!isActive) {
          // Keep aria-pressed in sync even when the checked state didn't change.
          syncSegmentedPressedState(field);
        }
        return;
      }

      if (field instanceof HTMLInputElement && field.type === 'checkbox') {
        const nextChecked = value === true;
        if (isActive) return;
        if (field.checked !== nextChecked) {
          field.checked = nextChecked;
        }
      } else if ('value' in field) {
        const nextValue =
          field instanceof HTMLInputElement && field.dataset.bobJson != null
            ? (() => {
                try {
                  return value == null ? '' : JSON.stringify(value);
                } catch {
                  return '';
                }
              })()
            : value == null
              ? ''
              : String(value);

        const currentValue = (field as HTMLInputElement).value;
        const unchanged = currentValue === nextValue;
        const isEcho = lastUpdate && lastUpdate.source === 'ops' && lastUpdate.path === path;
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
    });

    return () => {
      container.removeEventListener('bob-ops', handleBobOpsEvent as EventListener, true);
      container.removeEventListener('input', handleContainerEvent, true);
      container.removeEventListener('change', handleContainerEvent, true);
    };
  }, [instanceData, applyOps, panelHtml, renderKey]);

  // Re-apply show-if visibility when data changes
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    showIfEntriesRef.current = buildShowIfEntries(container);
    applyShowIfVisibility(showIfEntriesRef.current, instanceData);
  });

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
      {header}
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

function parseBobJsonValue(input: HTMLInputElement, rawValue: string): unknown | null {
  if (input.dataset.bobJson == null) return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
