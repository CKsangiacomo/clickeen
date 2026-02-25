import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PanelId } from '../lib/types';
import type { ApplyWidgetOpsResult, WidgetOp } from '../lib/ops';
import { getAt } from '../lib/utils/paths';
import { buildControlMatchers, findBestControlForPath } from '../lib/edit/controls';
import { getCkTypographyAllowedStyles, getCkTypographyAllowedWeights } from '../lib/edit/typography-fonts';
import { pathMatchesAllowlist, type AllowlistEntry } from '../lib/l10n/instance';
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

type PresetSpec = {
  customValue?: string;
  values?: Record<string, Record<string, unknown>>;
};

type PresetEntry = {
  sourcePath: string;
  customValue: string;
  values: Record<string, Record<string, unknown>>;
  targetPaths: string[];
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildPresetEntries(raw: unknown): PresetEntry[] {
  if (!isPlainRecord(raw)) return [];
  const entries: PresetEntry[] = [];

  for (const [sourcePath, specRaw] of Object.entries(raw)) {
    if (!sourcePath || !isPlainRecord(specRaw)) continue;
    const valuesRaw = (specRaw as PresetSpec).values;
    if (!isPlainRecord(valuesRaw)) continue;

    const values: Record<string, Record<string, unknown>> = {};
    const targetSet = new Set<string>();
    for (const [presetKey, mappingRaw] of Object.entries(valuesRaw)) {
      if (!presetKey || !isPlainRecord(mappingRaw)) continue;
      values[presetKey] = mappingRaw;
      Object.keys(mappingRaw).forEach((path) => {
        if (path) targetSet.add(path);
      });
    }

    if (Object.keys(values).length === 0 || targetSet.size === 0) continue;
    const customValue =
      typeof (specRaw as PresetSpec).customValue === 'string' && (specRaw as PresetSpec).customValue?.trim()
        ? (specRaw as PresetSpec).customValue!.trim()
        : 'custom';

    entries.push({
      sourcePath,
      customValue,
      values,
      targetPaths: Array.from(targetSet),
    });
  }

  return entries;
}

function pathMatchesTarget(path: string, target: string): boolean {
  return path === target || path.startsWith(`${target}.`);
}

function pickAllowedValue(current: unknown, allowed: string[], preferred: string): string {
  const trimmed = typeof current === 'string' ? current.trim() : '';
  if (trimmed && allowed.includes(trimmed)) return trimmed;
  if (allowed.includes(preferred)) return preferred;
  return allowed[0] ?? '';
}

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

function applyReadOnlyState(container: HTMLElement, readOnly: boolean) {
  const disabledKey = 'ckReadonlyDisabled';
  const readonlyKey = 'ckReadonlyReadonly';
  const contentEditableKey = 'ckReadonlyContenteditable';

  container.querySelectorAll<HTMLInputElement>('input').forEach((el) => {
    if (readOnly) {
      if (!(disabledKey in el.dataset)) el.dataset[disabledKey] = el.disabled ? '1' : '0';
      if (!(readonlyKey in el.dataset)) el.dataset[readonlyKey] = el.readOnly ? '1' : '0';
      el.readOnly = true;
      el.disabled = true;
      return;
    }
    if (disabledKey in el.dataset) {
      el.disabled = el.dataset[disabledKey] === '1';
      delete el.dataset[disabledKey];
    }
    if (readonlyKey in el.dataset) {
      el.readOnly = el.dataset[readonlyKey] === '1';
      delete el.dataset[readonlyKey];
    }
  });

  container.querySelectorAll<HTMLTextAreaElement>('textarea').forEach((el) => {
    if (readOnly) {
      if (!(disabledKey in el.dataset)) el.dataset[disabledKey] = el.disabled ? '1' : '0';
      if (!(readonlyKey in el.dataset)) el.dataset[readonlyKey] = el.readOnly ? '1' : '0';
      el.readOnly = true;
      el.disabled = true;
      return;
    }
    if (disabledKey in el.dataset) {
      el.disabled = el.dataset[disabledKey] === '1';
      delete el.dataset[disabledKey];
    }
    if (readonlyKey in el.dataset) {
      el.readOnly = el.dataset[readonlyKey] === '1';
      delete el.dataset[readonlyKey];
    }
  });

  container.querySelectorAll<HTMLSelectElement>('select').forEach((el) => {
    if (readOnly) {
      if (!(disabledKey in el.dataset)) el.dataset[disabledKey] = el.disabled ? '1' : '0';
      el.disabled = true;
      return;
    }
    if (disabledKey in el.dataset) {
      el.disabled = el.dataset[disabledKey] === '1';
      delete el.dataset[disabledKey];
    }
  });

  container.querySelectorAll<HTMLButtonElement>('button').forEach((el) => {
    if (el.classList.contains('tdmenucontent__cluster-toggle')) return;
    if (readOnly) {
      if (!(disabledKey in el.dataset)) el.dataset[disabledKey] = el.disabled ? '1' : '0';
      el.disabled = true;
      return;
    }
    if (disabledKey in el.dataset) {
      el.disabled = el.dataset[disabledKey] === '1';
      delete el.dataset[disabledKey];
    }
  });

  container.querySelectorAll<HTMLElement>('[contenteditable]').forEach((el) => {
    if (readOnly) {
      if (!(contentEditableKey in el.dataset)) {
        const original = el.getAttribute('contenteditable');
        el.dataset[contentEditableKey] = original == null ? '__unset__' : original;
      }
      el.setAttribute('contenteditable', 'false');
      return;
    }
    if (contentEditableKey in el.dataset) {
      const original = el.dataset[contentEditableKey];
      if (original === '__unset__') el.removeAttribute('contenteditable');
      else el.setAttribute('contenteditable', original ?? '');
      delete el.dataset[contentEditableKey];
    }
  });
}

async function ensureAssets(dieterAssets: { styles?: string[]; scripts?: string[] } | undefined): Promise<void> {
  const styleLoads = (dieterAssets?.styles || []).map((href) => loadStyle(href));
  const scriptList = dieterAssets?.scripts || [];

  // Load scripts sequentially to preserve dependency order.
  const scriptsPromise = scriptList.reduce<Promise<void>>(async (chain, src) => {
    await chain;
    await loadScript(src);
  }, Promise.resolve());

  const settled = await Promise.allSettled([...styleLoads, scriptsPromise]);
  const failures = settled.filter(
    (entry): entry is PromiseRejectedResult => entry.status === 'rejected'
  );

  if (failures.length > 0 && process.env.NODE_ENV === 'development') {
    failures.forEach((failure) => {
      console.warn('[TdMenuContent] Dieter asset load warning', failure.reason);
    });
  }
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
  footer?: ReactNode;
  translateMode?: boolean;
  readOnly?: boolean;
  translateAllowlist?: Array<string | AllowlistEntry>;
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

function hasLinksInValue(value: unknown, seen: Set<unknown> = new Set()): boolean {
  if (value == null) return false;
  if (typeof value === 'string') {
    return /<a\b[^>]*href=/i.test(value);
  }
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((item) => hasLinksInValue(item, seen));
  }
  return Object.values(value as Record<string, unknown>).some((item) => hasLinksInValue(item, seen));
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
  if (name === 'hasLinks') {
    const values = node.args.map((arg) => resolveValue(arg, data));
    return values.some((value) => hasLinksInValue(value));
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
          console.warn('[TdMenuContent] show-if evaluation failed', entry.raw, err);
        }
      }
    }
    const hideTarget =
      entry.el.closest<HTMLElement>(
        '[data-bob-group], .diet-textfield, .diet-valuefield, .diet-toggle, [data-bob-control]'
      ) || entry.el;
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
    const rawLabel = node.getAttribute('data-bob-group-label');
    const label = rawLabel !== null ? rawLabel : labelForGroup(key);
    if (label.trim()) {
      const header = document.createElement('div');
      header.className = 'overline-small tdmenucontent__group-label';
      header.textContent = label;
      wrapper.appendChild(header);
    }

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

