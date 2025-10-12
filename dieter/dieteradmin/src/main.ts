import '@dieter/tokens/tokens.css';
import '@dieter/components/button.css';
import '@dieter/components/segmented.css';
import '@dieter/components/textfield.css';
import '@dieter/components/dropdown.css';
import '@dieter/components/expander.css';
import '@dieter/components/toggle.css';
import '@dieter/components/tabs.css';

import { showcasePages, showcaseIndex, navGroups, type NavItem } from './data/routes';
import { getIcon } from './data/icons';
import { navigate, startRouter, type RouteMatch } from './router';

const htmlFragments = import.meta.glob('./html/dieter-showcase/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function hydrateIcons(scope: Element | DocumentFragment) {
  scope.querySelectorAll<HTMLElement>('[data-icon]').forEach((node) => {
    const name = node.getAttribute('data-icon');
    if (!name) return;
    const markup = getIcon(name);
    if (!markup) {
      return;
    }
    node.innerHTML = markup;
    node.removeAttribute('data-icon');
  });
}

const getFragment = (path: string): string => {
  const [rawPath, rawAnchor] = path.split('#', 2);
  const anchor = rawAnchor?.trim();
  const normalised = rawPath.startsWith('./')
    ? rawPath
    : rawPath.startsWith('../')
      ? rawPath.replace('../', './')
      : `./${rawPath}`;
  const fragment =
    htmlFragments[normalised] ??
    htmlFragments[`${normalised}?raw` as keyof typeof htmlFragments];
  const html = typeof fragment === 'string' ? fragment : '<!-- MISSING FRAGMENT -->';

  if (!anchor) {
    return html;
  }

  const template = document.createElement('template');
  template.innerHTML = html;
  const target =
    template.content.querySelector(`#${anchor}`) ??
    template.content.querySelector(`[data-demo="${anchor}"]`);
  return target ? target.outerHTML : html;
};

const app = document.getElementById('app');
if (!app) throw new Error('Root app container not found');

const shell = document.createElement('div');
shell.className = 'docs-shell';
shell.setAttribute('data-sidebar', 'expanded');

const sidebar = document.createElement('aside');
sidebar.className = 'docs-shell__sidebar';
sidebar.setAttribute('aria-label', 'Site navigation');
sidebar.setAttribute('data-sidebar-state', 'expanded');

const overlay = document.createElement('div');
overlay.className = 'docs-shell__overlay';
overlay.setAttribute('aria-hidden', 'true');


const main = document.createElement('main');
main.className = 'docs-shell__main';

const contentSection = document.createElement('section');
contentSection.className = 'docs-shell__content';
main.append(contentSection);

shell.append(sidebar, overlay, main);
app.append(shell);

const toggleButton = document.createElement('button');
toggleButton.type = 'button';
toggleButton.className = 'docs-shell__menu-toggle nav-link';
toggleButton.setAttribute('aria-expanded', 'false');
toggleButton.textContent = '☰';

toggleButton.addEventListener('click', () => {
  const isOpen = sidebar.getAttribute('data-state') === 'open';
  sidebar.setAttribute('data-state', isOpen ? 'closed' : 'open');
  overlay.setAttribute('data-state', isOpen ? 'closed' : 'open');
  toggleButton.setAttribute('aria-expanded', String(!isOpen));
});

overlay.addEventListener('click', () => {
  sidebar.setAttribute('data-state', 'closed');
  overlay.setAttribute('data-state', 'closed');
  toggleButton.setAttribute('aria-expanded', 'false');
});


const brandSection = document.createElement('div');
brandSection.className = 'docs-shell__brand';

const brandHeader = document.createElement('div');
brandHeader.className = 'docs-shell__brand-header';

const brandTitle = document.createElement('h1');
brandTitle.className = 'heading-1 docs-shell__brand-title';
brandTitle.style.margin = '0';
brandTitle.textContent = 'Dieter';

