(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const resizeState = new WeakMap();
  const FLOATING_ANCHORS = new Set([
    'top',
    'bottom',
    'left',
    'right',
    'center',
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ]);
  const FLOATING_ALIGN_MAP = {
    top: { justify: 'center', alignItems: 'flex-start' },
    bottom: { justify: 'center', alignItems: 'flex-end' },
    left: { justify: 'flex-start', alignItems: 'center' },
    right: { justify: 'flex-end', alignItems: 'center' },
    center: { justify: 'center', alignItems: 'center' },
    'top-left': { justify: 'flex-start', alignItems: 'flex-start' },
    'top-right': { justify: 'flex-end', alignItems: 'flex-start' },
    'bottom-left': { justify: 'flex-start', alignItems: 'flex-end' },
    'bottom-right': { justify: 'flex-end', alignItems: 'flex-end' },
  };
  const DEFAULT_FLOATING_ANCHOR = 'bottom-right';
  const DEFAULT_FLOATING_OFFSET = 24;
  const FLOATING_OFFSET_MIN = 0;
  const FLOATING_OFFSET_MAX = 400;
  const INSIDE_SHADOW_LAYER_BELOW = 'below-content';
  const INSIDE_SHADOW_LAYER_ABOVE = 'above-content';
  const EDITOR_CHECKERBOARD =
    'repeating-conic-gradient(var(--color-system-gray-6-step4) 0% 25%, var(--color-system-white) 0% 50%) 50% / 12px 12px';

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

  function clampNumber(value, min, max) {
    const n = typeof value === 'number' && Number.isFinite(value) ? value : min;
    return Math.min(max, Math.max(min, n));
  }

  function forceInset(shadow, inset) {
    if (!shadow || typeof shadow !== 'object' || Array.isArray(shadow)) return shadow;
    return { ...shadow, inset };
  }

  function computeShadowBoxShadow(shadow) {
    if (!shadow || typeof shadow !== 'object') return 'none';
    if (shadow.enabled !== true) return 'none';
    const alpha = clampNumber(shadow.alpha, 0, 100);
    if (alpha <= 0) return 'none';
    const x = clampNumber(shadow.x, -200, 200);
    const y = clampNumber(shadow.y, -200, 200);
    const blur = clampNumber(shadow.blur, 0, 400);
    const spread = clampNumber(shadow.spread, -200, 200);
    const color = typeof shadow.color === 'string' && shadow.color.trim() ? shadow.color.trim() : '#000000';
    const alphaMix = 100 - alpha;
    const mix = `color-mix(in oklab, ${color}, transparent ${alphaMix}%)`;
    return `${shadow.inset === true ? 'inset ' : ''}${x}px ${y}px ${blur}px ${spread}px ${mix}`;
  }

  function computeInsideFadeSizePx(side, shadow) {
    if (!shadow || typeof shadow !== 'object') return 0;
    const axis = side === 'left' || side === 'right' ? toNumber(shadow.x, 0) : toNumber(shadow.y, 0);
    const blur = toNumber(shadow.blur, 0);
    const spread = toNumber(shadow.spread, 0);
    return clampNumber(Math.abs(axis) + blur + spread, 0, 400);
  }

  function computeInsideFadeLayer(side, shadow) {
    if (!shadow || typeof shadow !== 'object') return null;
    if (shadow.enabled !== true) return null;
    const alpha = clampNumber(shadow.alpha, 0, 100);
    if (alpha <= 0) return null;
    const color = typeof shadow.color === 'string' && shadow.color.trim() ? shadow.color.trim() : '#000000';
    const alphaMix = 100 - alpha;
    const mix = `color-mix(in oklab, ${color}, transparent ${alphaMix}%)`;
    const sizePx = computeInsideFadeSizePx(side, shadow);
    if (sizePx <= 0) return null;

    if (side === 'left') {
      return `linear-gradient(to right, ${mix}, transparent) left / ${sizePx}px 100% no-repeat`;
    }
    if (side === 'right') {
      return `linear-gradient(to left, ${mix}, transparent) right / ${sizePx}px 100% no-repeat`;
    }
    if (side === 'top') {
      return `linear-gradient(to bottom, ${mix}, transparent) top / 100% ${sizePx}px no-repeat`;
    }
    if (side === 'bottom') {
      return `linear-gradient(to top, ${mix}, transparent) bottom / 100% ${sizePx}px no-repeat`;
    }
    return null;
  }

  function computeInsideFadeBackground(cfg) {
    if (!cfg || typeof cfg !== 'object') return 'none';

    const linked = cfg.linked !== false;
    const resolved = linked
      ? { top: cfg.all, right: cfg.all, bottom: cfg.all, left: cfg.all }
      : { top: cfg.top, right: cfg.right, bottom: cfg.bottom, left: cfg.left };

    const layers = [
      computeInsideFadeLayer('top', resolved.top),
      computeInsideFadeLayer('right', resolved.right),
      computeInsideFadeLayer('bottom', resolved.bottom),
      computeInsideFadeLayer('left', resolved.left),
    ].filter(Boolean);

    return layers.length ? layers.join(', ') : 'none';
  }

  function applyPaddingVars(el, key, pad) {
    el.style.setProperty(`--${key}-top`, `${pad.top}px`);
    el.style.setProperty(`--${key}-right`, `${pad.right}px`);
    el.style.setProperty(`--${key}-bottom`, `${pad.bottom}px`);
    el.style.setProperty(`--${key}-left`, `${pad.left}px`);
  }

  function parsePx(value) {
    const n = Number.parseFloat(String(value || '0'));
    return Number.isFinite(n) ? n : 0;
  }

  function applyCenterAlignmentCompensation(stageEl, podEl, opts) {
    const floatingEnabled = Boolean(opts && opts.floatingEnabled);
    const alignment = typeof (opts && opts.alignment) === 'string' ? opts.alignment : 'center';
    if (floatingEnabled || alignment !== 'center') {
      stageEl.removeAttribute('data-stage-center-compensated');
      podEl.style.removeProperty('left');
      podEl.style.removeProperty('top');
      return;
    }

    const styles = window.getComputedStyle(stageEl);
    const offsetX = (parsePx(styles.paddingRight) - parsePx(styles.paddingLeft)) / 2;
    const offsetY = (parsePx(styles.paddingBottom) - parsePx(styles.paddingTop)) / 2;

    // Keep "center" visually centered against the full stage area,
    // even when stage paddings are asymmetric.
    podEl.style.position = 'relative';
    podEl.style.left = `${offsetX}px`;
    podEl.style.top = `${offsetY}px`;
    stageEl.setAttribute('data-stage-center-compensated', 'true');
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

  function resolveBackgroundFill(raw) {
    if (window.CKFill && typeof window.CKFill.toCssBackground === 'function') {
      return window.CKFill.toCssBackground(raw);
    }
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (!v) return 'transparent';
    if (/^url\(\s*/i.test(v)) {
      if (v.includes(',')) return v;
      return `${v}, linear-gradient(var(--color-system-white), var(--color-system-white))`;
    }
    if (/^(?:https?:\/\/|data:|blob:)/i.test(v)) {
      return `url("${v}") center center / cover no-repeat, linear-gradient(var(--color-system-white), var(--color-system-white))`;
    }
    return v;
  }

  function isEditorPreview() {
    if (window.parent === window) return false;

    const payload = window.CK_WIDGET && typeof window.CK_WIDGET === 'object' ? window.CK_WIDGET : null;
    if (payload && payload.state && typeof payload.state === 'object') return false;

    try {
      return window.parent.location.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  function resolveFloatingConfig(stageCfg) {
    const floatingRaw = stageCfg && typeof stageCfg === 'object' ? stageCfg.floating : null;
    if (!floatingRaw || typeof floatingRaw !== 'object' || Array.isArray(floatingRaw)) {
      return { enabled: false, anchor: DEFAULT_FLOATING_ANCHOR, offset: 0 };
    }

    const enabled = floatingRaw.enabled === true;
    const anchorRaw = typeof floatingRaw.anchor === 'string' ? floatingRaw.anchor.trim() : '';
    const anchor = FLOATING_ANCHORS.has(anchorRaw) ? anchorRaw : DEFAULT_FLOATING_ANCHOR;
    const offsetRaw = toNumber(floatingRaw.offset, DEFAULT_FLOATING_OFFSET);
    const offsetClamped = clampNumber(Math.round(offsetRaw), FLOATING_OFFSET_MIN, FLOATING_OFFSET_MAX);
    const offset = enabled && anchor !== 'center' ? offsetClamped : 0;
    return { enabled, anchor, offset };
  }

  function applyFloatingLayout(stageEl, podEl, floating) {
    const fillLayer = stageEl.querySelector(':scope > .ck-fill-layer');
    const insideLayer = stageEl.querySelector(':scope > .ck-inside-shadow-layer');

    if (floating.enabled) {
      stageEl.setAttribute('data-stage-floating', 'true');
      stageEl.setAttribute('data-stage-floating-anchor', floating.anchor);
      stageEl.setAttribute('data-stage-floating-offset', String(floating.offset));

      stageEl.style.position = 'fixed';
      stageEl.style.inset = `${floating.offset}px`;
      stageEl.style.width = 'auto';
      stageEl.style.height = 'auto';
      stageEl.style.minHeight = '0';
      stageEl.style.margin = '0';
      stageEl.style.padding = '0';
      stageEl.style.zIndex = '1000';
      stageEl.style.pointerEvents = 'none';
      stageEl.style.background = isEditorPreview() ? EDITOR_CHECKERBOARD : 'transparent';
      stageEl.style.boxShadow = 'none';
      podEl.style.pointerEvents = 'auto';

      if (fillLayer instanceof HTMLElement) fillLayer.style.display = 'none';
      if (insideLayer instanceof HTMLElement) insideLayer.style.display = 'none';
      return;
    }

    stageEl.removeAttribute('data-stage-floating');
    stageEl.removeAttribute('data-stage-floating-anchor');
    stageEl.removeAttribute('data-stage-floating-offset');
    stageEl.style.removeProperty('position');
    stageEl.style.removeProperty('inset');
    stageEl.style.removeProperty('width');
    stageEl.style.removeProperty('height');
    stageEl.style.removeProperty('min-height');
    stageEl.style.removeProperty('margin');
    stageEl.style.removeProperty('padding');
    stageEl.style.removeProperty('z-index');
    stageEl.style.removeProperty('pointer-events');
    stageEl.style.removeProperty('background');
    stageEl.style.removeProperty('box-shadow');
    podEl.style.removeProperty('pointer-events');

    if (fillLayer instanceof HTMLElement) fillLayer.style.removeProperty('display');
    if (insideLayer instanceof HTMLElement) insideLayer.style.removeProperty('display');
  }

  function ensureInsideShadowLayer(container) {
    const existing = container.querySelector(':scope > .ck-inside-shadow-layer');
    if (existing instanceof HTMLElement) return existing;
    const layer = document.createElement('div');
    layer.className = 'ck-inside-shadow-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.position = 'absolute';
    layer.style.inset = '0';
    layer.style.pointerEvents = 'none';
    layer.style.borderRadius = 'inherit';
    layer.style.zIndex = '1';
    container.appendChild(layer);
    return layer;
  }

  function resolveInsideShadowLayer(raw) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    return value === INSIDE_SHADOW_LAYER_ABOVE ? INSIDE_SHADOW_LAYER_ABOVE : INSIDE_SHADOW_LAYER_BELOW;
  }

  function applyInsideShadowLayer(container, shadow, opts) {
    if (!(container instanceof HTMLElement)) return;
    container.style.position = 'relative';
    container.style.isolation = 'isolate';

    const layer = ensureInsideShadowLayer(container);
    const next = typeof shadow === 'string' && shadow.trim() ? shadow.trim() : 'none';
    const layerPlacement = resolveInsideShadowLayer(opts && opts.layer);
    layer.style.background = next;
    layer.style.zIndex = layerPlacement === INSIDE_SHADOW_LAYER_ABOVE ? '2' : '1';
    layer.hidden = next === 'none';

    const contentEl = opts && opts.contentEl instanceof HTMLElement ? opts.contentEl : null;
    if (contentEl) {
      contentEl.style.position = 'relative';
      contentEl.style.zIndex = layerPlacement === INSIDE_SHADOW_LAYER_ABOVE ? '1' : '2';
    }
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
      const canvasMode = String(stageEl.getAttribute('data-canvas-mode') || '');
      window.parent.postMessage({ type: 'ck:resize', height, canvasMode }, '*');
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

    if (window.CKFill && typeof window.CKFill.applyMediaLayer === 'function') {
      window.CKFill.applyMediaLayer(stageEl, stageCfg.background, { contentEl: podEl });
    }
    stageEl.style.setProperty('--stage-bg', resolveBackgroundFill(stageCfg.background));
    stageEl.style.setProperty('--stage-shadow', computeShadowBoxShadow(forceInset(stageCfg.shadow, false)));
    applyInsideShadowLayer(stageEl, computeInsideFadeBackground(stageCfg.insideShadow), {
      contentEl: podEl,
      layer: stageCfg && stageCfg.insideShadow ? stageCfg.insideShadow.layer : null,
    });
    const stagePads = resolvePaddingV2(stageCfg);
    applyPaddingVars(stageEl, 'stage-pad-desktop', stagePads.desktop);
    applyPaddingVars(stageEl, 'stage-pad-mobile', stagePads.mobile);

    const canvas = resolveCanvas(stageCfg);
    stageEl.setAttribute('data-canvas-mode', canvas.mode);
    stageEl.style.setProperty('--stage-fixed-width', canvas.width > 0 ? `${canvas.width}px` : 'auto');
    stageEl.style.setProperty('--stage-fixed-height', canvas.height > 0 ? `${canvas.height}px` : 'auto');

    const floating = resolveFloatingConfig(stageCfg);
    applyFloatingLayout(stageEl, podEl, floating);

    const alignMap = {
      left: { justify: 'flex-start', alignItems: 'center' },
      right: { justify: 'flex-end', alignItems: 'center' },
      top: { justify: 'center', alignItems: 'flex-start' },
      bottom: { justify: 'center', alignItems: 'flex-end' },
      center: { justify: 'center', alignItems: 'center' },
    };
    const resolved = floating.enabled ? FLOATING_ALIGN_MAP[floating.anchor] : alignMap[stageCfg.alignment] || alignMap.center;
    stageEl.style.justifyContent = resolved.justify;
    stageEl.style.alignItems = resolved.alignItems;
    applyCenterAlignmentCompensation(stageEl, podEl, {
      alignment: stageCfg.alignment,
      floatingEnabled: floating.enabled,
    });

    podEl.style.setProperty('--pod-bg', resolveBackgroundFill(podCfg.background));
    if (window.CKFill && typeof window.CKFill.applyMediaLayer === 'function') {
      window.CKFill.applyMediaLayer(podEl, podCfg.background, { contentEl: scopeEl });
    }
    const podPads = resolvePaddingV2(podCfg);
    applyPaddingVars(podEl, 'pod-pad-desktop', podPads.desktop);
    applyPaddingVars(podEl, 'pod-pad-mobile', podPads.mobile);

    const radii = resolveRadius(podCfg);
    podEl.style.setProperty('--pod-radius', `${radii.tl} ${radii.tr} ${radii.br} ${radii.bl}`);
    podEl.style.setProperty('--pod-shadow', computeShadowBoxShadow(forceInset(podCfg.shadow, false)));
    applyInsideShadowLayer(podEl, computeInsideFadeBackground(podCfg.insideShadow), {
      contentEl: scopeEl,
      layer: podCfg && podCfg.insideShadow ? podCfg.insideShadow.layer : null,
    });

    podEl.setAttribute('data-width-mode', podCfg.widthMode);
    podEl.style.setProperty('--content-width', `${podCfg.contentWidth}px`);

    // Tell the parent that the widget has applied its first state.
    // Bob uses this to avoid rendering "default" HTML before the real config is applied.
    postReady(stageEl, scopeEl);

    // Notify parent (Bob/Prague/Venice embeds) of height changes when the stage can be content-driven.
    // `viewport` must report as well; otherwise iframe hosts can get stuck at a tiny initial height.
    const shouldReport =
      typeof window !== 'undefined' &&
      window.parent &&
      window.parent !== window &&
      (canvas.mode === 'wrap' || canvas.mode === 'viewport' || (canvas.mode === 'fixed' && !(canvas.height > 0)));
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