function getClusterBody(cluster: HTMLElement): HTMLElement | null {
  return cluster.querySelector<HTMLElement>(':scope > .tdmenucontent__cluster-body');
}

function normalizeBobPath(raw: string): string {
  return String(raw || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');
}

function resolveTranslateRoot(field: HTMLElement): HTMLElement {
  return (
    field.closest<HTMLElement>(
      '.diet-dropdown-actions, .diet-dropdown-edit, .diet-textedit, .diet-textfield, .diet-valuefield, .diet-toggle, .diet-select, .diet-dropdown, .diet-range, .diet-slider, .diet-color, .diet-input'
    ) || field
  );
}

function normalizeTranslateAllowlist(allowlist: Array<string | AllowlistEntry>): string[] {
  return allowlist
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object' && typeof entry.path === 'string') return entry.path.trim();
      return '';
    })
    .filter(Boolean);
}

function applyTranslateVisibility(scope: HTMLElement, allowlist: Array<string | AllowlistEntry>, enabled: boolean) {
  const tagged = scope.querySelectorAll<HTMLElement>(
    '[data-translate-hidden], [data-translate-allow], [data-translate-empty]'
  );
  tagged.forEach((node) => {
    node.removeAttribute('data-translate-hidden');
    node.removeAttribute('data-translate-allow');
    node.removeAttribute('data-translate-empty');
  });

  const allowlistPaths = normalizeTranslateAllowlist(allowlist);
  if (!enabled || allowlistPaths.length === 0) return;

  const isAllowed = (path: string) => allowlistPaths.some((allow) => pathMatchesAllowlist(path, allow));
  const rootAllow = new Map<HTMLElement, boolean>();
  const fields = Array.from(scope.querySelectorAll<HTMLElement>('[data-bob-path]'));

  fields.forEach((field) => {
    const rawPath = field.getAttribute('data-bob-path') || '';
    const path = normalizeBobPath(rawPath);
    if (!path) return;
    const root = resolveTranslateRoot(field);
    const allowed = isAllowed(path);
    const prev = rootAllow.get(root);
    rootAllow.set(root, prev === true ? true : allowed);
  });

  rootAllow.forEach((allowed, root) => {
    if (allowed) {
      root.setAttribute('data-translate-allow', 'true');
      return;
    }
    root.setAttribute('data-translate-hidden', 'true');
  });

  const groups = scope.querySelectorAll<HTMLElement>('.tdmenucontent__cluster, .tdmenucontent__group');
  groups.forEach((group) => {
    const hasAllowed = Boolean(group.querySelector('[data-translate-allow="true"]'));
    if (!hasAllowed) {
      group.setAttribute('data-translate-empty', 'true');
    }
  });
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
      const body = getClusterBody(controller);
      (body ?? controller).appendChild(cluster);
    }

    clusterOrder.set(cluster, idx);
    registerClusterPaths(cluster);
  });
}