const createSidebarToggle = (direction: 'collapse' | 'expand') => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `sidebar-toggle sidebar-toggle--${direction} diet-btn`;
  button.setAttribute('data-size', 'md');
  button.setAttribute('data-type', 'icon-only');
  button.setAttribute('data-variant', 'neutral');
  button.setAttribute('aria-label', direction === 'collapse' ? 'Collapse sidebar' : 'Expand sidebar');
  button.innerHTML = direction === 'collapse'
    ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9.75 3.25a.75.75 0 0 1 0 1.06L7.06 7l2.69 2.69a.75.75 0 1 1-1.06 1.06l-3.22-3.22a.75.75 0 0 1 0-1.06l3.22-3.22a.75.75 0 0 1 1.06 0z" fill="currentColor"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6.25 12.75a.75.75 0 0 1 0-1.06L8.94 9 6.25 6.31a.75.75 0 0 1 1.06-1.06l3.22 3.22a.75.75 0 0 1 0 1.06l-3.22 3.22a.75.75 0 0 1-1.06 0z" fill="currentColor"/></svg>';
  return button;
};

const collapseToggle = createSidebarToggle('collapse');
const expandToggle = createSidebarToggle('expand');

const themeControl = document.createElement('div');
themeControl.className = 'diet-segmented';
themeControl.setAttribute('role', 'radiogroup');
themeControl.setAttribute('data-size', 'lg');
themeControl.innerHTML = `
  <label class="diet-segment" data-type="icon-only">
    <input type="radio" name="theme" value="light" class="diet-segment__input" checked>
    <span class="diet-segment__surface" aria-hidden="true"></span>
    <span class="diet-segment__icon" aria-hidden="true" data-icon="sun.max"></span>
    <span class="diet-segment__sr">Light theme</span>
  </label>
  <label class="diet-segment" data-type="icon-only">
    <input type="radio" name="theme" value="dark" class="diet-segment__input">
    <span class="diet-segment__surface" aria-hidden="true"></span>
    <span class="diet-segment__icon" aria-hidden="true" data-icon="moon.fill"></span>
    <span class="diet-segment__sr">Dark theme</span>
  </label>
`;

// Hydrate Dieter icons in the sidebar segmented, same as previews
try { hydrateIcons(themeControl); } catch {}

themeControl.querySelectorAll('input[name="theme"]').forEach((input) => {
  input.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.checked) {
      document.documentElement.setAttribute('data-theme', target.value);
      const colorTable = document.querySelector<HTMLElement>('.color-table');
      if (colorTable) {
        colorTable.setAttribute('data-color-theme', target.value);
      }
    }
  });
});

const initialThemeRadio = themeControl.querySelector<HTMLInputElement>('input[name="theme"]:checked');
const initialTheme = initialThemeRadio?.value ?? 'light';
document.documentElement.setAttribute('data-theme', initialTheme);
const colorTableInit = document.querySelector<HTMLElement>('.color-table');
if (colorTableInit) {
  colorTableInit.setAttribute('data-color-theme', initialTheme);
}

const setSidebarLayout = (state: 'expanded' | 'collapsed') => {
  shell.setAttribute('data-sidebar', state);
  sidebar.setAttribute('data-sidebar-state', state);
  collapseToggle.hidden = state === 'collapsed';
  expandToggle.hidden = state === 'expanded';
  if (state === 'collapsed') {
    sidebar.setAttribute('data-state', 'closed');
    overlay.setAttribute('data-state', 'closed');
    toggleButton.setAttribute('aria-expanded', 'false');
  }
};

collapseToggle.addEventListener('click', () => setSidebarLayout('collapsed'));
expandToggle.addEventListener('click', () => setSidebarLayout('expanded'));

brandHeader.append(brandTitle, collapseToggle);
brandSection.append(brandHeader, themeControl, expandToggle);

const navContainer = document.createElement('nav');
navContainer.className = 'docs-shell__nav';

const createNavGroup = (groupTitle: string, items: NavItem[]) => {
  const group = document.createElement('div');
  group.className = 'nav-group';

  if (groupTitle) {
    const title = document.createElement('p');
    title.className = 'nav-group__title';
    title.textContent = groupTitle;
    group.append(title);
  }

  const list = document.createElement('ul');
  list.className = 'nav-group__list';

  items.forEach((item) => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'nav-link diet-btn';
    link.setAttribute('data-size', 'md');
    link.setAttribute('data-variant', 'neutral');
    link.href = item.path;
    link.textContent = item.title;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(item.path);
    });
    li.append(link);
    list.append(li);
  });

  group.append(list);
  return group;
};

navGroups.forEach((group, index) => {
  navContainer.append(createNavGroup(group.title, group.items));
  if (group.id === 'dieter') {
    const divider = document.createElement('div');
    divider.className = 'nav-divider';
    navContainer.append(divider);
  }
});

