(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[CTA] Missing CKWidgetRuntime.register');
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

  function initCta(widgetRoot, runtimeContext) {
    const state = runtimeContext.state;

    const ctaRoot = widgetRoot.querySelector('[data-role="cta"]');
    const titleEl = widgetRoot.querySelector('[data-role="cta-title"]');
    const bodyEl = widgetRoot.querySelector('[data-role="cta-body"]');
    const primaryEl = widgetRoot.querySelector('[data-role="cta-primary"]');
    const secondaryEl = widgetRoot.querySelector('[data-role="cta-secondary"]');
    if (!(ctaRoot instanceof HTMLElement)) throw new Error('[CTA] Missing [data-role="cta"]');
    if (!(titleEl instanceof HTMLElement)) throw new Error('[CTA] Missing [data-role="cta-title"]');
    if (!(bodyEl instanceof HTMLElement)) throw new Error('[CTA] Missing [data-role="cta-body"]');
    if (!(primaryEl instanceof HTMLAnchorElement)) throw new Error('[CTA] Missing [data-role="cta-primary"]');
    if (!(secondaryEl instanceof HTMLAnchorElement)) throw new Error('[CTA] Missing [data-role="cta-secondary"]');

    if (!window.CKStagePod || typeof window.CKStagePod.applyStagePod !== 'function') {
      throw new Error('[CTA] Missing CKStagePod.applyStagePod');
    }
    window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

    if (!window.CKTypography || typeof window.CKTypography.applyTypography !== 'function') {
      throw new Error('[CTA] Missing CKTypography.applyTypography');
    }
    window.CKTypography.applyTypography(
      state.typography,
      ctaRoot,
      {
        title: { varKey: 'title' },
        body: { varKey: 'body' },
        button: { varKey: 'button' },
      },
      { locale: runtimeContext && runtimeContext.locale, instanceId: runtimeContext && runtimeContext.instanceId },
    );

    ctaRoot.style.setProperty('--ck-cta-max-width', `${state.layout.maxWidth}px`);
    ctaRoot.style.setProperty('--ck-cta-body-width', `${state.layout.bodyWidth}px`);
    ctaRoot.style.setProperty('--ck-cta-gap', `${state.layout.gap}px`);

    titleEl.innerHTML = sanitizeInlineHtml(state.title);
    bodyEl.innerHTML = sanitizeInlineHtml(state.body);
    bodyEl.hidden = !String(state.body || '').trim();
    applyLink(primaryEl, state.primaryCta);
    applyLink(secondaryEl, state.secondaryCta);

    if (window.CKBranding && typeof window.CKBranding.applyBacklink === 'function') {
      window.CKBranding.applyBacklink(widgetRoot, state);
    }
  }

  runtime.register('cta', initCta);
})();