function installClusterCollapseBehavior(container: HTMLElement): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>('.tdmenucontent__cluster-toggle');
    if (!button) return;
    const cluster = button.closest<HTMLElement>('.tdmenucontent__cluster');
    if (!cluster) return;
    const body = getClusterBody(cluster);
    if (!body) return;

    const collapsed = cluster.dataset.collapsed === 'true';
    const nextCollapsed = !collapsed;
    cluster.dataset.collapsed = nextCollapsed ? 'true' : 'false';
    body.toggleAttribute('hidden', nextCollapsed);
    button.setAttribute('aria-expanded', nextCollapsed ? 'false' : 'true');
    event.preventDefault();
    event.stopPropagation();
  };

  container.addEventListener('click', onClick);
  return () => container.removeEventListener('click', onClick);
}

export function TdMenuContent({
  panelId,
  panelHtml,
  widgetKey,
  instanceData,
  applyOps,
  dieterAssets,
  lastUpdate,
  header,
  footer,
  translateMode = false,
  readOnly = false,
  translateAllowlist = [],
}: TdMenuContentProps) {
  const session = useWidgetSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderKey, setRenderKey] = useState(0);
  const showIfEntriesRef = useRef<ShowIfEntry[]>([]);
  const instanceDataRef = useRef(instanceData);
  const activePathRef = useRef<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const lastUpdateRef = useRef<TdMenuContentProps['lastUpdate']>();

  useEffect(() => {
    lastUpdateRef.current = lastUpdate ?? null;
  }, [lastUpdate]);

  useEffect(() => {
    instanceDataRef.current = instanceData;
  }, [instanceData]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const flags = session.policy?.flags ?? null;
    if (!flags || typeof flags !== 'object') {
      delete container.dataset.ckPolicyFlags;
      return;
    }
    container.dataset.ckPolicyFlags = JSON.stringify(flags);
  }, [session.policy]);

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
  }, [panelHtml, session]);

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
    container.querySelectorAll<HTMLElement>('.tdmenucontent__cluster').forEach((cluster) => {
      const body = getClusterBody(cluster);
      applyGroupHeaders(body ?? cluster);
    });
    const cleanupCollapse = installClusterCollapseBehavior(container);
    showIfEntriesRef.current = buildShowIfEntries(container);
    applyShowIfVisibility(showIfEntriesRef.current, instanceDataRef.current);

    ensureAssets(dieterAssets)
      .then(() => {
        if (container) {
          runHydrators(container);
          applyI18nToDom(container, session.compiled?.widgetname ?? null).catch((err) => {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[TdMenuContent] i18n apply failed', err);
            }
          });
          showIfEntriesRef.current = buildShowIfEntries(container);
          setRenderKey((n) => n + 1);
        }
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('[TdMenuContent] Failed to load Dieter assets', err);
        }
      });

    return () => {
      cleanupCollapse();
    };
  }, [panelHtml, dieterAssets, session.compiled?.widgetname]);

  // Bind controls: render values from instanceData, emit strict ops, honor showIf
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const setOp = (path: string, value: unknown): WidgetOp => ({ op: 'set', path, value });
    const presetEntries = buildPresetEntries(session.compiled?.presets);
    const controlMatchers = buildControlMatchers(session.compiled?.controls ?? []);
    const typographyFamilyPaths = Array.from(
      new Set(
        (session.compiled?.controls ?? [])
          .map((control) => control.path)
          .filter((path) => /^typography\.roles\.[^.]+\.family$/.test(path)),
      ),
    );
    const isAllowedPath = (path: string) => Boolean(findBestControlForPath(controlMatchers, path));

    const coerceFiniteNumber = (value: unknown): number | null => {
      if (isFiniteNumber(value)) return value;
      if (typeof value === 'string') {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };

    const coercePxNumber = (value: unknown): number | null => {
      if (isFiniteNumber(value)) return value;
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed) return null;
      const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(?:px)?$/);
      if (!match) return null;
      const n = Number(match[1]);
      return Number.isFinite(n) ? n : null;
    };

    const expandLinkedOps = (ops: WidgetOp[]): WidgetOp[] => {
      const expanded: WidgetOp[] = [];
      const presetByPath = new Map(presetEntries.map((entry) => [entry.sourcePath, entry]));
      const presetOps = new Map<string, WidgetOp>();
      const themeScopePrefixes = ['stage.', 'pod.', 'appearance.', 'typography.'];
      const insideShadowLinkedOverrides = new Map<string, boolean>();

      for (const op of ops) {
        if (op.op === 'set' && typeof op.path === 'string' && presetByPath.has(op.path)) {
          presetOps.set(op.path, op);
        }
        if (op.op === 'set' && typeof op.path === 'string' && typeof op.value === 'boolean') {
          const insideShadowLinkMatch = op.path.match(/^(stage|pod|appearance\.cardwrapper)\.insideShadow\.linked$/);
          if (insideShadowLinkMatch) insideShadowLinkedOverrides.set(insideShadowLinkMatch[1], op.value);
        }
      }

      for (const entry of presetEntries) {
        const targetPaths = entry.targetPaths.includes('typography.globalFamily')
          ? Array.from(new Set([...entry.targetPaths, ...typographyFamilyPaths]))
          : entry.targetPaths;
        const currentValue = getAt<unknown>(instanceData, entry.sourcePath);
        const shouldResetPreset =
          !presetOps.has(entry.sourcePath) &&
          typeof currentValue === 'string' &&
          currentValue !== entry.customValue &&
          ops.some((op) => {
            if (typeof op.path !== 'string') return false;
            if (op.path === entry.sourcePath) return false;
            if (entry.sourcePath === 'appearance.theme') {
              return themeScopePrefixes.some((prefix) => op.path.startsWith(prefix));
            }
            return targetPaths.some((target) => pathMatchesTarget(op.path, target));
          });

        if (shouldResetPreset) {
          expanded.push(setOp(entry.sourcePath, entry.customValue));
        }
      }

      for (const op of ops) {
        if (op.op !== 'set' || typeof op.path !== 'string') {
          expanded.push(op);
          continue;
        }

        const presetEntry = presetByPath.get(op.path);
        if (presetEntry && typeof op.value === 'string') {
          expanded.push(op);
          const presetValues = op.value !== presetEntry.customValue ? presetEntry.values[op.value] : null;
          if (presetValues) {
            for (const [presetPath, presetValue] of Object.entries(presetValues)) {
              if (presetPath === 'typography.globalFamily') {
                const familyValue = typeof presetValue === 'string' ? presetValue : '';
                if (familyValue) {
                  const allowedWeights = getCkTypographyAllowedWeights(familyValue);
                  const allowedStyles = getCkTypographyAllowedStyles(familyValue);
                  typographyFamilyPaths.forEach((familyPath) => {
                    if (isAllowedPath(familyPath)) {
                      expanded.push(setOp(familyPath, familyValue));
                    }

                    const roleBase = familyPath.replace(/\.family$/, '');
                    const weightPath = `${roleBase}.weight`;
                    const stylePath = `${roleBase}.fontStyle`;

                    if (allowedWeights.length > 0 && isAllowedPath(weightPath)) {
                      const currentWeight = getAt<unknown>(instanceData, weightPath);
                      const nextWeight = pickAllowedValue(currentWeight, allowedWeights, '400');
                      if (nextWeight) expanded.push(setOp(weightPath, nextWeight));
                    }

                    if (allowedStyles.length > 0 && isAllowedPath(stylePath)) {
                      const currentStyle = getAt<unknown>(instanceData, stylePath);
                      const nextStyle = pickAllowedValue(currentStyle, allowedStyles, 'normal');
                      if (nextStyle) expanded.push(setOp(stylePath, nextStyle));
                    }
                  });
                }
              }
              if (isAllowedPath(presetPath)) {
                expanded.push(setOp(presetPath, presetValue));
              }
            }
          }
          continue;
        }

        if (typeof op.value === 'boolean') {
          const radiusLinkMatch = op.path.match(/^(pod|appearance\.cardwrapper)\.radiusLinked$/);
          if (radiusLinkMatch) {
            const nextLinked = op.value;
            const base = radiusLinkMatch[1];
            const linkedPath = `${base}.radius`;
            const tlPath = `${base}.radiusTL`;
            const trPath = `${base}.radiusTR`;
            const brPath = `${base}.radiusBR`;
            const blPath = `${base}.radiusBL`;

            const linkedValue = getAt<unknown>(instanceData, linkedPath);
            const tlValue = getAt<unknown>(instanceData, tlPath);
            const source = nextLinked ? tlValue : linkedValue;
            if (typeof source !== 'string' || !source.trim()) {
              expanded.push(op);
              continue;
            }

            expanded.push(
              setOp(op.path, nextLinked),
              ...(nextLinked ? [setOp(linkedPath, source)] : []),
              setOp(tlPath, source),
              setOp(trPath, source),
              setOp(brPath, source),
              setOp(blPath, source),
            );
            continue;
          }

          const insideShadowLinkMatch = op.path.match(/^(stage|pod|appearance\.cardwrapper)\.insideShadow\.linked$/);
          if (insideShadowLinkMatch) {
            const nextLinked = op.value;
            const base = insideShadowLinkMatch[1];
            const allPath = `${base}.insideShadow.all`;
            const topPath = `${base}.insideShadow.top`;
            const rightPath = `${base}.insideShadow.right`;
            const bottomPath = `${base}.insideShadow.bottom`;
            const leftPath = `${base}.insideShadow.left`;

            const allValue = getAt<unknown>(instanceData, allPath);
            const topValue = getAt<unknown>(instanceData, topPath);
            const rightValue = getAt<unknown>(instanceData, rightPath);
            const bottomValue = getAt<unknown>(instanceData, bottomPath);
            const leftValue = getAt<unknown>(instanceData, leftPath);

            const pickAxis = (value: unknown, axisKey: 'x' | 'y'): number | null => {
              if (!isPlainRecord(value)) return null;
              return coerceFiniteNumber((value as Record<string, unknown>)[axisKey]);
            };

            const makeShadowFrom = (sourceShadow: Record<string, unknown>) => () => ({ ...sourceShadow });

            if (!nextLinked) {
              if (!isPlainRecord(allValue)) {
                expanded.push(op);
                continue;
              }

              const makeShadow = makeShadowFrom(allValue as Record<string, unknown>);
              expanded.push(
                setOp(op.path, nextLinked),
                setOp(topPath, makeShadow()),
                setOp(rightPath, makeShadow()),
                setOp(bottomPath, makeShadow()),
                setOp(leftPath, makeShadow()),
              );
              continue;
            }

            const baseShadowRaw =
              (isPlainRecord(topValue) ? topValue : null) ??
              (isPlainRecord(allValue) ? allValue : null) ??
              (isPlainRecord(leftValue) ? leftValue : null) ??
              (isPlainRecord(rightValue) ? rightValue : null) ??
              (isPlainRecord(bottomValue) ? bottomValue : null);

            if (!baseShadowRaw) {
              expanded.push(op);
              continue;
            }

            const baseShadow = baseShadowRaw as Record<string, unknown>;
            const mergedShadow: Record<string, unknown> = { ...baseShadow };
            const xFromSides = pickAxis(leftValue, 'x') ?? pickAxis(rightValue, 'x');
            const yFromSides = pickAxis(topValue, 'y') ?? pickAxis(bottomValue, 'y');
            if (xFromSides != null) mergedShadow.x = xFromSides;
            if (yFromSides != null) mergedShadow.y = yFromSides;

            const makeShadow = makeShadowFrom(mergedShadow);

            expanded.push(
              setOp(op.path, nextLinked),
              setOp(allPath, makeShadow()),
              setOp(topPath, makeShadow()),
              setOp(rightPath, makeShadow()),
              setOp(bottomPath, makeShadow()),
              setOp(leftPath, makeShadow()),
            );
            continue;
          }

          const v2PaddingMatch = op.path.match(/^(pod|stage)\.padding\.(desktop|mobile)\.linked$/);
          if (v2PaddingMatch) {
            const nextLinked = op.value;
            const rootKey = v2PaddingMatch[1];
            const deviceKey = v2PaddingMatch[2];
            const base = `${rootKey}.padding.${deviceKey}`;
            const allPath = `${base}.all`;
            const topPath = `${base}.top`;
            const rightPath = `${base}.right`;
            const bottomPath = `${base}.bottom`;
            const leftPath = `${base}.left`;

            const linkedValue = getAt<unknown>(instanceData, allPath);
            const topValue = getAt<unknown>(instanceData, topPath);
            const source = nextLinked ? topValue : linkedValue;
            const n = coerceFiniteNumber(source);
            if (n == null) {
              expanded.push(op);
              continue;
            }

            expanded.push(
              setOp(op.path, nextLinked),
              ...(nextLinked ? [setOp(allPath, n)] : []),
              setOp(topPath, n),
              setOp(rightPath, n),
              setOp(bottomPath, n),
              setOp(leftPath, n),
            );
            continue;
          }

          if (op.path === 'layout.itemPaddingLinked') {
            const nextLinked = op.value;
            const linkedValue = getAt<unknown>(instanceData, 'layout.itemPadding');
            const topValue = getAt<unknown>(instanceData, 'layout.itemPaddingTop');
            const source = nextLinked ? topValue : linkedValue;
            const n = coerceFiniteNumber(source);
            if (n == null) {
              expanded.push(op);
              continue;
            }

            expanded.push(
              setOp(op.path, nextLinked),
              ...(nextLinked ? [setOp('layout.itemPadding', n)] : []),
              setOp('layout.itemPaddingTop', n),
              setOp('layout.itemPaddingRight', n),
              setOp('layout.itemPaddingBottom', n),
              setOp('layout.itemPaddingLeft', n),
            );
            continue;
          }

          if (op.path === 'appearance.ctaPaddingLinked') {
            const nextLinked = op.value;
            if (nextLinked === true) {
              const inlineValue = getAt<unknown>(instanceData, 'appearance.ctaPaddingInline');
              const n = coerceFiniteNumber(inlineValue);
              if (n == null) {
                expanded.push(op);
                continue;
              }
              expanded.push(setOp(op.path, true), setOp('appearance.ctaPaddingBlock', n));
              continue;
            }
          }
        }

        const v2PaddingAllMatch = op.path.match(/^(pod|stage)\.padding\.(desktop|mobile)\.all$/);
        if (v2PaddingAllMatch) {
          const rootKey = v2PaddingAllMatch[1];
          const deviceKey = v2PaddingAllMatch[2];
          const base = `${rootKey}.padding.${deviceKey}`;
          const linkedValue = getAt<unknown>(instanceData, `${base}.linked`);
          const linked = linkedValue !== false;
          const n = coerceFiniteNumber(op.value);
          if (linked && n != null) {
            expanded.push(
              setOp(op.path, n),
              setOp(`${base}.top`, n),
              setOp(`${base}.right`, n),
              setOp(`${base}.bottom`, n),
              setOp(`${base}.left`, n),
            );
            continue;
          }
        }

        const insideShadowAllMatch = op.path.match(/^(stage|pod|appearance\.cardwrapper)\.insideShadow\.all$/);
        if (insideShadowAllMatch) {
          const base = insideShadowAllMatch[1];
          const linkedOverride = insideShadowLinkedOverrides.get(base);
          const linkedValue =
            linkedOverride != null ? linkedOverride : getAt<unknown>(instanceData, `${base}.insideShadow.linked`);
          const linked = linkedValue !== false;
          if (linked && isPlainRecord(op.value)) {
            const sourceShadow = op.value as Record<string, unknown>;
            const makeShadow = () => ({ ...sourceShadow });
            expanded.push(
              setOp(op.path, makeShadow()),
              setOp(`${base}.insideShadow.top`, makeShadow()),
              setOp(`${base}.insideShadow.right`, makeShadow()),
              setOp(`${base}.insideShadow.bottom`, makeShadow()),
              setOp(`${base}.insideShadow.left`, makeShadow()),
            );
            continue;
          }
        }

        const radiusValueMatch = op.path.match(/^(pod|appearance\.cardwrapper)\.radius$/);
        if (radiusValueMatch) {
          const base = radiusValueMatch[1];
          const linkedValue = getAt<unknown>(instanceData, `${base}.radiusLinked`);
          const linked = linkedValue !== false;
          if (linked && typeof op.value === 'string' && op.value.trim()) {
            expanded.push(
              op,
              setOp(`${base}.radiusTL`, op.value),
              setOp(`${base}.radiusTR`, op.value),
              setOp(`${base}.radiusBR`, op.value),
              setOp(`${base}.radiusBL`, op.value),
            );
            continue;
          }
        }

        if (op.path === 'layout.itemPadding') {
          const linkedValue = getAt<unknown>(instanceData, 'layout.itemPaddingLinked');
          const linked = linkedValue !== false;
          const n = coerceFiniteNumber(op.value);
          if (linked && n != null) {
            expanded.push(
              setOp(op.path, n),
              setOp('layout.itemPaddingTop', n),
              setOp('layout.itemPaddingRight', n),
              setOp('layout.itemPaddingBottom', n),
              setOp('layout.itemPaddingLeft', n),
            );
            continue;
          }
        }

        if (op.path === 'appearance.ctaPaddingInline') {
          const linkedValue = getAt<unknown>(instanceData, 'appearance.ctaPaddingLinked');
          const linked = linkedValue === true;
          const n = coerceFiniteNumber(op.value);
          if (linked && n != null) {
            expanded.push(setOp(op.path, n), setOp('appearance.ctaPaddingBlock', n));
            continue;
          }
        }

        expanded.push(op);
      }

      return expanded;
    };

    const handleBobOpsEvent = (event: Event) => {
      if (readOnly) return;
      // Dieter controls may emit an explicit ops bundle (e.g. typography family -> {family,weight,style}).
      const detail = (event as any).detail;
      const ops = detail?.ops as WidgetOp[] | undefined;
      if (!Array.isArray(ops) || ops.length === 0) return;
      event.stopPropagation();
      const applied = applyOps(expandLinkedOps(ops));
      if (!applied.ok && process.env.NODE_ENV === 'development') {
        console.warn('[TdMenuContent] Failed to apply ops event', applied.errors);
      }
    };

    const handleBobPreviewEvent = (event: Event) => {
      if (readOnly) return;
      const detail = (event as any).detail;
      if (detail?.clear) {
        event.stopPropagation();
        session.clearPreviewOps();
        return;
      }
      const ops = detail?.ops as WidgetOp[] | undefined;
      if (!Array.isArray(ops) || ops.length === 0) return;
      event.stopPropagation();
      session.setPreviewOps(expandLinkedOps(ops));
    };

    const handleUpsellEvent = (event: Event) => {
      const detail = (event as any).detail;
      const reasonKey =
        detail && typeof detail.reasonKey === 'string' ? detail.reasonKey : 'coreui.upsell.reason.flagBlocked';
      const detailText = detail && typeof detail.detail === 'string' ? detail.detail : undefined;
      event.stopPropagation();
      session.requestUpsell(reasonKey, detailText);
    };

    const applySet = (path: string, rawValue: unknown) => {
      const applied = applyOps(expandLinkedOps([{ op: 'set', path, value: rawValue }]));
      if (!applied.ok && process.env.NODE_ENV === 'development') {
        console.warn('[TdMenuContent] Failed to apply set op', applied.errors);
      }
    };

    const revertTargetValue = (target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, path: string) => {
      const prevValue = getAt<unknown>(instanceData, path);

      if (target instanceof HTMLInputElement && target.type === 'checkbox') {
        target.checked = prevValue === true;
        return;
      }

      const nextValue =
        target instanceof HTMLInputElement && target.dataset.bobJson != null
          ? serializeBobJsonFieldValue(target, prevValue)
          : prevValue == null
            ? ''
            : String(prevValue);

      if ('value' in target) {
        (target as HTMLInputElement).value = nextValue;
      }

      if (target instanceof HTMLInputElement) {
        target.dispatchEvent(
          new CustomEvent('external-sync', {
            detail: { value: nextValue, source: 'bob-deny', bobIgnore: true },
          })
        );
      }
    };

    const handleContainerEvent = (event: Event) => {
      const detail = (event as any).detail;
      if (detail?.bobIgnore === true) return;

      const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (!target) return;
      // Dropdown Edit can host a PopAddLink input that must not be treated as widget instanceData updates.
      if (target.closest('.diet-popaddlink')) return;
      const path = resolvePathFromTarget(target);
      if (!path) return;
      if (readOnly) {
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
          revertTargetValue(target, path);
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (target instanceof HTMLInputElement && target.type === 'checkbox') {
        const radiusLinkMatch = path.match(/^(pod|appearance\.cardwrapper)\.radiusLinked$/);
        if (radiusLinkMatch) {
          const nextLinked = target.checked;
          const base = radiusLinkMatch[1];
          const linkedPath = `${base}.radius`;
          const tlPath = `${base}.radiusTL`;
          const trPath = `${base}.radiusTR`;
          const brPath = `${base}.radiusBR`;
          const blPath = `${base}.radiusBL`;

          const linkedValue = getAt<unknown>(instanceData, linkedPath);
          const tlValue = getAt<unknown>(instanceData, tlPath);
          const source = nextLinked ? tlValue : linkedValue;
          if (typeof source !== 'string' || !source.trim()) {
            applySet(path, nextLinked);
            return;
          }

          const ops: WidgetOp[] = [
            setOp(path, nextLinked),
            ...(nextLinked ? [setOp(linkedPath, source)] : []),
            setOp(tlPath, source),
            setOp(trPath, source),
            setOp(brPath, source),
            setOp(blPath, source),
          ];
          applyOps(ops);
          return;
        }
        const v2PaddingMatch = path.match(/^(pod|stage)\.padding\.(desktop|mobile)\.linked$/);
        if (v2PaddingMatch) {
          const nextLinked = target.checked;
          const rootKey = v2PaddingMatch[1];
          const deviceKey = v2PaddingMatch[2];
          const base = `${rootKey}.padding.${deviceKey}`;
          const allPath = `${base}.all`;
          const topPath = `${base}.top`;
          const rightPath = `${base}.right`;
          const bottomPath = `${base}.bottom`;
          const leftPath = `${base}.left`;

          const linkedValue = getAt<unknown>(instanceData, allPath);
          const topValue = getAt<unknown>(instanceData, topPath);
          const source = nextLinked ? topValue : linkedValue;
          const n = coerceFiniteNumber(source);
          if (n == null) {
            applySet(path, nextLinked);
            return;
          }
          const ops: WidgetOp[] = [
            setOp(path, nextLinked),
            ...(nextLinked ? [setOp(allPath, n)] : []),
            setOp(topPath, n),
            setOp(rightPath, n),
            setOp(bottomPath, n),
            setOp(leftPath, n),
          ];
          applyOps(ops);
          return;
        }
        const insideShadowLinkMatch = path.match(/^(stage|pod|appearance\.cardwrapper)\.insideShadow\.linked$/);
        if (insideShadowLinkMatch) {
          const nextLinked = target.checked;
          const base = insideShadowLinkMatch[1];
          const allPath = `${base}.insideShadow.all`;
          const topPath = `${base}.insideShadow.top`;
          const rightPath = `${base}.insideShadow.right`;
          const bottomPath = `${base}.insideShadow.bottom`;
          const leftPath = `${base}.insideShadow.left`;

          const allValue = getAt<unknown>(instanceData, allPath);
          const topValue = getAt<unknown>(instanceData, topPath);
          const source = nextLinked ? topValue : allValue;
          if (!isPlainRecord(source)) {
            applySet(path, nextLinked);
            return;
          }

          const sourceShadow = source as Record<string, unknown>;
          const makeShadow = () => ({ ...sourceShadow });
          const ops: WidgetOp[] = [
            setOp(path, nextLinked),
            ...(nextLinked ? [setOp(allPath, makeShadow())] : []),
            setOp(topPath, makeShadow()),
            setOp(rightPath, makeShadow()),
            setOp(bottomPath, makeShadow()),
            setOp(leftPath, makeShadow()),
          ];
          applyOps(ops);
          return;
        }
        if (path === 'layout.itemPaddingLinked') {
          const nextLinked = target.checked;
          const linkedValue = getAt<unknown>(instanceData, 'layout.itemPadding');
          const topValue = getAt<unknown>(instanceData, 'layout.itemPaddingTop');
          const source = nextLinked ? topValue : linkedValue;
          const n = coerceFiniteNumber(source);
          if (n == null) {
            applySet(path, nextLinked);
            return;
          }
          const ops: WidgetOp[] = [
            setOp('layout.itemPaddingLinked', nextLinked),
            ...(nextLinked ? [setOp('layout.itemPadding', n)] : []),
            setOp('layout.itemPaddingTop', n),
            setOp('layout.itemPaddingRight', n),
            setOp('layout.itemPaddingBottom', n),
            setOp('layout.itemPaddingLeft', n),
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
              console.warn('[TdMenuContent] Ignoring invalid JSON input for path', path);
            }
            return;
          }
          const applied = applyOps(expandLinkedOps([{ op: 'set', path, value: parsed }]));
          if (!applied.ok) {
            revertTargetValue(target, path);
            if (process.env.NODE_ENV === 'development') {
              console.warn('[TdMenuContent] Denied JSON input for path', path, applied.errors);
            }
          }
          return;
        }

        const sizeCustomMatch = path.match(/^typography\.roles\.([^.]+)\.sizeCustom$/);
        if (sizeCustomMatch) {
          const trimmed = rawValue.trim();
          if (!trimmed) return;
          const parsed = Number(trimmed);
          if (!Number.isFinite(parsed)) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[TdMenuContent] Ignoring invalid typography sizeCustom input for path', path);
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
              console.warn('[TdMenuContent] Ignoring empty numeric input for path', path);
            }
            return;
          }
          const parsed = Number(trimmed);
          if (!Number.isFinite(parsed)) {
            if (process.env.NODE_ENV === 'development') {
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
            const scalePx = coercePxNumber(scaleValue);
            if (scalePx != null) {
              const applied = applyOps([
                { op: 'set', path: `typography.roles.${roleKey}.sizeCustom`, value: scalePx },
                { op: 'set', path, value: rawValue },
              ]);
              if (!applied.ok && process.env.NODE_ENV === 'development') {
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
    container.addEventListener('bob-preview', handleBobPreviewEvent as EventListener, true);
    container.addEventListener('bob-upsell', handleUpsellEvent as EventListener, true);
    container.addEventListener('input', handleContainerEvent, true);
    container.addEventListener('change', handleContainerEvent, true);

    const fields = Array.from(container.querySelectorAll<HTMLElement>('[data-bob-path]'));

    fields.forEach((field) => {
      const path = field.getAttribute('data-bob-path');
      if (!path) return;

      const rawValue = getAt(instanceData, path);
      const value =
        rawValue === undefined && session.compiled?.defaults
          ? getAt(session.compiled.defaults as Record<string, unknown>, path)
          : rawValue;

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
      } else if (field instanceof HTMLInputElement && field.type === 'range') {
        if (isActive) return;
        const fallback = field.min?.trim() || '0';
        const resolvedNumber = coerceFiniteNumber(value);
        const resolvedValue = resolvedNumber == null ? fallback : String(resolvedNumber);
        if (field.value !== resolvedValue) {
          field.value = resolvedValue;
        }
        field.style.setProperty('--value', resolvedValue);
        field.style.setProperty('--min', field.min || '0');
        field.style.setProperty('--max', field.max || '100');
      } else if ('value' in field) {
        let nextValue =
          field instanceof HTMLInputElement && field.dataset.bobJson != null
            ? serializeBobJsonFieldValue(field, value)
            : value == null
              ? ''
              : String(value);

        const sizeCustomMatch = path.match(/^typography\.roles\.([^.]+)\.sizeCustom$/);
        if (sizeCustomMatch && field instanceof HTMLInputElement && field.type === 'number') {
          const n = coercePxNumber(value);
          nextValue = n == null ? '' : String(n);
        }

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
            } else if (field.classList.contains('diet-datepicker__field')) {
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
      container.removeEventListener('bob-preview', handleBobPreviewEvent as EventListener, true);
      container.removeEventListener('bob-upsell', handleUpsellEvent as EventListener, true);
      container.removeEventListener('input', handleContainerEvent, true);
      container.removeEventListener('change', handleContainerEvent, true);
    };
  }, [instanceData, applyOps, panelHtml, renderKey, readOnly, session, session.requestUpsell]);

  // Re-apply show-if visibility when data changes
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    showIfEntriesRef.current = buildShowIfEntries(container);
    applyShowIfVisibility(showIfEntriesRef.current, instanceData);
    applyTranslateVisibility(container, translateAllowlist, translateMode);
    applyReadOnlyState(container, readOnly);
  });

  if (!panelId) {
    return (
      <div className="tdmenucontent">
        <div className="heading-3">No controls</div>
      </div>
    );
  }

  const panelTitle = panelId ? `${panelId.charAt(0).toUpperCase()}${panelId.slice(1)}` : '';

  return (
    <div className="tdmenucontent" data-translate-mode={translateMode ? 'true' : 'false'} data-readonly={readOnly ? 'true' : 'false'}>
      <div className="tdmenucontent__header">
        <div className="heading-3">{panelTitle}</div>
        {header}
      </div>
      <div className="tdmenucontent__fields" ref={containerRef} />
      {footer}
    </div>
  );
}

function resolvePathFromTarget(target: EventTarget | null): string | null {
  if (!target || !(target instanceof HTMLElement)) return null;
  const direct = target.closest<HTMLElement>('[data-bob-path]');
  if (direct) return direct.getAttribute('data-bob-path');

  const controlRoot = target.closest<HTMLElement>('.diet-dropdown-edit, .diet-textedit');
  if (controlRoot) {
    const hidden = controlRoot.querySelector<HTMLElement>('[data-bob-path]');
    if (hidden) return hidden.getAttribute('data-bob-path');
  }
  return null;
}

function expectsJsonArrayField(input: HTMLElement): boolean {
  return (
    input.classList.contains('diet-repeater__field') ||
    input.classList.contains('diet-object-manager__field') ||
    input.classList.contains('diet-bulk-edit__field')
  );
}

function parseBobJsonValue(input: HTMLInputElement, rawValue: string): unknown | null {
  if (input.dataset.bobJson == null) return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (expectsJsonArrayField(input) && !Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function serializeBobJsonArrayValue(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '[]';
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return trimmed;
    } catch {
      // Fall through to default.
    }
  }
  return '[]';
}

function serializeBobJsonValue(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return JSON.stringify(value);
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function serializeBobJsonFieldValue(input: HTMLInputElement, value: unknown): string {
  if (expectsJsonArrayField(input)) {
    return serializeBobJsonArrayValue(value);
  }
  return serializeBobJsonValue(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
