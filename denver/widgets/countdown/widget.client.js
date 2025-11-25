// Minimal state handler for countdown preview.
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function applyState(state) {
    if (!state || typeof state !== 'object') return;
    const heading = typeof state.heading === 'string' ? state.heading : null;
    const stageBg = state.stage && typeof state.stage.background === 'string' ? state.stage.background : null;
    const podBg = state.pod && typeof state.pod.background === 'string' ? state.pod.background : null;

    const body = document.body;
    if (body && stageBg) {
      body.style.background = stageBg;
    }

    const el = document.querySelector('.widget-placeholder');
    if (el && 'textContent' in el && heading) {
      el.textContent = heading;
    }
    if (el instanceof HTMLElement && podBg) {
      el.style.background = podBg;
    }
  }

  window.addEventListener('message', function (event) {
    const data = event.data;
    if (!data || data.type !== 'ck:state-update') return;
    if (data.widgetname !== 'countdown') return;
    applyState(data.state || {});
  });
})();
