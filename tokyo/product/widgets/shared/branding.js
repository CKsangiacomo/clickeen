(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const STYLE_ID = 'ck-branding-style';

  function resolveCspNonce() {
    const direct = window.CK_CSP_NONCE;
    if (typeof direct === 'string' && direct) return direct;

    const meta = document.querySelector('meta[name="ck-csp-nonce"]');
    const metaNonce = meta instanceof HTMLMetaElement ? meta.content : '';
    if (metaNonce) return metaNonce;

    const nonceEl = document.querySelector('script[nonce],style[nonce]');
    const attr = nonceEl instanceof HTMLElement ? nonceEl.getAttribute('nonce') || '' : '';
    return attr;
  }

  function ensureStyle(scope) {
    if (!scope) return;
    const existing =
      scope instanceof ShadowRoot
        ? scope.querySelector(`#${STYLE_ID}`)
        : document.getElementById(STYLE_ID);
    if (existing) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    const nonce = resolveCspNonce();
    if (nonce) {
      style.setAttribute('nonce', nonce);
      style.nonce = nonce;
    }
    style.textContent = `
      .ck-branding {
        position: absolute;
        z-index: 50;
        pointer-events: none;
        display: flex;
        transform: translate(var(--ck-branding-tx, 0), var(--ck-branding-ty, 0));
      }
      .ck-branding[hidden] {
        display: none !important;
      }

      .ck-branding[data-ck-align="right"] {
        inset-inline-end: var(--ck-branding-inset, var(--space-6));
        --ck-branding-tx: 0;
      }
      .ck-branding[data-ck-align="center"] {
        inset-inline-start: 50%;
        --ck-branding-tx: -50%;
      }

      .ck-branding[data-ck-anchor="outside"] {
        inset-block-start: 100%;
        margin-top: var(--ck-branding-gap, 0px);
      }
      .ck-branding[data-ck-anchor="inside"] {
        inset-block-end: var(--ck-branding-inset-bottom, var(--space-0));
        margin-bottom: var(--ck-branding-gap, 0px);
      }

      .ck-branding__link {
        pointer-events: auto;
        display: inline-flex;
        align-items: center;
        gap: var(--control-inline-gap-sm, var(--space-1));
        padding-block: var(--space-0);
        padding-inline: var(--space-2);
        border-radius: var(--control-radius-sm, 0.25rem);
        border: none;
        background: color-mix(in oklab, var(--color-system-white), transparent 15%);
        box-shadow: none;
        font: 500 var(--fs-12, 12px) / var(--lh-tight, 1.2) var(--font-ui, ui-sans-serif);
        color: var(--color-text);
        text-decoration: none;
        -webkit-font-smoothing: antialiased;
        white-space: nowrap;
      }
      .ck-branding__link:hover {
        text-decoration: underline;
      }
    `;
    if (scope instanceof ShadowRoot) {
      scope.appendChild(style);
      return;
    }
    document.head.appendChild(style);
  }

  function resolveConfig(widgetRoot) {
    const globalCfg = window.CK_BRANDING && typeof window.CK_BRANDING === 'object' ? window.CK_BRANDING : {};
    const alignRaw = widgetRoot.getAttribute('data-ck-branding-align') || globalCfg.align;
    const anchorRaw = widgetRoot.getAttribute('data-ck-branding-anchor') || globalCfg.anchor;

    const align = alignRaw === 'center' ? 'center' : 'right';
    const anchor = anchorRaw === 'outside' ? 'outside' : 'inside';
    return { align, anchor };
  }

  function resolveRuntimeContext(widgetRoot) {
    const runtime = window.CKWidgetRuntime;
    if (!runtime || typeof runtime.contextFor !== 'function') {
      throw new Error('[CKBranding] Missing CKWidgetRuntime.contextFor');
    }
    const widgetType = widgetRoot.getAttribute('data-ck-widget') || '';
    return runtime.contextFor(widgetRoot, widgetType);
  }

  function findBranding(widgetRoot) {
    if (!(widgetRoot instanceof HTMLElement)) return null;
    const pod = widgetRoot.closest('.pod');
    if (!(pod instanceof HTMLElement)) return null;
    const existing = pod.querySelector(`:scope > .ck-branding[data-ck-branding-for="${widgetRoot.dataset.ckWidget}"]`);
    return existing instanceof HTMLElement ? existing : null;
  }

  function removeBranding(widgetRoot) {
    const badge = findBranding(widgetRoot);
    if (badge) badge.remove();
  }

  function ensureBranding(widgetRoot) {
    if (!(widgetRoot instanceof HTMLElement)) return null;
    const pod = widgetRoot.closest('.pod');
    if (!(pod instanceof HTMLElement)) return null;

    const existing = findBranding(widgetRoot);
    if (existing instanceof HTMLElement) return existing;

    pod.style.position = 'relative';

    const cfg = resolveConfig(widgetRoot);

    const badge = document.createElement('div');
    badge.className = 'ck-branding';
    badge.setAttribute('data-ck-branding-for', widgetRoot.dataset.ckWidget || '');
    badge.setAttribute('data-ck-align', cfg.align);
    badge.setAttribute('data-ck-anchor', cfg.anchor);

    const link = document.createElement('a');
    link.className = 'ck-branding__link';
    link.href = 'https://clickeen.com';
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'Made with Clickeen';
    badge.appendChild(link);

    pod.appendChild(badge);
    return badge;
  }

  function applyVisibility(widgetRoot, state) {
    const show = state?.behavior?.showBacklink;
    if (show == null) {
      const badge = ensureBranding(widgetRoot);
      if (!badge) return;
      badge.hidden = false;
      return;
    }
    if (typeof show !== 'boolean') {
      throw new Error('[CKBranding] state.behavior.showBacklink must be a boolean');
    }
    if (!show) {
      removeBranding(widgetRoot);
      return;
    }
    const badge = ensureBranding(widgetRoot);
    if (badge) badge.hidden = false;
  }

  function applyBacklink(widgetRoot, state) {
    ensureStyle(document);
    applyVisibility(widgetRoot, state);
  }

  function applyInitial() {
    ensureStyle(document);
    const roots = Array.from(document.querySelectorAll('[data-ck-widget]'));
    roots.forEach((root) => ensureBranding(root));
    roots.forEach((root) => {
      const context = resolveRuntimeContext(root);
      if (context.state) applyVisibility(root, context.state);
    });
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'ck:state-update') return;
    ensureStyle(document);

    const widgetname = data.widgetname;
    const state = data.state;

    const roots = widgetname
      ? Array.from(document.querySelectorAll(`[data-ck-widget="${widgetname}"]`))
      : Array.from(document.querySelectorAll('[data-ck-widget]'));
    roots.forEach((root) => applyVisibility(root, state));
  });

  window.CKBranding = Object.assign({}, window.CKBranding || {}, {
    applyBacklink,
  });

  applyInitial();
})();
