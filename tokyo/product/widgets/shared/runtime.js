(function () {
  'use strict';

  var registeredInitializer;

  function shells() {
    return document.querySelectorAll('.ck-headerLayout[data-ck-widget]');
  }

  function register(initialize) {
    var initializer = function (widgetShell) {
      if (widgetShell.getAttribute('data-ck-widget-runtime-bound') === 'true') return;
      widgetShell.setAttribute('data-ck-widget-runtime-bound', 'true');
      window.CKHeader.bind(widgetShell);
      window.CKLocaleSwitcher.bind(widgetShell);
      window.CKStagePod.bind(widgetShell);
      window.CKSocialShare.bind(widgetShell);
      initialize(widgetShell);
    };

    registeredInitializer = initializer;
    shells().forEach(initializer);
  }

  function initialize(widgetShell) {
    registeredInitializer(widgetShell);
  }

  window.CKWidgetRuntime = Object.freeze({ register, initialize, shells });
})();
