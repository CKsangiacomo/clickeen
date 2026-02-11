(function () {
  if (typeof window === 'undefined') return;

  var INSIDE_SHADOW_LAYER_BELOW = 'below-content';
  var INSIDE_SHADOW_LAYER_ABOVE = 'above-content';
  var overlayStateByScope = new WeakMap();

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

  function resolveInsideShadowLayer(insideShadow) {
    if (!isRecord(insideShadow)) return INSIDE_SHADOW_LAYER_BELOW;
    var raw = typeof insideShadow.layer === 'string' ? insideShadow.layer.trim() : '';
    return raw === INSIDE_SHADOW_LAYER_ABOVE ? INSIDE_SHADOW_LAYER_ABOVE : INSIDE_SHADOW_LAYER_BELOW;
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

  function getOverlayState(scopeEl, key) {
    var byKey = overlayStateByScope.get(scopeEl);
    if (!byKey) {
      byKey = {};
      overlayStateByScope.set(scopeEl, byKey);
    }
    if (!byKey[key]) {
      byKey[key] = { observer: null, raf: 0, active: false, fade: 'none' };
    }
    return byKey[key];
  }

  function collectSurfaceTargets(scopeEl, key) {
    var selector = '[data-ck-surface="' + key + '"]';
    var list = [];
    if (typeof scopeEl.matches === 'function' && scopeEl.matches(selector)) list.push(scopeEl);
    scopeEl.querySelectorAll(selector).forEach(function (el) {
      if (el instanceof HTMLElement) list.push(el);
    });
    return list;
  }

  function findOverlayLayer(host, key) {
    var children = host.children;
    for (var i = 0; i < children.length; i += 1) {
      var child = children[i];
      if (!(child instanceof HTMLElement)) continue;
      if (!child.classList.contains('ck-surface-inside-shadow-layer')) continue;
      if (child.getAttribute('data-ck-surface-layer') !== key) continue;
      return child;
    }
    return null;
  }

  function ensureOverlayHost(host) {
    if (host.style.position === '') {
      var computed = window.getComputedStyle ? window.getComputedStyle(host).position : '';
      if (computed === 'static') {
        host.style.position = 'relative';
        host.setAttribute('data-ck-surface-overlay-position', 'true');
      }
    }
    if (host.style.isolation === '') {
      host.style.isolation = 'isolate';
      host.setAttribute('data-ck-surface-overlay-isolation', 'true');
    }
  }

  function cleanupOverlayHost(host) {
    if (host.getAttribute('data-ck-surface-overlay-position') === 'true') {
      host.style.removeProperty('position');
      host.removeAttribute('data-ck-surface-overlay-position');
    }
    if (host.getAttribute('data-ck-surface-overlay-isolation') === 'true') {
      host.style.removeProperty('isolation');
      host.removeAttribute('data-ck-surface-overlay-isolation');
    }
  }

  function syncOverlayLayers(scopeEl, key, insideFade) {
    var targets = collectSurfaceTargets(scopeEl, key);
    targets.forEach(function (host) {
      ensureOverlayHost(host);
      var layer = findOverlayLayer(host, key);
      if (!(layer instanceof HTMLElement)) {
        layer = document.createElement('div');
        layer.className = 'ck-surface-inside-shadow-layer';
        layer.setAttribute('data-ck-surface-layer', key);
        layer.setAttribute('aria-hidden', 'true');
        layer.style.position = 'absolute';
        layer.style.inset = '0';
        layer.style.pointerEvents = 'none';
        layer.style.borderRadius = 'inherit';
        layer.style.zIndex = '2';
        host.appendChild(layer);
      }
      layer.style.background = insideFade;
      layer.hidden = insideFade === 'none';
    });
  }

  function clearOverlayLayers(scopeEl, key) {
    if (scopeEl instanceof HTMLElement) {
      var selfLayer = findOverlayLayer(scopeEl, key);
      while (selfLayer instanceof HTMLElement) {
        selfLayer.remove();
        selfLayer = findOverlayLayer(scopeEl, key);
      }
      cleanupOverlayHost(scopeEl);
    }

    var selector = '.ck-surface-inside-shadow-layer[data-ck-surface-layer="' + key + '"]';
    scopeEl.querySelectorAll(selector).forEach(function (el) {
      if (!(el instanceof HTMLElement)) return;
      var host = el.parentElement;
      el.remove();
      if (host instanceof HTMLElement && !findOverlayLayer(host, key)) cleanupOverlayHost(host);
    });
  }

  function scheduleOverlaySync(scopeEl, key) {
    var state = getOverlayState(scopeEl, key);
    if (state.raf) return;
    state.raf = window.requestAnimationFrame(function () {
      state.raf = 0;
      if (!state.active) return;
      syncOverlayLayers(scopeEl, key, state.fade);
    });
  }

  function startOverlaySync(scopeEl, key, insideFade) {
    var state = getOverlayState(scopeEl, key);
    state.active = true;
    state.fade = insideFade;
    if (!state.observer && typeof MutationObserver !== 'undefined') {
      state.observer = new MutationObserver(function () {
        scheduleOverlaySync(scopeEl, key);
      });
      state.observer.observe(scopeEl, { childList: true, subtree: true });
    }
    scheduleOverlaySync(scopeEl, key);
  }

  function stopOverlaySync(scopeEl, key) {
    var state = getOverlayState(scopeEl, key);
    state.active = false;
    state.fade = 'none';
    if (state.raf) {
      window.cancelAnimationFrame(state.raf);
      state.raf = 0;
    }
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    clearOverlayLayers(scopeEl, key);
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
    var insideLayer = resolveInsideShadowLayer(card.insideShadow);

    scopeEl.style.setProperty(baseVar + '-border-width', border.width);
    scopeEl.style.setProperty(baseVar + '-border-color', border.color);
    scopeEl.style.setProperty(baseVar + '-radius', radius);
    scopeEl.style.setProperty(baseVar + '-shadow', outsideShadow);
    scopeEl.style.setProperty(baseVar + '-inside-fade', insideLayer === INSIDE_SHADOW_LAYER_ABOVE ? 'none' : insideFade);

    if (insideLayer === INSIDE_SHADOW_LAYER_ABOVE && insideFade !== 'none') {
      startOverlaySync(scopeEl, key, insideFade);
    } else {
      stopOverlaySync(scopeEl, key);
    }

    return { border: border, radius: radius, shadow: outsideShadow, insideFade: insideFade, insideLayer: insideLayer };
  }

  function applyCardWrapper(card, scopeEl) {
    return applyCard(card, scopeEl, 'cardwrapper');
  }

  window.CKSurface = window.CKSurface || {};
  window.CKSurface.applyCard = applyCard;
  window.CKSurface.applyCardWrapper = applyCardWrapper;
})();
