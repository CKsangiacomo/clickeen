(function () {
  'use strict';

  function bind(widgetShell) {
    var instanceId = widgetShell.dataset.ckInstanceId;
    var root = document.querySelector(
      '.ck-locale-switcher[data-ck-locale-switcher-for="' + instanceId + '"]',
    );
    if (!root) return;

    var select = root.querySelector('.ck-locale-switcher__select');
    var previewMode = widgetShell.dataset.ckPreviewMode;
    var languages = Array.from(select.options).map(function (option) {
      return option.value;
    });
    if (!languages.length && (previewMode === 'editing' || previewMode === 'translations')) {
      var localeContext = window.CK_LOCALE_POLICY;
      if (!localeContext) throw new Error('ck.localeSwitcher.previewPolicyMissing');
      languages = localeContext.languages;
      select.replaceChildren(
        ...languages.map(function (locale) {
          var option = document.createElement('option');
          option.value = locale;
          option.textContent = locale;
          return option;
        }),
      );
    }
    if (!languages.length) throw new Error('ck.localeSwitcher.optionsMissing');
    if (languages.length <= 1) {
      root.hidden = true;
      return;
    }
    select.value = document.documentElement.lang;
    root.hidden = false;

    if (select.dataset.ckLocaleBound === 'true') return;
    select.dataset.ckLocaleBound = 'true';
    select.addEventListener('change', function () {
      var nextLocale = select.value;
      if (previewMode === 'editing') {
        select.value = document.documentElement.lang;
        window.parent.postMessage({ type: 'ck:preview-locale-switch-blocked' }, '*');
        return;
      }
      if (previewMode === 'translations') {
        select.value = document.documentElement.lang;
        window.parent.postMessage(
          { type: 'ck:preview-locale-change-request', locale: nextLocale },
          '*',
        );
        return;
      }
      var url = new URL(window.location.href);
      url.searchParams.set('locale', nextLocale);
      window.location.href = url.toString();
    });
  }

  window.CKLocaleSwitcher = Object.freeze({ bind });
})();
