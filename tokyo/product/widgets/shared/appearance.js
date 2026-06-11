(function () {
  if (typeof window === 'undefined') return;

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function clampNumber(value, min, max) {
    const n = typeof value === 'number' && Number.isFinite(value) ? value : min;
    return Math.min(max, Math.max(min, n));
  }

  function tokenizeRadius(value) {
    const normalized = String(value || '').trim();
    if (!normalized || normalized === 'none') return '0';
    return `var(--control-radius-${normalized})`;
  }

  function resolveCornerRadii(config) {
    const cfg = isRecord(config) ? config : {};
    if (cfg.radiusLinked === false) {
      return {
        tl: tokenizeRadius(cfg.radiusTL),
        tr: tokenizeRadius(cfg.radiusTR),
        br: tokenizeRadius(cfg.radiusBR),
        bl: tokenizeRadius(cfg.radiusBL),
      };
    }
    const all = tokenizeRadius(cfg.radius);
    return { tl: all, tr: all, br: all, bl: all };
  }

  function toCssBackground(value) {
    if (window.CKFill && typeof window.CKFill.toCssBackground === 'function') {
      return window.CKFill.toCssBackground(value);
    }
    if (isRecord(value)) throw new Error('[CKAppearance] Missing CKFill');
    return String(value ?? '');
  }

  function toCssColor(value) {
    if (window.CKFill && typeof window.CKFill.toCssColor === 'function') {
      return window.CKFill.toCssColor(value);
    }
    if (isRecord(value)) throw new Error('[CKAppearance] Missing CKFill');
    return String(value ?? '');
  }

  function forceInset(shadow, inset) {
    if (!isRecord(shadow)) return shadow;
    return { ...shadow, inset };
  }

  function shadowToBoxShadow(shadow) {
    if (!isRecord(shadow)) return 'none';
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

  window.CKAppearance = Object.freeze({
    forceInset,
    resolveCornerRadii,
    shadowToBoxShadow,
    toCssBackground,
    toCssColor,
    tokenizeRadius,
  });
})();
