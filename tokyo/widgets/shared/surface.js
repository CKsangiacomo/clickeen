(function () {
  if (typeof window === 'undefined') return;

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function assertRecord(value, name) {
    if (!isRecord(value)) throw new Error('[CKSurface] ' + name + ' must be an object');
  }

  function assertBoolean(value, name) {
    if (typeof value !== 'boolean') throw new Error('[CKSurface] ' + name + ' must be a boolean');
  }

  function assertNumber(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('[CKSurface] ' + name + ' must be a number');
  }

  function assertString(value, name) {
    if (typeof value !== 'string') throw new Error('[CKSurface] ' + name + ' must be a string');
  }

  function tokenizeRadius(value) {
    var normalized = String(value || '').trim();
    return normalized === 'none' ? '0' : 'var(--control-radius-' + normalized + ')';
  }

  function resolveRadius(card) {
    assertBoolean(card.radiusLinked, 'card.radiusLinked');
    assertString(card.radius, 'card.radius');
    assertString(card.radiusTL, 'card.radiusTL');
    assertString(card.radiusTR, 'card.radiusTR');
    assertString(card.radiusBR, 'card.radiusBR');
    assertString(card.radiusBL, 'card.radiusBL');

    if (card.radiusLinked === false) {
      return (
        tokenizeRadius(card.radiusTL) +
        ' ' +
        tokenizeRadius(card.radiusTR) +
        ' ' +
        tokenizeRadius(card.radiusBR) +
        ' ' +
        tokenizeRadius(card.radiusBL)
      );
    }

    var all = tokenizeRadius(card.radius);
    return all + ' ' + all + ' ' + all + ' ' + all;
  }

  function resolveBorder(border) {
    assertRecord(border, 'border');
    assertBoolean(border.enabled, 'border.enabled');
    assertNumber(border.width, 'border.width');
    assertString(border.color, 'border.color');

    var enabled = border.enabled === true && border.width > 0;
    return {
      width: enabled ? String(border.width) + 'px' : '0px',
      color: enabled ? border.color : 'transparent',
    };
  }

  function computeShadowBoxShadow(shadow) {
    assertRecord(shadow, 'shadow');
    assertBoolean(shadow.enabled, 'shadow.enabled');
    assertBoolean(shadow.inset, 'shadow.inset');
    assertNumber(shadow.x, 'shadow.x');
    assertNumber(shadow.y, 'shadow.y');
    assertNumber(shadow.blur, 'shadow.blur');
    assertNumber(shadow.spread, 'shadow.spread');
    assertString(shadow.color, 'shadow.color');
    assertNumber(shadow.alpha, 'shadow.alpha');
    if (shadow.alpha < 0 || shadow.alpha > 100) throw new Error('[CKSurface] shadow.alpha must be 0..100');

    if (shadow.enabled !== true || shadow.alpha <= 0) return 'none';
    var alphaMix = 100 - shadow.alpha;
    var color = 'color-mix(in oklab, ' + shadow.color + ', transparent ' + alphaMix + '%)';
    return (
      (shadow.inset === true ? 'inset ' : '') +
      shadow.x +
      'px ' +
      shadow.y +
      'px ' +
      shadow.blur +
      'px ' +
      shadow.spread +
      'px ' +
      color
    );
  }

  function forceInset(shadow, inset) {
    if (!isRecord(shadow)) return shadow;
    return Object.assign({}, shadow, { inset: inset });
  }

  function computeInsideFadeSizePx(side, shadow) {
    var axis = side === 'left' || side === 'right' ? shadow.x : shadow.y;
    var size = Math.abs(axis) + shadow.blur + shadow.spread;
    if (!Number.isFinite(size) || size <= 0) return 0;
    if (size > 400) return 400;
    return size;
  }

  function computeInsideFadeLayer(side, rawShadow) {
    if (!isRecord(rawShadow)) return null;

    var shadow = Object.assign({}, rawShadow, { inset: true });
    assertRecord(shadow, 'shadow');
    assertBoolean(shadow.enabled, 'shadow.enabled');
    assertBoolean(shadow.inset, 'shadow.inset');
    assertNumber(shadow.x, 'shadow.x');
    assertNumber(shadow.y, 'shadow.y');
    assertNumber(shadow.blur, 'shadow.blur');
    assertNumber(shadow.spread, 'shadow.spread');
    assertString(shadow.color, 'shadow.color');
    assertNumber(shadow.alpha, 'shadow.alpha');
    if (shadow.alpha < 0 || shadow.alpha > 100) throw new Error('[CKSurface] shadow.alpha must be 0..100');

    if (shadow.enabled !== true || shadow.alpha <= 0) return null;

    var sizePx = computeInsideFadeSizePx(side, shadow);
    if (sizePx <= 0) return null;

    var alphaMix = 100 - shadow.alpha;
    var mix = 'color-mix(in oklab, ' + shadow.color + ', transparent ' + alphaMix + '%)';

    if (side === 'left') {
      return 'linear-gradient(to right, ' + mix + ', transparent) left / ' + sizePx + 'px 100% no-repeat';
    }
    if (side === 'right') {
      return 'linear-gradient(to left, ' + mix + ', transparent) right / ' + sizePx + 'px 100% no-repeat';
    }
    if (side === 'top') {
      return 'linear-gradient(to bottom, ' + mix + ', transparent) top / 100% ' + sizePx + 'px no-repeat';
    }
    if (side === 'bottom') {
      return 'linear-gradient(to top, ' + mix + ', transparent) bottom / 100% ' + sizePx + 'px no-repeat';
    }
    return null;
  }

  function computeInsideFadeBackground(insideShadow) {
    if (!isRecord(insideShadow)) return 'none';

    var linked = insideShadow.linked !== false;
    var resolved = linked
      ? { top: insideShadow.all, right: insideShadow.all, bottom: insideShadow.all, left: insideShadow.all }
      : { top: insideShadow.top, right: insideShadow.right, bottom: insideShadow.bottom, left: insideShadow.left };

    var layers = [];
    var topLayer = computeInsideFadeLayer('top', resolved.top);
    if (topLayer) layers.push(topLayer);
    var rightLayer = computeInsideFadeLayer('right', resolved.right);
    if (rightLayer) layers.push(rightLayer);
    var bottomLayer = computeInsideFadeLayer('bottom', resolved.bottom);
    if (bottomLayer) layers.push(bottomLayer);
    var leftLayer = computeInsideFadeLayer('left', resolved.left);
    if (leftLayer) layers.push(leftLayer);

    return layers.length ? layers.join(', ') : 'none';
  }

  function applyCard(card, scopeEl, namespace) {
    assertRecord(card, 'card');
    if (!(scopeEl instanceof HTMLElement)) throw new Error('[CKSurface] scopeEl must be an HTMLElement');

    var key = typeof namespace === 'string' && namespace.trim() ? namespace.trim() : 'card';
    var baseVar = '--ck-' + key;

    var border = resolveBorder(card.border);
    var radius = resolveRadius(card);
    var outsideShadow = computeShadowBoxShadow(forceInset(card.shadow, false));
    var insideFade = computeInsideFadeBackground(card.insideShadow);

    scopeEl.style.setProperty(baseVar + '-border-width', border.width);
    scopeEl.style.setProperty(baseVar + '-border-color', border.color);
    scopeEl.style.setProperty(baseVar + '-radius', radius);
    scopeEl.style.setProperty(baseVar + '-shadow', outsideShadow);
    scopeEl.style.setProperty(baseVar + '-inside-fade', insideFade);

    return { border: border, radius: radius, shadow: outsideShadow, insideFade: insideFade };
  }

  function applyCardWrapper(card, scopeEl) {
    return applyCard(card, scopeEl, 'cardwrapper');
  }

  window.CKSurface = window.CKSurface || {};
  window.CKSurface.applyCard = applyCard;
  window.CKSurface.applyCardWrapper = applyCardWrapper;
})();
