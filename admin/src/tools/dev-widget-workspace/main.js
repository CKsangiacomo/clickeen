import { createWorkspaceApi } from './api.js';
import { createBobHost } from './bob-host.js';
import {
  DEFAULT_INSTANCE_DISPLAY_NAME,
  buildLocalDefaultInstance,
  findInstanceByPublicId as findInstanceByPublicIdFromState,
  formatInstanceLabel,
  formatWidgetLabel,
  getScopedInstances as getScopedInstancesFromState,
  isLocalDefaultPublicId,
  isMainInstancePublicId,
  listWidgetSlugs,
  normalizeWidgetname,
} from './state.js';

export function mountDevWidgetWorkspace() {
    // DevStudio swaps DOM but does not automatically remove global event listeners.
    // Use an AbortController keyed on `window` so re-entering this tool page doesn't
    // accumulate listeners and spam postMessage loops.
    const CK_DEV_INSTANCES_ABORT_KEY = '__CK_DEV_INSTANCES_ABORT__';
    try {
      const prev = window[CK_DEV_INSTANCES_ABORT_KEY];
      if (prev && typeof prev.abort === 'function') prev.abort();
    } catch {}
    const abortController = new AbortController();
    try {
      window[CK_DEV_INSTANCES_ABORT_KEY] = abortController;
    } catch {}

    const PROFILE = (() => {
      const params = new URLSearchParams(window.location.search);
      const raw = (params.get('profile') || 'product').trim().toLowerCase();
      return raw === 'source' ? 'source' : 'product';
    })();
    const IS_SOURCE_PROFILE = PROFILE === 'source';
    const SUPPORT_TARGET_STORAGE_KEY = 'ck.devstudio.supportTargetEnvelope.v1';

    function resolveHashSearchParams() {
      const hash = String(window.location.hash || '');
      const queryIndex = hash.indexOf('?');
      if (queryIndex === -1) return new URLSearchParams();
      return new URLSearchParams(hash.slice(queryIndex + 1));
    }

    function readSupportTargetEnvelopeFromStorage() {
      const raw = window.sessionStorage.getItem(SUPPORT_TARGET_STORAGE_KEY);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        return parsed;
      } catch {
        return null;
      }
    }

    function writeSupportTargetEnvelopeToStorage(nextValue) {
      if (!nextValue || typeof nextValue !== 'object' || Array.isArray(nextValue)) return;
      window.sessionStorage.setItem(SUPPORT_TARGET_STORAGE_KEY, JSON.stringify(nextValue));
    }

    const HASH_PARAMS = resolveHashSearchParams();
    const SUPPORT_MODE = HASH_PARAMS.get('support') === '1';

    function requireBobOrigin() {
      const params = new URLSearchParams(window.location.search);
      const defaultBob = 'http://localhost:3000';
      const raw = (params.get('bob') || defaultBob).trim();
      try {
        return new URL(raw).origin;
      } catch {
        throw new Error(`Invalid ?bob= origin: "${raw}"`);
      }
    }

    const BOB_ORIGIN = requireBobOrigin();

    function resolveTokyoBaseUrl() {
      // Keep in sync with bob/lib/env/tokyo.ts (plain JS variant for DevStudio tools).
      // product profile: cloud-dev Tokyo (default)
      // source profile: local Tokyo (explicit low-level service development)
      const params = new URLSearchParams(window.location.search);
      const profile = PROFILE;
      const raw = (params.get('tokyo') || '').trim();
      if (raw) {
        try {
          return new URL(raw).origin;
        } catch {}
      }
      if (profile === 'source') return 'http://localhost:4000';
      return 'https://tokyo.dev.clickeen.com';
    }

    const TOKYO_BASE = resolveTokyoBaseUrl();
    const SUPPORT_STATUS_VALUE = 'Manual';
    const SUPPORT_STATUS_META = 'Support path does not poll translation status.';
    let currentPublicId = null;
    let selectedWidgetSlug = null;
    let widgetTypes = [];
    let storedInstances = [];
    let instances = [];
    let isOpen = false;
    let bobSessionId = '';
    let supportTarget = SUPPORT_MODE ? readSupportTargetEnvelopeFromStorage() : null;
    const isLocalDevStudio =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const dropdown = document.getElementById('instance-dropdown');
    const widgetSelector = document.getElementById('widget-selector');
    const widgetSelect = document.getElementById('widget-select');
    const control = document.getElementById('instance-dropdown-control');
    const valueField = document.getElementById('instance-dropdown-value');
    const menu = document.getElementById('instance-dropdown-menu');
    const iframe = document.getElementById('bob-iframe');
    const currentLabel = document.getElementById('current-instance-label');
    const platformActions = document.getElementById('platform-actions');
    const platformUpdateTheme = document.getElementById('platform-update-theme');
    const l10nStatus = document.getElementById('l10n-status');
    const l10nStatusValue = document.getElementById('l10n-status-value');
    const l10nStatusMeta = document.getElementById('l10n-status-meta');
    const l10nStatusTooltip = document.getElementById('l10n-status-tooltip');
    const themeModal = document.getElementById('theme-modal');
    const themeModalClose = document.getElementById('theme-modal-close');
    const themeModalCancel = document.getElementById('theme-modal-cancel');
    const themeModalConfirm = document.getElementById('theme-modal-confirm');
    const themeModalSelect = document.getElementById('theme-modal-select');
    let l10nStatusTimer = null;

    const THEME_UPDATE_LAST_ID_STORAGE = 'ck.devstudio.theme.update.lastThemeId';

    let themeModalState = null;

    const bobUrl = new URL(`${BOB_ORIGIN}/bob`);
    bobUrl.searchParams.set('boot', 'message');
    bobUrl.searchParams.set('subject', 'account');
    bobUrl.searchParams.set('assetApiBase', `${window.location.origin}/api/devstudio/assets`);
    bobUrl.searchParams.set(
      'assetUploadEndpoint',
      `${window.location.origin}/api/devstudio/assets/upload`,
    );
    if (!isLocalDevStudio) bobUrl.searchParams.set('readonly', '1');
    iframe.src = bobUrl.toString();

    function buildDevStudioApiUrl(pathname, searchParams = {}) {
      const url = new URL(pathname, window.location.origin);
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value == null || value === '') return;
        url.searchParams.set(key, String(value));
      });
      return url.toString();
    }

    function fetchDevStudio(url, init = {}) {
      return fetch(url, { cache: 'no-store', ...init });
    }
    function findInstanceByPublicId(publicId) {
      return findInstanceByPublicIdFromState(instances, publicId);
    }

    function getScopedInstances() {
      return getScopedInstancesFromState({
        instances,
        selectedWidgetSlug,
        profile: PROFILE,
      });
    }

    function setL10nStatusDisplay({ state, tone, value, meta }) {
      if (!(l10nStatus instanceof HTMLElement)) return;
      l10nStatus.dataset.state = state || 'idle';
      l10nStatus.dataset.tone = tone || 'unavailable';
      const valueLabel = value || '-';
      const metaLabel = meta || '';
      if (l10nStatusValue instanceof HTMLElement) l10nStatusValue.textContent = valueLabel;
      if (l10nStatusMeta instanceof HTMLElement) {
        l10nStatusMeta.textContent = metaLabel;
      }
      const hoverDetails = [valueLabel, metaLabel].filter(Boolean).join(' · ');
      if (l10nStatusTooltip instanceof HTMLElement) {
        l10nStatusTooltip.textContent = hoverDetails || 'No status details available.';
      }
      if (hoverDetails && valueLabel !== '-') {
        l10nStatus.setAttribute('aria-label', `Translations status: ${hoverDetails}`);
      } else {
        l10nStatus.setAttribute('aria-label', 'Translations status');
      }
      l10nStatus.removeAttribute('title');
    }

    const {
      buildSupportInstance,
      runSupportAccountCommand,
      runDevstudioAccountCommand,
      fetchLocalWidgetCatalog,
      fetchInstances,
      fetchInstanceEnvelope,
      refreshL10nStatus,
      resolveDevStudioAccountId,
    } = createWorkspaceApi({
      supportMode: SUPPORT_MODE,
      getSupportTarget: () => supportTarget,
      setSupportTarget: (nextValue) => {
        supportTarget = nextValue;
      },
      writeSupportTargetEnvelopeToStorage,
      bobOrigin: BOB_ORIGIN,
      supportStatusValue: SUPPORT_STATUS_VALUE,
      supportStatusMeta: SUPPORT_STATUS_META,
      buildDevStudioApiUrl,
      fetchDevStudio,
      isLocalDefaultPublicId,
      findInstanceByPublicId,
      setL10nStatusDisplay,
      getL10nStatusTimer: () => l10nStatusTimer,
      setL10nStatusTimer: (nextValue) => {
        l10nStatusTimer = nextValue;
      },
    });

    let isPosting = false;
    window.addEventListener(
      'message',
      (event) => {
        if (event.origin !== BOB_ORIGIN) return;
        if (event.source !== iframe.contentWindow) return;
        const data = event.data;
        if (data && data.type === 'bob:request-instance-switch') {
          const publicId = typeof data.publicId === 'string' ? data.publicId.trim() : '';
          if (!publicId) return;
          if (!findInstanceByPublicId(publicId)) return;
          switchInstance(publicId);
          return;
        }
        if (data && data.type === 'bob:account-command') {
          const requestId = typeof data.requestId === 'string' ? data.requestId.trim() : '';
          const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
          const command = typeof data.command === 'string' ? data.command.trim() : '';
          const accountId = typeof data.accountId === 'string' ? data.accountId.trim() : '';
          const publicId = typeof data.publicId === 'string' ? data.publicId.trim() : '';
          const locale = typeof data.locale === 'string' ? data.locale.trim() : '';
          if (!requestId || !sessionId || sessionId !== bobSessionId || !command || !accountId || !publicId) {
            return;
          }
          if (SUPPORT_MODE) {
            void runSupportAccountCommand({
              source: event.source,
              requestId,
              sessionId,
              command,
              accountId,
              publicId,
              body: data.body,
            });
            return;
          }
          void runDevstudioAccountCommand({
            source: event.source,
            requestId,
            sessionId,
            command,
            accountId,
            publicId,
            locale,
            body: data.body,
          });
          return;
        }
        if (data && data.type === 'bob:session-ready') {
          const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
          if (!sessionId) {
            console.error('[DevStudio] bob:session-ready missing sessionId');
            return;
          }
          if (data.bootMode && data.bootMode !== 'message') {
            console.error('[DevStudio] Bob bootMode mismatch', data.bootMode);
            return;
          }
          bobSessionId = sessionId;
          if (!currentPublicId) return;
          console.log('[DevStudio] Received bob:session-ready, posting instance', currentPublicId);
          if (isPosting) return;
          isPosting = true;
          Promise.resolve(sendInstanceToIframe(currentPublicId))
            .catch((error) => console.error('[DevStudio] Failed to send instance to Bob', error))
            .finally(() => {
              isPosting = false;
            });
        }
        if (data && data.type === 'bob:published') {
          const publicId = typeof data.publicId === 'string' ? data.publicId : '';
          const widgetType = typeof data.widgetType === 'string' ? data.widgetType : '';
          const config = data.config && typeof data.config === 'object' ? data.config : null;
          if (!publicId || !widgetType || !config) return;
          refreshL10nStatus(publicId).catch(() => {});
        }
      },
      { signal: abortController.signal },
    );

    function attachDropdown() {
      const header = document.querySelector('.devstudio-page__header');
      if (!header || !dropdown || !widgetSelector) {
        requestAnimationFrame(attachDropdown);
        return;
      }
      header.classList.add('devstudio-instances-header');
      header.appendChild(widgetSelector);
      dropdown.style.display = 'inline-block';
      header.appendChild(dropdown);
    }
    attachDropdown();

    const { ensureCompiledWidget, exportInstanceDataFromBob, invalidateCompiledWidget, sendInstanceToIframe } = createBobHost({
      windowRef: window,
      performanceRef: performance,
      cryptoRef: crypto,
      bobOrigin: BOB_ORIGIN,
      supportMode: SUPPORT_MODE,
      tokyoBase: TOKYO_BASE,
      defaultInstanceDisplayName: DEFAULT_INSTANCE_DISPLAY_NAME,
      iframe,
      getBobSessionId: () => bobSessionId,
      resolveDevStudioAccountId,
      findInstanceByPublicId,
      normalizeWidgetname,
      isLocalDefaultPublicId,
      fetchInstanceEnvelope,
      getSupportTarget: () => supportTarget,
    });

    function syncWidgetSelector() {
      if (!(widgetSelect instanceof HTMLSelectElement)) return;
      const widgetSlugs = listWidgetSlugs(widgetTypes, instances);
      widgetSelect.replaceChildren();
      widgetSlugs.forEach((widgetSlug) => {
        const option = document.createElement('option');
        option.value = widgetSlug;
        option.textContent = formatWidgetLabel(widgetSlug);
        widgetSelect.appendChild(option);
      });
      if (!widgetSlugs.length) {
        selectedWidgetSlug = null;
        if (widgetSelector instanceof HTMLElement) widgetSelector.style.display = 'none';
        return;
      }
      if (!selectedWidgetSlug || !widgetSlugs.includes(selectedWidgetSlug)) {
        selectedWidgetSlug = widgetSlugs[0];
      }
      widgetSelect.value = selectedWidgetSlug;
      if (widgetSelector instanceof HTMLElement) {
        widgetSelector.style.display = widgetSlugs.length > 1 ? 'block' : 'none';
      }
    }

    function syncSelectedWidgetForPublicId(publicId) {
      const selected = findInstanceByPublicId(publicId);
      const widgetSlug = selected?.widgetSlug || normalizeWidgetname(selected?.widgetname);
      if (!widgetSlug) return;
      if (widgetSlug === selectedWidgetSlug) return;
      selectedWidgetSlug = widgetSlug;
      syncWidgetSelector();
    }

    function rebuildInstances() {
      instances = storedInstances.slice();
    }

    function rebuildWidgetTypesFromInstances(localWidgetTypes) {
      const instanceWidgetTypes = storedInstances
        .map((instance) => normalizeWidgetname(instance.widgetSlug || instance.widgetname))
        .filter((widgetSlug) => typeof widgetSlug === 'string' && widgetSlug);
      widgetTypes = Array.from(new Set([...(localWidgetTypes || []), ...instanceWidgetTypes])).sort(
        (a, b) => a.localeCompare(b),
      );
    }

    async function loadInstances() {
      if (SUPPORT_MODE) {
        const supportInstance = buildSupportInstance(supportTarget);
        if (!supportInstance) {
          selectedWidgetSlug = null;
          currentPublicId = null;
          currentLabel.textContent = 'Support target unavailable';
          valueField.value = '';
          menu.innerHTML =
            '<div class="devstudio-instances__empty-option body-s">Open a customer target from Customer Recovery first.</div>';
          dropdown.style.display = 'none';
          if (widgetSelector instanceof HTMLElement) widgetSelector.style.display = 'none';
          setL10nStatusDisplay({
            state: 'ready',
            tone: 'unavailable',
            value: 'Unavailable',
            meta: 'Support target missing',
          });
          return;
        }

        storedInstances = [supportInstance];
        instances = storedInstances.slice();
        widgetTypes = [supportInstance.widgetSlug];
        selectedWidgetSlug = supportInstance.widgetSlug;
        currentPublicId = supportInstance.publicId;
        dropdown.style.display = 'inline-block';
        syncWidgetSelector();
        updateCurrentLabel();
        renderInstances();
        await refreshL10nStatus(currentPublicId);
        if (bobSessionId && currentPublicId) {
          await sendInstanceToIframe(currentPublicId);
        }
        return;
      }

      const localWidgetTypes = await fetchLocalWidgetCatalog();
      storedInstances = await fetchInstances();
      rebuildInstances();
      rebuildWidgetTypesFromInstances(localWidgetTypes);

      if (widgetTypes.length === 0) {
        selectedWidgetSlug = null;
        currentPublicId = null;
        currentLabel.textContent = 'No widgets found';
        valueField.value = '';
        menu.innerHTML = '';
        dropdown.style.display = 'none';
        if (widgetSelector instanceof HTMLElement) widgetSelector.style.display = 'none';
        return;
      }
      dropdown.style.display = 'inline-block';

      if (!selectedWidgetSlug || !widgetTypes.includes(selectedWidgetSlug)) {
        selectedWidgetSlug = widgetTypes[0];
      }
      syncWidgetSelector();

      const scopedInstances = getScopedInstances();
      if (!scopedInstances.some((inst) => inst.publicId === currentPublicId)) {
        currentPublicId = scopedInstances[0]?.publicId || instances[0]?.publicId || null;
      }
      syncSelectedWidgetForPublicId(currentPublicId);

      console.log('[DevStudio] Current publicId', currentPublicId, 'instances', instances.length);
      updateCurrentLabel();
      renderInstances();
      if (bobSessionId && currentPublicId) {
        sendInstanceToIframe(currentPublicId).catch((error) => {
          console.error('[DevStudio] Failed to load initial instance into Bob', error);
          currentLabel.textContent = 'Error loading instances';
        });
      }
      refreshL10nStatus(currentPublicId).catch(() => {});
    }

    function updateCurrentLabel() {
      if (!currentPublicId) {
        currentLabel.textContent = 'No instances yet';
        valueField.value = '';
        return;
      }
      const current = findInstanceByPublicId(currentPublicId);
      currentLabel.textContent = formatInstanceLabel(current);
      valueField.value = currentPublicId;
    }

    function renderInstances() {
      const scopedInstances = getScopedInstances();
      if (!scopedInstances.length) {
        menu.innerHTML = '<div class="devstudio-instances__empty-option body-s">No instances</div>';
        return;
      }

      menu.innerHTML = scopedInstances
        .map((inst) => {
          const selected = inst.publicId === currentPublicId;
          return `
        <button
          type="button"
          class="diet-btn-menuactions diet-dropdown__option${selected ? ' is-selected' : ''}"
          role="option"
          data-public-id="${inst.publicId}"
          aria-selected="${selected ? 'true' : 'false'}"
        >
          <span class="diet-btn-menuactions__label">${inst.label}</span>
          <span class="diet-btn-menuactions__icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M4 8l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </button>
      `;
        })
        .join('');

      menu.querySelectorAll('[data-public-id]').forEach((button) => {
        button.addEventListener('click', () => {
          const publicId = button.getAttribute('data-public-id');
          if (!publicId) return;
          switchInstance(publicId);
        });
      });
    }

    function switchInstance(publicId) {
      syncSelectedWidgetForPublicId(publicId);
      currentPublicId = publicId;
      isOpen = false;
      dropdown.setAttribute('data-state', 'closed');
      control.setAttribute('aria-expanded', 'false');
      updateCurrentLabel();
      renderInstances();
      if (bobSessionId) {
        sendInstanceToIframe(publicId).catch((error) => {
          console.error('[DevStudio] Failed to send instance to Bob', error);
          currentLabel.textContent = 'Error loading instances';
        });
      }
      refreshL10nStatus(publicId).catch(() => {});
    }

    function cloneJson(value) {
      // v1: config is JSON-only.
      return JSON.parse(JSON.stringify(value ?? null));
    }

    function stripTokyoBaseFromConfig(config, tokyoBase) {
      if (!config || typeof config !== 'object') return config;
      const base = String(tokyoBase || '')
        .trim()
        .replace(/\/+$/, '');
      if (!base) return config;
      const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const baseRegex = new RegExp(escaped, 'g');

      const visit = (node) => {
        if (typeof node === 'string') {
          if (!node.includes(base)) return;
          return node.replace(baseRegex, '');
        }
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          for (let i = 0; i < node.length; i += 1) {
            const replaced = visit(node[i]);
            if (typeof replaced === 'string') node[i] = replaced;
          }
          return;
        }
        for (const [key, value] of Object.entries(node)) {
          const replaced = visit(value);
          if (typeof replaced === 'string') node[key] = replaced;
        }
      };

      visit(config);
      return config;
    }

    function readConfigValueAtPath(config, path) {
      if (!config || typeof config !== 'object' || Array.isArray(config)) return undefined;
      const segments = String(path || '')
        .split('.')
        .filter(Boolean);
      if (!segments.length) return undefined;
      let current = config;
      for (const segment of segments) {
        if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
        if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
        current = current[segment];
      }
      return current;
    }

    function buildThemeValuesFromConfig(config, compiled) {
      const values = {};
      const controls = Array.isArray(compiled?.controls) ? compiled.controls : [];
      const allowedPrefixes = ['stage.', 'pod.', 'appearance.', 'typography.'];
      const tokenPathPattern = /(^|\.)__[^.]+__(\.|$)/;

      controls.forEach((control) => {
        if (!control || typeof control !== 'object') return;
        const path = typeof control.path === 'string' ? control.path.trim() : '';
        if (!path) return;
        if (path === 'appearance.theme') return;
        if (!allowedPrefixes.some((prefix) => path.startsWith(prefix))) return;
        if (tokenPathPattern.test(path)) return;
        if (Object.prototype.hasOwnProperty.call(values, path)) return;
        const value = readConfigValueAtPath(config, path);
        if (value === undefined) return;
        values[path] = cloneJson(value);
      });

      return values;
    }

    function normalizeColorFillValue(raw) {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return cloneJson(raw);
      }
      if (typeof raw !== 'string') return raw;
      const color = raw.trim();
      if (!color) return raw;
      if (color.startsWith('{')) {
        try {
          const parsed = JSON.parse(color);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return cloneJson(parsed);
          }
        } catch {}
      }
      return { type: 'color', color };
    }

    function normalizeThemeValuesForCompiledControls(values, compiled) {
      const normalized = cloneJson(values);
      const controls = Array.isArray(compiled?.controls) ? compiled.controls : [];
      controls.forEach((control) => {
        if (!control || typeof control !== 'object') return;
        if (control.type !== 'dropdown-fill') return;
        const path = typeof control.path === 'string' ? control.path : '';
        if (!path || !Object.prototype.hasOwnProperty.call(normalized, path)) return;
        normalized[path] = normalizeColorFillValue(normalized[path]);
      });
      return normalized;
    }

    async function listTokyoThemes() {
      const res = await fetch(`/api/themes/list?_t=${Date.now()}`, { cache: 'no-store' });
      const text = await res.text().catch(() => '');
      if (!res.ok) {
        throw new Error(
          `[DevStudio] List themes failed (HTTP ${res.status})${text ? `: ${text}` : ''}`,
        );
      }
      const json = text ? JSON.parse(text) : null;
      const themes = Array.isArray(json?.themes) ? json.themes : [];
      return themes
        .map((theme) => ({
          id: String(theme?.id || '')
            .trim()
            .toLowerCase(),
          label: String(theme?.label || '').trim(),
        }))
        .filter((theme) => Boolean(theme.id) && theme.id !== 'custom');
    }

    function openThemeModal({ themes, defaultThemeId }) {
      if (!themeModal || !(themeModalSelect instanceof HTMLSelectElement)) {
        return Promise.resolve(null);
      }

      const normalizedThemes = Array.isArray(themes) ? themes : [];
      if (!normalizedThemes.length) return Promise.resolve(null);

      themeModalSelect.replaceChildren();
      const hasDefaultTheme =
        Boolean(defaultThemeId) && normalizedThemes.some((theme) => theme.id === defaultThemeId);
      if (!hasDefaultTheme) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select theme to overwrite...';
        placeholder.disabled = true;
        placeholder.selected = true;
        placeholder.hidden = true;
        themeModalSelect.appendChild(placeholder);
      }
      normalizedThemes.forEach((theme) => {
        const opt = document.createElement('option');
        opt.value = theme.id;
        opt.textContent = theme.label ? `${theme.label} (${theme.id})` : theme.id;
        themeModalSelect.appendChild(opt);
      });

      const initial = hasDefaultTheme ? defaultThemeId : '';
      themeModalSelect.value = initial;

      themeModal.hidden = false;
      themeModalSelect.focus();

      return new Promise((resolve) => {
        themeModalState = { resolve };
      });
    }

    function closeThemeModal(result) {
      if (themeModal) themeModal.hidden = true;
      if (themeModalState && typeof themeModalState.resolve === 'function') {
        themeModalState.resolve(result ?? null);
      }
      themeModalState = null;
    }

    async function updateTokyoTheme({ themeId, values }) {
      const res = await fetch(`/api/themes/update?_t=${Date.now()}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ themeId, values }),
      });
      const text = await res.text().catch(() => '');
      if (!res.ok) {
        throw new Error(
          `[DevStudio] Update theme failed (HTTP ${res.status})${text ? `: ${text}` : ''}`,
        );
      }
      return text ? JSON.parse(text) : null;
    }

    async function updateThemeFromEditor() {
      if (!IS_SOURCE_PROFILE) {
        throw new Error(
          '[DevStudio] Update Theme is source-profile only. Re-open DevStudio with ?profile=source.',
        );
      }
      if (!currentPublicId) {
        throw new Error('[DevStudio] Select an instance first.');
      }
      const current = findInstanceByPublicId(currentPublicId);
      const widgetSlug = current?.widgetSlug || normalizeWidgetname(current?.widgetname);
      if (!widgetSlug) {
        throw new Error('[DevStudio] Unable to resolve widget type from the selected instance.');
      }

      const localHostRegex = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;
      if (!localHostRegex.test(BOB_ORIGIN)) {
        throw new Error(
          '[DevStudio] Update Theme requires local Bob (http://localhost:3000). Remote Bob does not reflect local Tokyo theme edits.',
        );
      }

      const exported = await exportInstanceDataFromBob({
        exportMode: 'current',
      });
      const config = exported?.instanceData;
      if (!config || typeof config !== 'object') {
        throw new Error('[DevStudio] Bob export did not include instanceData');
      }

      const editorThemeId = String(config?.appearance?.theme || '')
        .trim()
        .toLowerCase();
      const themes = await listTokyoThemes();
      const lastThemeId = String(sessionStorage.getItem(THEME_UPDATE_LAST_ID_STORAGE) || '')
        .trim()
        .toLowerCase();
      const hasEditorTheme =
        Boolean(editorThemeId) &&
        editorThemeId !== 'custom' &&
        themes.some((theme) => theme.id === editorThemeId);
      const hasLastTheme =
        Boolean(lastThemeId) &&
        lastThemeId !== 'custom' &&
        themes.some((theme) => theme.id === lastThemeId);
      const defaultThemeId = hasEditorTheme ? editorThemeId : hasLastTheme ? lastThemeId : '';
      if (!themes?.length) throw new Error('[DevStudio] Theme list not found.');
      const themeId = await openThemeModal({ themes, defaultThemeId });
      if (!themeId) throw new Error('[DevStudio] Canceled');
      const compiled = await ensureCompiledWidget(widgetSlug);
      const values = buildThemeValuesFromConfig(config, compiled);
      if (!Object.keys(values).length) {
        throw new Error('[DevStudio] Theme values not found in current config.');
      }

      const normalizedValues = normalizeThemeValuesForCompiledControls(values, compiled);
      const cleanedValues = stripTokyoBaseFromConfig(cloneJson(normalizedValues), TOKYO_BASE);
      await updateTokyoTheme({ themeId, values: cleanedValues });
      sessionStorage.setItem(THEME_UPDATE_LAST_ID_STORAGE, themeId);
      invalidateCompiledWidget(widgetSlug);
      if (currentPublicId) {
        await sendInstanceToIframe(currentPublicId);
      }
      alert(`[DevStudio] Theme "${themeId}" updated from current editor state.`);
      return { themeId, values: cleanedValues };
    }

    if (platformActions instanceof HTMLElement) {
      const showThemeAction = isLocalDevStudio && IS_SOURCE_PROFILE;
      platformActions.style.display = showThemeAction ? 'inline-flex' : 'none';
    }

    platformUpdateTheme?.addEventListener('click', async () => {
      try {
        await updateThemeFromEditor();
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err));
      }
    });

    themeModalConfirm?.addEventListener('click', () => {
      try {
        if (!(themeModalSelect instanceof HTMLSelectElement))
          throw new Error('[DevStudio] Theme selector missing');
        const themeId = String(themeModalSelect.value || '')
          .trim()
          .toLowerCase();
        if (!themeId) throw new Error('[DevStudio] Select a theme first.');
        closeThemeModal(themeId);
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err));
      }
    });

    themeModalClose?.addEventListener('click', () => {
      closeThemeModal(null);
    });

    themeModalCancel?.addEventListener('click', () => {
      closeThemeModal(null);
    });

    themeModal?.addEventListener('click', (event) => {
      if (event.target === themeModal) closeThemeModal(null);
    });

    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape') return;
        if (themeModal && !themeModal.hidden) closeThemeModal(null);
      },
      { signal: abortController.signal },
    );

    function setOpen(nextState) {
      isOpen = nextState;
      dropdown.setAttribute('data-state', isOpen ? 'open' : 'closed');
      control.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    if (widgetSelect instanceof HTMLSelectElement) {
      widgetSelect.addEventListener(
        'change',
        () => {
          const nextWidgetSlug = normalizeWidgetname(widgetSelect.value);
          if (!nextWidgetSlug) return;
          if (nextWidgetSlug === selectedWidgetSlug) return;
          selectedWidgetSlug = nextWidgetSlug;

          const scopedInstances = getScopedInstances();
          const nextPublicId = scopedInstances.some((inst) => inst.publicId === currentPublicId)
            ? currentPublicId
            : scopedInstances[0]?.publicId || null;
          const instanceChanged = nextPublicId !== currentPublicId;
          currentPublicId = nextPublicId;

          setOpen(false);
          updateCurrentLabel();
          renderInstances();

          if (currentPublicId && instanceChanged && bobSessionId) {
            sendInstanceToIframe(currentPublicId).catch((error) => {
              console.error('[DevStudio] Failed to send instance to Bob', error);
            });
          }
          refreshL10nStatus(currentPublicId).catch(() => {});
        },
        { signal: abortController.signal },
      );
    }

    control.addEventListener(
      'click',
      () => {
        setOpen(!isOpen);
      },
      { signal: abortController.signal },
    );

    control.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setOpen(!isOpen);
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          setOpen(true);
          const firstOption = menu.querySelector('[data-public-id]');
          firstOption?.focus();
        } else if (event.key === 'Escape') {
          setOpen(false);
        }
      },
      { signal: abortController.signal },
    );

    menu.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          control.focus();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          const options = Array.from(menu.querySelectorAll('[data-public-id]'));
          const currentIndex = options.indexOf(document.activeElement);
          const nextIndex = event.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
          const next = options[nextIndex];
          if (next) {
            event.preventDefault();
            next.focus();
          }
        } else if (event.key === 'Home') {
          const first = menu.querySelector('[data-public-id]');
          if (first) {
            event.preventDefault();
            first.focus();
          }
        } else if (event.key === 'End') {
          const options = menu.querySelectorAll('[data-public-id]');
          const last = options[options.length - 1];
          if (last) {
            event.preventDefault();
            last.focus();
          }
        } else if (event.key === 'Tab') {
          setOpen(false);
        } else if (event.key === 'Enter' || event.key === ' ') {
          const target = event.target.closest('[data-public-id]');
          if (target) {
            event.preventDefault();
            target.click();
          }
        }
      },
      { signal: abortController.signal },
    );

    document.addEventListener(
      'click',
      (event) => {
        if (!dropdown.contains(event.target)) {
          setOpen(false);
        }
      },
      { signal: abortController.signal },
    );

    (async () => {
      try {
        await loadInstances();
      } catch (error) {
        console.error('[DevStudio] Failed to load instances', error);
        currentLabel.textContent = 'Error loading instances';
      }
    })();
}
