import { pathMatchesAllowlist, type AllowlistEntry } from '../../lib/l10n/instance';

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

const GROUP_LABELS: Record<string, string> = {
  wgtappearance: 'Widget appearance',
  wgtlayout: 'Widget layout',
  podstageappearance: 'Stage/Pod appearance',
  podstagelayout: 'Stage/Pod layout',
};

export type DieterAssets = {
  styles?: string[];
  scripts?: string[];
};

function loadStyle(href: string): Promise<void> {
  if (!href) return Promise.resolve();
  if (loadedStyles.has(href)) return Promise.resolve();
  const existing = stylePromises.get(href);
  if (existing) return existing;
  const head = document.head;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  const promise = new Promise<void>((resolve, reject) => {
    link.onload = () => {
      loadedStyles.add(href);
      resolve();
    };
    link.onerror = () => reject(new Error(`Failed to load style ${href}`));
  });
  stylePromises.set(href, promise);
  head.appendChild(link);
  return promise;
}

function loadScript(src: string): Promise<void> {
  if (!src) return Promise.resolve();
  const existing = loadedScripts.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script ${src}`));
    document.head.appendChild(script);
  });
  loadedScripts.set(src, promise);
  return promise;
}

function applyDisabledState(
  el: { disabled: boolean; dataset: DOMStringMap },
  readOnly: boolean,
  disabledKey: string,
) {
  if (readOnly) {
    if (!(disabledKey in el.dataset)) el.dataset[disabledKey] = el.disabled ? '1' : '0';
    el.disabled = true;
    return;
  }
  if (disabledKey in el.dataset) {
    el.disabled = el.dataset[disabledKey] === '1';
    delete el.dataset[disabledKey];
  }
}

function applyReadOnlyFlag(
  el: { readOnly: boolean; dataset: DOMStringMap },
  readOnly: boolean,
  readonlyKey: string,
) {
  if (readOnly) {
    if (!(readonlyKey in el.dataset)) el.dataset[readonlyKey] = el.readOnly ? '1' : '0';
    el.readOnly = true;
    return;
  }
  if (readonlyKey in el.dataset) {
    el.readOnly = el.dataset[readonlyKey] === '1';
    delete el.dataset[readonlyKey];
  }
}

function labelForGroup(key: string | null): string {
  if (!key) return '';
  return GROUP_LABELS[key] || key.replace(/-/g, ' ');
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

export function resetDieterAssetCaches() {
  loadedStyles.clear();
  loadedScripts.clear();
}

export async function ensureAssets(dieterAssets: DieterAssets | undefined): Promise<void> {
  const styleLoads = (dieterAssets?.styles || []).map((href) => loadStyle(href));
  const scriptList = dieterAssets?.scripts || [];

  const scriptsPromise = scriptList.reduce<Promise<void>>(async (chain, src) => {
    await chain;
    await loadScript(src);
  }, Promise.resolve());

  const settled = await Promise.allSettled([...styleLoads, scriptsPromise]);
  const failures = settled.filter((entry): entry is PromiseRejectedResult => entry.status === 'rejected');

  if (failures.length > 0 && process.env.NODE_ENV === 'development') {
    failures.forEach((failure) => {
      console.warn('[TdMenuContent] Dieter asset load warning', failure.reason);
    });
  }
}

export function runHydrators(scope: HTMLElement) {
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

export function syncSegmentedPressedState(input: HTMLInputElement) {
  const segment = input.closest('.diet-segment');
  if (!segment) return;
  const button = segment.querySelector<HTMLElement>('.diet-btn-ictxt, .diet-btn-ic, .diet-btn-txt');
  if (!button) return;
  button.setAttribute('aria-pressed', input.checked ? 'true' : 'false');
}

export function applyReadOnlyState(container: HTMLElement, readOnly: boolean) {
  const disabledKey = 'ckReadonlyDisabled';
  const readonlyKey = 'ckReadonlyReadonly';
  const contentEditableKey = 'ckReadonlyContenteditable';

  container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((el) => {
    applyDisabledState(el, readOnly, disabledKey);
    applyReadOnlyFlag(el, readOnly, readonlyKey);
  });

  container.querySelectorAll<HTMLSelectElement>('select').forEach((el) => {
    applyDisabledState(el, readOnly, disabledKey);
  });

  container.querySelectorAll<HTMLButtonElement>('button').forEach((el) => {
    if (el.classList.contains('tdmenucontent__cluster-toggle')) return;
    applyDisabledState(el, readOnly, disabledKey);
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

export function applyGroupHeaders(scope: HTMLElement) {
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

export function getClusterBody(cluster: HTMLElement): HTMLElement | null {
  return cluster.querySelector<HTMLElement>(':scope > .tdmenucontent__cluster-body');
}

export function applyTranslateVisibility(
  scope: HTMLElement,
  allowlist: Array<string | AllowlistEntry>,
  enabled: boolean,
) {
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
    const previous = rootAllow.get(root);
    rootAllow.set(root, previous === true ? true : allowed);
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

export function installClusterCollapseBehavior(container: HTMLElement): () => void {
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
