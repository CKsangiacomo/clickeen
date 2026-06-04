(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[Hero] Missing CKWidgetRuntime.register');
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

  function initHero(widgetRoot, runtimeContext) {
    const state = runtimeContext.state;

    const heroRoot = widgetRoot.querySelector('[data-role="hero"]');
    const eyebrowEl = widgetRoot.querySelector('[data-role="hero-eyebrow"]');
    const headlineEl = widgetRoot.querySelector('[data-role="hero-headline"]');
    const subheadlineEl = widgetRoot.querySelector('[data-role="hero-subheadline"]');
    const primaryEl = widgetRoot.querySelector('[data-role="hero-primary"]');
    const secondaryEl = widgetRoot.querySelector('[data-role="hero-secondary"]');
    const visualEl = widgetRoot.querySelector('[data-role="hero-visual"]');
    const mediaEl = widgetRoot.querySelector('[data-role="hero-media"]');
    if (!(heroRoot instanceof HTMLElement)) throw new Error('[Hero] Missing [data-role="hero"]');
    if (!(eyebrowEl instanceof HTMLElement)) throw new Error('[Hero] Missing [data-role="hero-eyebrow"]');
    if (!(headlineEl instanceof HTMLElement)) throw new Error('[Hero] Missing [data-role="hero-headline"]');
    if (!(subheadlineEl instanceof HTMLElement)) throw new Error('[Hero] Missing [data-role="hero-subheadline"]');
    if (!(primaryEl instanceof HTMLAnchorElement)) throw new Error('[Hero] Missing [data-role="hero-primary"]');
    if (!(secondaryEl instanceof HTMLAnchorElement)) throw new Error('[Hero] Missing [data-role="hero-secondary"]');
    if (!(visualEl instanceof HTMLElement)) throw new Error('[Hero] Missing [data-role="hero-visual"]');
    if (!(mediaEl instanceof HTMLElement)) throw new Error('[Hero] Missing [data-role="hero-media"]');

    if (!window.CKStagePod || typeof window.CKStagePod.applyStagePod !== 'function') {
      throw new Error('[Hero] Missing CKStagePod.applyStagePod');
    }
    window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

    if (!window.CKTypography || typeof window.CKTypography.applyTypography !== 'function') {
      throw new Error('[Hero] Missing CKTypography.applyTypography');
    }
    window.CKTypography.applyTypography(
      state.typography,
      heroRoot,
      {
        eyebrow: { varKey: 'eyebrow' },
        title: { varKey: 'title' },
        body: { varKey: 'body' },
        button: { varKey: 'button' },
      },
      { locale: runtimeContext && runtimeContext.locale, instanceId: runtimeContext && runtimeContext.instanceId },
    );

    const alignment = state.layout.alignment === 'center' ? 'center' : 'left';
    heroRoot.dataset.align = alignment;
    heroRoot.style.setProperty('--ck-hero-align', alignment);
    heroRoot.style.setProperty('--ck-hero-max-width', `${state.layout.maxWidth}px`);
    heroRoot.style.setProperty('--ck-hero-copy-width', `${state.layout.copyWidth}px`);
    heroRoot.style.setProperty('--ck-hero-body-width', `${state.layout.bodyWidth}px`);
    heroRoot.style.setProperty('--ck-hero-gap', `${state.layout.gap}px`);
    heroRoot.style.setProperty('--ck-hero-copy-gap', `${state.layout.copyGap}px`);
    heroRoot.style.setProperty('--ck-hero-media-height', `${state.visual.height}px`);
    heroRoot.style.setProperty('--ck-hero-media-radius', state.visual.radius);

    eyebrowEl.innerHTML = sanitizeInlineHtml(state.eyebrow);
    eyebrowEl.hidden = !String(state.eyebrow || '').trim();
    headlineEl.innerHTML = sanitizeInlineHtml(state.headline);
    subheadlineEl.innerHTML = sanitizeInlineHtml(state.subheadline);
    subheadlineEl.hidden = !String(state.subheadline || '').trim();
    applyLink(primaryEl, state.primaryCta);
    applyLink(secondaryEl, state.secondaryCta);

    const visualEnabled = state.visual.enabled === true;
    heroRoot.dataset.visual = visualEnabled ? 'true' : 'false';
    visualEl.hidden = !visualEnabled;
    if (visualEnabled) {
      if (!window.CKFill || typeof window.CKFill.toCssBackground !== 'function') {
        throw new Error('[Hero] Missing CKFill.toCssBackground');
      }
      mediaEl.style.setProperty('--ck-hero-media-fill', window.CKFill.toCssBackground(state.visual.fill));
    } else {
      mediaEl.style.removeProperty('--ck-hero-media-fill');
    }

    if (window.CKBranding && typeof window.CKBranding.applyBacklink === 'function') {
      window.CKBranding.applyBacklink(widgetRoot, state);
    }
  }

  runtime.register('hero', initHero);
})();
