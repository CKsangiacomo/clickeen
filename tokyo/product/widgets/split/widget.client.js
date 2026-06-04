(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[Split] Missing CKWidgetRuntime.register');
  }

  function sanitizeInlineHtml(html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = String(html || '');
    const allowed = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S', 'BR']);
    wrapper.querySelectorAll('*').forEach((node) => {
      const el = node;
      if (!allowed.has(el.tagName)) {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        return;
      }
      Array.from(el.attributes).forEach((attr) => el.removeAttribute(attr.name));
    });
    return wrapper.innerHTML;
  }

  function normalizeHref(value) {
    const href = String(value || '').trim();
    return /^(?:https?:\/\/|\/|#)/i.test(href) ? href : '';
  }

  function applyLink(el, config) {
    const href = normalizeHref(config.href);
    const label = String(config.label || '').trim();
    const enabled = config.enabled === true && href && label;
    el.hidden = !enabled;
    if (!enabled) {
      el.removeAttribute('href');
      el.removeAttribute('target');
      el.removeAttribute('rel');
      el.textContent = '';
      return;
    }
    el.textContent = label;
    el.setAttribute('href', href);
    if (config.openMode === 'new-tab' || config.openMode === 'new-window') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    } else {
      el.removeAttribute('target');
      el.removeAttribute('rel');
    }
  }

  function normalizeVariant(value) {
    if (value === 'visual-left' || value === 'stacked') return value;
    return 'visual-right';
  }

  function initSplit(widgetRoot, runtimeContext) {
    const state = runtimeContext.state;

    const splitRoot = widgetRoot.querySelector('[data-role="split"]');
    const headlineEl = widgetRoot.querySelector('[data-role="split-headline"]');
    const subheadlineEl = widgetRoot.querySelector('[data-role="split-subheadline"]');
    const primaryEl = widgetRoot.querySelector('[data-role="split-primary"]');
    const secondaryEl = widgetRoot.querySelector('[data-role="split-secondary"]');
    const visualEl = widgetRoot.querySelector('[data-role="split-visual"]');
    const mediaEl = widgetRoot.querySelector('[data-role="split-media"]');
    if (!(splitRoot instanceof HTMLElement)) throw new Error('[Split] Missing [data-role="split"]');
    if (!(headlineEl instanceof HTMLElement)) throw new Error('[Split] Missing [data-role="split-headline"]');
    if (!(subheadlineEl instanceof HTMLElement)) throw new Error('[Split] Missing [data-role="split-subheadline"]');
    if (!(primaryEl instanceof HTMLAnchorElement)) throw new Error('[Split] Missing [data-role="split-primary"]');
    if (!(secondaryEl instanceof HTMLAnchorElement)) throw new Error('[Split] Missing [data-role="split-secondary"]');
    if (!(visualEl instanceof HTMLElement)) throw new Error('[Split] Missing [data-role="split-visual"]');
    if (!(mediaEl instanceof HTMLElement)) throw new Error('[Split] Missing [data-role="split-media"]');

    if (!window.CKStagePod || typeof window.CKStagePod.applyStagePod !== 'function') {
      throw new Error('[Split] Missing CKStagePod.applyStagePod');
    }
    window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

    if (!window.CKTypography || typeof window.CKTypography.applyTypography !== 'function') {
      throw new Error('[Split] Missing CKTypography.applyTypography');
    }
    window.CKTypography.applyTypography(
      state.typography,
      splitRoot,
      {
        title: { varKey: 'title' },
        body: { varKey: 'body' },
        button: { varKey: 'button' },
      },
      { locale: runtimeContext && runtimeContext.locale, instanceId: runtimeContext && runtimeContext.instanceId },
    );

    splitRoot.dataset.layout = normalizeVariant(state.layout.variant);
    splitRoot.style.setProperty('--ck-split-max-width', `${state.layout.maxWidth}px`);
    splitRoot.style.setProperty('--ck-split-copy-width', `${state.layout.copyWidth}px`);
    splitRoot.style.setProperty('--ck-split-body-width', `${state.layout.bodyWidth}px`);
    splitRoot.style.setProperty('--ck-split-gap', `${state.layout.gap}px`);
    splitRoot.style.setProperty('--ck-split-copy-gap', `${state.layout.copyGap}px`);
    splitRoot.style.setProperty('--ck-split-media-height', `${state.visual.height}px`);
    splitRoot.style.setProperty('--ck-split-media-radius', state.visual.radius);

    headlineEl.innerHTML = sanitizeInlineHtml(state.headline);
    subheadlineEl.innerHTML = sanitizeInlineHtml(state.subheadline);
    subheadlineEl.hidden = !String(state.subheadline || '').trim();
    applyLink(primaryEl, state.primaryCta);
    applyLink(secondaryEl, state.secondaryCta);

    const visualEnabled = state.visual.enabled === true;
    splitRoot.dataset.visual = visualEnabled ? 'true' : 'false';
    visualEl.hidden = !visualEnabled;
    if (visualEnabled) {
      if (!window.CKFill || typeof window.CKFill.toCssBackground !== 'function') {
        throw new Error('[Split] Missing CKFill.toCssBackground');
      }
      mediaEl.style.setProperty('--ck-split-media-fill', window.CKFill.toCssBackground(state.visual.fill));
    } else {
      mediaEl.style.removeProperty('--ck-split-media-fill');
    }

    if (window.CKBranding && typeof window.CKBranding.applyBacklink === 'function') {
      window.CKBranding.applyBacklink(widgetRoot, state);
    }
  }

  runtime.register('split', initSplit);
})();
