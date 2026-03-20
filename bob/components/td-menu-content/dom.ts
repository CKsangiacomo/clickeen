import type { AccountAssetsClient } from '../../../dieter/components/shared/account-assets';

declare global {
  interface Window {
    Dieter?: {
      hydrateAll?: (scope?: HTMLElement, deps?: DieterHydratorDeps) => void;
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

export type DieterHydratorDeps = {
  accountAssets: AccountAssetsClient;
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

function labelForGroup(key: string | null): string {
  if (!key) return '';
  return GROUP_LABELS[key] || key.replace(/-/g, ' ');
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

export function runHydrators(scope: HTMLElement, deps?: DieterHydratorDeps) {
  if (typeof window === 'undefined' || !window.Dieter) return;
  const entries = Object.entries(window.Dieter).filter(
    ([name, fn]) =>
      typeof fn === 'function' &&
      name.toLowerCase().startsWith('hydrate') &&
      name.toLowerCase() !== 'hydrateall',
  );
  for (const [, fn] of entries) {
    try {
      (fn as (el?: HTMLElement, deps?: DieterHydratorDeps) => void)(scope, deps);
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
