import type { AccountAssetsClient } from '../../../dieter/components/shared/account-assets';
import {
  hydrateBulkEdit,
  hydrateButton,
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
  hydrateTextrename,
  hydrateToggle,
  hydrateValuefield,
} from '../../../dieter/components';
import { hydrateObjectManager } from '../../../dieter/components/object-manager/object-manager';
import { hydrateRepeater } from '../../../dieter/components/repeater/repeater';

const GROUP_LABELS: Record<string, string> = {
  wgtappearance: 'Widget appearance',
  wgtlayout: 'Widget layout',
  podstageappearance: 'Stage/Pod appearance',
  podstagelayout: 'Stage/Pod layout',
};

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

function labelForGroup(key: string | null): string {
  if (!key) return '';
  return GROUP_LABELS[key] || key.replace(/-/g, ' ');
}

export function runHydrators(scope: HTMLElement, deps: DieterHydratorDeps): void {
  const nestedDeps = {
    ...deps,
    hydrateChildren: (childScope: HTMLElement) => runHydrators(childScope, deps),
  };

  hydrateIcons(scope);
  hydrateBulkEdit(scope, nestedDeps);
  hydrateButton(scope);
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
  hydrateTextrename(scope);
  hydrateToggle(scope);
  hydrateValuefield(scope);
  hydrateIcons(scope);
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
