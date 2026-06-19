import '@dieter/tokens/tokens.css';
import '@dieter/components/popover/popover.css';
import '@dieter/components/valuefield/valuefield.css';
import '@dieter/components/toggle/toggle.css';
import './css/tokens.css';
import './css/layout.css';
import './css/dieter-previews.css';
import './css/utilities.css';
import { navGroups, showcaseIndex, showcaseModules } from './data/routes';
import { getIcon } from './data/icons';
import {
  hydrateChoiceTiles,
  hydrateDropdownActions,
  hydrateDropdownBorder,
  hydrateDropdownFill,
  hydrateDropdownEdit,
  hydrateDropdownShadow,
  hydrateDropdownUpload,
  hydrateMenuactions,
  hydratePopAddLink,
  hydrateSegmented,
  hydrateTabs,
  hydrateTextrename,
  hydrateTextedit,
  hydrateTextfield,
  hydrateValuefield,
} from '@dieter/components';
import dietIconCss from '@dieter/components/icon/icon.css?raw';
import { typographySections, typographyRoleCount, getTypographySampleText } from './data/typography';
import {
  ENTITLEMENT_META,
  isPolicyEntitled,
  deriveAiRuntimePolicyUi,
  resolveAiRuntimePolicy,
  resolvePolicy,
  getEntitlementsMatrix,
  type PolicyProfile,
} from '@clickeen/ck-policy';
import {
  labelAiModel,
  listAiAgents,
  listAiModelCatalog,
  listAiProviderUi,
  type AiProvider,
} from '@clickeen/ck-contracts/ai';
import type { AccountAssetsClient } from '@dieter/components/shared/account-assets';

const entitlements = getEntitlementsMatrix();

const showcaseAccountAssets: AccountAssetsClient = {
  async listAssets() {
    return [];
  },
  async resolveAssets() {
    return { assetsByRef: new Map(), missingAssetRefs: [] };
  },
  async uploadAsset() {
    throw new Error('Asset uploads are not available in the Dieter showcase.');
  },
};

window.__CK_ENTITLEMENTS__ = entitlements;
window.__CK_ENTITLEMENTS_META__ = ENTITLEMENT_META;

const aiProviderUi = listAiProviderUi();
const aiProviderLabelByKey = new Map(aiProviderUi.map((entry) => [entry.provider, entry.label]));
const aiAgents = listAiAgents();

const aiAgentsByTier = aiAgents.map((entry) => {
  const byTier: Partial<
    Record<
      PolicyProfile,
      {
        policyProfile: PolicyProfile;
        enabled: boolean;
        deniedEntitlement: string | null;
        allowModelPicker: boolean;
        defaultProvider: AiProvider | '';
        defaultProviderLabel: string;
        modelOptions: Array<{ provider: AiProvider; model: string; label: string }>;
        providers: Array<{
          provider: AiProvider;
          label: string;
          defaultModel: string;
          defaultModelLabel: string;
          models: Array<{ model: string; label: string }>;
        }>;
      }
    >
  > = {};

  for (const policyProfile of entitlements.tiers) {
    const policy = resolvePolicy({ profile: policyProfile, role: 'editor' });
    const deniedEntitlement =
      entry.requiredEntitlements?.find((entitlement) => !isPolicyEntitled(policy, entitlement)) ?? null;
    const runtimePolicy = resolveAiRuntimePolicy({ entry, policyProfile });
    const runtimeUi = deriveAiRuntimePolicyUi(runtimePolicy);
    const providers = (Object.entries(runtimePolicy.modelsByProvider) as Array<[AiProvider, NonNullable<typeof runtimePolicy.modelsByProvider[AiProvider]>]>).map(([provider, modelPolicy]) => {
      const defaultModel = modelPolicy?.defaultModel ?? '';
      return {
        provider,
        label: aiProviderLabelByKey.get(provider) ?? provider,
        defaultModel,
        defaultModelLabel: labelAiModel(defaultModel, provider),
        models: Array.isArray(modelPolicy?.allowed)
          ? modelPolicy!.allowed.map((model) => ({ model, label: labelAiModel(model, provider) }))
          : [],
      };
    });

    byTier[policyProfile] = {
      policyProfile,
      enabled: deniedEntitlement == null,
      deniedEntitlement,
      allowModelPicker: runtimePolicy.allowModelPicker,
      defaultProvider: runtimePolicy.defaultModel.provider,
      defaultProviderLabel: aiProviderLabelByKey.get(runtimePolicy.defaultModel.provider) ?? runtimePolicy.defaultModel.provider,
      modelOptions: runtimeUi.modelOptions,
      providers,
    };
  }

  return {
    agentId: entry.agentId,
    description: entry.description,
    category: entry.category,
    taskClass: entry.taskClass,
    executionSurface: entry.executionSurface,
    requiredEntitlements: Array.isArray(entry.requiredEntitlements) ? entry.requiredEntitlements : [],
    supportedProviders: entry.supportedProviders.map((provider) => ({
      provider,
      label: aiProviderLabelByKey.get(provider) ?? provider,
    })),
    byTier,
  };
});

