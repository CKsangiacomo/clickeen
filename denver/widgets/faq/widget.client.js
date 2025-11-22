// FAQ widget client-side behavior
// Expand/collapse + live title updates from Bob editing state.

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function wireAccordion() {
    const buttons = document.querySelectorAll('.ck-faq__q');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const current = button.getAttribute('aria-expanded') === 'true';
        const next = !current;
        button.setAttribute('aria-expanded', String(next));
        const answer = button.nextElementSibling;
        if (answer && answer.classList.contains('ck-faq__a')) {
          answer.style.display = next ? 'block' : 'none';
        }
      });
    });
  }

  function applyState(state) {
    if (!state || typeof state !== 'object') return;
    const title = typeof state.title === 'string' ? state.title : null;
    const showTitle = state.showTitle !== false; // default true
    const header = document.querySelector('.ck-faq__header');
    if (title) {
      const el = document.querySelector('.ck-faq__title');
      if (el && 'textContent' in el) {
        el.textContent = title;
      }
    }
    if (header instanceof HTMLElement) {
      header.style.display = showTitle ? '' : 'none';
    }
  }

  window.addEventListener('message', function (event) {
    const data = event.data;
    if (!data || data.type !== 'ck:state-update') return;
    if (data.widgetname !== 'faq') return;
    applyState(data.state || {});
  });

  wireAccordion();
})(); 
