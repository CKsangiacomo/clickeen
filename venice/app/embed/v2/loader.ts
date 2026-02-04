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
		    ckOptimization = 'none',
		    cacheBust = 'false',
		    maxWidth: maxWidthAttr,
		    minHeight: minHeightAttr,
		    width: widthAttr,
		    ts: tsAttr,
		    locale: localeAttr,
		  } = scriptEl.dataset;

  function createHostErrorCard(title, message, details, maxWidthPx) {
    const card = document.createElement('div');
    card.setAttribute('data-ck-embed-error', '1');
    card.style.boxSizing = 'border-box';
    card.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
    card.style.border = '1px solid rgba(148, 163, 184, 0.6)';
    card.style.borderRadius = '14px';
    card.style.background = 'rgba(248, 250, 252, 0.98)';
    card.style.color = '#0f172a';
    card.style.padding = '14px 14px 12px';
    card.style.width = '100%';
    const resolvedMaxWidth = typeof maxWidthPx === 'number' && Number.isFinite(maxWidthPx) ? maxWidthPx : 640;
    card.style.maxWidth = resolvedMaxWidth === 0 ? 'none' : resolvedMaxWidth + 'px';
    card.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.12)';

    const h = document.createElement('div');
    h.textContent = title;
    h.style.fontSize = '14px';
    h.style.fontWeight = '650';
    h.style.marginBottom = '6px';
    card.appendChild(h);

    const p = document.createElement('div');
    p.textContent = message;
    p.style.fontSize = '13px';
    p.style.lineHeight = '1.4';
    p.style.opacity = '0.92';
    card.appendChild(p);

    if (details) {
      const pre = document.createElement('pre');
      pre.textContent = details;
      pre.style.marginTop = '10px';
      pre.style.padding = '10px 12px';
      pre.style.background = 'rgba(15, 23, 42, 0.04)';
      pre.style.borderRadius = '12px';
      pre.style.overflowX = 'auto';
      pre.style.fontSize = '12px';
      pre.style.lineHeight = '1.35';
      card.appendChild(pre);
    }

	    return card;
	  }

			  const origin = new URL(scriptEl.src, window.location.href).origin;
			  window.CK_ASSET_ORIGIN = origin;

			  const PLACEHOLDER_SELECTOR = '[data-clickeen-id]';

			  const normalizeLocaleToken = (raw) => {
			    const value = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/_/g, '-') : '';
			    return value || '';
			  };

			  const resolveLocale = (raw) => {
			    const preferred = normalizeLocaleToken(raw);
			    if (preferred) return preferred;
			    const nav = normalizeLocaleToken(navigator.language || '');
			    return nav || 'en';
			  };

			  const locale = resolveLocale(localeAttr);

			  let missingIdErrorEl = null;
			  let missingIdErrorTimer = null;
			  const clearMissingIdError = () => {
			    if (missingIdErrorTimer) clearTimeout(missingIdErrorTimer);
			    missingIdErrorTimer = null;
			    if (missingIdErrorEl && missingIdErrorEl.parentNode) missingIdErrorEl.parentNode.removeChild(missingIdErrorEl);
			    missingIdErrorEl = null;
			  };
			  const scheduleMissingIdError = () => {
			    if (publicId) return;
			    clearMissingIdError();
			    missingIdErrorTimer = setTimeout(() => {
			      if (document.querySelector(PLACEHOLDER_SELECTOR)) return;
			      missingIdErrorEl = createHostErrorCard(
			        'Clickeen embed error',
			        'Missing data-public-id on the loader script (and no data-clickeen-id placeholders found).',
			        'Fix: either add data-public-id=\"wgt_...\" to the <script> tag OR add <div data-clickeen-id=\"wgt_...\"></div> placeholders.',
			        640,
			      );
			      if (scriptEl.parentNode) scriptEl.parentNode.insertBefore(missingIdErrorEl, scriptEl);
			    }, 1500);
			  };
			  scheduleMissingIdError();

		  const optimization = typeof ckOptimization === 'string' ? ckOptimization.trim().toLowerCase() : '';
		  const seoGeoOptimization = optimization === 'seo-geo';

		  const explicitTs = typeof tsAttr === 'string' ? tsAttr.trim() : '';
		  const tsToken = explicitTs || (cacheBust === 'true' ? String(Date.now()) : '');
		  const tsParam = tsToken ? { ts: tsToken } : {};

		  const DEFAULT_MAX_WIDTH = 640;
		  const DEFAULT_MIN_HEIGHT = 420;

		  const parseMaxWidth = (rawValue, fallback) => {
		    const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
		    if (!raw) return fallback;
		    const n = Number(raw);
		    if (!Number.isFinite(n) || n < 0) {
		      console.warn('[Clickeen] Invalid data-max-width; using fallback');
		      return fallback;
		    }
		    return Math.round(n);
		  };

		  const parseMinHeight = (rawValue, fallback) => {
		    const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
		    if (!raw) return fallback;
		    const n = Number(raw);
		    if (!Number.isFinite(n) || n <= 0) {
		      console.warn('[Clickeen] Invalid data-min-height; using fallback');
		      return fallback;
		    }
		    return Math.round(n);
		  };

		  const maxWidthValue = parseMaxWidth(maxWidthAttr, DEFAULT_MAX_WIDTH);
		  const minHeightValue = parseMinHeight(minHeightAttr, DEFAULT_MIN_HEIGHT);

	  const widthValue = typeof widthAttr === 'string' ? widthAttr.trim() : '';
	  if (widthValue && widthValue !== '100%') {
	    console.warn('[Clickeen] Invalid data-width (v2 only supports \"100%\"):', widthValue);
	  }

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

	  const embedUrl = (path, params = {}) => makeUrl(path, { theme, device, ...tsParam, ...params });
	  const embedUrlFor = (opts, path, params = {}) =>
	    makeUrl(path, { theme: opts.theme, device: opts.device, ...opts.tsParam, ...params });
	  const assetUrl = (path, params = {}) => makeUrl(path, { ...tsParam, ...params });

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
  container.style.maxWidth = maxWidthValue === 0 ? 'none' : maxWidthValue + 'px';
  container.style.minHeight = minHeightValue + 'px';
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
	    iframe.src = embedUrl('/e/' + encodeURIComponent(publicId), { locale });
	    iframe.setAttribute('loading', trigger === 'immediate' ? 'eager' : 'lazy');
	    iframe.setAttribute('title', 'Clickeen widget');
	    iframe.setAttribute('referrerpolicy', 'no-referrer');
	    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
	    iframe.style.width = '100%';
	    iframe.style.border = '0';
	    iframe.style.maxWidth = maxWidthValue === 0 ? 'none' : maxWidthValue + 'px';
	    iframe.style.minHeight = minHeightValue + 'px';

    container.replaceChildren(iframe);

    let errorEl = null;
    const clearError = () => {
      if (errorEl && errorEl.parentNode) errorEl.parentNode.removeChild(errorEl);
      errorEl = null;
    };

    const showFrameError = (title, message, details) => {
      if (errorEl) return;
      errorEl = createHostErrorCard(title, message, details, maxWidthValue);
      errorEl.style.marginTop = '10px';
      container.appendChild(errorEl);
    };

    const onResizeMessage = (event) => {
      if (!event || event.origin !== origin) return;
      if (!iframe.contentWindow || event.source !== iframe.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || data.type !== 'ck:resize') return;
      const h = Number(data.height);
      if (!Number.isFinite(h) || h <= 0) return;
      const next = Math.max(minHeightValue, Math.min(12000, Math.ceil(h)));
      iframe.style.height = next + 'px';
      container.style.minHeight = next + 'px';
    };
    window.addEventListener('message', onResizeMessage);

    const onCspViolation = (event) => {
      const dir = String((event && (event.effectiveDirective || event.violatedDirective)) || '').toLowerCase();
      if (dir !== 'frame-src' && dir !== 'child-src') return;
      const blocked = String((event && event.blockedURI) || '');
      if (!blocked) return;
      if (!blocked.startsWith(origin)) return;
      showFrameError(
        'Clickeen blocked by CSP',
        'Your site Content Security Policy is blocking the embed iframe.',
        'Allow in CSP: frame-src (or child-src) ' + origin,
      );
    };
    document.addEventListener('securitypolicyviolation', onCspViolation);

    const loadTimeout = setTimeout(() => {
      showFrameError(
        'Clickeen failed to load',
        'The iframe did not finish loading. This is usually a CSP (frame-src) block or an ad-blocker.',
        'If you use CSP, allow: frame-src ' + origin,
      );
    }, 8000);

    iframe.addEventListener('load', () => {
      clearTimeout(loadTimeout);
      document.removeEventListener('securitypolicyviolation', onCspViolation);
      clearError();
      setReadyOnce();
    });
  }

  function upsertSchema(targetPublicId, schemaJsonLd) {
    if (!schemaJsonLd) return;
    const id = 'ck-schema-' + targetPublicId;
    let script = document.getElementById(id);
    if (!(script instanceof HTMLScriptElement)) {
      script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = schemaJsonLd;
  }

  function ensureExcerptShell(targetPublicId, anchorEl, maxWidthPx) {
    const id = 'ck-excerpt-' + targetPublicId;
    let details = document.getElementById(id);
    if (details instanceof HTMLDetailsElement) return details;

    details = document.createElement('details');
    details.id = id;
    details.setAttribute('data-ck-excerpt', '1');
    details.style.width = '100%';
    details.style.maxWidth = maxWidthPx === 0 ? 'none' : maxWidthPx + 'px';
    details.style.marginTop = '12px';

    const summary = document.createElement('summary');
    summary.textContent = 'About this widget';
    details.appendChild(summary);

    const body = document.createElement('div');
    body.setAttribute('data-ck-excerpt-body', '1');
    body.style.marginTop = '8px';
    details.appendChild(body);

    const parent = anchorEl && anchorEl.parentNode;
    if (parent) {
      if (anchorEl.nextSibling) parent.insertBefore(details, anchorEl.nextSibling);
      else parent.appendChild(details);
    } else {
      document.body.appendChild(details);
    }

    return details;
  }

  function upsertExcerpt(targetPublicId, anchorEl, maxWidthPx, excerptHtml) {
    if (!excerptHtml) return;
    const shell = ensureExcerptShell(targetPublicId, anchorEl, maxWidthPx);
    const body = shell.querySelector('[data-ck-excerpt-body=\"1\"]');
    if (!body) return;
    body.innerHTML = excerptHtml;
  }

  function ensureWidgetGlobals(payload) {
    window.CK_WIDGETS = window.CK_WIDGETS || {};
    window.CK_WIDGETS[publicId] = payload;
    window.CK_WIDGET = payload; // legacy single-widget accessor
  }

  function loadShadowScript(target, src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      const prev = window.CK_CURRENT_SCRIPT;
      window.CK_CURRENT_SCRIPT = script;
      script.onload = () => {
        window.CK_CURRENT_SCRIPT = prev;
        resolve();
      };
      script.onerror = () => {
        window.CK_CURRENT_SCRIPT = prev;
        reject(new Error('Failed to load script ' + src));
      };
      target.appendChild(script);
    });
  }

  function loadShadowStyle(target, href) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error('Failed to load style ' + href));
      target.appendChild(link);
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

		    upsertSchema(renderPayload.publicId || publicId, renderPayload.schemaJsonLd);
		    if (seoGeoOptimization) {
		      upsertExcerpt(renderPayload.publicId || publicId, container, maxWidthValue, renderPayload.excerptHtml);
		    }

    // Widgets expect their runtime scripts to be rendered inside the widget root
    // so document.currentScript.closest('[data-ck-widget]') resolves deterministically.
    const scriptTarget = shadow.querySelector && shadow.querySelector('[data-ck-widget]') || shadow;

    // Load scripts sequentially, preserving dependency order.
    // Shadow-root scripts cannot use document.currentScript, so we expose a deterministic fallback
    // via window.CK_CURRENT_SCRIPT. To avoid multi-embed races, serialize shadow script execution.
    const runScripts = async () => {
      for (const src of scripts) {
        await loadShadowScript(scriptTarget, assetUrl(src));
      }
    };
    window.CK_SHADOW_SCRIPT_QUEUE = window.CK_SHADOW_SCRIPT_QUEUE || Promise.resolve();
    window.CK_SHADOW_SCRIPT_QUEUE = window.CK_SHADOW_SCRIPT_QUEUE.then(runScripts, runScripts);
    await window.CK_SHADOW_SCRIPT_QUEUE;

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

		    // Default path (fast): iframe embed only.
		    if (forceShadow !== 'true') {
		      mountIframe();
		      if (seoGeoOptimization) {
		        try {
		          const metaRes = await fetch(embedUrl('/r/' + encodeURIComponent(publicId), { locale, meta: '1' }), {
		            mode: 'cors',
		            credentials: 'omit',
		          });
		          const metaPayload = await metaRes.json().catch(() => null);
		          if (!metaRes.ok || !metaPayload) {
		            console.warn('[Clickeen] SEO/GEO meta failed', metaRes.status, metaPayload);
		          } else {
			            upsertSchema(publicId, metaPayload.schemaJsonLd);
			            upsertExcerpt(publicId, container, maxWidthValue, metaPayload.excerptHtml);
			          }
		        } catch (err) {
		          console.warn('[Clickeen] SEO/GEO meta failed', err);
		        }
		      }
		      return;
		    }

		    // Shadow mode: fetch structured render payload (used by Bob preview-shadow / SEO flows).
		    const renderRes = await fetch(embedUrl('/r/' + encodeURIComponent(publicId), { locale }), {
		      mode: 'cors',
		      credentials: 'omit',
		    });
	    const payload = await renderRes.json().catch(() => null);

	    if (!renderRes.ok || !payload) {
	      console.warn('[Clickeen] Render failed', renderRes.status, payload);
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

  function mountPlaceholderNow(hostEl) {
    if (!(hostEl instanceof HTMLElement)) return;
    if (hostEl.getAttribute('data-ck-mounted') === '1') return;

    const pid = typeof hostEl.dataset.clickeenId === 'string' ? hostEl.dataset.clickeenId.trim() : '';
    if (!pid) return;

    hostEl.setAttribute('data-ck-mounted', '1');
    hostEl.setAttribute('data-ck-public-id', pid);
    clearMissingIdError();

    const hostThemeRaw = typeof hostEl.dataset.theme === 'string' ? hostEl.dataset.theme.trim().toLowerCase() : '';
    const hostTheme = hostThemeRaw === 'dark' ? 'dark' : theme;

    const hostDeviceRaw = typeof hostEl.dataset.device === 'string' ? hostEl.dataset.device.trim().toLowerCase() : '';
    const hostDevice = hostDeviceRaw === 'mobile' ? 'mobile' : device;

    const hostLocaleRaw = typeof hostEl.dataset.locale === 'string' ? hostEl.dataset.locale : locale;
    const hostLocale = resolveLocale(hostLocaleRaw);

    const hostExplicitTs = typeof hostEl.dataset.ts === 'string' ? hostEl.dataset.ts.trim() : '';
    const hostCacheBust = typeof hostEl.dataset.cacheBust === 'string' ? hostEl.dataset.cacheBust.trim().toLowerCase() : '';
    const hostTsToken = hostExplicitTs || (hostCacheBust === 'true' ? String(Date.now()) : tsToken);
    const hostTsParam = hostTsToken ? { ts: hostTsToken } : tsParam;

    const hostMaxWidth = parseMaxWidth(hostEl.dataset.maxWidth, maxWidthValue);
    const hostMinHeight = parseMinHeight(hostEl.dataset.minHeight, minHeightValue);

    const hostWidth = typeof hostEl.dataset.width === 'string' ? hostEl.dataset.width.trim() : '';
    if (hostWidth && hostWidth !== '100%') {
      console.warn('[Clickeen] Invalid data-width (v2 only supports \"100%\"):', hostWidth);
    }

    hostEl.style.position = 'relative';
    hostEl.style.width = '100%';
    hostEl.style.maxWidth = hostMaxWidth === 0 ? 'none' : hostMaxWidth + 'px';
    hostEl.style.minHeight = hostMinHeight + 'px';

    const iframe = document.createElement('iframe');
    iframe.src = embedUrlFor({ theme: hostTheme, device: hostDevice, tsParam: hostTsParam }, '/e/' + encodeURIComponent(pid), {
      locale: hostLocale,
    });
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('title', 'Clickeen widget');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.maxWidth = hostMaxWidth === 0 ? 'none' : hostMaxWidth + 'px';
    iframe.style.minHeight = hostMinHeight + 'px';

    hostEl.replaceChildren(iframe);

    let errorEl = null;
    const clearError = () => {
      if (errorEl && errorEl.parentNode) errorEl.parentNode.removeChild(errorEl);
      errorEl = null;
    };

    const showFrameError = (title, message, details) => {
      if (errorEl) return;
      errorEl = createHostErrorCard(title, message, details, hostMaxWidth);
      errorEl.style.marginTop = '10px';
      hostEl.appendChild(errorEl);
    };

    const onResizeMessage = (event) => {
      if (!event || event.origin !== origin) return;
      if (!iframe.contentWindow || event.source !== iframe.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || data.type !== 'ck:resize') return;
      const h = Number(data.height);
      if (!Number.isFinite(h) || h <= 0) return;
      const next = Math.max(hostMinHeight, Math.min(12000, Math.ceil(h)));
      iframe.style.height = next + 'px';
      hostEl.style.minHeight = next + 'px';
    };
    window.addEventListener('message', onResizeMessage);

    const onCspViolation = (event) => {
      const dir = String((event && (event.effectiveDirective || event.violatedDirective)) || '').toLowerCase();
      if (dir !== 'frame-src' && dir !== 'child-src') return;
      const blocked = String((event && event.blockedURI) || '');
      if (!blocked) return;
      if (!blocked.startsWith(origin)) return;
      showFrameError(
        'Clickeen blocked by CSP',
        'Your site Content Security Policy is blocking the embed iframe.',
        'Allow in CSP: frame-src (or child-src) ' + origin,
      );
    };
    document.addEventListener('securitypolicyviolation', onCspViolation);

    const loadTimeout = setTimeout(() => {
      showFrameError(
        'Clickeen failed to load',
        'The iframe did not finish loading. This is usually a CSP (frame-src) block or an ad-blocker.',
        'If you use CSP, allow: frame-src ' + origin,
      );
    }, 8000);

    iframe.addEventListener('load', () => {
      clearTimeout(loadTimeout);
      document.removeEventListener('securitypolicyviolation', onCspViolation);
      clearError();
      setReadyOnce();
    });

    const hostOptimization = typeof hostEl.dataset.ckOptimization === 'string' ? hostEl.dataset.ckOptimization.trim().toLowerCase() : '';
    const hostSeoGeoOptimization = hostOptimization === 'seo-geo';
    if (hostSeoGeoOptimization) {
      fetch(embedUrlFor({ theme: hostTheme, device: hostDevice, tsParam: hostTsParam }, '/r/' + encodeURIComponent(pid), { locale: hostLocale, meta: '1' }), {
        mode: 'cors',
        credentials: 'omit',
      })
        .then((res) => res.json().catch(() => null).then((payload) => ({ res, payload })))
        .then(({ res, payload }) => {
          if (!res.ok || !payload) {
            console.warn('[Clickeen] SEO/GEO meta failed', res.status, payload);
            return;
          }
          upsertSchema(pid, payload.schemaJsonLd);
          upsertExcerpt(pid, hostEl, hostMaxWidth, payload.excerptHtml);
        })
        .catch((err) => console.warn('[Clickeen] SEO/GEO meta failed', err));
    }
  }

  function mountPlaceholder(hostEl) {
    if (!(hostEl instanceof HTMLElement)) return;
    const mounted = hostEl.getAttribute('data-ck-mounted');
    if (mounted === '1' || mounted === 'pending') return;

    const pid = typeof hostEl.dataset.clickeenId === 'string' ? hostEl.dataset.clickeenId.trim() : '';
    if (!pid) return;

    if (typeof IntersectionObserver === 'undefined') {
      mountPlaceholderNow(hostEl);
      return;
    }

    const LOADER_STATE_KEY = '__CK_V2_EMBED_LOADER__';
    const loaderState = window[LOADER_STATE_KEY] || { observer: null, io: null };
    window[LOADER_STATE_KEY] = loaderState;

    const rect = hostEl.getBoundingClientRect();
    const margin = 240;
    const inRange = rect.top < window.innerHeight + margin && rect.bottom > -margin;
    if (inRange) {
      mountPlaceholderNow(hostEl);
      return;
    }

    if (!loaderState.io) {
      loaderState.io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const el = entry.target;
            if (!(el instanceof HTMLElement)) continue;
            loaderState.io.unobserve(el);
            mountPlaceholderNow(el);
          }
        },
        { rootMargin: '240px 0px' },
      );
    }

    hostEl.setAttribute('data-ck-mounted', 'pending');
    loaderState.io.observe(hostEl);
  }

  function scanPlaceholders(root) {
    const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
    if (root && root instanceof HTMLElement && typeof root.matches === 'function' && root.matches(PLACEHOLDER_SELECTOR)) {
      mountPlaceholder(root);
    }
    const nodes = scope.querySelectorAll(PLACEHOLDER_SELECTOR);
    nodes.forEach((el) => mountPlaceholder(el));
  }

  const LOADER_STATE_KEY = '__CK_V2_EMBED_LOADER__';
  const loaderState = window[LOADER_STATE_KEY] || { observer: null, io: null };
  window[LOADER_STATE_KEY] = loaderState;

  const mount = (root) => scanPlaceholders(root || document);
  if (window.Clickeen && typeof window.Clickeen === 'object') {
    window.Clickeen.mount = window.Clickeen.mount || mount;
  }

  mount(document);

  if (!loaderState.observer && typeof MutationObserver !== 'undefined') {
    loaderState.observer = new MutationObserver((records) => {
      for (const record of records) {
        const added = record.addedNodes || [];
        for (const node of added) {
          if (!(node instanceof HTMLElement)) continue;
          scanPlaceholders(node);
        }
      }
    });
    loaderState.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (publicId) scheduleMount();
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