sidebar.append(brandSection, navContainer);

setSidebarLayout('expanded');

type RenderResult = HTMLElement;

const renderShowcase = (slug?: string): RenderResult => {
  if (!slug) return renderNotFound('Component showcase not specified');
  // Special case: Bob page → keep page header, but preview body is a pure empty container.
  if (slug === 'bob') {
    const article = document.createElement('article');
    article.className = 'stack';
    // Ensure bottom breathing room so preview doesn't touch viewport bottom
    try {
      (article.style as any).paddingBottom = '40px';
      // Constrain the article to viewport height minus the bottom padding,
      // and let the preview fill remaining space without overflowing.
      (article.style as any).minHeight = 'calc(100vh - 40px)';
      (article.style as any).display = 'grid';
      (article.style as any).gridTemplateRows = 'auto 1fr';
    } catch {}

    const headerSection = document.createElement('header');
    headerSection.className = 'stack';
    headerSection.innerHTML = `
      <h1 class="heading-2" style="margin:0">Bob</h1>
    `;

    const previewSection = document.createElement('section');
    previewSection.id = 'Bob-Preview';
    previewSection.className = 'stack';
    // Bob preview should be a pure empty container filling the available height
    try {
      (previewSection.style as any).background = 'var(--color-system-gray-5)';
      (previewSection.style as any).minHeight = '0';
      (previewSection.style as any).height = '100%';
      (previewSection.style as any).overflow = 'hidden';
      (previewSection.style as any).padding = '16px';
      (previewSection.style as any).boxSizing = 'border-box';
    } catch {}

    // Serve Bob inside the preview as an iframe (fills the container)
    // Default behavior: point to the root path '/' to match local Next dev
    // and typical deployments. Still honor VITE_BOB_URL and VITE_BOB_PATH
    // when provided.
    try {
      const base = String((import.meta as any).env?.VITE_BOB_URL || 'http://localhost:3000');
      let bobPath = (import.meta as any).env?.VITE_BOB_PATH as string | undefined;
      if (!bobPath) {
        try {
          const u = new URL(base);
          // Prefer root '/' by default (works for local dev and most hosts)
          // Only use '/bob' when explicitly provided via VITE_BOB_PATH.
          bobPath = '/';
          // If someone really hosts Bob at a subpath, they can set VITE_BOB_PATH.
          // Keep a minimal heuristic: if port is non-empty and not 3000, still default to '/'.
          // This avoids hardcoding '/bob' which caused 404s in production builds.
          void u; // avoid unused var in some bundlers
        } catch {
          // If base is not a valid URL string, still fall back to root
          bobPath = '/';
        }
      }
      const url = base.replace(/\/$/, '') + (bobPath.startsWith('/') ? bobPath : `/${bobPath}`);
      const frame = document.createElement('iframe');
      frame.src = url;
      frame.setAttribute('title', 'Bob');
      frame.style.width = '100%';
      frame.style.height = '100%';
      frame.style.border = '0';
      frame.style.background = 'transparent';
      frame.style.borderRadius = '12px';
      previewSection.append(frame);
    } catch {}

    article.append(headerSection, previewSection);
    return article;
  }
  const preview = showcaseIndex.get(slug);
  if (!preview) return renderNotFound('Component showcase not found');

  const article = document.createElement('article');
  article.className = 'stack';

  const headerSection = document.createElement('header');
  headerSection.className = 'stack';
  headerSection.innerHTML = `
    <h1 class="heading-2" style="margin:0">${preview.title}</h1>
  `;

  const previewSection = document.createElement('section');
  previewSection.id = 'preview';
  previewSection.className = 'stack';
  const previewFragment = buildHtmlFragment(preview.htmlPath);
  wireDropdownDemo(previewFragment);
  previewSection.append(previewFragment);

  if (preview.css.length > 0) {
    article.append(headerSection, previewSection, buildCodeBlock(preview.css.map((href) => `import '${href}';`).join('\n')));
  } else {
    article.append(headerSection, previewSection);
  }
  return article;
};

const renderNotFound = (message: string): RenderResult => {
  const article = document.createElement('article');
  article.className = 'stack';
  const heading = document.createElement('h1');
  heading.className = 'heading-3';
  heading.textContent = 'Not found';
  const paragraph = document.createElement('p');
  paragraph.textContent = message;
  article.append(heading, paragraph);
  return article;
};

