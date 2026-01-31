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

  function tokenizeRadius(value) {
    var normalized = String(value || '').trim();
    if (!normalized || normalized === 'none') return '0';
    return 'var(--control-radius-' + normalized + ')';
  }

  function applyHeader(state, widgetRoot) {
    if (!(widgetRoot instanceof HTMLElement)) {
      throw new Error('[CKHeader] applyHeader expects widgetRoot HTMLElement');
    }

    assertObject(state, 'state');
    assertObject(state.header, 'state.header');
    assertObject(state.cta, 'state.cta');
    assertObject(state.appearance, 'state.appearance');

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

    assertBoolean(state.cta.enabled, 'state.cta.enabled');
    assertString(state.cta.label, 'state.cta.label');
    assertString(state.cta.href, 'state.cta.href');
    assertString(state.cta.style, 'state.cta.style');
    if (state.cta.style !== 'filled' && state.cta.style !== 'outline') {
      throw new Error('[CKHeader] state.cta.style must be filled|outline');
    }

    var layoutEl = widgetRoot.querySelector('.ck-headerLayout');
    if (!(layoutEl instanceof HTMLElement)) {
      throw new Error('[CKHeader] Missing .ck-headerLayout');
    }

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

    var hasCta = hasHeader && state.cta.enabled === true;
    headerEl.dataset.cta = hasCta ? 'true' : 'false';
    ctaEl.hidden = !hasCta;
    ctaEl.textContent = state.cta.label;
    ctaEl.setAttribute('data-variant', state.cta.style);

    var href = normalizeHttpUrl(state.cta.href);
    if (hasCta && href) {
      ctaEl.setAttribute('href', href);
      ctaEl.removeAttribute('aria-disabled');
      ctaEl.tabIndex = 0;
    } else {
      ctaEl.removeAttribute('href');
      ctaEl.setAttribute('aria-disabled', 'true');
      ctaEl.tabIndex = -1;
    }

    layoutEl.style.setProperty('--ck-header-cta-bg', resolveFillBackground(state.appearance.ctaBackground));
    layoutEl.style.setProperty('--ck-header-cta-fg', resolveFillColor(state.appearance.ctaTextColor));
    layoutEl.style.setProperty('--ck-header-cta-radius', tokenizeRadius(state.appearance.ctaRadius));
  }

  window.CKHeader = window.CKHeader || {};
  window.CKHeader.applyHeader = applyHeader;
})();
