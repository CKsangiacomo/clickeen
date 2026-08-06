(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function normalizeWidgetType(widgetType) {
    return String(widgetType || '').trim();
  }

  function assertWidgetRoot(widgetRoot, widgetType) {
    if (!(widgetRoot instanceof HTMLElement)) {
      throw new Error('[CKWidgetRuntime] widget root must be an HTMLElement');
    }
    if (widgetRoot.getAttribute('data-ck-widget') !== widgetType) {
      throw new Error(`[CKWidgetRuntime] expected [data-ck-widget="${widgetType}"]`);
    }
  }

  function bindingAttr(widgetType) {
    return `data-ck-${widgetType.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}-runtime-bound`;
  }

  function roots(widgetType) {
    const selector = `[data-ck-widget="${widgetType}"]`;
    const found = [];
    const visited = new Set();

    function collect(scope) {
      if (visited.has(scope)) return;
      visited.add(scope);
      scope.querySelectorAll(selector).forEach((root) => {
        if (root instanceof HTMLElement) found.push(root);
      });
      scope.querySelectorAll('*').forEach((element) => {
        if (element instanceof HTMLElement && element.shadowRoot) collect(element.shadowRoot);
      });
    }

    collect(document);
    return found;
  }

  function resolveInstanceId(widgetRoot) {
    if (!(widgetRoot instanceof HTMLElement)) return '';

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

    return '';
  }

  function contextFor(widgetRoot, widgetType) {
    assertWidgetRoot(widgetRoot, widgetType);
    const instanceId = resolveInstanceId(widgetRoot);
    if (instanceId) widgetRoot.setAttribute('data-ck-instance-id', instanceId);
    return {
      widgetRoot,
      instanceId,
      locale: document.documentElement.lang || '',
    };
  }

  function register(widgetType, init) {
    const normalized = normalizeWidgetType(widgetType);
    if (!normalized) throw new Error('[CKWidgetRuntime] widget type is required');
    if (typeof init !== 'function') throw new Error('[CKWidgetRuntime] init must be a function');

    const attr = bindingAttr(normalized);
    const initializer = function (widgetRoot) {
      assertWidgetRoot(widgetRoot, normalized);
      if (widgetRoot.getAttribute(attr) === 'true') return null;
      widgetRoot.setAttribute(attr, 'true');
      return init(widgetRoot, contextFor(widgetRoot, normalized));
    };

    window.CK_WIDGET_INITIALIZERS = Object.assign({}, window.CK_WIDGET_INITIALIZERS || {});
    window.CK_WIDGET_INITIALIZERS[normalized] = initializer;
    roots(normalized).forEach((root) => initializer(root));
    return initializer;
  }

  function matchingEventElement(event, selector) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const item of path) {
      if (item instanceof Element) {
        const match = item.closest(selector);
        if (match) return match;
      }
    }
    return event.target instanceof Element ? event.target.closest(selector) : null;
  }

  function isEditorPreview() {
    if (window.parent === window) return false;
    try { return window.parent.location.origin === window.location.origin; } catch (_error) { return false; }
  }

  function showPreviewOnly(target) {
    const root = target.closest('[data-ck-social-share-root]');
    const toast = root && root.querySelector('.ck-socialShare__toast');
    if (!(toast instanceof HTMLElement)) return;
    toast.textContent = 'Preview only';
    toast.style.display = 'block';
    window.setTimeout(() => { toast.style.display = 'none'; toast.textContent = ''; }, 1600);
  }

  function bindStaticInteractions() {
    if (document.documentElement.getAttribute('data-ck-static-runtime-bound') === 'true') return;
    document.documentElement.setAttribute('data-ck-static-runtime-bound', 'true');
    async function copyText(value) {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(value);
        return;
      }
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      if (!copied) throw new Error('[CKWidgetRuntime] clipboard write failed');
    }

    function openUrl(url) {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) throw new Error('[CKWidgetRuntime] share window was blocked');
      opened.opener = null;
    }

    document.addEventListener('click', async (event) => {
      const target = matchingEventElement(event, '[data-role="header-cta"], [data-ck-social-share-root] [data-action]');
      if (!(target instanceof HTMLElement)) return;
      if (target.matches('[data-role="header-cta"]') && isEditorPreview()) {
        event.preventDefault();
        return;
      }
      if (target.matches('[data-open-mode="new-window"]')) {
        const href = target.getAttribute('href');
        if (!href) return;
        event.preventDefault();
        if (isEditorPreview()) return;
        const popup = window.open(href, '_blank', 'noopener,noreferrer,popup=yes,width=1024,height=720');
        if (popup) popup.opener = null;
        return;
      }
      const action = target.getAttribute('data-action') || '';
      if (!action) return;
      event.preventDefault();
      const details = target.closest('details');
      if (details instanceof HTMLDetailsElement) details.removeAttribute('open');
      if (isEditorPreview()) { showPreviewOnly(target); return; }
      const shareUrl = new URL(window.location.href);
      shareUrl.searchParams.set('ref', 'share');
      shareUrl.searchParams.set('channel', action);
      const url = shareUrl.toString();
      const messageText = 'Check out this widget from Clickeen!';
      const socialText = `This Clickeen ${document.title || 'widget'} widget is awesome`;
      const message = `${messageText}\n${url}`;
      if (action === 'copy') return copyText(url);
      if (action === 'email') { window.location.href = `mailto:?subject=${encodeURIComponent(document.title)}&body=${encodeURIComponent(message)}`; return; }
      if (action === 'sms') { window.location.href = `sms:?&body=${encodeURIComponent(message)}`; return; }
      const intents = {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(messageText)}`,
        x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(socialText)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(socialText)}`,
      };
      if (intents[action]) { openUrl(intents[action]); return; }
      const pasteDestinations = {
        linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url),
        signal: 'https://signal.me/', messenger: 'https://www.messenger.com/', line: 'https://line.me/',
        slack: 'https://slack.com/app', teams: 'https://teams.microsoft.com/', discord: 'https://discord.com/channels/@me',
        instagram: 'https://www.instagram.com/', tiktok: 'https://www.tiktok.com/',
      };
      if (action === 'wechat') { await copyText(url); return; }
      if (action === 'linkedin') { await copyText(`${socialText}\n\n${url}`); openUrl(pasteDestinations[action]); return; }
      if (pasteDestinations[action]) {
        await copyText(action === 'instagram' || action === 'tiktok' ? `${socialText}\n\n${url}` : url);
        openUrl(pasteDestinations[action]);
        return;
      }
      throw new Error(`[CKWidgetRuntime] unsupported social action: ${action}`);
    });
    document.addEventListener('change', (event) => {
      const select = matchingEventElement(event, '.ck-locale-switcher__select');
      if (!(select instanceof HTMLSelectElement)) return;
      const nextLocale = select.value.trim();
      const currentLocale = select.getAttribute('data-current-locale') || '';
      if (!nextLocale || nextLocale === currentLocale) return;
      const previewMode = document.documentElement.getAttribute('data-ck-preview-mode') || '';
      if (previewMode === 'editing' || previewMode === 'translations') {
        select.value = currentLocale;
        window.parent.postMessage(
          previewMode === 'editing'
            ? { type: 'ck:preview-locale-switch-blocked' }
            : { type: 'ck:preview-locale-change-request', locale: nextLocale },
          '*',
        );
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set('locale', nextLocale);
      window.location.assign(url.toString());
    });
    if (window.parent !== window) {
      const postSize = () => window.parent.postMessage({ type: 'ck:resize', height: Math.ceil(document.documentElement.scrollHeight) }, '*');
      window.parent.postMessage({ type: 'ck:ready' }, '*');
      postSize();
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(postSize).observe(document.documentElement);
    }
  }

  bindStaticInteractions();

  window.CKWidgetRuntime = Object.freeze({
    assertWidgetRoot,
    contextFor,
    register,
    resolveInstanceId,
    roots,
  });
})();
