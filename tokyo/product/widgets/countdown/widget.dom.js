(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function requireElement(root, selector, message) {
    const el = root.querySelector(selector);
    if (!(el instanceof HTMLElement)) throw new Error(message);
    return el;
  }

  function resolveCountdownDom(widgetRoot, runtimeContext) {
    if (!(widgetRoot instanceof HTMLElement)) {
      throw new Error('[Countdown] init requires [data-ck-widget="countdown"]');
    }
    if (widgetRoot.getAttribute('data-ck-widget') !== 'countdown') {
      throw new Error('[Countdown] init requires [data-ck-widget="countdown"]');
    }

    const countdownRoot = requireElement(widgetRoot, '[data-role="countdown"]', '[Countdown] Missing [data-role="countdown"] root');
    const timerEl = requireElement(countdownRoot, '[data-role="timer"]', '[Countdown] Missing [data-role="timer"]');
    const afterMsgEl = requireElement(countdownRoot, '[data-role="after-message"]', '[Countdown] Missing [data-role="after-message"]');
    const stageEl = widgetRoot.closest('.stage');
    if (!(stageEl instanceof HTMLElement)) throw new Error('[Countdown] Missing .stage wrapper');
    const podEl = widgetRoot.closest('.pod');
    if (!(podEl instanceof HTMLElement)) throw new Error('[Countdown] Missing .pod wrapper');

    const resolvedInstanceId =
      runtimeContext && typeof runtimeContext.instanceId === 'string'
        ? runtimeContext.instanceId
        : '';
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
