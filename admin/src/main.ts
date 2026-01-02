import '@dieter/tokens/tokens.css';
import '@dieter/components/popover/popover.css';
import { navGroups, showcaseIndex, showcaseModules } from './data/routes';
import { generateBobNativeCatalog } from './BobNativeCatalog';
import { getIcon } from './data/icons';
import {
  hydrateChoiceTiles,
  hydrateDropdownActions,
  hydrateDropdownFill,
  hydrateDropdownEdit,
  hydrateDropdownShadow,
  hydrateDropdownUpload,
  hydrateMenuactions,
  hydratePopAddLink,
  hydrateSegmented,
  hydrateTabs,
  hydrateTextedit,
  hydrateTextfield,
} from '@dieter/components';
import dietIconCss from '@dieter/components/icon/icon.css?raw';
import { typographySections, getTypographySampleText } from './data/typography';

const appRoot = document.getElementById('app');
if (!appRoot) {
  throw new Error('DevStudio root node not found');
}

const shell = document.createElement('div');
shell.className = 'docs-shell';

const sidebar = document.createElement('aside');
sidebar.className = 'docs-shell__sidebar';

const main = document.createElement('main');
main.className = 'docs-shell__main devstudio-page-layout';

shell.append(sidebar, main);
appRoot.append(shell);

const navHeader = document.createElement('header');
navHeader.className = 'docs-shell__brand';
navHeader.innerHTML = '<h2 class="heading-2 docs-shell__brand-title">DevStudio</h2>';
sidebar.append(navHeader);

const nav = document.createElement('nav');
nav.className = 'docs-shell__nav';
sidebar.append(nav);

const links = new Map<string, HTMLAnchorElement>();

navGroups.forEach((group) => {
  if (!group.items.length) return;

  const wrapper = document.createElement('section');
  wrapper.className = 'nav-group';

  if (group.title) {
    const title = document.createElement('p');
    title.className = 'nav-group__title label-xs';
    title.textContent = group.title;
    wrapper.append(title);
  }

  const list = document.createElement('ul');
  list.className = 'nav-group__list';

  group.items.forEach((item) => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'nav-link';
    link.href = item.path;
    link.textContent = item.title;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      navigateTo(item.path);
    });
    li.append(link);
    list.append(li);
    links.set(item.path, link);
  });

  wrapper.append(list);
  nav.append(wrapper);
});

function navigateTo(path: string) {
  if (window.location.hash !== path) {
    window.location.hash = path;
  } else {
    renderFromHash();
  }
}

function parseSlug(hash: string): string | null {
  if (!hash.startsWith('#/dieter/')) return null;
  return hash.replace('#/dieter/', '').split('?')[0];
}

