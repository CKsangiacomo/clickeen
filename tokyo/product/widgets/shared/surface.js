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

  function resolveAppearance() {
    if (
      !window.CKAppearance ||
      typeof window.CKAppearance.forceInset !== 'function' ||
      typeof window.CKAppearance.resolveCornerRadii !== 'function' ||
      typeof window.CKAppearance.shadowToBoxShadow !== 'function'
    ) {
      throw new Error('[CKSurface] Missing CKAppearance helpers');
    }
    return window.CKAppearance;
  }

  function resolveRadius(card) {
    assertBoolean(card.radiusLinked, 'card.radiusLinked');
    assertString(card.radius, 'card.radius');
    assertString(card.radiusTL, 'card.radiusTL');
    assertString(card.radiusTR, 'card.radiusTR');
    assertString(card.radiusBR, 'card.radiusBR');
    assertString(card.radiusBL, 'card.radiusBL');

    var radius = resolveAppearance().resolveCornerRadii(card);
    return radius.tl + ' ' + radius.tr + ' ' + radius.br + ' ' + radius.bl;
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

  function assertShadow(shadow) {
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
  }

  function applyCard(card, scopeEl, namespace) {
    assertRecord(card, 'card');
    if (!(scopeEl instanceof HTMLElement)) throw new Error('[CKSurface] scopeEl must be an HTMLElement');

    var key = typeof namespace === 'string' && namespace.trim() ? namespace.trim() : 'card';
    var baseVar = '--ck-' + key;

    var appearance = resolveAppearance();
    var border = resolveBorder(card.border);
    var radius = resolveRadius(card);
    assertShadow(card.shadow);
    var outsideShadow = appearance.shadowToBoxShadow(appearance.forceInset(card.shadow, false));

    scopeEl.style.setProperty(baseVar + '-border-width', border.width);
    scopeEl.style.setProperty(baseVar + '-border-color', border.color);
    scopeEl.style.setProperty(baseVar + '-radius', radius);
    scopeEl.style.setProperty(baseVar + '-shadow', outsideShadow);

    return { border: border, radius: radius, shadow: outsideShadow };
  }

  function applyCardWrapper(card, scopeEl) {
    return applyCard(card, scopeEl, 'cardwrapper');
  }

  window.CKSurface = window.CKSurface || {};
  window.CKSurface.applyCard = applyCard;
  window.CKSurface.applyCardWrapper = applyCardWrapper;
})();
