(function () {
  'use strict';

  function resolveGeneratedSupportReferences(documentFragment, publicUrl) {
    documentFragment.querySelectorAll('[href="./styles.css"]').forEach(function (element) {
      element.setAttribute('href', new URL(element.getAttribute('href'), publicUrl).toString());
    });
    documentFragment.querySelectorAll('[src="./runtime.js"]').forEach(function (element) {
      element.setAttribute('src', new URL(element.getAttribute('src'), publicUrl).toString());
    });
  }

  function attachSemanticJson(sources, publicUrl) {
    sources.forEach(function (source, index) {
      var alreadyAttached = Array.from(
        document.head.querySelectorAll('script[data-clickeen-source][data-clickeen-schema-index]'),
      ).some(function (script) {
        return script.dataset.clickeenSource === publicUrl &&
          script.dataset.clickeenSchemaIndex === String(index);
      });
      if (alreadyAttached) return;
      var script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.clickeenSource = publicUrl;
      script.dataset.clickeenSchemaIndex = String(index);
      script.textContent = source;
      document.head.appendChild(script);
    });
  }

  function setShadowHtml(shadowRoot, html) {
    if (typeof shadowRoot.setHTMLUnsafe === 'function') {
      shadowRoot.setHTMLUnsafe(html);
      return;
    }
    shadowRoot.innerHTML = html;
  }

  async function mount(installer) {
    if (installer.dataset.clickeenMounted === 'true') return;
    installer.dataset.clickeenMounted = 'true';

    var publicUrl = String(installer.dataset.clickeen || '').trim();
    if (!publicUrl) throw new Error('[Clickeen] Missing data-clickeen URL');

    var response = await fetch(publicUrl, { credentials: 'omit' });
    if (!response.ok) throw new Error('[Clickeen] Public product request failed');

    var completedPublicUrl = response.url;
    var sourceDocument = new DOMParser().parseFromString(await response.text(), 'text/html');
    if (!sourceDocument.body) throw new Error('[Clickeen] Public product HTML is invalid');

    resolveGeneratedSupportReferences(sourceDocument, completedPublicUrl);
    var semanticJson = Array.from(sourceDocument.querySelectorAll('script[type="application/ld+json"]'))
      .map(function (source) { return source.textContent || ''; });
    var runtimeElement = Array.from(sourceDocument.querySelectorAll('script[src]'))
      .find(function (script) { return /\/runtime\.js(?:$|[?#])/.test(script.getAttribute('src') || ''); });
    var runtimeUrl = runtimeElement
      ? new URL(runtimeElement.getAttribute('src'), completedPublicUrl).toString()
      : '';
    var stylesheetElement = sourceDocument.querySelector('link[rel="stylesheet"][href]');
    if (!stylesheetElement) throw new Error('[Clickeen] Public product stylesheet is missing');
    var stylesheetUrl = new URL(stylesheetElement.getAttribute('href'), completedPublicUrl).toString();
    sourceDocument.querySelectorAll('script').forEach(function (script) { script.remove(); });

    var host = document.createElement('div');
    host.dataset.clickeenProduct = completedPublicUrl;
    var shadowRoot = host.attachShadow({ mode: 'open' });
    setShadowHtml(
      shadowRoot,
      '<link rel="stylesheet" href="' + stylesheetUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '">' +
        sourceDocument.body.innerHTML,
    );
    installer.before(host);
    attachSemanticJson(semanticJson, completedPublicUrl);

    if (runtimeUrl) {
      var runtime = document.createElement('script');
      runtime.src = runtimeUrl;
      runtime.defer = true;
      runtime.dataset.clickeenRuntime = completedPublicUrl;
      document.head.appendChild(runtime);
    }
  }

  document.querySelectorAll('script[data-clickeen]').forEach(function (installer) {
    mount(installer).catch(function (error) {
      installer.dataset.clickeenMounted = 'false';
      console.error(error);
    });
  });
})();
