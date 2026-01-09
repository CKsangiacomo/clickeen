(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const resizeState = new WeakMap();

  function getResizeState(stageEl) {
    const existing = resizeState.get(stageEl);
    if (existing) return existing;
    const next = { obs: null, raf: 0, lastHeight: null, readySent: false };
    resizeState.set(stageEl, next);
    return next;
  }

  function toNumber(value, fallback) {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function resolveBox(box) {
    if (!box || typeof box !== 'object') {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }
    const linked = box.linked !== false;
    if (!linked) {
      return {
        top: toNumber(box.top, 0),
        right: toNumber(box.right, 0),
        bottom: toNumber(box.bottom, 0),
        left: toNumber(box.left, 0),
      };
    }
    const all = toNumber(box.all, 0);
    return { top: all, right: all, bottom: all, left: all };
  }

  function resolvePaddingV2(cfg) {
    const padding = cfg && typeof cfg === 'object' ? cfg.padding : null;
    if (padding && typeof padding === 'object' && ('desktop' in padding || 'mobile' in padding)) {
      return {
        desktop: resolveBox(padding.desktop),
        mobile: resolveBox(padding.mobile),
      };
    }
    throw new Error('[CKStagePod] stage/pod.padding must define desktop + mobile padding objects');
  }

  function resolveRadius(cfg) {
    const tokenize = (value) => (value === 'none' ? '0' : `var(--control-radius-${value})`);
    if (cfg.radiusLinked === false) {
      return {
        tl: tokenize(cfg.radiusTL),
        tr: tokenize(cfg.radiusTR),
        br: tokenize(cfg.radiusBR),
        bl: tokenize(cfg.radiusBL),
      };
    }
    const all = tokenize(cfg.radius);
    return { tl: all, tr: all, br: all, bl: all };
  }

  function applyPaddingVars(el, key, pad) {
    el.style.setProperty(`--${key}-top`, `${pad.top}px`);
    el.style.setProperty(`--${key}-right`, `${pad.right}px`);
    el.style.setProperty(`--${key}-bottom`, `${pad.bottom}px`);
    el.style.setProperty(`--${key}-left`, `${pad.left}px`);
  }

  function resolveCanvas(stageCfg) {
    const canvas = stageCfg && typeof stageCfg === 'object' ? stageCfg.canvas : null;
    if (!canvas || typeof canvas !== 'object') return { mode: 'wrap', width: 0, height: 0 };
    return {
      mode: String(canvas.mode || 'wrap'),
      width: toNumber(canvas.width, 0),
      height: toNumber(canvas.height, 0),
    };
  }

  function normalizeBackgroundFill(raw) {
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (!v) return 'transparent';
    // Allow full CSS background shorthands (colors, gradients, url(...), etc).
    if (/^url\(\s*/i.test(v)) {
      // Ensure image fills always have a paintable fallback layer while the image decodes/loads.
      // Without this, browsers may show the underlying page (often grey) for a frame or more.
      if (v.includes(',')) return v;
      return `${v}, linear-gradient(var(--color-system-white), var(--color-system-white))`;
    }
    // Accept a plain URL string as a convenience (some editor flows store the primary URL only).
    if (/^(?:https?:\/\/|data:|blob:)/i.test(v)) {
      return `url("${v}") center center / cover no-repeat, linear-gradient(var(--color-system-white), var(--color-system-white))`;
    }
    return v;
  }

  function postResize(stageEl) {
    if (!(stageEl instanceof HTMLElement)) return;
    if (typeof window === 'undefined' || !window.parent || window.parent === window) return;
    const state = getResizeState(stageEl);
    if (state.raf) return;
    state.raf = requestAnimationFrame(() => {
      state.raf = 0;
      const rect = stageEl.getBoundingClientRect();
      const height = Math.max(0, Math.ceil(rect.height));
      if (state.lastHeight != null && Math.abs(height - state.lastHeight) <= 1) return;
      state.lastHeight = height;
      window.parent.postMessage({ type: 'ck:resize', height }, '*');
    });
  }

  function postReady(stageEl, scopeEl) {
    if (!(stageEl instanceof HTMLElement)) return;
    if (!(scopeEl instanceof HTMLElement)) return;
    if (typeof window === 'undefined' || !window.parent || window.parent === window) return;
    const state = getResizeState(stageEl);
    if (state.readySent) return;
    state.readySent = true;

    const widgetRoot = scopeEl.closest('[data-ck-widget]');
    const widgetname = widgetRoot instanceof HTMLElement ? widgetRoot.getAttribute('data-ck-widget') || '' : '';
    const publicId = widgetRoot instanceof HTMLElement ? widgetRoot.getAttribute('data-ck-public-id') || '' : '';

    window.parent.postMessage({ type: 'ck:ready', widgetname, publicId }, '*');
  }

  function applyStagePod(stageCfg, podCfg, scopeEl) {
    if (!(scopeEl instanceof HTMLElement)) {
      throw new Error('[CKStagePod] scope must be an HTMLElement');
    }

    const stageEl = scopeEl.closest('.stage');
    const podEl = scopeEl.closest('.pod');
    if (!(stageEl instanceof HTMLElement) || !(podEl instanceof HTMLElement)) {
      throw new Error('[CKStagePod] Missing .stage/.pod wrappers for scope');
    }

    stageEl.style.setProperty('--stage-bg', normalizeBackgroundFill(stageCfg.background));
    const stagePads = resolvePaddingV2(stageCfg);
    applyPaddingVars(stageEl, 'stage-pad-desktop', stagePads.desktop);
    applyPaddingVars(stageEl, 'stage-pad-mobile', stagePads.mobile);

    const canvas = resolveCanvas(stageCfg);
    stageEl.setAttribute('data-canvas-mode', canvas.mode);
    stageEl.style.setProperty('--stage-fixed-width', canvas.width > 0 ? `${canvas.width}px` : 'auto');
    stageEl.style.setProperty('--stage-fixed-height', canvas.height > 0 ? `${canvas.height}px` : 'auto');

    const alignMap = {
      left: { justify: 'flex-start', alignItems: 'center' },
      right: { justify: 'flex-end', alignItems: 'center' },
      top: { justify: 'center', alignItems: 'flex-start' },
      bottom: { justify: 'center', alignItems: 'flex-end' },
      center: { justify: 'center', alignItems: 'center' },
    };
    const resolved = alignMap[stageCfg.alignment];
    stageEl.style.justifyContent = resolved.justify;
    stageEl.style.alignItems = resolved.alignItems;

    podEl.style.setProperty('--pod-bg', normalizeBackgroundFill(podCfg.background));
    const podPads = resolvePaddingV2(podCfg);
    applyPaddingVars(podEl, 'pod-pad-desktop', podPads.desktop);
    applyPaddingVars(podEl, 'pod-pad-mobile', podPads.mobile);

    const radii = resolveRadius(podCfg);
    podEl.style.setProperty('--pod-radius', `${radii.tl} ${radii.tr} ${radii.br} ${radii.bl}`);

    podEl.setAttribute('data-width-mode', podCfg.widthMode);
    podEl.style.setProperty('--content-width', `${podCfg.contentWidth}px`);

    // Tell the parent that the widget has applied its first state.
    // Bob uses this to avoid rendering "default" HTML before the real config is applied.
    postReady(stageEl, scopeEl);

    // Notify parent (Bob preview) of height changes only when the parent needs it (wrap-to-content or auto-height fixed).
    const shouldReport =
      typeof window !== 'undefined' &&
      window.parent &&
      window.parent !== window &&
      (canvas.mode === 'wrap' || (canvas.mode === 'fixed' && !(canvas.height > 0)));
    const state = getResizeState(stageEl);
    if (!shouldReport) {
      if (state.obs) {
        state.obs.disconnect();
        state.obs = null;
      }
      return;
    }

    postResize(stageEl);
    if (!state.obs && typeof ResizeObserver !== 'undefined') {
      state.obs = new ResizeObserver(() => postResize(stageEl));
      state.obs.observe(stageEl);
    }
  }

  window.CKStagePod = { applyStagePod };
})();
