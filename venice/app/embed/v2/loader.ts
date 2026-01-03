const script = `(() => {
  const scriptEl = document.currentScript;
  if (!scriptEl) return;

  const {
    publicId,
    trigger = 'immediate',
    delay = '0',
    scrollPct,
    clickSelector,
    theme = 'light',
    device = 'desktop',
    forceShadow = 'false',
  } = scriptEl.dataset;

  if (!publicId) {
    console.warn('[Clickeen] Missing data-public-id');
    return;
  }

  const origin = new URL(scriptEl.src, window.location.href).origin;
  const locale = (navigator.language || 'en').split('-')[0] || 'en';

  // Minimal event bus with buffering
  const bus = { listeners: {}, queue: [], ready: false };
  bus.publish = function(event, payload) {
    if (!this.ready) { this.queue.push({ event, payload }); return; }
    (this.listeners[event] || []).forEach((fn) => fn(payload));
  };
  bus.subscribe = function(event, handler) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(handler);
    return () => { this.listeners[event] = (this.listeners[event] || []).filter((fn) => fn !== handler); };
  };

  window.ckeenBus = window.ckeenBus || bus;
  window.Clickeen = window.Clickeen || window.ckeenBus;

  const makeUrl = (path, params = {}) => {
    const url = new URL(origin + path);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
    return url.toString();
  };

  const embedUrl = (path, params = {}) => makeUrl(path, { theme, device, ...params });
  const assetUrl = (path) => makeUrl(path);

  function setReadyOnce() {
    if (bus.ready) return;
    bus.ready = true;
    const q = bus.queue.slice();
    bus.queue.length = 0;
    q.forEach(({ event, payload }) => bus.publish(event, payload));
    bus.publish('ready');
  }

  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.maxWidth = '640px';
  let overlayEl = null;

  function injectInline() {
    if (scriptEl.parentNode) {
      scriptEl.parentNode.insertBefore(container, scriptEl);
    }
  }

  function injectOverlay() {
    if (document.body.contains(container)) return;
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(15, 23, 42, 0.48)';
    overlay.style.backdropFilter = 'blur(2px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '24px';
    overlay.style.zIndex = '2147483647';
    overlay.addEventListener('click', (evt) => {
      if (evt.target === overlay) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        overlayEl = null;
        bus.publish('close');
      }
    });
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    overlayEl = overlay;
    bus.publish('open');
  }

  function triggerInjection() {
    if (trigger === 'overlay') injectOverlay();
    else injectInline();
  }

  function scheduleInjection() {
    switch (trigger) {
      case 'time': {
        const ms = Number(delay) || 0;
        setTimeout(triggerInjection, ms);
        break;
      }
      case 'scroll': {
        const threshold = Math.max(0, Math.min(100, Number(scrollPct) || 50));
        const handler = () => {
          const scrolled = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
          if (scrolled >= threshold) {
            triggerInjection();
            window.removeEventListener('scroll', handler);
          }
        };
        window.addEventListener('scroll', handler, { passive: true });
        handler();
        break;
      }
      case 'click': {
        if (!clickSelector) {
          console.warn('[Clickeen] data-click-selector required for click trigger');
          return;
        }
        const triggerEl = document.querySelector(clickSelector);
        if (!triggerEl) {
          console.warn('[Clickeen] click selector not found:', clickSelector);
          return;
        }
        triggerEl.addEventListener('click', (evt) => {
          evt.preventDefault();
          triggerInjection();
        });
        break;
      }
      case 'overlay':
        triggerInjection();
        break;
      default:
        injectInline();
    }
  }

  function mountIframe() {
    const iframe = document.createElement('iframe');
    iframe.src = embedUrl('/e/' + encodeURIComponent(publicId), { ts: Date.now() });
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('title', 'Clickeen widget');
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.maxWidth = '640px';
    iframe.style.minHeight = '420px';

    container.replaceChildren(iframe);
    iframe.addEventListener('load', () => setReadyOnce());
  }

  function upsertSchema(schemaJsonLd) {
    if (!schemaJsonLd) return;
    const id = 'ck-schema-' + publicId;
    let script = document.getElementById(id);
    if (!(script instanceof HTMLScriptElement)) {
      script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = schemaJsonLd;
  }

  function ensureWidgetGlobals(payload) {
    window.CK_WIDGETS = window.CK_WIDGETS || {};
    window.CK_WIDGETS[publicId] = payload;
    window.CK_WIDGET = payload; // legacy single-widget accessor
  }

  function loadShadowScript(shadowRoot, src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load script ' + src));
      shadowRoot.appendChild(script);
    });
  }

  function loadShadowStyle(shadowRoot, href) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error('Failed to load style ' + href));
      shadowRoot.appendChild(link);
    });
  }

  function activateDeepLink(shadowRoot, state) {
    if (!state || !state.geo || state.geo.enableDeepLinks !== true) return;
    const hash = window.location.hash || '';
    const targetId = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!targetId) return;

    const el = shadowRoot.getElementById ? shadowRoot.getElementById(targetId) : shadowRoot.querySelector('#' + CSS.escape(targetId));
    if (!el) return;
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
    const btn = el.querySelector && el.querySelector('[data-role="faq-question"]');
    if (btn && btn.getAttribute('aria-expanded') !== 'true') {
      btn.click();
    }
  }

  async function mountShadow(renderPayload) {
    const shadow = container.attachShadow({ mode: 'open' });
    container.setAttribute('data-ck-public-id', publicId);

    const styles = (renderPayload && renderPayload.assets && renderPayload.assets.styles) || [];
    const scripts = (renderPayload && renderPayload.assets && renderPayload.assets.scripts) || [];
    const renderHtml = (renderPayload && renderPayload.renderHtml) || '';

    // Render structure first (no scripts in renderHtml by contract)
    const template = document.createElement('template');
    template.innerHTML = renderHtml;
    shadow.appendChild(template.content.cloneNode(true));

    // Load styles first so initial paint is correct
    for (const href of styles) {
      await loadShadowStyle(shadow, assetUrl(href));
    }

    // Provide state for widget scripts
    ensureWidgetGlobals({
      widgetname: renderPayload.widgetType,
      publicId: renderPayload.publicId,
      status: renderPayload.status,
      theme: renderPayload.theme,
      device: renderPayload.device,
      state: renderPayload.state,
    });

    upsertSchema(renderPayload.schemaJsonLd);

    // Load scripts sequentially, preserving dependency order
    for (const src of scripts) {
      await loadShadowScript(shadow, assetUrl(src));
    }

    // Deep link activation (initial + hash changes)
    const onHash = () => activateDeepLink(shadow, renderPayload.state);
    window.addEventListener('hashchange', onHash);
    onHash();

    setReadyOnce();
  }

  let mountStarted = false;
  async function mountOnce() {
    if (mountStarted) return;
    mountStarted = true;

    const renderRes = await fetch(embedUrl('/r/' + encodeURIComponent(publicId), { ts: Date.now(), locale }), {
      mode: 'cors',
      credentials: 'omit',
    });
    const payload = await renderRes.json();

    if (!renderRes.ok) {
      console.warn('[Clickeen] Render failed', renderRes.status, payload);
      mountIframe();
      return;
    }

    const enabled =
      forceShadow === 'true' ||
      (payload && payload.state && payload.state.seoGeo && payload.state.seoGeo.enabled === true);
    if (!enabled) {
      mountIframe();
      return;
    }

    await mountShadow(payload);
  }

  function triggerAndMount() {
    triggerInjection();
    mountOnce().catch((err) => {
    console.warn('[Clickeen] Mount failed, falling back to iframe', err);
    try { mountIframe(); } catch {}
    });
  }

  function scheduleMount() {
    switch (trigger) {
      case 'time': {
        const ms = Number(delay) || 0;
        setTimeout(triggerAndMount, ms);
        break;
      }
      case 'scroll': {
        const threshold = Math.max(0, Math.min(100, Number(scrollPct) || 50));
        const handler = () => {
          const scrolled = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
          if (scrolled >= threshold) {
            triggerAndMount();
            window.removeEventListener('scroll', handler);
          }
        };
        window.addEventListener('scroll', handler, { passive: true });
        handler();
        break;
      }
      case 'click': {
        if (!clickSelector) {
          console.warn('[Clickeen] data-click-selector required for click trigger');
          return;
        }
        const triggerEl = document.querySelector(clickSelector);
        if (!triggerEl) {
          console.warn('[Clickeen] click selector not found:', clickSelector);
          return;
        }
        triggerEl.addEventListener('click', (evt) => {
          evt.preventDefault();
          triggerAndMount();
        });
        break;
      }
      case 'overlay':
        triggerAndMount();
        break;
      default:
        triggerAndMount();
    }
  }

  scheduleMount();
})();
`;

export const runtime = 'edge';

export function GET() {
  return new Response(script, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
