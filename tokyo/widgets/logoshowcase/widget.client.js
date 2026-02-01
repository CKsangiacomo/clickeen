// LogoShowcase widget runtime (strict, deterministic).
// Assumes canonical, typed state from the editor; no runtime fallbacks/merges.

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const scriptEl = document.currentScript;
  if (!(scriptEl instanceof HTMLElement)) return;

  const widgetRoot = scriptEl.closest('[data-ck-widget="logoshowcase"]');
  if (!(widgetRoot instanceof HTMLElement)) {
    throw new Error('[LogoShowcase] widget.client.js must be rendered inside [data-ck-widget="logoshowcase"]');
  }

  const lsRoot = widgetRoot.querySelector('[data-role="logoshowcase"]');
  if (!(lsRoot instanceof HTMLElement)) {
    throw new Error('[LogoShowcase] Missing [data-role="logoshowcase"] root');
  }

  const stripsEl = lsRoot.querySelector('[data-role="strips"]');
  if (!(stripsEl instanceof HTMLElement)) {
    throw new Error('[LogoShowcase] Missing [data-role="strips"]');
  }

  const assetOriginRaw = typeof window.CK_ASSET_ORIGIN === 'string' ? window.CK_ASSET_ORIGIN : '';
  const scriptOrigin = (() => {
    if (!(scriptEl instanceof HTMLScriptElement)) return '';
    try {
      return new URL(scriptEl.src, window.location.href).origin;
    } catch {
      return '';
    }
  })();
  const assetOrigin = (assetOriginRaw || scriptOrigin || window.location.origin).replace(/\/$/, '');
  widgetRoot.style.setProperty('--ck-asset-origin', assetOrigin);
  widgetRoot.style.setProperty('--ls-icon-prev', `url("${assetOrigin}/dieter/icons/svg/chevron.left.svg")`);
  widgetRoot.style.setProperty('--ls-icon-next', `url("${assetOrigin}/dieter/icons/svg/chevron.right.svg")`);

  const resolvedPublicId = (() => {
    const direct = widgetRoot.getAttribute('data-ck-public-id');
    if (typeof direct === 'string' && direct.trim()) return direct.trim();

    const rootNode = widgetRoot.getRootNode();
    if (rootNode instanceof ShadowRoot) {
      const host = rootNode.host;
      const fromHost = host instanceof HTMLElement ? host.getAttribute('data-ck-public-id') : '';
      if (typeof fromHost === 'string' && fromHost.trim()) return fromHost.trim();
    }

    const ancestor = widgetRoot.closest('[data-ck-public-id]');
    const fromAncestor = ancestor instanceof HTMLElement ? ancestor.getAttribute('data-ck-public-id') : '';
    if (typeof fromAncestor === 'string' && fromAncestor.trim()) return fromAncestor.trim();

    const global = window.CK_WIDGET && typeof window.CK_WIDGET === 'object' ? window.CK_WIDGET : null;
    const candidate = global && typeof global.publicId === 'string' ? global.publicId.trim() : '';
    return candidate || '';
  })();
  if (resolvedPublicId) widgetRoot.setAttribute('data-ck-public-id', resolvedPublicId);

  function assertBoolean(value, path) {
    if (typeof value !== 'boolean') throw new Error(`[LogoShowcase] ${path} must be a boolean`);
  }

  function assertNumber(value, path) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`[LogoShowcase] ${path} must be a finite number`);
    }
  }

  function assertString(value, path) {
    if (typeof value !== 'string') throw new Error(`[LogoShowcase] ${path} must be a string`);
  }

  function assertObject(value, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`[LogoShowcase] ${path} must be an object`);
    }
  }

  function assertFill(value, path) {
    if (typeof value === 'string') return;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`[LogoShowcase] ${path} must be a fill`);
    }
    if (typeof value.type !== 'string' || !value.type.trim()) {
      throw new Error(`[LogoShowcase] ${path}.type must be a string`);
    }
  }

  function assertArray(value, path) {
    if (!Array.isArray(value)) throw new Error(`[LogoShowcase] ${path} must be an array`);
  }

  function assertBorderConfig(value, path) {
    assertObject(value, path);
    assertBoolean(value.enabled, `${path}.enabled`);
    assertNumber(value.width, `${path}.width`);
    assertString(value.color, `${path}.color`);
    if (value.width < 0 || value.width > 12) {
      throw new Error(`[LogoShowcase] ${path}.width must be 0..12`);
    }
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function assertLogoShowcaseState(state) {
    assertObject(state, 'state');

    assertObject(state.header, 'state.header');
    assertBoolean(state.header.enabled, 'state.header.enabled');
    assertString(state.header.title, 'state.header.title');
    assertBoolean(state.header.showSubtitle, 'state.header.showSubtitle');
    assertString(state.header.subtitleHtml, 'state.header.subtitleHtml');
    assertString(state.header.alignment, 'state.header.alignment');
    if (!['left', 'center', 'right'].includes(state.header.alignment)) {
      throw new Error('[LogoShowcase] state.header.alignment must be left|center|right');
    }
    assertString(state.header.placement, 'state.header.placement');
    if (!['top', 'bottom', 'left', 'right'].includes(state.header.placement)) {
      throw new Error('[LogoShowcase] state.header.placement must be top|bottom|left|right');
    }
    assertString(state.header.ctaPlacement, 'state.header.ctaPlacement');
    if (!['right', 'below'].includes(state.header.ctaPlacement)) {
      throw new Error('[LogoShowcase] state.header.ctaPlacement must be right|below');
    }

    assertArray(state.strips, 'state.strips');
    state.strips.forEach((strip, stripIdx) => {
      assertObject(strip, `state.strips[${stripIdx}]`);
      assertString(strip.id, `state.strips[${stripIdx}].id`);
      assertArray(strip.logos, `state.strips[${stripIdx}].logos`);
      strip.logos.forEach((logo, logoIdx) => {
        assertObject(logo, `state.strips[${stripIdx}].logos[${logoIdx}]`);
        assertString(logo.id, `state.strips[${stripIdx}].logos[${logoIdx}].id`);
        assertString(logo.name, `state.strips[${stripIdx}].logos[${logoIdx}].name`);
        assertString(logo.logoFill, `state.strips[${stripIdx}].logos[${logoIdx}].logoFill`);
        assertString(logo.href, `state.strips[${stripIdx}].logos[${logoIdx}].href`);
        assertBoolean(logo.targetBlank, `state.strips[${stripIdx}].logos[${logoIdx}].targetBlank`);
        assertBoolean(logo.nofollow, `state.strips[${stripIdx}].logos[${logoIdx}].nofollow`);
        assertString(logo.alt, `state.strips[${stripIdx}].logos[${logoIdx}].alt`);
        assertString(logo.title, `state.strips[${stripIdx}].logos[${logoIdx}].title`);
        assertString(logo.caption, `state.strips[${stripIdx}].logos[${logoIdx}].caption`);
      });
    });

    assertObject(state.cta, 'state.cta');
    assertBoolean(state.cta.enabled, 'state.cta.enabled');
    assertString(state.cta.label, 'state.cta.label');
    assertString(state.cta.href, 'state.cta.href');
    assertBoolean(state.cta.iconEnabled, 'state.cta.iconEnabled');
    assertString(state.cta.iconName, 'state.cta.iconName');
    assertString(state.cta.iconPlacement, 'state.cta.iconPlacement');
    if (!['left', 'right'].includes(state.cta.iconPlacement)) {
      throw new Error('[LogoShowcase] state.cta.iconPlacement must be left|right');
    }

    if (!['grid', 'carousel'].includes(state.type)) {
      throw new Error('[LogoShowcase] state.type must be grid|carousel');
    }

    assertObject(state.typeConfig, 'state.typeConfig');
    assertObject(state.typeConfig.grid, 'state.typeConfig.grid');

    assertObject(state.typeConfig.carousel, 'state.typeConfig.carousel');
    if (!['paged', 'continuous'].includes(state.typeConfig.carousel.mode)) {
      throw new Error('[LogoShowcase] state.typeConfig.carousel.mode must be paged|continuous');
    }
    if (!['logo', 'page'].includes(state.typeConfig.carousel.step)) {
      throw new Error('[LogoShowcase] state.typeConfig.carousel.step must be logo|page');
    }
    assertBoolean(state.typeConfig.carousel.showArrows, 'state.typeConfig.carousel.showArrows');
    assertBoolean(state.typeConfig.carousel.allowSwipe, 'state.typeConfig.carousel.allowSwipe');
    assertBoolean(state.typeConfig.carousel.autoplay, 'state.typeConfig.carousel.autoplay');
    assertBoolean(state.typeConfig.carousel.pauseOnHover, 'state.typeConfig.carousel.pauseOnHover');
    assertNumber(state.typeConfig.carousel.autoSlideDelayMs, 'state.typeConfig.carousel.autoSlideDelayMs');
    assertNumber(state.typeConfig.carousel.transitionMs, 'state.typeConfig.carousel.transitionMs');
    assertNumber(state.typeConfig.carousel.speed, 'state.typeConfig.carousel.speed');
    if (!['left', 'right'].includes(state.typeConfig.carousel.direction)) {
      throw new Error('[LogoShowcase] state.typeConfig.carousel.direction must be left|right');
    }

    assertObject(state.appearance, 'state.appearance');
    if (!['original', 'grayscale'].includes(state.appearance.logoLook)) {
      throw new Error('[LogoShowcase] state.appearance.logoLook must be original|grayscale');
    }
    assertNumber(state.appearance.logoOpacity, 'state.appearance.logoOpacity');
    if (state.appearance.logoOpacity < 0 || state.appearance.logoOpacity > 1) {
      throw new Error('[LogoShowcase] state.appearance.logoOpacity must be 0..1');
    }

    assertFill(state.appearance.itemBackground, 'state.appearance.itemBackground');
    assertObject(state.appearance.itemCard, 'state.appearance.itemCard');

    assertBoolean(state.appearance.itemCard.radiusLinked, 'state.appearance.itemCard.radiusLinked');
    assertString(state.appearance.itemCard.radius, 'state.appearance.itemCard.radius');
    assertString(state.appearance.itemCard.radiusTL, 'state.appearance.itemCard.radiusTL');
    assertString(state.appearance.itemCard.radiusTR, 'state.appearance.itemCard.radiusTR');
    assertString(state.appearance.itemCard.radiusBR, 'state.appearance.itemCard.radiusBR');
    assertString(state.appearance.itemCard.radiusBL, 'state.appearance.itemCard.radiusBL');

    assertObject(state.appearance.itemCard.border, 'state.appearance.itemCard.border');
    assertBoolean(state.appearance.itemCard.border.enabled, 'state.appearance.itemCard.border.enabled');
    assertNumber(state.appearance.itemCard.border.width, 'state.appearance.itemCard.border.width');
    assertString(state.appearance.itemCard.border.color, 'state.appearance.itemCard.border.color');

    assertObject(state.appearance.itemCard.shadow, 'state.appearance.itemCard.shadow');
    assertBoolean(state.appearance.itemCard.shadow.enabled, 'state.appearance.itemCard.shadow.enabled');
    assertBoolean(state.appearance.itemCard.shadow.inset, 'state.appearance.itemCard.shadow.inset');
    assertNumber(state.appearance.itemCard.shadow.x, 'state.appearance.itemCard.shadow.x');
    assertNumber(state.appearance.itemCard.shadow.y, 'state.appearance.itemCard.shadow.y');
    assertNumber(state.appearance.itemCard.shadow.blur, 'state.appearance.itemCard.shadow.blur');
    assertNumber(state.appearance.itemCard.shadow.spread, 'state.appearance.itemCard.shadow.spread');
    assertString(state.appearance.itemCard.shadow.color, 'state.appearance.itemCard.shadow.color');
    assertNumber(state.appearance.itemCard.shadow.alpha, 'state.appearance.itemCard.shadow.alpha');
    if (state.appearance.itemCard.shadow.alpha < 0 || state.appearance.itemCard.shadow.alpha > 100) {
      throw new Error('[LogoShowcase] state.appearance.itemCard.shadow.alpha must be 0..100');
    }

    assertFill(state.appearance.ctaBackground, 'state.appearance.ctaBackground');
    assertFill(state.appearance.ctaTextColor, 'state.appearance.ctaTextColor');
    assertBorderConfig(state.appearance.ctaBorder, 'state.appearance.ctaBorder');
    assertString(state.appearance.ctaRadius, 'state.appearance.ctaRadius');
    assertString(state.appearance.ctaSizePreset, 'state.appearance.ctaSizePreset');
    if (!['xs', 's', 'm', 'l', 'xl', 'custom'].includes(state.appearance.ctaSizePreset)) {
      throw new Error('[LogoShowcase] state.appearance.ctaSizePreset must be xs|s|m|l|xl|custom');
    }
    assertBoolean(state.appearance.ctaPaddingLinked, 'state.appearance.ctaPaddingLinked');
    assertNumber(state.appearance.ctaPaddingInline, 'state.appearance.ctaPaddingInline');
    assertNumber(state.appearance.ctaPaddingBlock, 'state.appearance.ctaPaddingBlock');
    assertString(state.appearance.ctaIconSizePreset, 'state.appearance.ctaIconSizePreset');
    if (!['xs', 's', 'm', 'l', 'xl', 'custom'].includes(state.appearance.ctaIconSizePreset)) {
      throw new Error('[LogoShowcase] state.appearance.ctaIconSizePreset must be xs|s|m|l|xl|custom');
    }
    assertNumber(state.appearance.ctaIconSize, 'state.appearance.ctaIconSize');

    assertObject(state.spacing, 'state.spacing');
    assertNumber(state.spacing.gap, 'state.spacing.gap');
    assertNumber(state.spacing.rowGap, 'state.spacing.rowGap');
    assertNumber(state.spacing.stripGap, 'state.spacing.stripGap');
    assertNumber(state.spacing.logoHeight, 'state.spacing.logoHeight');
    assertNumber(state.spacing.mobileGap, 'state.spacing.mobileGap');
    assertNumber(state.spacing.mobileStripGap, 'state.spacing.mobileStripGap');

    assertObject(state.behavior, 'state.behavior');
    assertBoolean(state.behavior.randomOrder, 'state.behavior.randomOrder');
    assertBoolean(state.behavior.showBacklink, 'state.behavior.showBacklink');

    assertObject(state.stage, 'state.stage');
    assertObject(state.pod, 'state.pod');
    assertObject(state.typography, 'state.typography');
  }

  function normalizeHttpUrl(raw) {
    const v = String(raw || '').trim();
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) return null;
    return v;
  }

  function resolveAssetUrl(raw, origin) {
    const v = String(raw || '').trim();
    if (!v) return null;
    if (/^(?:data:|blob:|https?:\/\/|\/\/)/i.test(v)) return v;
    if (!origin) return v;
    try {
      return new URL(v, origin).toString();
    } catch {
      return v;
    }
  }

  function extractPrimaryUrl(raw, origin) {
    const v = String(raw || '').trim();
    if (!v) return null;
    if (/^(?:data:|blob:|https?:\/\/|\/\/)/i.test(v)) return v;
    // CSS fill string, e.g. url("data:...") center center / cover no-repeat
    const m = v.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
    if (m && m[2]) return resolveAssetUrl(m[2], origin);
    if (/^(?:\/|\.\/|\.\.\/)/.test(v)) return resolveAssetUrl(v, origin);
    return null;
  }

  function fnv1a32(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
      hash ^= str.charCodeAt(i);
      // 32-bit FNV-1a: hash *= 16777619
      hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
    }
    return hash >>> 0;
  }

  function xorshift32(seed) {
    let x = seed >>> 0;
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) / 4294967296;
    };
  }

  function shuffleWithSeed(items, seed) {
    const out = items.slice();
    const rand = xorshift32(seed);
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function resolveFillBackground(value) {
    if (window.CKFill && typeof window.CKFill.toCssBackground === 'function') {
      return window.CKFill.toCssBackground(value);
    }
    return String(value ?? '');
  }

  function applyLayoutVars(state) {
    lsRoot.style.setProperty('--ls-gap', `${state.spacing.gap}px`);
    lsRoot.style.setProperty('--ls-gap-mobile', `${state.spacing.mobileGap}px`);
    lsRoot.style.setProperty('--ls-strip-gap', `${state.spacing.stripGap}px`);
    lsRoot.style.setProperty('--ls-strip-gap-mobile', `${state.spacing.mobileStripGap}px`);
    lsRoot.style.setProperty('--ls-row-gap', `${state.spacing.rowGap}px`);
    lsRoot.style.setProperty('--ls-logo-h', `${state.spacing.logoHeight}px`);
    lsRoot.style.setProperty('--ls-logo-h-mobile', `${state.spacing.logoHeight}px`);
  }

  function applyAppearanceVars(state) {
    lsRoot.style.setProperty('--ls-logo-opacity', String(state.appearance.logoOpacity));
    lsRoot.style.setProperty('--ls-logo-filter', state.appearance.logoLook === 'grayscale' ? 'grayscale(1)' : 'none');

    lsRoot.style.setProperty('--ls-item-bg', resolveFillBackground(state.appearance.itemBackground));
    if (!window.CKSurface?.applyItemCard) {
      throw new Error('[LogoShowcase] Missing CKSurface.applyItemCard');
    }
    window.CKSurface.applyItemCard(state.appearance.itemCard, lsRoot);
  }

  function renderLogoTile(logo) {
    const href = normalizeHttpUrl(logo.href);
    const isClickable = Boolean(href);

    const tileEl = isClickable ? document.createElement('a') : document.createElement('div');
    tileEl.className = 'ck-logoshowcase__logo';
    tileEl.setAttribute('data-role', 'logo');

    const altText = String(logo.alt || '').trim();
    const nameText = String(logo.name || '').trim();
    const aria = altText || nameText;
    if (aria) tileEl.setAttribute('aria-label', aria);

    const titleText = String(logo.title || '').trim();
    if (titleText) tileEl.setAttribute('title', titleText);

    if (isClickable) {
      tileEl.setAttribute('href', href);
      if (logo.targetBlank === true) tileEl.setAttribute('target', '_blank');
      else tileEl.removeAttribute('target');

      const rel = logo.nofollow === true ? 'nofollow noopener noreferrer' : 'noopener noreferrer';
      tileEl.setAttribute('rel', rel);
    }

    const visualEl = document.createElement('div');
    visualEl.className = 'ck-logoshowcase__logo-visual';
    visualEl.setAttribute('data-role', 'logo-visual');
    visualEl.setAttribute('role', 'img');
    if (aria) visualEl.setAttribute('aria-label', aria);

    const primaryUrl = extractPrimaryUrl(logo.logoFill, assetOrigin);
    if (primaryUrl) {
      const safeUrl = primaryUrl.replace(/"/g, '%22');
      visualEl.style.backgroundImage = `url("${safeUrl}")`;
    } else {
      visualEl.style.removeProperty('background-image');
    }

    const captionEl = document.createElement('div');
    captionEl.className = 'ck-logoshowcase__logo-caption';
    captionEl.setAttribute('data-role', 'logo-caption');
    const captionText = String(logo.caption || '').trim() || nameText;
    captionEl.textContent = captionText;
    captionEl.hidden = !captionText;

    tileEl.appendChild(visualEl);
    tileEl.appendChild(captionEl);
    return tileEl;
  }

  function renderStrips(state) {
    // Clean up existing per-strip motion bindings before DOM churn.
    Array.from(stripsEl.querySelectorAll('[data-role="strip"]')).forEach((stripEl) => cleanupStrip(stripEl));

    stripsEl.innerHTML = '';

    state.strips.forEach((strip) => {
      const stripEl = document.createElement('div');
      stripEl.className = 'ck-logoshowcase__strip';
      stripEl.setAttribute('data-role', 'strip');
      stripEl.setAttribute('data-strip-id', strip.id);

      const viewportEl = document.createElement('div');
      viewportEl.className = 'ck-logoshowcase__strip-viewport';
      viewportEl.setAttribute('data-role', 'strip-viewport');

      const trackEl = document.createElement('div');
      trackEl.className = 'ck-logoshowcase__strip-track';
      trackEl.setAttribute('data-role', 'strip-track');

      const logos = (() => {
        if (state.behavior.randomOrder !== true) return strip.logos;
        const seedString = `${strip.id}|${strip.logos.map((l) => l.id).join(',')}`;
        return shuffleWithSeed(strip.logos, fnv1a32(seedString));
      })();

      const isContinuous = state.type === 'carousel' && state.typeConfig.carousel.mode === 'continuous';
      if (isContinuous) {
        const copyA = document.createElement('div');
        copyA.className = 'ck-logoshowcase__ticker-copy';
        copyA.setAttribute('data-role', 'ticker-a');

        const copyB = document.createElement('div');
        copyB.className = 'ck-logoshowcase__ticker-copy';
        copyB.setAttribute('data-role', 'ticker-b');

        const listA = document.createElement('div');
        listA.className = 'ck-logoshowcase__logos';
        listA.setAttribute('data-role', 'logos');

        const listB = document.createElement('div');
        listB.className = 'ck-logoshowcase__logos';
        listB.setAttribute('data-role', 'logos');

        logos.forEach((logo) => {
          listA.appendChild(renderLogoTile(logo));
          listB.appendChild(renderLogoTile(logo));
        });

        copyA.appendChild(listA);
        copyB.appendChild(listB);
        trackEl.appendChild(copyA);
        trackEl.appendChild(copyB);
      } else {
        const listEl = document.createElement('div');
        listEl.className = 'ck-logoshowcase__logos';
        listEl.setAttribute('data-role', 'logos');
        logos.forEach((logo) => listEl.appendChild(renderLogoTile(logo)));
        trackEl.appendChild(listEl);
      }

      viewportEl.appendChild(trackEl);
      stripEl.appendChild(viewportEl);

      const navEl = document.createElement('div');
      navEl.className = 'ck-logoshowcase__nav';
      navEl.setAttribute('data-role', 'nav');

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'diet-btn-ic ck-logoshowcase__arrow';
      prevBtn.setAttribute('data-size', 'md');
      prevBtn.setAttribute('data-variant', 'neutral');
      prevBtn.setAttribute('data-role', 'arrow');
      prevBtn.setAttribute('data-dir', 'prev');
      prevBtn.setAttribute('aria-label', 'Previous');
      prevBtn.innerHTML = '<span class="diet-btn-ic__icon"></span>';

      const dotsEl = document.createElement('div');
      dotsEl.className = 'ck-logoshowcase__dots';
      dotsEl.setAttribute('data-role', 'dots');

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'diet-btn-ic ck-logoshowcase__arrow';
      nextBtn.setAttribute('data-size', 'md');
      nextBtn.setAttribute('data-variant', 'neutral');
      nextBtn.setAttribute('data-role', 'arrow');
      nextBtn.setAttribute('data-dir', 'next');
      nextBtn.setAttribute('aria-label', 'Next');
      nextBtn.innerHTML = '<span class="diet-btn-ic__icon"></span>';

      navEl.appendChild(prevBtn);
      navEl.appendChild(dotsEl);
      navEl.appendChild(nextBtn);
      stripEl.appendChild(navEl);

      stripsEl.appendChild(stripEl);
    });
  }

  function isMobile() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function animateScrollLeft(el, targetLeft, durationMs, runtime) {
    if (!(el instanceof HTMLElement)) return;
    const to = Math.max(0, Math.round(targetLeft));
    const duration = Math.max(0, Math.round(durationMs));

    if (runtime.raf) cancelAnimationFrame(runtime.raf);
    runtime.raf = 0;

    if (duration <= 0) {
      el.scrollLeft = to;
      return;
    }

    const start = el.scrollLeft;
    const delta = to - start;
    const startTime = performance.now();

    const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const tick = (now) => {
      const t = clamp((now - startTime) / duration, 0, 1);
      el.scrollLeft = start + delta * easeInOutQuad(t);
      if (t < 1) runtime.raf = requestAnimationFrame(tick);
      else runtime.raf = 0;
    };

    runtime.raf = requestAnimationFrame(tick);
  }

  const stripBindings = new WeakMap();

  function cleanupStrip(stripEl) {
    const runtime = stripBindings.get(stripEl);
    if (!runtime) return;
    try {
      runtime.cleanup();
    } finally {
      stripBindings.delete(stripEl);
    }
  }

  function bindPagedMotion(stripEl, state) {
    const viewportEl = stripEl.querySelector('[data-role="strip-viewport"]');
    const navEl = stripEl.querySelector('[data-role="nav"]');
    const dotsEl = stripEl.querySelector('[data-role="dots"]');
    const prevBtn = stripEl.querySelector('[data-role="arrow"][data-dir="prev"]');
    const nextBtn = stripEl.querySelector('[data-role="arrow"][data-dir="next"]');

    if (!(viewportEl instanceof HTMLElement)) return;
    if (!(navEl instanceof HTMLElement)) return;
    if (!(dotsEl instanceof HTMLElement)) return;
    if (!(prevBtn instanceof HTMLButtonElement)) return;
    if (!(nextBtn instanceof HTMLButtonElement)) return;

    const cfg = state.typeConfig.carousel;

    stripEl.dataset.swipe = cfg.allowSwipe === true ? 'true' : 'false';
    stripEl.dataset.pauseOnHover = 'false';

    prevBtn.hidden = cfg.showArrows !== true;
    nextBtn.hidden = cfg.showArrows !== true;
    dotsEl.hidden = true;
    navEl.hidden = cfg.showArrows !== true;
    navEl.dataset.dots = 'false';
    navEl.dataset.arrows = cfg.showArrows === true ? 'true' : 'false';

    let hovering = false;
    const onEnter = () => {
      hovering = true;
    };
    const onLeave = () => {
      hovering = false;
    };
    stripEl.addEventListener('mouseenter', onEnter);
    stripEl.addEventListener('mouseleave', onLeave);

    const runtime = {
      raf: 0,
      interval: 0,
      ro: null,
      cleanup: () => {},
    };

    const getPaging = () => {
      const itemCount = stripEl.querySelectorAll('[data-role="logos"] [data-role="logo"]').length;
      const first = stripEl.querySelector('[data-role="logos"] [data-role="logo"]');
      const tileW = first instanceof HTMLElement ? first.getBoundingClientRect().width : 0;
      const gap = isMobile() ? state.spacing.mobileGap : state.spacing.gap;
      const viewportW = viewportEl.clientWidth;
      const perPage = tileW > 0 ? Math.max(1, Math.floor((viewportW + gap) / (tileW + gap))) : 1;
      const stepMode = cfg.step === 'logo' ? 'logo' : 'page';
      const pageCount =
        stepMode === 'logo' ? Math.max(1, itemCount) : Math.max(1, Math.ceil(itemCount / perPage));
      const stepPx = (stepMode === 'logo' ? 1 : perPage) * (tileW + gap);
      const pageIndex = stepPx > 0 ? clamp(Math.round(viewportEl.scrollLeft / stepPx), 0, pageCount - 1) : 0;
      return { itemCount, tileW, viewportW, perPage, pageCount, stepPx, pageIndex };
    };

    const syncUi = () => {
      const { pageCount, pageIndex } = getPaging();
      if (cfg.showArrows === true) {
        prevBtn.disabled = pageIndex <= 0;
        nextBtn.disabled = pageIndex >= pageCount - 1;
      }
    };

    const scrollToPage = (targetIndex, animate) => {
      const { pageCount, stepPx } = getPaging();
      if (pageCount <= 1 || stepPx <= 0) return;
      const idx = clamp(targetIndex, 0, pageCount - 1);
      const targetLeft = idx * stepPx;
      if (animate) animateScrollLeft(viewportEl, targetLeft, cfg.transitionMs, runtime);
      else viewportEl.scrollLeft = targetLeft;
      syncUi();
    };

    const onClickPrev = () => {
      const { pageIndex } = getPaging();
      scrollToPage(pageIndex - 1, true);
    };
    const onClickNext = () => {
      const { pageIndex } = getPaging();
      scrollToPage(pageIndex + 1, true);
    };

    prevBtn.addEventListener('click', onClickPrev);
    nextBtn.addEventListener('click', onClickNext);

    const onScroll = () => syncUi();
    viewportEl.addEventListener('scroll', onScroll, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
      runtime.ro = new ResizeObserver(() => {
        const { pageIndex } = getPaging();
        scrollToPage(pageIndex, false);
      });
      runtime.ro.observe(viewportEl);
    }

    if (cfg.autoplay === true && cfg.autoSlideDelayMs > 0) {
      runtime.interval = window.setInterval(() => {
        if (cfg.pauseOnHover === true && hovering) return;
        const { pageIndex, pageCount } = getPaging();
        if (pageCount <= 1) return;
        scrollToPage((pageIndex + 1) % pageCount, true);
      }, Math.round(cfg.autoSlideDelayMs));
    }

    runtime.cleanup = () => {
      if (runtime.raf) cancelAnimationFrame(runtime.raf);
      runtime.raf = 0;
      if (runtime.interval) clearInterval(runtime.interval);
      runtime.interval = 0;
      if (runtime.ro) runtime.ro.disconnect();
      runtime.ro = null;

      stripEl.removeEventListener('mouseenter', onEnter);
      stripEl.removeEventListener('mouseleave', onLeave);
      prevBtn.removeEventListener('click', onClickPrev);
      nextBtn.removeEventListener('click', onClickNext);
      viewportEl.removeEventListener('scroll', onScroll);
    };

    stripBindings.set(stripEl, runtime);
    syncUi();
  }

  function bindContinuousMotion(stripEl, state) {
    const viewportEl = stripEl.querySelector('[data-role="strip-viewport"]');
    const trackEl = stripEl.querySelector('[data-role="strip-track"]');
    const navEl = stripEl.querySelector('[data-role="nav"]');
    const dotsEl = stripEl.querySelector('[data-role="dots"]');
    const prevBtn = stripEl.querySelector('[data-role="arrow"][data-dir="prev"]');
    const nextBtn = stripEl.querySelector('[data-role="arrow"][data-dir="next"]');

    if (!(viewportEl instanceof HTMLElement)) return;
    if (!(trackEl instanceof HTMLElement)) return;
    if (!(navEl instanceof HTMLElement)) return;
    if (!(dotsEl instanceof HTMLElement)) return;
    if (!(prevBtn instanceof HTMLButtonElement)) return;
    if (!(nextBtn instanceof HTMLButtonElement)) return;

    const cfg = state.typeConfig.carousel;

    stripEl.dataset.swipe = 'false';
    stripEl.dataset.pauseOnHover = cfg.pauseOnHover === true ? 'true' : 'false';
    navEl.hidden = true;
    prevBtn.hidden = true;
    nextBtn.hidden = true;
    dotsEl.hidden = true;

    const runtime = {
      ro: null,
      cleanup: () => {},
    };

    const applyTickerVars = () => {
      const listEl = stripEl.querySelector('[data-role="ticker-a"] [data-role="logos"]');
      if (!(listEl instanceof HTMLElement)) return;
      const distancePx = Math.max(0, Math.ceil(listEl.scrollWidth));
      const speed = cfg.speed;
      if (!(typeof speed === 'number' && Number.isFinite(speed) && speed > 0)) return;
      const durationSec = distancePx / speed;

      trackEl.style.setProperty('--ls-ticker-duration', `${durationSec}s`);
      const signed = -distancePx;
      if (cfg.direction === 'right') {
        trackEl.style.setProperty('--ls-ticker-from', `${signed}px`);
        trackEl.style.setProperty('--ls-ticker-to', `0px`);
      } else {
        trackEl.style.setProperty('--ls-ticker-from', `0px`);
        trackEl.style.setProperty('--ls-ticker-to', `${signed}px`);
      }
    };

    applyTickerVars();

    if (typeof ResizeObserver !== 'undefined') {
      runtime.ro = new ResizeObserver(() => applyTickerVars());
      runtime.ro.observe(viewportEl);
    }

    runtime.cleanup = () => {
      if (runtime.ro) runtime.ro.disconnect();
      runtime.ro = null;
    };

    stripBindings.set(stripEl, runtime);
  }

  function bindMotion(state) {
    Array.from(stripsEl.querySelectorAll('[data-role="strip"]')).forEach((stripEl) => {
      cleanupStrip(stripEl);
      if (!(stripEl instanceof HTMLElement)) return;
      if (state.type === 'carousel') {
        if (state.typeConfig.carousel.mode === 'continuous') bindContinuousMotion(stripEl, state);
        else bindPagedMotion(stripEl, state);
      } else {
        // grid: no motion bindings
        const navEl = stripEl.querySelector('[data-role="nav"]');
        const dotsEl = stripEl.querySelector('[data-role="dots"]');
        const prevBtn = stripEl.querySelector('[data-role="arrow"][data-dir="prev"]');
        const nextBtn = stripEl.querySelector('[data-role="arrow"][data-dir="next"]');
        if (navEl instanceof HTMLElement) navEl.hidden = true;
        if (dotsEl instanceof HTMLElement) dotsEl.hidden = true;
        if (prevBtn instanceof HTMLElement) prevBtn.hidden = true;
        if (nextBtn instanceof HTMLElement) nextBtn.hidden = true;
        stripEl.dataset.swipe = 'false';
        stripEl.dataset.pauseOnHover = 'false';
      }
    });
  }

  let lastStripsSignature = '';

  function applyState(state) {
    assertLogoShowcaseState(state);

    if (!window.CKStagePod?.applyStagePod) {
      throw new Error('[LogoShowcase] Missing CKStagePod.applyStagePod');
    }
    window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

    if (!window.CKTypography?.applyTypography) {
      throw new Error('[LogoShowcase] Missing CKTypography.applyTypography');
    }
    window.CKTypography.applyTypography(state.typography, lsRoot, {
      title: { varKey: 'title' },
      body: { varKey: 'body' },
      button: { varKey: 'button' },
    });

    lsRoot.setAttribute('data-type', state.type);
    if (state.type === 'carousel') {
      lsRoot.setAttribute('data-motion', state.typeConfig.carousel.mode);
    } else {
      lsRoot.removeAttribute('data-motion');
    }

    applyLayoutVars(state);
    applyAppearanceVars(state);

    if (!window.CKHeader?.applyHeader) {
      throw new Error('[LogoShowcase] Missing CKHeader.applyHeader');
    }
    window.CKHeader.applyHeader(state, widgetRoot);

    const nextSignature = JSON.stringify([
      state.type,
      state.type === 'carousel' ? state.typeConfig.carousel.mode : 'grid',
      state.behavior.randomOrder === true,
      state.strips,
    ]);
    if (nextSignature !== lastStripsSignature) {
      lastStripsSignature = nextSignature;
      renderStrips(state);
    }

    bindMotion(state);
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.type !== 'ck:state-update') return;
    if (msg.widgetname && msg.widgetname !== 'logoshowcase') return;
    if (resolvedPublicId && msg.publicId && msg.publicId !== resolvedPublicId) return;
    applyState(msg.state);
  });

  const keyedPayload =
    resolvedPublicId &&
    window.CK_WIDGETS &&
    typeof window.CK_WIDGETS === 'object' &&
    window.CK_WIDGETS[resolvedPublicId] &&
    typeof window.CK_WIDGETS[resolvedPublicId] === 'object'
      ? window.CK_WIDGETS[resolvedPublicId]
      : null;
  const initialState = (keyedPayload && keyedPayload.state) || (window.CK_WIDGET && window.CK_WIDGET.state);
  if (initialState) applyState(initialState);
})();
