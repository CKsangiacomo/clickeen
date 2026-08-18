(function () {
  'use strict';

  function initialize(widgetShell) {
    var list = widgetShell.querySelector('[data-role="cards-list"]');
    var linkedTreatment = list.dataset.treatment === 'linked-cards';

    if (linkedTreatment) {
      list.querySelectorAll('.ck-cards__linkLabel').forEach(function (link) {
        link.removeAttribute('aria-hidden');
        link.removeAttribute('tabindex');
      });
    }

    list.addEventListener('click', function (event) {
      if (!(event.target instanceof Element) || event.target.closest('a')) return;
      var card = event.target.closest('[data-role="card"]');
      if (!card) return;
      var linked = linkedTreatment || card.dataset.linkEnabled === 'true';
      if (!linked) return;
      card.querySelector('.ck-cards__linkLabel').click();
    });
  }

  window.CKWidgetRuntime.register(initialize);
})();