function setActive(path: string) {
  links.forEach((link, value) => {
    if (value === path) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function hydrateIcons(scope: ParentNode) {
  scope.querySelectorAll<HTMLElement>('[data-icon]').forEach((node) => {
    const name = node.getAttribute('data-icon');
    if (!name) return;
    const markup = getIcon(name);
    if (!markup) return;
    node.innerHTML = markup;
    node.removeAttribute('data-icon');
  });
}

function hydrateDieterComponents(scope: Element | DocumentFragment): void {
  hydrateChoiceTiles(scope);
  hydrateTextfield(scope);
  hydrateTextedit(scope);
  hydrateDropdownActions(scope);
  hydrateDropdownFill(scope);
  hydrateDropdownShadow(scope);
  hydrateDropdownUpload(scope);
  hydrateDropdownEdit(scope);
  hydrateTabs(scope);
  hydrateMenuactions(scope);
  hydrateSegmented(scope);
  hydratePopAddLink(scope);
}

function renderBobNative(): DocumentFragment {
  const catalog = generateBobNativeCatalog();
  const fragment = document.createDocumentFragment();
  const grid = document.createElement('div');
  grid.className = 'component-masonry';

  Object.entries(catalog).forEach(([name, primitive]) => {
    const wrapper = document.createElement('article');
    wrapper.className = 'component-wrapper';
    wrapper.innerHTML = `
      <header class="spec-wrapper">
        <span class="spec-line body-small">${name}</span>
        <span class="spec-line body-small">${primitive.source}</span>
      </header>
      <div class="bob-preview-wrapper">
        <style>${primitive.css}</style>
        ${primitive.html}
      </div>
    `;
    grid.append(wrapper);
  });

  fragment.append(grid);
  hydrateIcons(fragment);
  hydrateDieterComponents(fragment);
  return fragment;
}

function executeScripts(scope: DocumentFragment | Element) {
  scope.querySelectorAll('script').forEach((oldScript) => {
    const script = document.createElement('script');
    Array.from(oldScript.attributes).forEach((attr) => {
      script.setAttribute(attr.name, attr.value);
    });
    script.textContent = oldScript.textContent ?? '';
    oldScript.replaceWith(script);
  });
}

function renderHtmlPage(htmlPath: string, styles: string[] = []): DocumentFragment {
  const raw = showcaseModules[htmlPath];
  const template = document.createElement('template');
  template.innerHTML = raw ?? '<!-- missing fragment -->';
  const cloned = template.content.cloneNode(true) as DocumentFragment;
  hydrateIcons(cloned);
  executeScripts(cloned);
  const fragment = document.createDocumentFragment();
  styles.forEach((css) => {
    if (!css) return;
    const style = document.createElement('style');
    style.textContent = css;
    fragment.append(style);
  });
  fragment.append(cloned);
  hydrateDieterComponents(fragment);
  return fragment;
}

function renderNotFound(slug: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const article = document.createElement('article');
  article.className = 'stack';
  article.innerHTML = `<h1 class="heading-2">Missing</h1><p>Could not load \`${slug}\`.</p>`;
  fragment.append(article);
  return fragment;
}

function wrapWithPageChrome(fragment: DocumentFragment, title: string): DocumentFragment {
  if (fragment.querySelector('.devstudio-page')) {
    return fragment;
  }

  const nodes = Array.from(fragment.childNodes);
  const container = document.createElement('div');
  container.className = 'devstudio-page';
  let headingElement: Element | null = null;
  const skipNodes = new Set<Node>();

  for (const node of nodes) {
    if (!(node instanceof Element)) continue;

    if (/^H[1-6]$/.test(node.tagName)) {
      headingElement = node;
      skipNodes.add(node);
      break;
    }

    if (node.children.length === 1) {
      const child = node.children[0];
      if (/^H[1-6]$/.test(child.tagName)) {
        headingElement = child;
        skipNodes.add(node);
        break;
      }
    }
  }

  const header = document.createElement('header');
  header.className = 'devstudio-page__header';

  if (headingElement) {
    headingElement.parentElement?.removeChild(headingElement);
    header.append(headingElement);
  } else {
    const heading = document.createElement('h1');
    heading.className = 'heading-2';
    heading.textContent = title;
    header.append(heading);
  }

  const defaultSection = document.createElement('div');
  defaultSection.className = 'devstudio-page-section';
  let hasDefaultContent = false;
  const sections: Element[] = [];

  nodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').trim()) {
      return;
    }

  if (skipNodes.has(node)) {
    return;
  }

    if (node instanceof HTMLStyleElement) {
      container.append(node);
      return;
    }

    if (node instanceof Element && node.classList.contains('devstudio-page-section')) {
      if (defaultSection.childNodes.length) {
        sections.push(defaultSection.cloneNode(true) as Element);
        defaultSection.replaceChildren();
      }
      sections.push(node);
      return;
    }

    defaultSection.append(node);
    hasDefaultContent = true;
  });

  container.append(header);
  sections.forEach((section) => container.append(section));
  if (hasDefaultContent) {
    container.append(defaultSection);
  }

  const wrapped = document.createDocumentFragment();
  wrapped.append(container);
  return wrapped;
}

function hydrateTypographyPage(scope: ParentNode) {
  const container = scope.querySelector<HTMLElement>('.typography-page__sections');
  if (!container || container.childElementCount) return;

  const doc = container.ownerDocument;

  typographySections.forEach(({ title, samples }) => {
    const header = doc.createElement('h3');
    header.textContent = title;
    container.appendChild(header);

    samples.forEach((sample) => {
      const row = doc.createElement('div');
      row.className = 'row';
      row.setAttribute('data-cols', '1');

      const rowHeader = doc.createElement('div');
      rowHeader.className = 'row-header';
      rowHeader.textContent = sample.name;
      row.appendChild(rowHeader);

      const specWrapper = doc.createElement('div');
      specWrapper.className = 'specdpreview';

      const specs = doc.createElement('div');
      specs.className = 'preview-specs';

      const specRow = doc.createElement('div');
      specRow.className = 'preview-specs__row';

      const specDetail = doc.createElement('span');
      specDetail.className = 'preview-specs__detail';
      specDetail.textContent = `.${sample.className}`;

      specRow.appendChild(specDetail);
      specs.appendChild(specRow);
      specWrapper.appendChild(specs);

      const previewWrapper = doc.createElement('div');
      previewWrapper.className = 'componentpreview';

      const sampleElement = doc.createElement('div');
      sampleElement.className = sample.className;
      sampleElement.textContent = getTypographySampleText(sample.sample);

      previewWrapper.appendChild(sampleElement);
      specWrapper.appendChild(previewWrapper);

      row.appendChild(specWrapper);
      container.appendChild(row);
    });
  });
}

function renderFromHash() {
  const slug = parseSlug(window.location.hash);
  if (!slug) {
    const first = navGroups[0]?.items[0];
    if (first) navigateTo(first.path);
    return;
  }

  const page = showcaseIndex.get(slug);
  if (!page) {
    main.replaceChildren(renderNotFound(slug));
    return;
  }

  const pageStyles = page.css ? [...page.css] : [];
  if (page.slug === 'icons') {
    pageStyles.push(dietIconCss);
  }

  let content: DocumentFragment;
  if (slug === 'bob-ui-native') {
    content = renderBobNative();
  } else {
    content = renderHtmlPage(page.htmlPath, pageStyles);
  }

  const wrapped = wrapWithPageChrome(content, page.title);
  setActive(page.path);
  document.title = `DevStudio · ${page.title}`;
  main.replaceChildren(wrapped);
  hydrateDieterComponents(main);
  hydrateTypographyPage(main);
}

window.addEventListener('hashchange', renderFromHash);
renderFromHash();
