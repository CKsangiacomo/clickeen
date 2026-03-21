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

  function tokenizeRadius(value) {
    const normalized = String(value || '').trim();
    if (!normalized || normalized === 'none') return '0';
    return 'var(--control-radius-' + normalized + ')';
  }

  function resolveFillBackground(value) {
    if (window.CKFill && typeof window.CKFill.toCssBackground === 'function') {
      return window.CKFill.toCssBackground(value);
    }
    return String(value ?? '');
  }

  function resolveFillColor(value) {
    if (window.CKFill && typeof window.CKFill.toCssColor === 'function') {
      return window.CKFill.toCssColor(value);
    }
    return String(value ?? '');
  }

  function resolvePublicId(widgetRoot) {
    const direct = widgetRoot.getAttribute('data-ck-public-id');
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const rootNode = widgetRoot.getRootNode();
    if (rootNode instanceof ShadowRoot && rootNode.host instanceof HTMLElement) {
      const fromHost = rootNode.host.getAttribute('data-ck-public-id') || '';
      if (fromHost.trim()) return fromHost.trim();
    }
    const ancestor = widgetRoot.closest('[data-ck-public-id]');
    if (ancestor instanceof HTMLElement) {
      const fromAncestor = ancestor.getAttribute('data-ck-public-id') || '';
      if (fromAncestor.trim()) return fromAncestor.trim();
    }
    const global = window.CK_WIDGET && typeof window.CK_WIDGET === 'object' ? window.CK_WIDGET : null;
    return global && typeof global.publicId === 'string' ? global.publicId.trim() : '';
  }

  function resolveInstanceKey(widgetRoot) {
    const existing = ROOT_SWITCHER_IDS.get(widgetRoot);
    if (existing) return existing;
    switcherSequence += 1;
    const publicId = resolvePublicId(widgetRoot);
    const widgetName = widgetRoot.getAttribute('data-ck-widget') || 'widget';
    const instanceKey = (publicId || widgetName) + '__' + String(switcherSequence);
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
    const border =
      appearance.localeSwitcherBorder &&
      typeof appearance.localeSwitcherBorder === 'object' &&
      !Array.isArray(appearance.localeSwitcherBorder)
        ? appearance.localeSwitcherBorder
        : null;

    return {
      background: resolveFillBackground(appearance.localeSwitcherBackground || 'var(--color-system-white)'),
      color: resolveFillColor(appearance.localeSwitcherTextColor || 'var(--color-system-black)'),
      radius: tokenizeRadius(appearance.localeSwitcherRadius || 'md'),
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

    const config = resolveSwitcherConfig(state && state.localeSwitcher);
    const policy =
      window.CK_LOCALE_POLICY && typeof window.CK_LOCALE_POLICY === 'object' ? window.CK_LOCALE_POLICY : {};
    const readyLocales = Array.isArray(policy.readyLocales)
      ? Array.from(new Set(policy.readyLocales.map(normalizeLocale).filter(Boolean)))
      : [];

    if (!config.enabled || readyLocales.length <= 1) {
      removeExisting(widgetRoot);
      return;
    }

    const currentLocale =
      normalizeLocale(runtimeContext && runtimeContext.locale) ||
      normalizeLocale(window.CK_WIDGET && typeof window.CK_WIDGET === 'object' ? window.CK_WIDGET.locale : '');
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
    if (JSON.stringify(existingOptions) !== JSON.stringify(readyLocales)) {
      select.innerHTML = '';
      readyLocales.forEach((locale) => {
        const option = document.createElement('option');
        option.value = locale;
        option.textContent = labels[locale] || locale;
        select.appendChild(option);
      });
    }

    if (currentLocale && readyLocales.indexOf(currentLocale) >= 0) {
      select.value = currentLocale;
    }

    if (select.dataset.bound !== 'true') {
      select.addEventListener('change', function () {
        const nextLocale = normalizeLocale(select.value);
        if (!nextLocale) return;
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
