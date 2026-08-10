import '@dieter/tokens/tokens.css';
import '@dieter/layouts/main-container/main-container.css';
import '@dieter/components/icon/icon.css';
import '@dieter/components/button/button.css';
import '@dieter/components/popup/popup.css';
import '@dieter/components/shared/property-row.css';
import '@dieter/components/popover/popover.css';
import '@dieter/components/dropdown-actions/dropdown-actions.css';
import '@dieter/components/menuactions/menuactions.css';
import '@dieter/components/table/table.css';
import '@dieter/components/textfield/textfield.css';
import '@dieter/components/tooltip/tooltip.css';
import '@dieter/components/valuefield/valuefield.css';
import '@dieter/components/toggle/toggle.css';
import './css/layout.css';
import './css/dieter-previews.css';
import './css/utilities.css';
import { navGroups, showcaseIndex, showcaseModules } from './data/routes';
import { getIcon } from './data/icons';
import {
  destroyDropdownActions,
  hydrateBulkEdit,
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
  hydrateTextedit,
  hydrateTextfield,
  hydrateValuefield,
} from '@dieter/components';
import { hydrateObjectManager } from '@dieter/components/object-manager/object-manager';
import { createDialogLifecycle } from '@dieter/components/shared/dialog-lifecycle';
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
  listAiModelCapabilities,
  listAiModelCatalog,
  listAiProviderUi,
  type AiProvider,
} from '@clickeen/ck-contracts/ai';
import {
  AI_MODEL_MANAGEMENT_CONFIG,
  validateAiModelManagementConfig,
} from '@clickeen/ck-contracts/ai-model-management';
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

window.__CK_LLM_MANAGEMENT__ = {
  source: '@clickeen/ck-contracts/ai-model-management',
  config: AI_MODEL_MANAGEMENT_CONFIG,
  validation: validateAiModelManagementConfig(AI_MODEL_MANAGEMENT_CONFIG),
  capabilities: listAiModelCapabilities(),
};

const appRoot = document.getElementById('app');
if (!appRoot) {
  throw new Error('DevStudio root node not found');
}

const shell = document.createElement('div');
shell.className = 'main-container body-s';

const sidebar = document.createElement('aside');
sidebar.className = 'left-nav';
sidebar.id = 'devstudio-navigation';

const main = document.createElement('main');
main.className = 'page';

const menuButton = document.createElement('button');
menuButton.className = 'devstudio-navigation-trigger diet-button';
menuButton.type = 'button';
menuButton.dataset.navigationTrigger = '';
menuButton.dataset.size = 'medium';
menuButton.dataset.type = 'quaternary';
menuButton.setAttribute('aria-label', 'Open navigation');
menuButton.setAttribute('aria-controls', sidebar.id);
menuButton.setAttribute('aria-expanded', 'false');
menuButton.innerHTML =
  '<span class="diet-icon" data-size="16" aria-hidden="true" data-icon="line.3.horizontal.decrease.circle"></span>';

const compactBar = document.createElement('header');
compactBar.className = 'devstudio-compact-bar';
compactBar.append(menuButton);

const scrim = document.createElement('button');
scrim.type = 'button';
scrim.dataset.navigationScrim = '';
scrim.tabIndex = -1;
scrim.setAttribute('aria-label', 'Close navigation');

shell.append(sidebar, main);
main.append(compactBar, scrim);
appRoot.append(shell);

const navHeader = document.createElement('header');
navHeader.className = 'devstudio-nav__brand';
navHeader.innerHTML = '<h2 class="heading-2 devstudio-nav__title">DevStudio</h2>';

const nav = document.createElement('nav');
nav.className = 'devstudio-nav__content';
const navLayout = document.createElement('div');
navLayout.className = 'devstudio-nav';
navLayout.append(navHeader, nav);
sidebar.append(navLayout);

const links = new Map<string, HTMLAnchorElement>();
const fullWorkspace = window.matchMedia('(min-width: 600px) and (min-height: 600px)');

function closeCompactNavigation(returnFocus: boolean) {
  const wasOpen = shell.dataset.navigationOpen === 'true';
  delete shell.dataset.navigationOpen;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation');
  if (!fullWorkspace.matches) sidebar.inert = true;
  if (wasOpen && returnFocus) menuButton.focus({ preventScroll: true });
}

