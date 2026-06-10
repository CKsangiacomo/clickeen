(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[CallToAction] Missing CKWidgetRuntime.register');
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
    if (!isRecord(value)) throw new Error('[CallToAction] ' + path + ' must be an object');
    return value;
  }

  function assertString(value, path) {
    if (typeof value !== 'string') throw new Error('[CallToAction] ' + path + ' must be a string');
    return value;
  }

  function assertBoolean(value, path) {
    if (typeof value !== 'boolean') throw new Error('[CallToAction] ' + path + ' must be a boolean');
    return value;
  }

  function assertNumber(value, path, min, max) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('[CallToAction] ' + path + ' must be a finite number');
    }
    if (value < min || value > max) {
      throw new Error('[CallToAction] ' + path + ' must be ' + min + '..' + max);
    }
    return value;
  }

  function assertEnum(value, path, options) {
    assertString(value, path);
    if (options.indexOf(value) === -1) {
      throw new Error('[CallToAction] ' + path + ' must be one of: ' + options.join(', '));
    }
    return value;
  }

  function assertFillValue(value, path) {
    if (typeof value === 'string' || isRecord(value)) return value;
    throw new Error('[CallToAction] ' + path + ' must be a fill value');
  }

  function queryElement(root, selector, path) {
    var el = root.querySelector(selector);
    if (!(el instanceof HTMLElement)) throw new Error('[CallToAction] Missing ' + path);
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
        throw new Error('[CallToAction] ' + path + ' must be a valid http(s) URL');
      }
    }
    if (/^mailto:[^\s]+$/i.test(value)) return value;
    if (/^tel:[+0-9().\-\s]+$/i.test(value)) return value;
    throw new Error('[CallToAction] ' + path + ' must be empty, #, root-relative, http(s), mailto, or tel');
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
      throw new Error('[CallToAction] Missing CKAppearance helpers');
    }
    return window.CKAppearance;
  }

  function applyActionStyle(calltoaction, contentEl) {
    var style = assertRecord(calltoaction.actionStyle, 'state.calltoaction.actionStyle');
    var appearance = resolveAppearance();
    contentEl.style.setProperty(
      '--ck-calltoaction-action-bg',
      appearance.toCssBackground(assertFillValue(style.background, 'state.calltoaction.actionStyle.background')),
    );
    contentEl.style.setProperty(
      '--ck-calltoaction-action-fg',
      appearance.toCssColor(assertFillValue(style.textColor, 'state.calltoaction.actionStyle.textColor')),
    );
    contentEl.style.setProperty('--ck-calltoaction-action-radius', appearance.tokenizeRadius(assertEnum(style.radius, 'state.calltoaction.actionStyle.radius', ['none', 'sm', 'md', 'lg', 'xl', '2xl'])));
    contentEl.style.setProperty(
      '--ck-calltoaction-action-padding-inline',
      assertNumber(style.paddingInline, 'state.calltoaction.actionStyle.paddingInline', 8, 48) + 'px',
    );
    contentEl.style.setProperty(
      '--ck-calltoaction-action-padding-block',
      assertNumber(style.paddingBlock, 'state.calltoaction.actionStyle.paddingBlock', 6, 36) + 'px',
    );
    contentEl.style.setProperty(
      '--ck-calltoaction-action-icon-size',
      assertNumber(style.iconSize, 'state.calltoaction.actionStyle.iconSize', 10, 40) + 'px',
    );

    var border = assertRecord(style.border, 'state.calltoaction.actionStyle.border');
    assertBoolean(border.enabled, 'state.calltoaction.actionStyle.border.enabled');
    assertString(border.color, 'state.calltoaction.actionStyle.border.color');
    var borderWidth = assertNumber(border.width, 'state.calltoaction.actionStyle.border.width', 0, 12);
    contentEl.style.setProperty('--ck-calltoaction-action-border-width', border.enabled === true ? borderWidth + 'px' : '0px');
    contentEl.style.setProperty(
      '--ck-calltoaction-action-border-color',
      border.enabled === true ? String(border.color) : 'transparent',
    );
  }

  function applyAction(action, contentEl, actionEl, labelEl, iconEl) {
    assertRecord(action, 'state.calltoaction.action');
    var enabled = assertBoolean(action.enabled, 'state.calltoaction.action.enabled');
    var label = assertString(action.label, 'state.calltoaction.action.label');
    var href = normalizeActionHref(action.href, 'state.calltoaction.action.href');
    var openMode = assertEnum(action.openMode, 'state.calltoaction.action.openMode', ['same-tab', 'new-tab', 'new-window']);
    var iconEnabled = assertBoolean(action.iconEnabled, 'state.calltoaction.action.iconEnabled');
    var iconName = assertString(action.iconName, 'state.calltoaction.action.iconName').trim();
    var iconPlacement = assertEnum(action.iconPlacement, 'state.calltoaction.action.iconPlacement', ['left', 'right']);
    var showButton = enabled === true && label.trim().length > 0;

    actionEl.hidden = !showButton;
    actionEl.dataset.iconPlacement = iconPlacement;
    labelEl.textContent = label;

    if (showButton && href) {
      actionEl.setAttribute('href', href);
      actionEl.removeAttribute('aria-disabled');
      actionEl.tabIndex = 0;
      if (openMode === 'new-tab') {
        actionEl.setAttribute('target', '_blank');
        actionEl.setAttribute('rel', 'noopener');
        actionEl.onclick = null;
      } else if (openMode === 'new-window') {
        actionEl.removeAttribute('target');
        actionEl.removeAttribute('rel');
        actionEl.onclick = function (event) {
          event.preventDefault();
          var popup = window.open(href, '_blank', 'noopener,noreferrer,popup=yes,width=1024,height=720');
          if (popup) popup.opener = null;
        };
      } else {
        actionEl.removeAttribute('target');
        actionEl.removeAttribute('rel');
        actionEl.onclick = null;
      }
    } else {
      actionEl.removeAttribute('href');
      actionEl.removeAttribute('target');
      actionEl.removeAttribute('rel');
      actionEl.setAttribute('aria-disabled', 'true');
      actionEl.tabIndex = -1;
      actionEl.onclick = null;
    }

    var showIcon = showButton && iconEnabled === true;
    if (showIcon && ALLOWED_ICONS.indexOf(iconName) === -1) {
      throw new Error('[CallToAction] state.calltoaction.action.iconName must be one of: ' + ALLOWED_ICONS.join(', '));
    }
    iconEl.hidden = !showIcon;
    contentEl.style.setProperty(
      '--ck-calltoaction-action-icon',
      showIcon ? 'url("/dieter/icons/svg/' + iconName + '.svg")' : 'none',
    );
  }

  function initCallToAction(widgetRoot, runtimeContext) {
    var callToActionRoot = queryElement(widgetRoot, '[data-role="calltoaction"]', '[data-role="calltoaction"]');
    var contentEl = queryElement(widgetRoot, '[data-role="calltoaction-content"]', '[data-role="calltoaction-content"]');
    var eyebrowEl = queryElement(widgetRoot, '[data-role="calltoaction-eyebrow"]', '[data-role="calltoaction-eyebrow"]');
    var titleEl = queryElement(widgetRoot, '[data-role="calltoaction-headline"]', '[data-role="calltoaction-headline"]');
    var copyEl = queryElement(widgetRoot, '[data-role="calltoaction-supporting-text"]', '[data-role="calltoaction-supporting-text"]');
    var actionEl = queryElement(widgetRoot, '[data-role="calltoaction-action"]', '[data-role="calltoaction-action"]');
    var actionLabelEl = queryElement(widgetRoot, '[data-role="calltoaction-action-label"]', '[data-role="calltoaction-action-label"]');
    var actionIconEl = queryElement(widgetRoot, '[data-role="calltoaction-action-icon"]', '[data-role="calltoaction-action-icon"]');
    var resolvedInstanceId = runtimeContext.instanceId;

    function renderCallToAction(state) {
      var calltoaction = assertRecord(state.calltoaction, 'state.calltoaction');
      var layout = assertRecord(calltoaction.layout, 'state.calltoaction.layout');
      var action = assertRecord(calltoaction.action, 'state.calltoaction.action');
      assertRecord(calltoaction.actionStyle, 'state.calltoaction.actionStyle');
      var alignment = assertEnum(layout.alignment, 'state.calltoaction.layout.alignment', ['left', 'center', 'right']);
      var gap = assertNumber(layout.gap, 'state.calltoaction.layout.gap', 0, 80);
      var textWidth = assertNumber(layout.textWidth, 'state.calltoaction.layout.textWidth', 280, 1200);
      var showEyebrow = assertBoolean(calltoaction.showEyebrow, 'state.calltoaction.showEyebrow');
      var eyebrow = assertString(calltoaction.eyebrow, 'state.calltoaction.eyebrow');
      var titleHtml = sanitizeInlineHtml(assertString(calltoaction.headline, 'state.calltoaction.headline'), false);
      var showCopy = assertBoolean(calltoaction.showSupportingText, 'state.calltoaction.showSupportingText');
      var copyHtml = sanitizeInlineHtml(assertString(calltoaction.supportingTextHtml, 'state.calltoaction.supportingTextHtml'), true);

      contentEl.hidden = false;
      contentEl.dataset.align = alignment;
      contentEl.style.setProperty('--ck-calltoaction-content-gap', gap + 'px');
      contentEl.style.setProperty('--ck-calltoaction-text-width', textWidth + 'px');

      eyebrowEl.textContent = eyebrow;
      eyebrowEl.hidden = !showEyebrow || eyebrow.trim().length === 0;

      titleEl.innerHTML = titleHtml;
      titleEl.hidden = titleHtml.length === 0;

      copyEl.innerHTML = showCopy ? copyHtml : '';
      copyEl.hidden = !showCopy || copyHtml.length === 0;

      applyActionStyle(calltoaction, contentEl);
      applyAction(action, contentEl, actionEl, actionLabelEl, actionIconEl);
    }

    function applyState(state, context) {
      assertRecord(state, 'state');
      if (!window.CKStagePod?.applyStagePod) {
        throw new Error('[CallToAction] Missing CKStagePod.applyStagePod');
      }
      window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot, state.appearance);

      if (!window.CKTypography?.applyTypography) {
        throw new Error('[CallToAction] Missing CKTypography.applyTypography');
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
        callToActionRoot,
        typographyRoles,
        { locale: context && context.locale, instanceId: context && context.instanceId },
      );

      if (!window.CKHeader?.applyHeader) {
        throw new Error('[CallToAction] Missing CKHeader.applyHeader');
      }
      window.CKHeader.applyHeader(state, widgetRoot);

      if (!window.CKCoreSize?.applyCoreSize) {
        throw new Error('[CallToAction] Missing CKCoreSize.applyCoreSize');
      }
      window.CKCoreSize.applyCoreSize(state.coreSize, contentEl);

      renderCallToAction(state);

      if (!window.CKLocaleSwitcher?.applyLocaleSwitcher) {
        throw new Error('[CallToAction] Missing CKLocaleSwitcher.applyLocaleSwitcher');
      }
      window.CKLocaleSwitcher.applyLocaleSwitcher(state, widgetRoot, {
        composedPage: context && context.composedPage === true,
        locale: context && context.locale,
        previewMode: context && context.previewMode,
        typographyScope: callToActionRoot,
      });

      if (window.CKBranding && typeof window.CKBranding.applyBacklink === 'function') {
        window.CKBranding.applyBacklink(widgetRoot, state);
      }

      if (!window.CKSocialShare?.apply) {
        throw new Error('[CallToAction] Missing CKSocialShare.apply');
      }
      window.CKSocialShare.apply(widgetRoot, state, {
        instanceId: context && context.instanceId,
        widgetType: 'calltoaction',
        widgetLabel: document.title || 'Call to Action',
        previewMode: context && context.previewMode,
      });
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
      assertRecord(state, 'state');
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
            console.error('[CallToAction] preview localization load failed', error);
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
      'calltoaction',
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
    applyState(runtimeContext.state, {
      ...runtimeContext,
      locale: initialLocale,
      instanceId: resolvedInstanceId,
    });
  }

  runtime.register('calltoaction', initCallToAction);
})();
