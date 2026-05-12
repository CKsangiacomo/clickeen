(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function requireElement(root, selector, message) {
    const el = root.querySelector(selector);
    if (!(el instanceof HTMLElement)) throw new Error(message);
    return el;
  }

  function resolveInstanceId(widgetRoot) {
    const direct = widgetRoot.getAttribute('data-ck-instance-id');
    if (typeof direct === 'string' && direct.trim()) return direct.trim();

    const rootNode = widgetRoot.getRootNode();
    if (rootNode instanceof ShadowRoot) {
      const host = rootNode.host;
      const fromHost = host instanceof HTMLElement ? host.getAttribute('data-ck-instance-id') : '';
      if (typeof fromHost === 'string' && fromHost.trim()) return fromHost.trim();
    }

    const ancestor = widgetRoot.closest('[data-ck-instance-id]');
    const fromAncestor = ancestor instanceof HTMLElement ? ancestor.getAttribute('data-ck-instance-id') : '';
    if (typeof fromAncestor === 'string' && fromAncestor.trim()) return fromAncestor.trim();

    const global = window.CK_WIDGET && typeof window.CK_WIDGET === 'object' ? window.CK_WIDGET : null;
    const candidate = global && typeof global.instanceId === 'string' ? global.instanceId.trim() : '';
    return candidate || '';
  }

  function resolveCountdownDom() {
    const scriptEl = document.currentScript || window.CK_CURRENT_SCRIPT;
    if (!(scriptEl instanceof HTMLElement)) return null;

    const widgetRoot = scriptEl.closest('[data-ck-widget="countdown"]');
    if (!(widgetRoot instanceof HTMLElement)) {
      throw new Error('[Countdown] widget.client.js must be rendered inside [data-ck-widget="countdown"]');
    }

    const countdownRoot = requireElement(widgetRoot, '[data-role="countdown"]', '[Countdown] Missing [data-role="countdown"] root');
    const timerEl = requireElement(countdownRoot, '[data-role="timer"]', '[Countdown] Missing [data-role="timer"]');
    const afterMsgEl = requireElement(countdownRoot, '[data-role="after-message"]', '[Countdown] Missing [data-role="after-message"]');
    const stageEl = widgetRoot.closest('.stage');
    if (!(stageEl instanceof HTMLElement)) throw new Error('[Countdown] Missing .stage wrapper');
    const podEl = widgetRoot.closest('.pod');
    if (!(podEl instanceof HTMLElement)) throw new Error('[Countdown] Missing .pod wrapper');

    const resolvedInstanceId = resolveInstanceId(widgetRoot);
    if (resolvedInstanceId) widgetRoot.setAttribute('data-ck-instance-id', resolvedInstanceId);

    return {
      widgetRoot,
      countdownRoot,
      timerEl,
      numberDisplayEl: requireElement(timerEl, '[data-role="number-display"]', '[Countdown] Missing [data-role="number-display"]'),
      numberValueEl: requireElement(timerEl, '[data-role="number-value"]', '[Countdown] Missing [data-role="number-value"]'),
      unitsDisplayEl: requireElement(timerEl, '[data-role="units-display"]', '[Countdown] Missing [data-role="units-display"]'),
      ctaEl: requireElement(countdownRoot, '[data-role="cta"]', '[Countdown] Missing [data-role="cta"]'),
      afterMsgEl,
      afterLinkEl: requireElement(afterMsgEl, '[data-role="after-link"]', '[Countdown] Missing [data-role="after-link"]'),
      stageEl,
      podEl,
      resolvedInstanceId,
    };
  }

  window.CK_COUNTDOWN_DOM = Object.freeze({ resolve: resolveCountdownDom });
})();