const buildHtmlFragment = (path: string) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'demo-fragment';
  wrapper.innerHTML = getFragment(path);
  // After injecting the static fragment, dynamically generate spec blocks
  // for each demo cell so specs never drift from the live markup.
  try {
    hydrateIcons(wrapper);
    applyDynamicSpecs(wrapper);
    applySectionColumnSizing(wrapper);
  } catch {
    // Non-fatal: previews still render with original content
  }
  wireDropdownDemo(wrapper);
  return wrapper;
};

const buildCodeBlock = (code: string) => {
  if (!code) {
    const placeholder = document.createElement('div');
    placeholder.className = 'demo-fragment';
    return placeholder;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'demo-fragment';

  const heading = document.createElement('div');
  heading.style.fontWeight = '600';
  heading.style.fontSize = '14px';
  heading.style.lineHeight = '1.4';
  heading.style.marginBottom = '8px';
  heading.textContent = 'CSS contract';

  const pre = document.createElement('pre');
  pre.style.margin = '0';
  const codeEl = document.createElement('code');
  codeEl.textContent = code;
  pre.append(codeEl);

  wrapper.append(heading, pre);
  return wrapper;
};

const setActiveNav = (path: string) => {
  const links = sidebar.querySelectorAll<HTMLAnchorElement>('a.nav-link');
  links.forEach((link) => {
    if (link.getAttribute('href') === path) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
};

const handleRoute = (match: RouteMatch) => {
  // Per-page background override: Bob page uses pure white page background only for this page
  try {
    if (match.kind === 'showcase' && match.slug === 'bob') {
      document.body.style.background = 'var(--color-system-white)';
      (shell.style as any).background = 'var(--color-system-white)';
    } else {
      // Revert to stylesheet defaults for all other pages
      document.body.style.removeProperty('background');
      (shell.style as any).removeProperty?.('background');
    }
  } catch {}

  const firstNavItem = navGroups.find((group) => group.items.length > 0)?.items[0];
  if (match.kind === 'home') {
    if (firstNavItem) {
      navigate(firstNavItem.path);
      return;
    }
  }

  const rendered = renderShowcase(match.slug);
  document.title = `Dieter Preview · ${match.slug ?? ''}`;
  setActiveNav(`#/dieter/${match.slug ?? ''}`);

  contentSection.replaceChildren(rendered);
  // Also run a final pass on the whole rendered section
  hydrateIcons(rendered);
  try {
    applyDynamicSpecs(rendered);
    applySectionColumnSizing(rendered);
    wireDropdownDemo(rendered);
  } catch {}
};

startRouter(handleRoute);

// ---- Dynamic spec generation (Admin-only) ----

const activeDropdowns = new Set<HTMLElement>();
let dropdownDocumentListenersAttached = false;

function closeDropdown(dropdown: HTMLElement) {
  const trigger = dropdown.querySelector<HTMLElement>('[data-dropdown-trigger]');
  const surface = dropdown.querySelector<HTMLElement>('[data-dropdown-surface]');
  dropdown.setAttribute('data-state', 'closed');
  trigger?.setAttribute('aria-expanded', 'false');
  surface?.removeAttribute('tabindex');
  activeDropdowns.delete(dropdown);
}

function handleDropdownDocPointer(event: Event) {
  activeDropdowns.forEach((dropdown) => {
    if (!dropdown.contains(event.target as Node)) {
      closeDropdown(dropdown);
    }
  });
}

function handleDropdownDocKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  const targetDropdown = Array.from(activeDropdowns).find((dropdown) => dropdown.contains(event.target as Node));
  if (targetDropdown) {
    closeDropdown(targetDropdown);
    const trigger = targetDropdown.querySelector<HTMLButtonElement>('[data-dropdown-trigger]');
    trigger?.focus();
  }
}

function ensureDropdownDocumentListeners() {
  if (dropdownDocumentListenersAttached) return;
  document.addEventListener('pointerdown', handleDropdownDocPointer, true);
  document.addEventListener('keydown', handleDropdownDocKey);
  dropdownDocumentListenersAttached = true;
}

function toggleDropdown(dropdown: HTMLElement, force?: 'open' | 'closed') {
  const trigger = dropdown.querySelector<HTMLButtonElement>('[data-dropdown-trigger]');
  const isOpen = dropdown.getAttribute('data-state') === 'open';
  const nextState = force ? force : isOpen ? 'closed' : 'open';
  if (nextState === 'open') {
    dropdown.setAttribute('data-state', 'open');
    trigger?.setAttribute('aria-expanded', 'true');
    ensureDropdownDocumentListeners();
    activeDropdowns.add(dropdown);
    const surface = dropdown.querySelector<HTMLElement>('[data-dropdown-surface]');
    surface?.setAttribute('tabindex', '-1');
    surface?.focus({ preventScroll: true });
  } else {
    closeDropdown(dropdown);
  }
}

function wireDropdownDemo(scope: Element) {
  const dropdowns = scope.querySelectorAll<HTMLElement>('[data-demo="dropdown"]');
  dropdowns.forEach((dropdown) => {
    if (dropdown.dataset.dropdownWired === 'true') return;
    dropdown.dataset.dropdownWired = 'true';
    const trigger = dropdown.querySelector<HTMLButtonElement>('[data-dropdown-trigger]');
    if (!trigger) return;
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      toggleDropdown(dropdown);
    });
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleDropdown(dropdown, 'open');
      }
    });
    dropdown.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeDropdown(dropdown);
        trigger.focus();
      }
    });
  });
}

