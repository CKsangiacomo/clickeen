(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const POSITION_SET = new Set([
    'top-left',
    'top-center',
    'top-right',
    'right-middle',
    'bottom-right',
    'bottom-center',
    'bottom-left',
    'left-middle',
  ]);
  const ROOT_SWITCHER_IDS = new WeakMap();
  let switcherSequence = 0;

  function normalizeLocale(value) {
    return typeof value === 'string' ? value.trim().toLowerCase().replace(/_/g, '-') : '';
  }

  function assertHost(widgetRoot, hostName) {
    const selector = hostName === 'pod' ? '.pod' : '.stage';
    const host = widgetRoot.closest(selector);
    if (!(host instanceof HTMLElement)) {
      throw new Error('[CKLocaleSwitcher] Missing ' + selector);
    }
    if (!host.style.position) host.style.position = 'relative';
    return host;
  }

  function resolveAppearanceHelpers() {
    const appearance = window.CKAppearance;
    if (
      !appearance ||
      typeof appearance.toCssBackground !== 'function' ||
      typeof appearance.toCssColor !== 'function' ||
      typeof appearance.tokenizeRadius !== 'function'
    ) {
      throw new Error('[CKLocaleSwitcher] Missing CKAppearance helpers');
    }
    return appearance;
  }

  function resolveRuntime() {
    const runtime = window.CKWidgetRuntime;
    if (!runtime || typeof runtime.resolveInstanceId !== 'function') {
      throw new Error('[CKLocaleSwitcher] Missing CKWidgetRuntime.resolveInstanceId');
    }
    return runtime;
  }

  function resolveInstanceKey(widgetRoot) {
    const existing = ROOT_SWITCHER_IDS.get(widgetRoot);
    if (existing) return existing;
    switcherSequence += 1;
    const instanceId = resolveRuntime().resolveInstanceId(widgetRoot);
    const widgetName = widgetRoot.getAttribute('data-ck-widget') || 'widget';
    const instanceKey = (instanceId || widgetName) + '__' + String(switcherSequence);
    ROOT_SWITCHER_IDS.set(widgetRoot, instanceKey);
    return instanceKey;
  }

  function resolveSwitcherConfig(raw) {
    const payload = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const attachTo = payload.attachTo === 'pod' ? 'pod' : 'stage';
    const position = POSITION_SET.has(payload.position) ? payload.position : 'top-right';
    return {
      enabled: payload.enabled === true,
      attachTo,
      position,
    };
  }

  function resolveAppearance(raw) {
    const appearance = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const helpers = resolveAppearanceHelpers();
    const border =
      appearance.localeSwitcherBorder &&
      typeof appearance.localeSwitcherBorder === 'object' &&
      !Array.isArray(appearance.localeSwitcherBorder)
        ? appearance.localeSwitcherBorder
        : null;

    return {
      background: helpers.toCssBackground(appearance.localeSwitcherBackground || 'var(--color-system-white)'),
      color: helpers.toCssColor(appearance.localeSwitcherTextColor || 'var(--color-system-black)'),
      radius: helpers.tokenizeRadius(appearance.localeSwitcherRadius || 'md'),
      borderWidth:
        border && border.enabled === true && typeof border.width === 'number' && Number.isFinite(border.width)
          ? border.width
          : 0,
      borderColor:
        border && border.enabled === true && typeof border.color === 'string' && border.color.trim()
          ? border.color
          : 'transparent',
      paddingInline:
        typeof appearance.localeSwitcherPaddingInline === 'number' && Number.isFinite(appearance.localeSwitcherPaddingInline)
          ? appearance.localeSwitcherPaddingInline
          : 14,
      paddingBlock:
        typeof appearance.localeSwitcherPaddingBlock === 'number' && Number.isFinite(appearance.localeSwitcherPaddingBlock)
          ? appearance.localeSwitcherPaddingBlock
          : 10,
    };
  }

  function postToHost(payload) {
    try {
      window.parent?.postMessage(payload, '*');
    } catch {}
  }

  function ensureElement(widgetRoot, hostName) {
    const key = resolveInstanceKey(widgetRoot);
    let existing = document.querySelector(
      '.ck-locale-switcher[data-ck-locale-switcher-for="' + key.replace(/"/g, '&quot;') + '"]',
    );
    if (!(existing instanceof HTMLElement)) {
      existing = document.createElement('div');
      existing.className = 'ck-locale-switcher';
      existing.setAttribute('data-ck-locale-switcher-for', key);
      const select = document.createElement('select');
      select.className = 'ck-locale-switcher__select';
      select.setAttribute('aria-label', 'Language');
      existing.appendChild(select);
    }

    const host = assertHost(widgetRoot, hostName);
    if (existing.parentElement !== host) {
      host.appendChild(existing);
    }
    existing.setAttribute('data-host', hostName);
    return existing;
  }

  function copyTypographyVars(target, source) {
    if (!(target instanceof HTMLElement) || !(source instanceof HTMLElement)) return;
    const styles = window.getComputedStyle(source);
    [
      '--typo-locale-switcher-family',
      '--typo-locale-switcher-style',
      '--typo-locale-switcher-weight',
      '--typo-locale-switcher-size',
      '--typo-locale-switcher-tracking',
      '--typo-locale-switcher-line-height',
      '--typo-locale-switcher-color',
    ].forEach((name) => {
      const value = styles.getPropertyValue(name);
      if (value && value.trim()) target.style.setProperty(name, value.trim());
    });
  }

  function applyAppearanceVars(target, appearance) {
    target.style.setProperty('--ck-locale-switcher-bg', appearance.background);
    target.style.setProperty('--ck-locale-switcher-fg', appearance.color);
    target.style.setProperty('--ck-locale-switcher-radius', appearance.radius);
    target.style.setProperty('--ck-locale-switcher-border-width', String(appearance.borderWidth) + 'px');
    target.style.setProperty('--ck-locale-switcher-border-color', appearance.borderColor);
    target.style.setProperty('--ck-locale-switcher-padding-inline', String(appearance.paddingInline) + 'px');
    target.style.setProperty('--ck-locale-switcher-padding-block', String(appearance.paddingBlock) + 'px');
    target.style.setProperty('--ck-locale-switcher-arrow', 'url("/dieter/icons/svg/chevron.down.svg")');
  }

  function readLabels() {
    const labels =
      window.CK_LOCALE_LABELS && typeof window.CK_LOCALE_LABELS === 'object' ? window.CK_LOCALE_LABELS : {};
    const out = {};
    Object.entries(labels).forEach(function ([locale, label]) {
      const normalized = normalizeLocale(locale);
      if (!normalized || typeof label !== 'string' || !label.trim()) return;
      out[normalized] = label.trim();
    });
    return out;
  }

  function removeExisting(widgetRoot) {
    const key = resolveInstanceKey(widgetRoot);
    const existing = document.querySelector(
      '.ck-locale-switcher[data-ck-locale-switcher-for="' + key.replace(/"/g, '&quot;') + '"]',
    );
    if (existing instanceof HTMLElement) existing.remove();
  }

  function applyLocaleSwitcher(state, widgetRoot, runtimeContext) {
    if (!(widgetRoot instanceof HTMLElement)) {
      throw new Error('[CKLocaleSwitcher] widgetRoot must be an HTMLElement');
    }

    if (runtimeContext && runtimeContext.composedPage === true) {
      removeExisting(widgetRoot);
      return;
    }

    const config = resolveSwitcherConfig(state && state.localeSwitcher);
    const policy =
      window.CK_LOCALE_POLICY && typeof window.CK_LOCALE_POLICY === 'object' ? window.CK_LOCALE_POLICY : {};
    const policyLanguages = Array.isArray(policy.languages)
      ? policy.languages
      : Array.isArray(policy['ready' + 'Locales'])
        ? policy['ready' + 'Locales']
        : [];
    const languages = Array.from(new Set(policyLanguages.map(normalizeLocale).filter(Boolean)));

    if (!config.enabled || languages.length <= 1) {
      removeExisting(widgetRoot);
      return;
    }

    const currentLocale =
      normalizeLocale(runtimeContext && runtimeContext.locale);
    const previewMode =
      runtimeContext && typeof runtimeContext.previewMode === 'string'
        ? runtimeContext.previewMode.trim()
        : '';
    const labels = readLabels();
    const element = ensureElement(widgetRoot, config.attachTo);
    const select = element.querySelector('.ck-locale-switcher__select');
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('[CKLocaleSwitcher] Missing select element');
    }

    copyTypographyVars(
      element,
      runtimeContext && runtimeContext.typographyScope instanceof HTMLElement
        ? runtimeContext.typographyScope
        : widgetRoot,
    );
    applyAppearanceVars(element, resolveAppearance(state && state.appearance));
    element.setAttribute('data-position', config.position);

    const existingOptions = Array.from(select.options).map((option) => option.value);
    if (JSON.stringify(existingOptions) !== JSON.stringify(languages)) {
      select.innerHTML = '';
      languages.forEach((locale) => {
        const option = document.createElement('option');
        option.value = locale;
        option.textContent = labels[locale] || locale;
        select.appendChild(option);
      });
    }

    if (currentLocale && languages.indexOf(currentLocale) >= 0) {
      select.value = currentLocale;
    }
    select.dataset.previewMode = previewMode;
    select.dataset.currentLocale = currentLocale;

    if (select.dataset.bound !== 'true') {
      select.addEventListener('change', function () {
        const nextLocale = normalizeLocale(select.value);
        if (!nextLocale) return;
        const current = normalizeLocale(select.dataset.currentLocale);
        const resetSelection = function () {
          if (current) {
            const hasCurrent = Array.from(select.options).some((option) => option.value === current);
            if (hasCurrent) {
              select.value = current;
              return;
            }
          }
          select.value = select.options[0] ? select.options[0].value : '';
        };
        if (nextLocale === current) return;
        const currentPreviewMode = typeof select.dataset.previewMode === 'string' ? select.dataset.previewMode : '';
        if (currentPreviewMode === 'editing') {
          resetSelection();
          postToHost({ type: 'ck:preview-locale-switch-blocked' });
          return;
        }
        if (currentPreviewMode === 'translations') {
          resetSelection();
          postToHost({ type: 'ck:preview-locale-change-request', locale: nextLocale });
          return;
        }
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('locale', nextLocale);
          window.location.href = url.toString();
        } catch {}
      });
      select.dataset.bound = 'true';
    }
  }

  window.CKLocaleSwitcher = window.CKLocaleSwitcher || {};
  window.CKLocaleSwitcher.applyLocaleSwitcher = applyLocaleSwitcher;
})();
