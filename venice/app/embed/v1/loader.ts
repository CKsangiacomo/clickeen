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
    device = 'desktop'
  } = scriptEl.dataset;

  if (!publicId) {
    console.warn('[Clickeen] Missing data-public-id');
    return;
  }

  const origin = new URL(scriptEl.src, window.location.href).origin;
  const embedUrl = (params = {}) => {
    const url = new URL(`${origin}/e/${encodeURIComponent(publicId)}`);
    const combined = { theme, device, ...params };
    Object.entries(combined).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, String(value));
    });
    return url.toString();
  };

  const iframe = document.createElement('iframe');
  iframe.src = embedUrl({ ts: Date.now() });
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('title', 'Clickeen widget');
  iframe.style.width = '100%';
  iframe.style.border = '0';
  iframe.style.maxWidth = '640px';
  iframe.style.minHeight = '420px';

  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.zIndex = '2147483647';
  container.appendChild(iframe);

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
        document.body.removeChild(overlay);
      }
    });
    overlay.appendChild(container);
    document.body.appendChild(overlay);
  }

  function triggerInjection() {
    if (trigger === 'overlay') {
      injectOverlay();
    } else {
      injectInline();
    }
  }

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

  window.Clickeen = window.Clickeen || {
    listeners: {},
    publish(event, payload) {
      (this.listeners[event] || []).forEach((fn) => fn(payload));
    },
    subscribe(event, handler) {
      this.listeners[event] = this.listeners[event] || [];
      this.listeners[event].push(handler);
      return () => {
        this.listeners[event] = (this.listeners[event] || []).filter((fn) => fn !== handler);
      };
    },
  };
})();
`;

export const runtime = 'edge';
export const dynamic = 'force-static';

export function GET() {
  return new Response(script, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
