// Minimal state handler for countdown preview.
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function applyState(state) {
    if (!state || typeof state !== 'object') return;
    const heading = typeof state.heading === 'string' ? state.heading : null;
    if (heading) {
      const el = document.querySelector('.widget-placeholder');
      if (el && 'textContent' in el) {
        el.textContent = heading;
      }
    }
  }

  window.addEventListener('message', function (event) {
    const data = event.data;
    if (!data || data.type !== 'ck:state-update') return;
    if (data.widgetname !== 'countdown') return;
    applyState(data.state || {});
  });
})();
