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

  function resolveContext() {
    const scriptEl = document.currentScript || window.CK_CURRENT_SCRIPT;
    if (scriptEl instanceof HTMLElement) {
      const widgetRoot = scriptEl.closest('[data-ck-widget]');
      const rootNode = scriptEl.getRootNode();
      return { widgetRoot: widgetRoot instanceof HTMLElement ? widgetRoot : null, rootNode };
    }
    return { widgetRoot: null, rootNode: document };
  }

  function resolvePublicId(widgetRoot) {
    const direct = widgetRoot.getAttribute('data-ck-public-id');
    if (typeof direct === 'string' && direct.trim()) return direct.trim();

    const rootNode = widgetRoot.getRootNode();
    if (rootNode instanceof ShadowRoot) {
      const host = rootNode.host;
      const fromHost = host instanceof HTMLElement ? host.getAttribute('data-ck-public-id') : '';
      if (typeof fromHost === 'string' && fromHost.trim()) return fromHost.trim();
    }

    const ancestor = widgetRoot.closest('[data-ck-public-id]');
    const fromAncestor = ancestor instanceof HTMLElement ? ancestor.getAttribute('data-ck-public-id') : '';
    if (typeof fromAncestor === 'string' && fromAncestor.trim()) return fromAncestor.trim();

    return '';
  }

  function resolveInitialState(publicId) {
    if (
      publicId &&
      window.CK_WIDGETS &&
      typeof window.CK_WIDGETS === 'object' &&
      window.CK_WIDGETS[publicId] &&
      typeof window.CK_WIDGETS[publicId] === 'object'
    ) {
      return window.CK_WIDGETS[publicId].state;
    }
    return window.CK_WIDGET && window.CK_WIDGET.state;
  }

  function ensureBranding(widgetRoot) {
    if (!(widgetRoot instanceof HTMLElement)) return null;
    const pod = widgetRoot.closest('.pod');
    if (!(pod instanceof HTMLElement)) return null;

    let existing = pod.querySelector(`:scope > .ck-branding[data-ck-branding-for="${widgetRoot.dataset.ckWidget}"]`);
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
    const badge = ensureBranding(widgetRoot);
    if (!badge) return;

    const show = state?.behavior?.showBacklink;
    if (typeof show !== 'boolean') {
      throw new Error('[CKBranding] state.behavior.showBacklink must be a boolean');
    }
    badge.hidden = show !== true;
  }

  function applyInitial() {
    const { widgetRoot, rootNode } = resolveContext();
    ensureStyle(rootNode);

    if (widgetRoot) {
      ensureBranding(widgetRoot);
      const publicId = resolvePublicId(widgetRoot);
      const initialState = resolveInitialState(publicId);
      if (initialState) applyVisibility(widgetRoot, initialState);
      return;
    }

    // Fallback for legacy/light-DOM documents.
    const roots = Array.from(document.querySelectorAll('[data-ck-widget]'));
    roots.forEach((root) => ensureBranding(root));
    roots.forEach((root) => {
      const publicId = resolvePublicId(root);
      const initialState = resolveInitialState(publicId);
      if (initialState) applyVisibility(root, initialState);
    });
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'ck:state-update') return;
    const { widgetRoot, rootNode } = resolveContext();
    ensureStyle(rootNode);

    const widgetname = data.widgetname;
    const state = data.state;

    if (widgetRoot) {
      if (!widgetname || widgetRoot.dataset.ckWidget === widgetname) {
        applyVisibility(widgetRoot, state);
      }
      return;
    }

    const roots = widgetname
      ? Array.from(document.querySelectorAll(`[data-ck-widget="${widgetname}"]`))
      : Array.from(document.querySelectorAll('[data-ck-widget]'));
    roots.forEach((root) => applyVisibility(root, state));
  });

  applyInitial();
})();