function openCompactNavigation() {
  if (fullWorkspace.matches) return;
  shell.dataset.navigationOpen = 'true';
  menuButton.setAttribute('aria-expanded', 'true');
  menuButton.setAttribute('aria-label', 'Close navigation');
  sidebar.inert = false;
  requestAnimationFrame(() => {
    sidebar.querySelector<HTMLAnchorElement>('.nav-link')?.focus({ preventScroll: true });
  });
}

function syncNavigationMode() {
  if (fullWorkspace.matches) {
    delete shell.dataset.navigationOpen;
    sidebar.inert = false;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    return;
  }
  sidebar.inert = shell.dataset.navigationOpen !== 'true';
}

menuButton.addEventListener('click', () => {
  if (shell.dataset.navigationOpen === 'true') closeCompactNavigation(true);
  else openCompactNavigation();
});
scrim.addEventListener('click', () => closeCompactNavigation(true));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && shell.dataset.navigationOpen === 'true') {
    event.preventDefault();
    closeCompactNavigation(true);
  }
});
fullWorkspace.addEventListener('change', syncNavigationMode);
syncNavigationMode();

navGroups.forEach((group) => {
  if (!group.items.length) return;

  const wrapper = document.createElement('section');
  wrapper.className = 'nav-group';

  if (group.title) {
    const title = document.createElement('p');
    title.className = 'nav-group__title overline-small';
    title.textContent = group.title;
    wrapper.append(title);
  }

  const list = document.createElement('ul');
  list.className = 'nav-group__list';

  group.items.forEach((item) => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'nav-link body-s';
    link.href = item.path;
    link.textContent = item.title;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      closeCompactNavigation(false);
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
    const name = node.getAttribute('data-icon') ?? '';
    node.innerHTML = getIcon(name);
    node.removeAttribute('data-icon');
  });
}

