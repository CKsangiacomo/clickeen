(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const resizeObservers = new WeakMap();

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

  function postResize(stageEl) {
    if (!(stageEl instanceof HTMLElement)) return;
    if (typeof window === 'undefined' || !window.parent || window.parent === window) return;
    const rect = stageEl.getBoundingClientRect();
    const height = Math.max(0, Math.ceil(rect.height));
    window.parent.postMessage({ type: 'ck:resize', height }, '*');
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

    stageEl.style.setProperty('--stage-bg', stageCfg.background || 'transparent');
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

    podEl.style.setProperty('--pod-bg', podCfg.background || 'transparent');
    const podPads = resolvePaddingV2(podCfg);
    applyPaddingVars(podEl, 'pod-pad-desktop', podPads.desktop);
    applyPaddingVars(podEl, 'pod-pad-mobile', podPads.mobile);

    const radii = resolveRadius(podCfg);
    podEl.style.setProperty('--pod-radius', `${radii.tl} ${radii.tr} ${radii.br} ${radii.bl}`);

    podEl.setAttribute('data-width-mode', podCfg.widthMode);
    podEl.style.setProperty('--content-width', `${podCfg.contentWidth}px`);

    // Notify parent (Bob preview) of height changes so iframe can wrap to content when needed.
    requestAnimationFrame(() => postResize(stageEl));
    if (!resizeObservers.has(stageEl) && typeof ResizeObserver !== 'undefined') {
      const obs = new ResizeObserver(() => postResize(stageEl));
      obs.observe(stageEl);
      resizeObservers.set(stageEl, obs);
    }
  }

  window.CKStagePod = { applyStagePod };
})();