window.__CK_AI_ACCESS__ = {
  providers: aiProviderUi,
  models: listAiModelCatalog(),
  agents: aiAgentsByTier,
  copilots: aiAgentsByTier.filter((agent) => agent.category === 'copilot'),
  systemAgents: aiAgentsByTier.filter((agent) => agent.category === 'system_agent'),
};

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

function parseShowcasePath(hash: string): string | null {
  const cleanHash = hash.split('?')[0];
  if (showcaseIndex.has(cleanHash)) return cleanHash;
  return null;
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
  hydrateValuefield(scope);
  hydrateTextedit(scope);
  hydrateTextrename(scope);
  hydrateDropdownActions(scope);
  hydrateDropdownBorder(scope);
  hydrateDropdownFill(scope, { accountAssets: showcaseAccountAssets });
  hydrateDropdownShadow(scope);
  hydrateDropdownUpload(scope, { accountAssets: showcaseAccountAssets });
  hydrateDropdownEdit(scope);
  hydrateTabs(scope);
  hydrateMenuactions(scope);
  hydrateSegmented(scope);
  hydratePopAddLink(scope);
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

type DieterTokenKind = 'colors' | 'typography';
type DieterToken = {
  token: string;
  value: string;
  editable: boolean;
};

const tokenCache = new Map<DieterTokenKind, DieterToken[]>();
let tokenEditor: HTMLElement | null = null;

async function fetchDieterTokens(kind: DieterTokenKind): Promise<DieterToken[]> {
  const cached = tokenCache.get(kind);
  if (cached) return cached;
  const res = await fetch(`/api/dieter/tokens/${kind}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok || !Array.isArray(payload.tokens)) {
    const message = payload?.error?.detail || payload?.error?.reasonKey || `HTTP_${res.status}`;
    throw new Error(message);
  }
  tokenCache.set(kind, payload.tokens);
  return payload.tokens;
}

async function saveDieterToken(kind: DieterTokenKind, token: string, value: string): Promise<DieterToken[]> {
  const res = await fetch(`/api/dieter/tokens/${kind}/value`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ token, value }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok || !Array.isArray(payload.tokens)) {
    const message = payload?.error?.detail || payload?.error?.reasonKey || `HTTP_${res.status}`;
    throw new Error(message);
  }
  tokenCache.set(kind, payload.tokens);
  return payload.tokens;
}

function closeTokenEditor() {
  tokenEditor?.remove();
  tokenEditor = null;
}

function updateVisibleTokenValue(token: string, value: string) {
  document.querySelectorAll<HTMLElement>(`[data-token-value="${CSS.escape(token)}"]`).forEach((node) => {
    node.textContent = value;
  });
  document.querySelectorAll<HTMLElement>(`[data-token="${CSS.escape(token)}"]`).forEach((node) => {
    node.setAttribute('data-value', value);
  });
}

async function openTokenEditor(kind: DieterTokenKind, preferredToken?: string) {
  closeTokenEditor();

  const overlay = document.createElement('div');
  overlay.className = 'devstudio-token-editor';
  overlay.innerHTML = `
    <form class="devstudio-token-editor__panel" data-state="loading">
      <div class="devstudio-token-editor__header">
        <h2 class="heading-4">Edit Token</h2>
        <button class="diet-btn-ic" data-size="sm" data-variant="neutral" type="button" data-token-editor-close aria-label="Close">
          <span class="diet-btn-ic__icon" data-icon="multiply"></span>
        </button>
      </div>
      <label class="devstudio-token-editor__field">
        <span class="label-xs">Token</span>
        <select class="devstudio-token-editor__select" name="token"></select>
      </label>
      <label class="devstudio-token-editor__field">
        <span class="label-xs">Value</span>
        <input class="devstudio-token-editor__input" name="value" type="text" autocomplete="off" />
      </label>
      <div class="devstudio-token-editor__diff body-xs" aria-live="polite"></div>
      <div class="devstudio-token-editor__actions">
        <button class="diet-btn-txt" data-size="md" data-variant="secondary" type="button" data-token-editor-close>
          <span class="diet-btn-txt__label">Cancel</span>
        </button>
        <button class="diet-btn-txt" data-size="md" data-variant="primary" type="submit">
          <span class="diet-btn-txt__label">Confirm Commit</span>
        </button>
      </div>
    </form>
  `;
  document.body.append(overlay);
  tokenEditor = overlay;
  hydrateIcons(overlay);

  const form = overlay.querySelector<HTMLFormElement>('form');
  const select = overlay.querySelector<HTMLSelectElement>('select[name="token"]');
  const input = overlay.querySelector<HTMLInputElement>('input[name="value"]');
  const diff = overlay.querySelector<HTMLElement>('.devstudio-token-editor__diff');
  if (!form || !select || !input || !diff) return;

  overlay.addEventListener('click', (event) => {
    const target = event.target;
    if (target === overlay || (target instanceof Element && target.closest('[data-token-editor-close]'))) {
      event.preventDefault();
      closeTokenEditor();
    }
  });

  const setStatus = (message: string, state = 'ready') => {
    form.dataset.state = state;
    diff.textContent = message;
  };

  try {
    const tokens = (await fetchDieterTokens(kind)).filter((token) => token.editable);
    select.replaceChildren(
      ...tokens.map((entry) => {
        const option = document.createElement('option');
        option.value = entry.token;
        option.textContent = entry.token;
        return option;
      }),
    );
    const selected = tokens.find((entry) => entry.token === preferredToken) ?? tokens[0];
    if (!selected) {
      setStatus('No editable tokens found.', 'error');
      return;
    }
    select.value = selected.token;
    input.value = selected.value;

    const syncDiff = () => {
      const current = tokens.find((entry) => entry.token === select.value);
      if (!current) return;
      if (input.value.trim() === current.value) {
        setStatus(`${current.token}: unchanged`);
      } else {
        setStatus(`${current.token}: ${current.value} -> ${input.value.trim()}`);
      }
    };

    select.addEventListener('change', () => {
      const current = tokens.find((entry) => entry.token === select.value);
      input.value = current?.value ?? '';
      syncDiff();
    });
    input.addEventListener('input', syncDiff);
    syncDiff();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const token = select.value;
      const value = input.value.trim();
      const current = tokens.find((entry) => entry.token === token);
      if (!current || !value || value === current.value) {
        syncDiff();
        return;
      }
      setStatus(`${token}: committing ${current.value} -> ${value}`, 'saving');
      try {
        const nextTokens = await saveDieterToken(kind, token, value);
        const next = nextTokens.find((entry) => entry.token === token);
        if (next) updateVisibleTokenValue(token, next.value);
        setStatus(`${token}: committed. CI will rebuild Dieter artifacts.`, 'saved');
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error), 'error');
      }
    });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
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
  const page = scope.querySelector<HTMLElement>('.typography-page');
  page?.setAttribute('data-governance-count', String(typographyRoleCount));

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

      const editButton = doc.createElement('button');
      editButton.className = 'token-edit-trigger';
      editButton.type = 'button';
      editButton.setAttribute('data-token-edit', 'typography');
      editButton.setAttribute('aria-label', `Edit typography tokens for ${sample.name}`);
      editButton.appendChild(sampleElement);

      previewWrapper.appendChild(editButton);
      specWrapper.appendChild(previewWrapper);

      row.appendChild(specWrapper);
      container.appendChild(row);
    });
  });
}

function renderFromHash() {
  const pagePath = parseShowcasePath(window.location.hash);
  if (!pagePath) {
    const first = navGroups[0]?.items[0];
    if (first) navigateTo(first.path);
    return;
  }

  const page = showcaseIndex.get(pagePath);
  if (!page) {
    main.replaceChildren(renderNotFound(pagePath));
    return;
  }

  const pageStyles = page.css ? [...page.css] : [];
  if (page.slug === 'icons') {
    pageStyles.push(dietIconCss);
  }

  const content = renderHtmlPage(page.htmlPath, pageStyles);

  const wrapped = wrapWithPageChrome(content, page.title);
  setActive(page.path);
  document.title = `DevStudio · ${page.title}`;
  main.replaceChildren(wrapped);
  hydrateDieterComponents(main);
  hydrateTypographyPage(main);
  main.querySelectorAll<HTMLElement>('[data-token-edit]').forEach((node) => {
    node.addEventListener('click', () => {
      const editKind = node.getAttribute('data-token-edit');
      if (editKind !== 'color' && editKind !== 'typography') return;
      openTokenEditor(editKind === 'color' ? 'colors' : 'typography', node.getAttribute('data-token') ?? undefined);
    });
  });
}

window.addEventListener('hashchange', renderFromHash);
renderFromHash();
