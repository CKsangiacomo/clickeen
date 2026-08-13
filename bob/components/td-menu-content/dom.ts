import type { AccountAssetsClient } from '../../../dieter/components/shared/account-assets';
import {
  destroyDropdownActions,
  destroyDropdownBorder,
  destroyDropdownEdit,
  destroyDropdownFill,
  destroyDropdownShadow,
  hydrateBulkEdit,
  hydrateChoiceTiles,
  hydrateDropdownActions,
  hydrateDropdownBorder,
  hydrateDropdownEdit,
  hydrateDropdownFill,
  hydrateDropdownShadow,
  hydrateDropdownUpload,
  hydrateMenuactions,
  hydratePopAddLink,
  hydrateSegmented,
  hydrateTabs,
  hydrateTextedit,
  hydrateTextfield,
  hydrateValuefield,
} from '../../../dieter/components';
import { hydrateObjectManager } from '../../../dieter/components/object-manager/object-manager';
import { hydrateRepeater } from '../../../dieter/components/repeater/repeater';

export type DieterHydratorDeps = {
  accountAssets: AccountAssetsClient;
};

function hydrateIcons(scope: Element | DocumentFragment): void {
  scope.querySelectorAll<HTMLElement>('[data-icon]').forEach((icon) => {
    const name = icon.dataset.icon?.trim() ?? '';
    if (!/^[a-z0-9.-]+$/i.test(name)) return;
    icon.style.setProperty('--diet-icon-source', `url("/dieter/icons/svg/${name}.svg")`);
  });
}

export function runHydrators(scope: HTMLElement, deps: DieterHydratorDeps): () => void {
  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    scope.querySelectorAll<HTMLElement>('.diet-dropdown-actions').forEach(destroyDropdownActions);
    scope.querySelectorAll<HTMLElement>('.diet-dropdown-border').forEach(destroyDropdownBorder);
    scope.querySelectorAll<HTMLElement>('.diet-dropdown-edit').forEach(destroyDropdownEdit);
    scope.querySelectorAll<HTMLElement>('.diet-dropdown-fill').forEach(destroyDropdownFill);
    scope.querySelectorAll<HTMLElement>('.diet-dropdown-shadow').forEach(destroyDropdownShadow);
  };
  const nestedDeps = {
    ...deps,
    hydrateChildren: (childScope: HTMLElement) => runHydrators(childScope, deps),
  };

  try {
    hydrateIcons(scope);
    hydrateBulkEdit(scope);
    hydrateChoiceTiles(scope);
    hydrateDropdownActions(scope);
    hydrateDropdownBorder(scope);
    hydrateDropdownEdit(scope);
    hydrateDropdownFill(scope, deps);
    hydrateDropdownShadow(scope);
    hydrateDropdownUpload(scope, deps);
    hydrateMenuactions(scope);
    hydrateObjectManager(scope, nestedDeps);
    hydratePopAddLink(scope);
    hydrateRepeater(scope, nestedDeps);
    hydrateSegmented(scope);
    hydrateTabs(scope);
    hydrateTextedit(scope);
    hydrateTextfield(scope);
    hydrateValuefield(scope);
    hydrateIcons(scope);
  } catch (error) {
    destroy();
    throw error;
  }

  return destroy;
}

export function syncSegmentedPressedState(input: HTMLInputElement) {
  const segment = input.closest('.diet-segment');
  if (!segment) return;
  const button = segment.querySelector<HTMLElement>('.diet-button');
  if (!button) return;
  button.setAttribute('aria-pressed', input.checked ? 'true' : 'false');
}

export function applyGroupHeaders(scope: HTMLElement, ownerLabel = '') {
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
    const label = rawLabel ?? '';
    const normalizedLabel = label.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const normalizedOwner = ownerLabel.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    if (normalizedLabel && normalizedLabel !== normalizedOwner) {
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

export function applyClusterGroupHeaders(cluster: HTMLElement): void {
  const label = cluster.querySelector<HTMLElement>(
    ':scope > .tdmenucontent__cluster-header > .tdmenucontent__cluster-label',
  );
  applyGroupHeaders(getClusterBody(cluster) ?? cluster, label?.textContent ?? '');
}

export function controlHostClusterId(namespace: string, id: string): string {
  if (!/^[a-z][a-z0-9-]*$/.test(namespace)) {
    throw new Error('[BobControlHost] cluster id namespace is invalid');
  }
  if (!/^td-[a-z0-9-]+-cluster-body-\d+$/.test(id)) {
    throw new Error('[BobControlHost] compiled cluster body id is invalid');
  }
  return `${namespace}-${id}`;
}

export function namespaceControlHostClusterIds(scope: HTMLElement, namespace: string): void {
  const bodies = Array.from(
    scope.querySelectorAll<HTMLElement>('.tdmenucontent__cluster-body[id]'),
  );
  const controls = Array.from(scope.querySelectorAll<HTMLElement>('[aria-controls]'));
  const ids = new Set<string>();
  bodies.forEach((body) => {
    const previousId = body.id;
    if (ids.has(previousId)) {
      throw new Error(`[BobControlHost] duplicate compiled cluster body id: ${previousId}`);
    }
    ids.add(previousId);
    const nextId = controlHostClusterId(namespace, previousId);
    body.id = nextId;
    controls.forEach((control) => {
      if (control.getAttribute('aria-controls') === previousId) {
        control.setAttribute('aria-controls', nextId);
      }
    });
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
