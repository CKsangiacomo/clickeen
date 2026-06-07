(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function assertObject(value, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`[CKHeader] ${path} must be an object`);
    }
  }

  function assertBoolean(value, path) {
    if (typeof value !== 'boolean') {
      throw new Error(`[CKHeader] ${path} must be a boolean`);
    }
  }

  function assertString(value, path) {
    if (typeof value !== 'string') {
      throw new Error(`[CKHeader] ${path} must be a string`);
    }
  }

  function assertNumber(value, path) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`[CKHeader] ${path} must be a finite number`);
    }
  }

  function applyOptionalPxVar(el, cssVar, value, path) {
    if (!cssVar || typeof cssVar !== 'string') return;
    if (value === undefined || value === null) {
      el.style.removeProperty(cssVar);
      return;
    }
    assertNumber(value, path);
    if (value < 0 || value > 200) {
      throw new Error(`[CKHeader] ${path} must be 0..200`);
    }
    el.style.setProperty(cssVar, String(value) + 'px');
  }

  function sanitizeInlineHtml(html, allowLinks) {
    var wrapper = document.createElement('div');
    wrapper.innerHTML = String(html || '');
    var allowed = { STRONG: true, B: true, EM: true, I: true, U: true, S: true, BR: true };
    if (allowLinks) allowed.A = true;

    var nodes = wrapper.querySelectorAll('*');
    nodes.forEach(function (node) {
      var el = node;
      var tag = el.tagName;
      if (!allowed[tag]) {
        var parent = el.parentNode;
        if (!parent) return;
        var before = el.previousSibling;
        var after = el.nextSibling;
        var needsSpaceBefore =
          before &&
          before.nodeType === Node.TEXT_NODE &&
          before.textContent &&
          !/\s$/.test(before.textContent);
        var needsSpaceAfter =
          after && after.nodeType === Node.TEXT_NODE && after.textContent && !/^\s/.test(after.textContent);
        if (needsSpaceBefore) parent.insertBefore(document.createTextNode(' '), el);
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        if (needsSpaceAfter) parent.insertBefore(document.createTextNode(' '), el.nextSibling);
        parent.removeChild(el);
        return;
      }

      if (tag === 'A') {
        var href = el.getAttribute('href') || '';
        if (!/^https?:\/\//i.test(href)) {
          el.removeAttribute('href');
          el.removeAttribute('target');
          el.removeAttribute('rel');
        } else {
          if (el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener');
          else el.removeAttribute('rel');
        }
        Array.from(el.attributes).forEach(function (attr) {
          if (attr.name === 'href' || attr.name === 'target' || attr.name === 'rel') return;
          if (attr.name === 'class' && /\bdiet-dropdown-edit-link\b/.test(attr.value)) return;
          el.removeAttribute(attr.name);
        });
      } else {
        Array.from(el.attributes).forEach(function (attr) {
          el.removeAttribute(attr.name);
        });
      }
    });

    return wrapper.innerHTML;
  }

  function normalizeHttpUrl(raw) {
    var v = String(raw || '').trim();
    if (!v) return '';
    if (!/^https?:\/\//i.test(v)) return '';
    try {
      var parsed = new URL(v);
      return parsed.href;
    } catch {
      return '';
    }
  }

  function resolveAppearance() {
    if (
      !window.CKAppearance ||
      typeof window.CKAppearance.toCssBackground !== 'function' ||
      typeof window.CKAppearance.toCssColor !== 'function' ||
      typeof window.CKAppearance.tokenizeRadius !== 'function'
    ) {
      throw new Error('[CKHeader] Missing CKAppearance helpers');
    }
    return window.CKAppearance;
  }

  function normalizeIconName(raw) {
    var v = String(raw || '').trim();
    if (!v) return '';
    if (v.includes('/') || v.includes('\\') || v.includes('..')) return '';
    if (!/^[a-z0-9.-]+$/i.test(v)) return '';
    return v;
  }

  function resolveCtaOpenMode(raw) {
    if (raw == null || raw === '') return 'same-tab';
    var v = String(raw);
    if (v === 'same-tab' || v === 'new-tab' || v === 'new-window') return v;
    throw new Error('[CKHeader] state.headerCta.openMode must be same-tab|new-tab|new-window');
  }

  var ALLOWED_CTA_ICONS = [
    'checkmark',
    'arrow.right',
    'chevron.right',
    'arrowshape.forward',
    'arrowshape.turn.up.right',
  ];

  function applyHeader(state, widgetRoot) {
    if (!(widgetRoot instanceof HTMLElement)) {
      throw new Error('[CKHeader] applyHeader expects widgetRoot HTMLElement');
    }

    assertObject(state, 'state');
    assertObject(state.header, 'state.header');
    assertObject(state.headerCta, 'state.headerCta');
    assertObject(state.appearance, 'state.appearance');
    assertObject(state.appearance.headerCta, 'state.appearance.headerCta');

    assertBoolean(state.header.enabled, 'state.header.enabled');
    assertString(state.header.title, 'state.header.title');
    assertBoolean(state.header.showSubtitle, 'state.header.showSubtitle');
    assertString(state.header.subtitleHtml, 'state.header.subtitleHtml');
    assertString(state.header.alignment, 'state.header.alignment');
    if (state.header.alignment !== 'left' && state.header.alignment !== 'center' && state.header.alignment !== 'right') {
      throw new Error('[CKHeader] state.header.alignment must be left|center|right');
    }

    assertString(state.header.placement, 'state.header.placement');
    if (
      state.header.placement !== 'top' &&
      state.header.placement !== 'bottom' &&
      state.header.placement !== 'left' &&
      state.header.placement !== 'right'
    ) {
      throw new Error('[CKHeader] state.header.placement must be top|bottom|left|right');
    }

    assertString(state.header.ctaPlacement, 'state.header.ctaPlacement');
    if (state.header.ctaPlacement !== 'right' && state.header.ctaPlacement !== 'below') {
      throw new Error('[CKHeader] state.header.ctaPlacement must be right|below');
    }

    assertBoolean(state.headerCta.enabled, 'state.headerCta.enabled');
    assertString(state.headerCta.label, 'state.headerCta.label');
    assertString(state.headerCta.href, 'state.headerCta.href');
    assertBoolean(state.headerCta.iconEnabled, 'state.headerCta.iconEnabled');
    assertString(state.headerCta.iconName, 'state.headerCta.iconName');
    assertString(state.headerCta.iconPlacement, 'state.headerCta.iconPlacement');
    if (state.headerCta.iconPlacement !== 'left' && state.headerCta.iconPlacement !== 'right') {
      throw new Error('[CKHeader] state.headerCta.iconPlacement must be left|right');
    }

    var layoutEl = widgetRoot.querySelector('.ck-headerLayout');
    if (!(layoutEl instanceof HTMLElement)) {
      throw new Error('[CKHeader] Missing .ck-headerLayout');
    }

    applyOptionalPxVar(layoutEl, '--ck-header-gap', state.header.gap, 'state.header.gap');
    applyOptionalPxVar(layoutEl, '--ck-header-inner-gap', state.header.innerGap, 'state.header.innerGap');
    applyOptionalPxVar(layoutEl, '--ck-header-text-gap', state.header.textGap, 'state.header.textGap');

    var headerEl = layoutEl.querySelector(':scope > .ck-header');
    if (!(headerEl instanceof HTMLElement)) {
      throw new Error('[CKHeader] Missing .ck-headerLayout > .ck-header');
    }

    var titleEl = headerEl.querySelector('[data-role="header-title"]');
    if (!(titleEl instanceof HTMLElement)) {
      throw new Error('[CKHeader] Missing [data-role="header-title"]');
    }

    var subtitleEl = headerEl.querySelector('[data-role="header-subtitle"]');
    if (!(subtitleEl instanceof HTMLElement)) {
      throw new Error('[CKHeader] Missing [data-role="header-subtitle"]');
    }

    var ctaEl = headerEl.querySelector('[data-role="header-cta"]');
    if (!(ctaEl instanceof HTMLElement)) {
      throw new Error('[CKHeader] Missing [data-role="header-cta"]');
    }

    var ctaLabelEl = ctaEl.querySelector('.ck-header__ctaLabel');
    if (!(ctaLabelEl instanceof HTMLElement)) {
      var legacy = ctaEl.textContent || '';
      while (ctaEl.firstChild) ctaEl.removeChild(ctaEl.firstChild);
      var iconEl = document.createElement('span');
      iconEl.className = 'ck-header__ctaIcon';
      iconEl.setAttribute('aria-hidden', 'true');
      var labelEl = document.createElement('span');
      labelEl.className = 'ck-header__ctaLabel';
      labelEl.textContent = legacy;
      ctaEl.appendChild(iconEl);
      ctaEl.appendChild(labelEl);
      ctaLabelEl = labelEl;
    }

    var ctaIconEl = ctaEl.querySelector('.ck-header__ctaIcon');
    if (!(ctaIconEl instanceof HTMLElement)) {
      ctaIconEl = document.createElement('span');
      ctaIconEl.className = 'ck-header__ctaIcon';
      ctaIconEl.setAttribute('aria-hidden', 'true');
      ctaEl.insertBefore(ctaIconEl, ctaLabelEl);
    }

    var hasHeader = state.header.enabled === true;
    layoutEl.dataset.hasHeader = hasHeader ? 'true' : 'false';
    layoutEl.dataset.headerPlacement = hasHeader ? state.header.placement : 'top';

    headerEl.hidden = !hasHeader;
    headerEl.dataset.align = state.header.alignment;
    headerEl.dataset.ctaPlacement = state.header.ctaPlacement;

    var titleHtml = sanitizeInlineHtml(state.header.title, false);
    titleEl.innerHTML = titleHtml;
    titleEl.hidden = !hasHeader || !titleHtml;

    var wantsSubtitle = hasHeader && state.header.showSubtitle === true;
    var subtitleHtml = wantsSubtitle ? sanitizeInlineHtml(state.header.subtitleHtml, true) : '';
    subtitleEl.innerHTML = subtitleHtml;
    subtitleEl.hidden = !wantsSubtitle || !subtitleHtml;

    var hasCta = hasHeader && state.headerCta.enabled === true;
    var ctaOpenMode = resolveCtaOpenMode(state.headerCta.openMode);
    headerEl.dataset.cta = hasCta ? 'true' : 'false';
    ctaEl.hidden = !hasCta;
    ctaLabelEl.textContent = state.headerCta.label;

    var href = normalizeHttpUrl(state.headerCta.href);
    if (hasCta && href) {
      ctaEl.setAttribute('href', href);
      ctaEl.removeAttribute('aria-disabled');
      ctaEl.tabIndex = 0;
      if (ctaOpenMode === 'new-tab') {
        ctaEl.setAttribute('target', '_blank');
        ctaEl.setAttribute('rel', 'noopener');
        ctaEl.onclick = null;
      } else if (ctaOpenMode === 'new-window') {
        ctaEl.removeAttribute('target');
        ctaEl.removeAttribute('rel');
        ctaEl.onclick = function (event) {
          event.preventDefault();
          var popup = window.open(href, '_blank', 'noopener,noreferrer,popup=yes,width=1024,height=720');
          if (popup) popup.opener = null;
        };
      } else {
        ctaEl.removeAttribute('target');
        ctaEl.removeAttribute('rel');
        ctaEl.onclick = null;
      }
    } else {
      ctaEl.removeAttribute('href');
      ctaEl.removeAttribute('target');
      ctaEl.removeAttribute('rel');
      ctaEl.setAttribute('aria-disabled', 'true');
      ctaEl.tabIndex = -1;
      ctaEl.onclick = null;
    }

    var iconEnabled = hasCta && state.headerCta.iconEnabled === true;
    var iconName = iconEnabled ? normalizeIconName(state.headerCta.iconName) : '';
    if (iconEnabled && !iconName) {
      throw new Error('[CKHeader] state.headerCta.iconName must be a non-empty icon id');
    }
    if (iconEnabled && ALLOWED_CTA_ICONS.indexOf(iconName) === -1) {
      throw new Error(
        '[CKHeader] state.headerCta.iconName must be one of: ' + ALLOWED_CTA_ICONS.join(', '),
      );
    }
    ctaIconEl.hidden = !iconEnabled;
    ctaEl.dataset.iconPlacement = state.headerCta.iconPlacement;
    if (iconEnabled) {
      layoutEl.style.setProperty('--ck-header-cta-icon', 'url("/dieter/icons/svg/' + iconName + '.svg")');
    } else {
      layoutEl.style.setProperty('--ck-header-cta-icon', 'none');
    }

    var appearance = resolveAppearance();
    layoutEl.style.setProperty('--ck-header-cta-bg', appearance.toCssBackground(state.appearance.headerCta.background));
    layoutEl.style.setProperty('--ck-header-cta-fg', appearance.toCssColor(state.appearance.headerCta.textColor));
    layoutEl.style.setProperty('--ck-header-cta-radius', appearance.tokenizeRadius(state.appearance.headerCta.radius));
    assertObject(state.appearance.headerCta.border, 'state.appearance.headerCta.border');
    assertBoolean(state.appearance.headerCta.border.enabled, 'state.appearance.headerCta.border.enabled');
    assertNumber(state.appearance.headerCta.border.width, 'state.appearance.headerCta.border.width');
    assertString(state.appearance.headerCta.border.color, 'state.appearance.headerCta.border.color');
    if (state.appearance.headerCta.border.width < 0 || state.appearance.headerCta.border.width > 12) {
      throw new Error('[CKHeader] state.appearance.headerCta.border.width must be 0..12');
    }
    layoutEl.style.setProperty(
      '--ck-header-cta-border-width',
      state.appearance.headerCta.border.enabled === true ? String(state.appearance.headerCta.border.width) + 'px' : '0px',
    );
    layoutEl.style.setProperty(
      '--ck-header-cta-border-color',
      state.appearance.headerCta.border.enabled === true ? String(state.appearance.headerCta.border.color) : 'transparent',
    );

    assertBoolean(state.appearance.headerCta.paddingLinked, 'state.appearance.headerCta.paddingLinked');
    assertNumber(state.appearance.headerCta.paddingInline, 'state.appearance.headerCta.paddingInline');
    assertNumber(state.appearance.headerCta.paddingBlock, 'state.appearance.headerCta.paddingBlock');
    assertString(state.appearance.headerCta.iconSizePreset, 'state.appearance.headerCta.iconSizePreset');
    assertNumber(state.appearance.headerCta.iconSize, 'state.appearance.headerCta.iconSize');

    layoutEl.style.setProperty('--ck-header-cta-padding-inline', String(state.appearance.headerCta.paddingInline) + 'px');
    layoutEl.style.setProperty('--ck-header-cta-padding-block', String(state.appearance.headerCta.paddingBlock) + 'px');
    layoutEl.style.setProperty('--ck-header-cta-icon-size', String(state.appearance.headerCta.iconSize) + 'px');
  }

  window.CKHeader = window.CKHeader || {};
  window.CKHeader.applyHeader = applyHeader;
})();
