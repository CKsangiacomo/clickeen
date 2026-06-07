(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[CTA] Missing CKWidgetRuntime.register');
  }

  var ALLOWED_ICONS = [
    'checkmark',
    'arrow.right',
    'chevron.right',
    'arrowshape.forward',
    'arrowshape.turn.up.right',
  ];

  function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function assertRecord(value, path) {
    if (!isRecord(value)) throw new Error('[CTA] ' + path + ' must be an object');
    return value;
  }

  function assertString(value, path) {
    if (typeof value !== 'string') throw new Error('[CTA] ' + path + ' must be a string');
    return value;
  }

  function assertBoolean(value, path) {
    if (typeof value !== 'boolean') throw new Error('[CTA] ' + path + ' must be a boolean');
    return value;
  }

  function assertNumber(value, path, min, max) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('[CTA] ' + path + ' must be a finite number');
    }
    if (value < min || value > max) {
      throw new Error('[CTA] ' + path + ' must be ' + min + '..' + max);
    }
    return value;
  }

  function assertEnum(value, path, options) {
    assertString(value, path);
    if (options.indexOf(value) === -1) {
      throw new Error('[CTA] ' + path + ' must be one of: ' + options.join(', '));
    }
    return value;
  }

  function assertFillValue(value, path) {
    if (typeof value === 'string' || isRecord(value)) return value;
    throw new Error('[CTA] ' + path + ' must be a fill value');
  }

  function queryElement(root, selector, path) {
    var el = root.querySelector(selector);
    if (!(el instanceof HTMLElement)) throw new Error('[CTA] Missing ' + path);
    return el;
  }

  function hasTypographyRole(state, roleKey) {
    return (
      isRecord(state) &&
      isRecord(state.typography) &&
      isRecord(state.typography.roles) &&
      isRecord(state.typography.roles[roleKey])
    );
  }

  function hasRenderableCore(core) {
    return (
      isRecord(core) &&
      typeof core.showEyebrow === 'boolean' &&
      typeof core.eyebrow === 'string' &&
      typeof core.title === 'string' &&
      typeof core.showCopy === 'boolean' &&
      typeof core.copyHtml === 'string' &&
      isRecord(core.button) &&
      isRecord(core.buttonStyle) &&
      typeof core.alignment === 'string' &&
      typeof core.gap === 'number' &&
      typeof core.textWidth === 'number'
    );
  }

  function unwrapElement(el) {
    var parent = el.parentNode;
    if (!parent) return;
    var before = el.previousSibling;
    var after = el.nextSibling;
    var needsSpaceBefore =
      before && before.nodeType === Node.TEXT_NODE && before.textContent && !/\s$/.test(before.textContent);
    var needsSpaceAfter =
      after && after.nodeType === Node.TEXT_NODE && after.textContent && !/^\s/.test(after.textContent);
    if (needsSpaceBefore) parent.insertBefore(document.createTextNode(' '), el);
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    if (needsSpaceAfter) parent.insertBefore(document.createTextNode(' '), el.nextSibling);
    parent.removeChild(el);
  }

  function normalizeActionHref(raw, path) {
    var value = assertString(raw, path).trim();
    if (!value) return '';
    if (value.charAt(0) === '#' && !/\s/.test(value)) return value;
    if (value.charAt(0) === '/' && value.charAt(1) !== '/' && !/\s/.test(value)) return value;
    if (/^https?:\/\//i.test(value)) {
      try {
        return new URL(value).href;
      } catch {
        throw new Error('[CTA] ' + path + ' must be a valid http(s) URL');
      }
    }
    if (/^mailto:[^\s]+$/i.test(value)) return value;
    if (/^tel:[+0-9().\-\s]+$/i.test(value)) return value;
    throw new Error('[CTA] ' + path + ' must be empty, #, root-relative, http(s), mailto, or tel');
  }

  function sanitizeInlineHtml(html, allowLinks) {
    var wrapper = document.createElement('div');
    wrapper.innerHTML = String(html || '');
    var allowed = { STRONG: true, B: true, EM: true, I: true, U: true, S: true, BR: true };
    if (allowLinks) allowed.A = true;

    wrapper.querySelectorAll('*').forEach(function (node) {
      var el = node;
      var tag = el.tagName;
      if (!allowed[tag]) {
        unwrapElement(el);
        return;
      }

      if (tag === 'A') {
        var href = el.getAttribute('href') || '';
        try {
          var normalized = normalizeActionHref(href, 'inline link href');
          if (normalized) el.setAttribute('href', normalized);
          else el.removeAttribute('href');
        } catch {
          el.removeAttribute('href');
        }
        if (el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener');
        else el.removeAttribute('rel');
        Array.from(el.attributes).forEach(function (attr) {
          if (attr.name === 'href' || attr.name === 'target' || attr.name === 'rel') return;
          if (attr.name === 'class' && /\bdiet-dropdown-edit-link\b/.test(attr.value)) return;
          el.removeAttribute(attr.name);
        });
        return;
      }

      Array.from(el.attributes).forEach(function (attr) {
        el.removeAttribute(attr.name);
      });
    });

    return wrapper.innerHTML;
  }

  function resolveAppearance() {
    if (
      !window.CKAppearance ||
      typeof window.CKAppearance.toCssBackground !== 'function' ||
      typeof window.CKAppearance.toCssColor !== 'function' ||
      typeof window.CKAppearance.tokenizeRadius !== 'function'
    ) {
      throw new Error('[CTA] Missing CKAppearance helpers');
    }
    return window.CKAppearance;
  }

  function applyButtonStyle(core, coreEl) {
    var style = assertRecord(core.buttonStyle, 'state.core.buttonStyle');
    var appearance = resolveAppearance();
    coreEl.style.setProperty(
      '--ck-cta-button-bg',
      appearance.toCssBackground(assertFillValue(style.background, 'state.core.buttonStyle.background')),
    );
    coreEl.style.setProperty(
      '--ck-cta-button-fg',
      appearance.toCssColor(assertFillValue(style.textColor, 'state.core.buttonStyle.textColor')),
    );
    coreEl.style.setProperty('--ck-cta-button-radius', appearance.tokenizeRadius(assertEnum(style.radius, 'state.core.buttonStyle.radius', ['none', 'sm', 'md', 'lg', 'xl', '2xl'])));
    coreEl.style.setProperty(
      '--ck-cta-button-padding-inline',
      assertNumber(style.paddingInline, 'state.core.buttonStyle.paddingInline', 0, 80) + 'px',
    );
    coreEl.style.setProperty(
      '--ck-cta-button-padding-block',
      assertNumber(style.paddingBlock, 'state.core.buttonStyle.paddingBlock', 0, 64) + 'px',
    );
    coreEl.style.setProperty(
      '--ck-cta-button-icon-size',
      assertNumber(style.iconSize, 'state.core.buttonStyle.iconSize', 0, 80) + 'px',
    );

    var border = assertRecord(style.border, 'state.core.buttonStyle.border');
    assertBoolean(border.enabled, 'state.core.buttonStyle.border.enabled');
    assertString(border.color, 'state.core.buttonStyle.border.color');
    var borderWidth = assertNumber(border.width, 'state.core.buttonStyle.border.width', 0, 12);
    coreEl.style.setProperty('--ck-cta-button-border-width', border.enabled === true ? borderWidth + 'px' : '0px');
    coreEl.style.setProperty(
      '--ck-cta-button-border-color',
      border.enabled === true ? String(border.color) : 'transparent',
    );
  }

  function applyButton(button, coreEl, buttonEl, labelEl, iconEl) {
    assertRecord(button, 'state.core.button');
    var enabled = assertBoolean(button.enabled, 'state.core.button.enabled');
    var label = assertString(button.label, 'state.core.button.label');
    var href = normalizeActionHref(button.href, 'state.core.button.href');
    var openMode = assertEnum(button.openMode, 'state.core.button.openMode', ['same-tab', 'new-tab', 'new-window']);
    var iconEnabled = assertBoolean(button.iconEnabled, 'state.core.button.iconEnabled');
    var iconName = assertString(button.iconName, 'state.core.button.iconName').trim();
    var iconPlacement = assertEnum(button.iconPlacement, 'state.core.button.iconPlacement', ['left', 'right']);
    var showButton = enabled === true && label.trim().length > 0;

    buttonEl.hidden = !showButton;
    buttonEl.dataset.iconPlacement = iconPlacement;
    labelEl.textContent = label;

    if (showButton && href) {
      buttonEl.setAttribute('href', href);
      buttonEl.removeAttribute('aria-disabled');
      buttonEl.tabIndex = 0;
      if (openMode === 'new-tab') {
        buttonEl.setAttribute('target', '_blank');
        buttonEl.setAttribute('rel', 'noopener');
        buttonEl.onclick = null;
      } else if (openMode === 'new-window') {
        buttonEl.removeAttribute('target');
        buttonEl.removeAttribute('rel');
        buttonEl.onclick = function (event) {
          event.preventDefault();
          var popup = window.open(href, '_blank', 'noopener,noreferrer,popup=yes,width=1024,height=720');
          if (popup) popup.opener = null;
        };
      } else {
        buttonEl.removeAttribute('target');
        buttonEl.removeAttribute('rel');
        buttonEl.onclick = null;
      }
    } else {
      buttonEl.removeAttribute('href');
      buttonEl.removeAttribute('target');
      buttonEl.removeAttribute('rel');
      buttonEl.setAttribute('aria-disabled', 'true');
      buttonEl.tabIndex = -1;
      buttonEl.onclick = null;
    }

    var showIcon = showButton && iconEnabled === true;
    if (showIcon && ALLOWED_ICONS.indexOf(iconName) === -1) {
      throw new Error('[CTA] state.core.button.iconName must be one of: ' + ALLOWED_ICONS.join(', '));
    }
    iconEl.hidden = !showIcon;
    coreEl.style.setProperty(
      '--ck-cta-button-icon',
      showIcon ? 'url("/dieter/icons/svg/' + iconName + '.svg")' : 'none',
    );
  }

  function initCta(widgetRoot, runtimeContext) {
    var ctaRoot = queryElement(widgetRoot, '[data-role="cta"]', '[data-role="cta"]');
    var coreEl = queryElement(widgetRoot, '[data-role="cta-core"]', '[data-role="cta-core"]');
    var eyebrowEl = queryElement(widgetRoot, '[data-role="cta-eyebrow"]', '[data-role="cta-eyebrow"]');
    var titleEl = queryElement(widgetRoot, '[data-role="cta-title"]', '[data-role="cta-title"]');
    var copyEl = queryElement(widgetRoot, '[data-role="cta-copy"]', '[data-role="cta-copy"]');
    var buttonEl = queryElement(widgetRoot, '[data-role="cta-button"]', '[data-role="cta-button"]');
    var buttonLabelEl = queryElement(widgetRoot, '[data-role="cta-button-label"]', '[data-role="cta-button-label"]');
    var buttonIconEl = queryElement(widgetRoot, '[data-role="cta-button-icon"]', '[data-role="cta-button-icon"]');
    var resolvedInstanceId = runtimeContext.instanceId;

    function renderCore(state) {
      if (!hasRenderableCore(state.core)) {
        coreEl.hidden = true;
        return;
      }
      coreEl.hidden = false;
      var core = assertRecord(state.core, 'state.core');
      var alignment = assertEnum(core.alignment, 'state.core.alignment', ['left', 'center', 'right']);
      var gap = assertNumber(core.gap, 'state.core.gap', 0, 120);
      var textWidth = assertNumber(core.textWidth, 'state.core.textWidth', 240, 1600);
      var showEyebrow = assertBoolean(core.showEyebrow, 'state.core.showEyebrow');
      var eyebrow = assertString(core.eyebrow, 'state.core.eyebrow');
      var titleHtml = sanitizeInlineHtml(assertString(core.title, 'state.core.title'), false);
      var showCopy = assertBoolean(core.showCopy, 'state.core.showCopy');
      var copyHtml = sanitizeInlineHtml(assertString(core.copyHtml, 'state.core.copyHtml'), true);

      coreEl.dataset.align = alignment;
      coreEl.style.setProperty('--ck-cta-core-gap', gap + 'px');
      coreEl.style.setProperty('--ck-cta-text-width', textWidth + 'px');

      eyebrowEl.textContent = eyebrow;
      eyebrowEl.hidden = !showEyebrow || eyebrow.trim().length === 0;

      titleEl.innerHTML = titleHtml;
      titleEl.hidden = titleHtml.length === 0;

      copyEl.innerHTML = showCopy ? copyHtml : '';
      copyEl.hidden = !showCopy || copyHtml.length === 0;

      applyButtonStyle(core, coreEl);
      applyButton(core.button, coreEl, buttonEl, buttonLabelEl, buttonIconEl);
    }

    function applyState(state, context) {
      if (!state) return;
      assertRecord(state, 'state');
      if (!window.CKStagePod?.applyStagePod) {
        throw new Error('[CTA] Missing CKStagePod.applyStagePod');
      }
      window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

      if (!window.CKTypography?.applyTypography) {
        throw new Error('[CTA] Missing CKTypography.applyTypography');
      }
      var typographyRoles = {
        title: { varKey: 'title' },
        body: { varKey: 'body' },
        button: { varKey: 'button' },
        localeSwitcher: { varKey: 'localeSwitcher' },
      };
      if (hasTypographyRole(state, 'eyebrow')) {
        typographyRoles.eyebrow = { varKey: 'eyebrow' };
      }
      window.CKTypography.applyTypography(
        state.typography,
        ctaRoot,
        typographyRoles,
        { locale: context && context.locale, instanceId: context && context.instanceId },
      );

      if (!window.CKHeader?.applyHeader) {
        throw new Error('[CTA] Missing CKHeader.applyHeader');
      }
      window.CKHeader.applyHeader(state, widgetRoot);

      renderCore(state);

      if (!window.CKCoreSize?.applyCoreSize) {
        throw new Error('[CTA] Missing CKCoreSize.applyCoreSize');
      }
      window.CKCoreSize.applyCoreSize(state.coreSize, coreEl);

      if (!window.CKLocaleSwitcher?.applyLocaleSwitcher) {
        throw new Error('[CTA] Missing CKLocaleSwitcher.applyLocaleSwitcher');
      }
      window.CKLocaleSwitcher.applyLocaleSwitcher(state, widgetRoot, {
        composedPage: context && context.composedPage === true,
        locale: context && context.locale,
        previewMode: context && context.previewMode,
        typographyScope: ctaRoot,
      });

      if (window.CKBranding && typeof window.CKBranding.applyBacklink === 'function') {
        window.CKBranding.applyBacklink(widgetRoot, state);
      }
    }

    var previewLocaleRequest = 0;

    async function applyPreviewState(
      state,
      locale,
      instanceId,
      previewMode,
      baseLocale,
      translatedLocaleValues,
    ) {
      if (!state) return;
      var requestId = ++previewLocaleRequest;
      var helper =
        window.CK_PREVIEW_L10N &&
        typeof window.CK_PREVIEW_L10N === 'object' &&
        typeof window.CK_PREVIEW_L10N.loadLocalizedState === 'function'
          ? window.CK_PREVIEW_L10N
          : null;
      var localizedState = state;
      if (helper) {
        try {
          localizedState = await helper.loadLocalizedState({
            instanceId: typeof instanceId === 'string' ? instanceId : resolvedInstanceId,
            locale,
            baseLocale,
            previewMode,
            baseState: state,
            values: translatedLocaleValues,
          });
        } catch (error) {
          if (requestId === previewLocaleRequest) {
            console.error('[CTA] preview localization load failed', error);
          }
          return;
        }
      }
      if (requestId !== previewLocaleRequest) return;
      applyState(localizedState, {
        locale,
        previewMode,
        composedPage: runtimeContext && runtimeContext.composedPage === true,
        instanceId: typeof instanceId === 'string' ? instanceId : resolvedInstanceId,
      });
    }

    runtime.bindStateUpdates(
      'cta',
      resolvedInstanceId,
      function (data) {
        void applyPreviewState(
          data.state,
          data.locale,
          data.instanceId,
          data.previewMode,
          data.baseLocale,
          data.translatedLocaleValues,
        );
      },
      { requireWidgetName: true },
    );

    var initialLocale = runtimeContext.locale || '';
    var initialState = runtimeContext.state;
    if (initialState) {
      applyState(initialState, {
        ...runtimeContext,
        locale: initialLocale,
        instanceId: resolvedInstanceId,
      });
    }
  }

  runtime.register('cta', initCta);
})();
