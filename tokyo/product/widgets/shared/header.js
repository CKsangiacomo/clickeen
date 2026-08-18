(function () {
  'use strict';

  function bind(widgetShell) {
    var cta = widgetShell.querySelector('[data-role="header-cta"][data-open-mode="new-window"]');
    if (!cta || cta.dataset.ckNewWindowBound === 'true') return;
    cta.dataset.ckNewWindowBound = 'true';
    cta.addEventListener('click', function (event) {
      event.preventDefault();
      var popup = window.open(
        cta.href,
        '_blank',
        'noopener,noreferrer,popup=yes,width=1024,height=720',
      );
      if (popup) popup.opener = null;
    });
  }

  window.CKHeader = Object.freeze({ bind });
})();