function hydrateDieterComponents(scope: Element | DocumentFragment): void {
  hydrateBulkEdit(scope, { accountAssets: showcaseAccountAssets });
  hydrateChoiceTiles(scope);
  hydrateObjectManager(scope);
  hydrateTextfield(scope);
  hydrateValuefield(scope);
  hydrateTextedit(scope);
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

type DieterTokenKind = 'colors' | 'foundation' | 'typography';
type DieterToken = {
  token: string;
  value: string;
  editable: boolean;
};

const tokenCache = new Map<DieterTokenKind, DieterToken[]>();
let tokenEditor: HTMLDialogElement | null = null;
let tokenEditorLifecycle: ReturnType<typeof createDialogLifecycle> | null = null;

const DIETER_TOKEN_LOAD_ERROR_COPY = 'Dieter tokens could not be loaded. Please try again.';
const DIETER_TOKEN_SAVE_ERROR_COPY = 'Dieter token could not be saved. Please try again.';
const DIETER_TYPOGRAPHY_TOKEN_INVALID_COPY = 'Invalid typography value. Nothing was changed.';

async function fetchDieterTokens(kind: DieterTokenKind): Promise<DieterToken[]> {
  const cached = tokenCache.get(kind);
  if (cached) return cached;
  const res = await fetch(`/api/dieter/tokens/${kind}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok || !Array.isArray(payload.tokens)) {
    throw new Error(DIETER_TOKEN_LOAD_ERROR_COPY);
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
    if (
      kind === 'typography' &&
      res.status === 422 &&
      payload?.error?.reasonKey === 'devstudio.errors.dieterTokens.typographyInvalid'
    ) {
      throw new Error(DIETER_TYPOGRAPHY_TOKEN_INVALID_COPY);
    }
    throw new Error(DIETER_TOKEN_SAVE_ERROR_COPY);
  }
  tokenCache.set(kind, payload.tokens);
  return payload.tokens;
}

function closeTokenEditor() {
  tokenEditorLifecycle?.destroy();
  const dropdown = tokenEditor?.querySelector<HTMLElement>('.diet-dropdown-actions');
  if (dropdown) destroyDropdownActions(dropdown);
  tokenEditor?.remove();
  tokenEditor = null;
  tokenEditorLifecycle = null;
}

function updateVisibleTokenValue(token: string, value: string) {
  document.querySelectorAll<HTMLElement>(`[data-token-value="${CSS.escape(token)}"]`).forEach((node) => {
    node.textContent = value;
  });
  document.querySelectorAll<HTMLElement>(`[data-token="${CSS.escape(token)}"]`).forEach((node) => {
    node.setAttribute('data-value', value);
  });
}

async function openTokenEditor(
  kind: DieterTokenKind,
  preferredToken?: string,
  visibleTokens?: ReadonlySet<string>,
) {
  closeTokenEditor();

  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const dialog = document.createElement('dialog');
  dialog.className = 'diet-popup devstudio-token-editor';
  dialog.dataset.size = 'small';
  dialog.setAttribute('closedby', 'closerequest');
  dialog.setAttribute('aria-labelledby', 'devstudio-token-editor-title');
  dialog.innerHTML = `
    <form class="devstudio-token-editor__panel" data-state="loading">
      <div class="devstudio-token-editor__view" data-token-editor-work>
        <header class="diet-popup__header">
          <div class="devstudio-token-editor__heading">
            <h2 class="heading-4" id="devstudio-token-editor-title">Edit token</h2>
            <p class="body-xs">Update the source-controlled Dieter value.</p>
          </div>
          <button class="diet-button" data-size="small" data-type="quaternary" type="button" data-token-editor-close aria-label="Close">
            <span class="diet-icon" aria-hidden="true" data-icon="multiply" data-size="12"></span>
          </button>
        </header>
        <div class="diet-popup__body devstudio-token-editor__body">
          <div class="diet-dropdown-actions diet-popover-host" data-size="sm" data-state="closed">
            <input class="diet-dropdown-actions__value-field" name="token" type="hidden" value="" data-placeholder="Loading token source…" />
            <button class="diet-dropdown-header diet-dropdown-actions__control" type="button" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="devstudio-token-editor-token-label" disabled>
              <span class="diet-dropdown-header-label label-xs" id="devstudio-token-editor-token-label">Token</span>
              <span class="diet-dropdown-header-value body-xs" data-muted="true">Loading token source…</span>
            </button>
            <div class="diet-popover diet-dropdown-actions__popover" role="listbox" aria-label="Editable Dieter tokens" data-state="closed">
              <div class="diet-popover__header">
                <span class="diet-popover__header-label label-xs">Token</span>
              </div>
              <div class="diet-popover__body diet-dropdown-actions__menu"></div>
            </div>
          </div>
          <div class="diet-textfield" data-size="sm">
            <label class="diet-textfield__control">
              <span class="diet-textfield__display-label label-xs">Value</span>
              <input class="diet-textfield__field body-xs" name="value" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Value" aria-describedby="devstudio-token-editor-status" disabled />
            </label>
          </div>
          <div class="devstudio-token-editor__diff body-xs" id="devstudio-token-editor-status" aria-live="polite">Loading token source…</div>
        </div>
        <footer class="diet-popup__footer">
          <div class="diet-popup__actions">
            <button class="diet-button" data-size="medium" data-type="secondary" type="button" data-token-editor-close>
              <span class="diet-button__label">Cancel</span>
            </button>
            <button class="diet-button" data-size="medium" data-type="primary" type="submit" data-token-editor-commit disabled>
              <span class="diet-button__label">Confirm commit</span>
            </button>
          </div>
        </footer>
      </div>
      <div class="devstudio-token-editor__view" data-token-editor-discard-view hidden>
        <header class="diet-popup__header">
          <h2 class="heading-4" id="devstudio-token-editor-discard-title">Discard changes?</h2>
        </header>
        <div class="diet-popup__body devstudio-token-editor__body">
          <p class="body-s">Your uncommitted token value will be lost.</p>
        </div>
        <footer class="diet-popup__footer">
          <div class="diet-popup__actions">
            <button class="diet-button" data-size="medium" data-type="secondary" type="button" data-token-editor-keep>
              <span class="diet-button__label">Keep editing</span>
            </button>
            <button class="diet-button" data-size="medium" data-type="primary" type="button" data-token-editor-discard>
              <span class="diet-button__label">Discard</span>
            </button>
          </div>
        </footer>
      </div>
    </form>
  `;
  document.body.append(dialog);
  tokenEditor = dialog;
  hydrateIcons(dialog);
  hydrateTextfield(dialog);

  const form = dialog.querySelector<HTMLFormElement>('form');
  const editorView = dialog.querySelector<HTMLElement>('[data-token-editor-work]');
  const discardView = dialog.querySelector<HTMLElement>('[data-token-editor-discard-view]');
  const tokenInput = dialog.querySelector<HTMLInputElement>('input[name="token"]');
  const tokenTrigger = dialog.querySelector<HTMLButtonElement>('.diet-dropdown-actions__control');
  const tokenMenu = dialog.querySelector<HTMLElement>('.diet-dropdown-actions__menu');
  const input = dialog.querySelector<HTMLInputElement>('input[name="value"]');
  const diff = dialog.querySelector<HTMLElement>('.devstudio-token-editor__diff');
  const commitButton = dialog.querySelector<HTMLButtonElement>('[data-token-editor-commit]');
  const keepEditingButton = dialog.querySelector<HTMLButtonElement>('[data-token-editor-keep]');
  const discardButton = dialog.querySelector<HTMLButtonElement>('[data-token-editor-discard]');
  const closeButtons = Array.from(
    dialog.querySelectorAll<HTMLButtonElement>('[data-token-editor-close]'),
  );
  if (!form || !editorView || !discardView || !tokenInput || !tokenTrigger || !tokenMenu || !input || !diff || !commitButton || !keepEditingButton || !discardButton) {
    closeTokenEditor();
    return;
  }

  const setStatus = (message: string, state = 'ready') => {
    form.dataset.state = state;
    diff.textContent = message;
  };

  let tokens: DieterToken[] = [];
  let saving = false;
  let editorFocus: HTMLElement | null = null;
  const isDirty = () => {
    const current = tokens.find((entry) => entry.token === tokenInput.value);
    return Boolean(current && input.value !== current.value);
  };
  const setSaving = (next: boolean) => {
    saving = next;
    tokenTrigger.disabled = next;
    tokenMenu.querySelectorAll<HTMLButtonElement>('.diet-dropdown-actions__menuaction').forEach((button) => {
      button.disabled = next;
    });
    input.disabled = next;
    closeButtons.forEach((button) => {
      button.disabled = next;
    });
    keepEditingButton.disabled = next;
    discardButton.disabled = next;
    commitButton.disabled = next || !isDirty();
  };
  const showEditor = (restoreFocus = false) => {
    discardView.hidden = true;
    editorView.hidden = false;
    dialog.setAttribute('aria-labelledby', 'devstudio-token-editor-title');
    if (restoreFocus) (editorFocus?.isConnected ? editorFocus : input).focus({ preventScroll: true });
  };
  const showDiscardConfirmation = () => {
    if (saving) return;
    editorFocus =
      document.activeElement instanceof HTMLElement && editorView.contains(document.activeElement)
        ? document.activeElement
        : input;
    editorView.hidden = true;
    discardView.hidden = false;
    dialog.setAttribute('aria-labelledby', 'devstudio-token-editor-discard-title');
    keepEditingButton.focus({ preventScroll: true });
  };
  const requestClose = () => {
    if (saving) return;
    if (isDirty()) {
      showDiscardConfirmation();
      return;
    }
    closeTokenEditor();
  };
  const lifecycle = createDialogLifecycle({
    dialog,
    initialFocus: tokenTrigger,
    requestDismiss(reason) {
      if (reason === 'backdrop') return;
      if (!discardView.hidden) {
        showEditor(true);
        return;
      }
      requestClose();
    },
  });
  tokenEditorLifecycle = lifecycle;
  lifecycle.open(opener);

  dialog.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('[data-token-editor-close]')) {
      event.preventDefault();
      requestClose();
    }
  });
  keepEditingButton.addEventListener('click', () => showEditor(true));
  discardButton.addEventListener('click', closeTokenEditor);

  try {
    const loadedTokens = await fetchDieterTokens(kind);
    if (tokenEditor !== dialog || !dialog.isConnected) return;
    tokens = loadedTokens.filter(
      (token) => token.editable && (!visibleTokens || visibleTokens.has(token.token)),
    );
    tokenMenu.replaceChildren(
      ...tokens.map((entry) => {
        const action = document.createElement('button');
        action.className = 'diet-btn-menuactions diet-dropdown-actions__menuaction';
        action.type = 'button';
        action.dataset.size = 'sm';
        action.dataset.variant = 'neutral';
        action.dataset.value = entry.token;
        action.dataset.label = entry.token;
        action.setAttribute('role', 'option');

        const actionLabel = document.createElement('span');
        actionLabel.className = 'diet-btn-menuactions__label body-xs';
        const actionText = document.createElement('span');
        actionText.className = 'diet-dropdown-actions__menuaction-text';
        actionText.textContent = entry.token;
        actionLabel.append(actionText);

        const actionIcon = document.createElement('span');
        actionIcon.className = 'diet-btn-menuactions__icon';
        actionIcon.setAttribute('aria-hidden', 'true');
        const check = document.createElement('span');
        check.className = 'diet-dropdown-actions__check';
        check.setAttribute('aria-hidden', 'true');
        const checkIcon = document.createElement('span');
        checkIcon.className = 'diet-icon';
        checkIcon.dataset.size = '12';
        checkIcon.dataset.icon = 'checkmark';
        check.append(checkIcon);
        actionIcon.append(check);
        action.append(actionLabel, actionIcon);
        return action;
      }),
    );
    const selected = tokens.find((entry) => entry.token === preferredToken) ?? tokens[0];
    if (!selected) {
      setStatus('No editable tokens found.', 'error');
      return;
    }
    tokenInput.value = selected.token;
    input.value = selected.value;
    hydrateIcons(dialog);
    hydrateDropdownActions(dialog);
    tokenTrigger.disabled = false;
    input.disabled = false;

    const syncDiff = () => {
      const current = tokens.find((entry) => entry.token === tokenInput.value);
      if (!current) return;
      if (input.value === current.value) {
        setStatus('No changes to commit.');
      } else {
        setStatus(`${current.value} → ${input.value}`);
      }
      commitButton.disabled = saving || !isDirty();
    };

    tokenInput.addEventListener('input', () => {
      const current = tokens.find((entry) => entry.token === tokenInput.value);
      input.value = current?.value ?? '';
      syncDiff();
    });
    input.addEventListener('input', syncDiff);
    syncDiff();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (saving) return;
      const token = tokenInput.value;
      const value = input.value;
      const current = tokens.find((entry) => entry.token === token);
      if (!current || !value || value === current.value) {
        syncDiff();
        return;
      }
      setSaving(true);
      setStatus(`Committing ${current.value} → ${value}…`, 'saving');
      try {
        const nextTokens = await saveDieterToken(kind, token, value);
        const next = nextTokens.find((entry) => entry.token === token);
        if (!next) throw new Error(DIETER_TOKEN_SAVE_ERROR_COPY);
        tokens = nextTokens.filter(
          (entry) => entry.editable && (!visibleTokens || visibleTokens.has(entry.token)),
        );
        input.value = next.value;
        updateVisibleTokenValue(token, next.value);
        setSaving(false);
        setStatus('Committed. CI will rebuild Dieter artifacts.', 'saved');
      } catch (error) {
        setSaving(false);
        setStatus(
          error instanceof Error ? error.message : DIETER_TOKEN_SAVE_ERROR_COPY,
          'error',
        );
      }
    });
  } catch {
    if (tokenEditor !== dialog || !dialog.isConnected) return;
    setStatus(DIETER_TOKEN_LOAD_ERROR_COPY, 'error');
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
  article.innerHTML = `<h1 class="heading-2">Missing</h1><p class="body-s">Could not load \`${slug}\`.</p>`;
  fragment.append(article);
  return fragment;
}

function wrapWithPageChrome(fragment: DocumentFragment, title: string): DocumentFragment {
  if (fragment.querySelector('.page__content')) {
    return fragment;
  }

  const nodes = Array.from(fragment.childNodes);
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
  header.className = 'page__header';

  if (headingElement) {
    headingElement.parentElement?.removeChild(headingElement);
    header.append(headingElement);
  } else {
    const heading = document.createElement('h1');
    heading.className = 'heading-2';
    heading.textContent = title;
    header.append(heading);
  }
  const declaredActions = nodes.find(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && node.hasAttribute('data-page-actions'),
  );
  const actions = declaredActions ?? document.createElement('div');
  if (declaredActions) {
    declaredActions.classList.add('page__actions');
    declaredActions.hidden = false;
    skipNodes.add(declaredActions);
  } else {
    actions.className = 'page__actions';
    actions.hidden = true;
  }
  header.append(actions);

  const content = document.createElement('div');
  content.className = 'page__content';

  nodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').trim()) {
      return;
    }

  if (skipNodes.has(node)) {
    return;
  }

    if (node instanceof HTMLStyleElement) {
      content.append(node);
      return;
    }

    content.append(node);
  });

  const wrapped = document.createDocumentFragment();
  wrapped.append(header, content);
  return wrapped;
}