const SIZE_PX: Record<string, number> = { xs: 16, sm: 20, md: 24, lg: 28, xl: 32 } as const;
const DEFAULT_SIZE_BY_COMPONENT: Record<string, string> = {
  'diet-segmented': 'sm',
  'diet-input': 'md',
  'diet-btn': 'md',
  'diet-toggle': 'md',
  'diet-tabs': 'md',
};

function findComponentRoot(container: Element): { el: HTMLElement; name: string } | null {
  // Prefer explicit known roots
  const explicit = container.querySelector<HTMLElement>('.diet-btn, .diet-segmented, .diet-input, .diet-toggle, .diet-tabs');
  if (explicit) {
    const cls = Array.from(explicit.classList).find((c) => c === 'diet-btn' || c === 'diet-segmented' || c === 'diet-input' || c === 'diet-toggle' || c === 'diet-tabs');
    if (cls) return { el: explicit, name: cls };
  }
  // Fallback: first class that looks like a root diet-* (exclude element subclasses)
  const all = Array.from(container.querySelectorAll<HTMLElement>('*'));
  for (const el of all) {
    const root = Array.from(el.classList).find(
      (c) => c.startsWith('diet-') && !c.startsWith('diet-btn__') && !c.startsWith('diet-segment__') && !c.startsWith('diet-input__'),
    );
    if (root === 'diet-btn' || root === 'diet-segmented' || root === 'diet-input' || root === 'diet-toggle' || root === 'diet-tabs') {
      return { el, name: root };
    }
  }
  return null;
}

function deriveSize(el: HTMLElement, componentName: string): string {
  const attr = el.getAttribute('data-size');
  if (attr && SIZE_PX[attr]) return attr;
  // Default when data-size is omitted (e.g., segmented small rows use default)
  return DEFAULT_SIZE_BY_COMPONENT[componentName] || 'md';
}

function applyDynamicSpecs(scope: Element) {
  const cells = scope.querySelectorAll<HTMLElement>('.specdpreview');
  cells.forEach((cell) => {
    const specs = cell.querySelector<HTMLElement>('.preview-specs');
    const demo = cell.querySelector<HTMLElement>('.componentpreview');
    if (!specs || !demo) return;

    const comp = findComponentRoot(demo);
    if (!comp) return;
    const size = deriveSize(comp.el, comp.name);
    const px = SIZE_PX[size] ?? undefined;

    // Clear and rebuild specs area with the required two lines:
    // 1) data-size + px (body-small)
    // 2) component class name (caption-small)
    specs.innerHTML = '';

    const sizeRow = document.createElement('div');
    sizeRow.className = 'preview-specs__row';
    const sizeSpan = document.createElement('span');
    sizeSpan.className = 'label-small';
    sizeSpan.textContent = px ? `${size} · ${px}` : size;
    sizeRow.append(sizeSpan);

    const nameRow = document.createElement('div');
    nameRow.className = 'preview-specs__row';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'caption-small';
    nameSpan.textContent = comp.name;
    nameRow.append(nameSpan);

    specs.append(sizeRow, nameRow);
  });
}

// DELETED: applySectionColumnSizing - CSS handles all layout now
function applySectionColumnSizing(_scope: Element) {
  // No-op: removed JS-based grid column sizing
}
