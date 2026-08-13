(function () {
  if (typeof window === 'undefined') return;

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
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
    if (!window.CKFill || typeof window.CKFill.toCssBackground !== 'function') throw new Error('[CKAppearance] Missing CKFill');
    return window.CKFill.toCssBackground(value);
  }

  function toCssColor(value) {
    if (!window.CKFill || typeof window.CKFill.toCssColor !== 'function') throw new Error('[CKAppearance] Missing CKFill');
    return window.CKFill.toCssColor(value);
  }

  function assertNumber(value, min, max, path) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new Error(`[CKAppearance] ${path} must be ${min}..${max}`);
    }
  }

  function assertShadow(shadow, expectedInset, path) {
    if (!isRecord(shadow)) throw new Error(`[CKAppearance] ${path} must be an object`);
    if (typeof shadow.enabled !== 'boolean') throw new Error(`[CKAppearance] ${path}.enabled must be a boolean`);
    if (shadow.inset !== expectedInset) {
      throw new Error(`[CKAppearance] ${path}.inset must be ${String(expectedInset)}`);
    }
    assertNumber(shadow.x, -200, 200, `${path}.x`);
    assertNumber(shadow.y, -200, 200, `${path}.y`);
    assertNumber(shadow.blur, 0, 400, `${path}.blur`);
    assertNumber(shadow.spread, -200, 200, `${path}.spread`);
    assertNumber(shadow.alpha, 0, 100, `${path}.alpha`);
    if (typeof shadow.color !== 'string' || !shadow.color.trim() || shadow.color !== shadow.color.trim()) {
      throw new Error(`[CKAppearance] ${path}.color must be a non-empty exact string`);
    }
    return shadow;
  }

  function shadowToBoxShadow(shadow, expectedInset, path) {
    assertShadow(shadow, expectedInset, path);
    if (shadow.enabled !== true) return 'none';
    if (shadow.alpha === 0) return 'none';
    const alphaMix = 100 - shadow.alpha;
    const mix = `color-mix(in oklab, ${shadow.color}, transparent ${alphaMix}%)`;
    return `${expectedInset ? 'inset ' : ''}${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${mix}`;
  }

  function insideShadowToBoxShadowList(group, path) {
    if (!isRecord(group)) throw new Error(`[CKAppearance] ${path} must be an object`);
    if (typeof group.linked !== 'boolean') throw new Error(`[CKAppearance] ${path}.linked must be a boolean`);
    if (group.layer !== 'below-content' && group.layer !== 'above-content') {
      throw new Error(`[CKAppearance] ${path}.layer must be below-content or above-content`);
    }
    const shadows = {
      all: assertShadow(group.all, true, `${path}.all`),
      top: assertShadow(group.top, true, `${path}.top`),
      right: assertShadow(group.right, true, `${path}.right`),
      bottom: assertShadow(group.bottom, true, `${path}.bottom`),
      left: assertShadow(group.left, true, `${path}.left`),
    };
    const active = group.linked
      ? [shadows.all]
      : [shadows.top, shadows.right, shadows.bottom, shadows.left];
    const rendered = active
      .map((shadow, index) => shadowToBoxShadow(shadow, true, `${path}.${group.linked ? 'all' : ['top', 'right', 'bottom', 'left'][index]}`))
      .filter((value) => value !== 'none');
    return rendered.length > 0 ? rendered.join(', ') : 'none';
  }

  function resolveOutsideShadowGutters(shadow, path) {
    assertShadow(shadow, false, path);
    if (shadow.enabled !== true || shadow.alpha === 0) {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }
    const extent = Math.max(0, Math.ceil(shadow.blur * 1.5 + shadow.spread));
    return {
      top: Math.max(0, extent - shadow.y),
      right: Math.max(0, extent + shadow.x),
      bottom: Math.max(0, extent + shadow.y),
      left: Math.max(0, extent - shadow.x),
    };
  }

  window.CKAppearance = Object.freeze({
    insideShadowToBoxShadowList,
    resolveCornerRadii,
    resolveOutsideShadowGutters,
    shadowToBoxShadow,
    toCssBackground,
    toCssColor,
    tokenizeRadius,
  });
})();