function hydrateTypographyPage(scope: ParentNode) {
  const container = scope.querySelector<HTMLElement>('.typography-page__sections');
  if (!container || container.childElementCount) return;
  const page = scope.querySelector<HTMLElement>('.typography-page');
  page?.setAttribute('data-governance-count', String(typographyRoleCount));

  const doc = container.ownerDocument;

  const pageActions = scope.querySelector<HTMLElement>('.page__actions');
  if (pageActions) {
    const editButton = doc.createElement('button');
    editButton.className = 'diet-button';
    editButton.type = 'button';
    editButton.dataset.size = 'medium';
    editButton.dataset.type = 'secondary';
    editButton.setAttribute('data-token-edit', 'typography');
    editButton.innerHTML = '<span class="diet-button__label">Edit typography tokens</span>';
    pageActions.replaceChildren(editButton);
    pageActions.hidden = false;
  }

  typographySections.forEach(({ title, samples }) => {
    const section = doc.createElement('section');
    section.className = 'foundation-section';

    const header = doc.createElement('h2');
    header.className = 'heading-4';
    header.textContent = title;
    section.appendChild(header);

    const frame = doc.createElement('div');
    frame.className = 'diet-table';
    const table = doc.createElement('table');
    table.className = 'diet-table__table';
    table.innerHTML = `
      <thead>
        <tr>
          <th class="label-s" scope="col">Role</th>
          <th class="label-s" scope="col">Source class</th>
          <th class="label-s diet-table__cell--preview" scope="col">Preview</th>
        </tr>
      </thead>
    `;
    const body = doc.createElement('tbody');

    samples.forEach((sample) => {
      const row = doc.createElement('tr');

      const rowHeader = doc.createElement('th');
      rowHeader.className = 'body-s';
      rowHeader.scope = 'row';
      rowHeader.textContent = sample.name;
      row.appendChild(rowHeader);

      const sourceCell = doc.createElement('td');
      sourceCell.className = 'body-s';
      const sourceCode = doc.createElement('code');
      sourceCode.className = 'body-s';
      sourceCode.textContent = `.${sample.className}`;
      sourceCell.appendChild(sourceCode);
      row.appendChild(sourceCell);

      const previewCell = doc.createElement('td');
      previewCell.className = 'body-s diet-table__cell--preview';
      const sampleElement = doc.createElement('div');
      sampleElement.className = sample.className;
      sampleElement.textContent = getTypographySampleText(sample.sample);
      previewCell.appendChild(sampleElement);
      row.appendChild(previewCell);

      body.appendChild(row);
    });

    table.appendChild(body);
    frame.appendChild(table);
    section.appendChild(frame);
    container.appendChild(section);
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
    main.replaceChildren(compactBar, scrim, renderNotFound(pagePath));
    return;
  }

  const pageStyles = page.css ? [...page.css] : [];

  const content = renderHtmlPage(page.htmlPath, pageStyles);

  const wrapped = wrapWithPageChrome(content, page.title);
  setActive(page.path);
  document.title = `DevStudio · ${page.title}`;
  main.replaceChildren(compactBar, scrim, wrapped);
  hydrateDieterComponents(main);
  hydrateTypographyPage(main);
  main.querySelectorAll<HTMLElement>('[data-token-edit]').forEach((node) => {
    node.addEventListener('click', () => {
      const editKind = node.getAttribute('data-token-edit');
      if (editKind !== 'color' && editKind !== 'foundation' && editKind !== 'typography') return;
      const tokensOnPage = new Set(
        Array.from(
          main.querySelectorAll<HTMLElement>(
            `[data-token-edit="${editKind}"][data-token]`,
          ),
        )
          .map((trigger) => trigger.getAttribute('data-token'))
          .filter((token): token is string => Boolean(token)),
      );
      openTokenEditor(
        editKind === 'color' ? 'colors' : editKind,
        node.getAttribute('data-token') ?? undefined,
        tokensOnPage.size ? tokensOnPage : undefined,
      );
    });
  });
}

window.addEventListener('hashchange', renderFromHash);
hydrateIcons(compactBar);
renderFromHash();
